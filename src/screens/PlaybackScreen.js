import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  Alert,
  ScrollView,
  BackHandler,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import * as Sharing from 'expo-sharing';
import { useTheme } from '../theme/ThemeContext';
import { ScrollingPlaybackTrack } from '../components/Waveform';
import PromptModal from '../components/PromptModal';
import ConfirmModal from '../components/ConfirmModal';
import PlaybackSettingsSheet from '../components/PlaybackSettingsSheet';
import EntryTagSheet from '../components/EntryTagSheet';
import { createPlayer } from '../audio/player';
import { formatDuration } from '../utils/format';
import {
  getEntry,
  renameEntry,
  deleteEntries,
  setTranscript,
  setTranscriptStatus,
  setEntryCategory,
} from '../db/entries';
import { listCategories, nextNameForCategory } from '../db/categories';
import { getGroqApiKey } from '../utils/settingsStore';
import { transcribeSegments } from '../groq/transcribe';

export default function PlaybackScreen({ route, navigation }) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { entryId } = route.params;
  const [entry, setEntry] = useState(null);
  const [categories, setCategories] = useState([]);
  const [positionMs, setPositionMs] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1.0);
  const [skipSilence, setSkipSilence] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [editMenuOpen, setEditMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tagSheetOpen, setTagSheetOpen] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [renamePromptVisible, setRenamePromptVisible] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const playerRef = useRef(null);
  const entryRef = useRef(null);

  const load = useCallback(async () => {
    const e = await getEntry(entryId);
    setEntry(e);
    entryRef.current = e;
    return e;
  }, [entryId]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      listCategories().then(setCategories);
      load().then((e) => {
        if (cancelled || !e) return;
        playerRef.current = createPlayer({
          segments: e.segments,
          onStatus: (s) => {
            setPositionMs(s.positionMs);
            if (s.finished) setIsPlaying(false);
          },
        });
      });
      return () => {
        cancelled = true;
        playerRef.current?.unload();
        playerRef.current = null;
      };
    }, [load])
  );

  // These two dropdowns are plain Views (not RN Modal), so unlike the sheet modals below,
  // Android's back button/gesture won't auto-close them - handle that explicitly.
  useFocusEffect(
    useCallback(() => {
      const onBack = () => {
        if (menuOpen) {
          setMenuOpen(false);
          return true;
        }
        if (editMenuOpen) {
          setEditMenuOpen(false);
          return true;
        }
        return false;
      };
      const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
      return () => sub.remove();
    }, [menuOpen, editMenuOpen])
  );

  if (!entry) {
    return <View style={[styles.container, { backgroundColor: theme.bg }]} />;
  }

  async function togglePlay() {
    if (isPlaying) {
      await playerRef.current?.pause();
      setIsPlaying(false);
    } else {
      await playerRef.current?.play();
      setIsPlaying(true);
    }
  }

  async function skip(deltaMs) {
    await playerRef.current?.skip(deltaMs);
  }

  async function seekTo(ms) {
    await playerRef.current?.seek(ms);
    setPositionMs(ms);
  }

  async function changeSpeed(newSpeed) {
    setSpeed(newSpeed);
    await playerRef.current?.setRate(newSpeed);
  }

  function toggleSkipSilence(next) {
    setSkipSilence(next);
    playerRef.current?.setSkipSilence(next, entry.waveform);
  }

  // --- 3-dot menu actions ---
  async function handleShare() {
    setMenuOpen(false);
    const lastUri = entry.segments[entry.segments.length - 1]?.uri;
    if (lastUri && (await Sharing.isAvailableAsync())) await Sharing.shareAsync(lastUri);
  }

  function handleRename() {
    setMenuOpen(false);
    setRenamePromptVisible(true);
  }

  async function submitRename(text) {
    setRenamePromptVisible(false);
    if (text) {
      await renameEntry(entry.id, text);
      load();
    }
  }

  async function handleRingtone() {
    setMenuOpen(false);
    const lastUri = entry.segments[entry.segments.length - 1]?.uri;
    if (lastUri && (await Sharing.isAvailableAsync())) {
      Alert.alert('Set as ringtone', 'Choose "Set as ringtone" from the share sheet, or save and set it from Sound settings.');
      await Sharing.shareAsync(lastUri);
    }
  }

  function handleDetails() {
    setMenuOpen(false);
    Alert.alert(
      'Details',
      `Category: ${entry.categoryName || 'Untagged'}\nDuration: ${formatDuration(entry.totalDurationMs)}\nSegments: ${entry.segments.length}\nCreated: ${new Date(entry.createdAt).toLocaleString()}`
    );
  }

  function handleDelete() {
    setMenuOpen(false);
    setDeleteModalVisible(true);
  }

  async function confirmDelete() {
    setDeleteModalVisible(false);
    await deleteEntries([entry.id]);
    navigation.goBack();
  }

  function handleOpenTag() {
    setMenuOpen(false);
    setTagSheetOpen(true);
  }

  async function applyTagChange(categoryId) {
    let title = entry.title;
    if (categoryId && categoryId !== entry.categoryId) {
      title = (await nextNameForCategory(categoryId)) || entry.title;
    }
    await setEntryCategory(entry.id, categoryId, title);
    setTagSheetOpen(false);
    load();
    listCategories().then(setCategories);
  }

  async function handleTranscribe() {
    setMenuOpen(false);
    const apiKey = await getGroqApiKey();
    if (!apiKey) {
      Alert.alert('No Groq API key', 'Add your free Groq API key in Settings to enable transcription.');
      return;
    }
    setTranscribing(true);
    await setTranscriptStatus(entry.id, 'pending');
    try {
      const text = await transcribeSegments(entry.segments, apiKey);
      await setTranscript(entry.id, text);
      await load();
      Alert.alert('Transcribed', text.slice(0, 400) + (text.length > 400 ? '…' : ''));
    } catch (e) {
      await setTranscriptStatus(entry.id, 'error');
      Alert.alert('Transcription failed', e.message);
    } finally {
      setTranscribing(false);
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <View style={[styles.topBar, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
          <Feather name="arrow-left" size={22} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.entryTitle, { color: theme.text }]} numberOfLines={1}>
          {entry.title}
        </Text>
        <TouchableOpacity onPress={() => setMenuOpen((v) => !v)} style={styles.iconBtn}>
          <Feather name="more-vertical" size={20} color={theme.text} />
        </TouchableOpacity>
      </View>

      {menuOpen && (
        <>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setMenuOpen(false)} />
          <View style={[styles.dropdown, { top: insets.top + 46, backgroundColor: theme.surface, borderColor: theme.border }]}>
            <TouchableOpacity style={styles.dropdownItem} onPress={handleShare}>
              <Feather name="share-2" size={17} color={theme.text} style={styles.dropdownIcon} />
              <Text style={{ color: theme.text }}>Share</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.dropdownItem} onPress={handleOpenTag}>
              <Feather name="tag" size={17} color={theme.text} style={styles.dropdownIcon} />
              <Text style={{ color: theme.text }}>Tag</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.dropdownItem} onPress={handleRename}>
              <Feather name="edit-2" size={17} color={theme.text} style={styles.dropdownIcon} />
              <Text style={{ color: theme.text }}>Rename</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.dropdownItem} onPress={handleRingtone}>
              <Feather name="bell" size={17} color={theme.text} style={styles.dropdownIcon} />
              <Text style={{ color: theme.text }}>Set as ringtone</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.dropdownItem} onPress={handleTranscribe}>
              <Feather name="file-text" size={17} color={theme.text} style={styles.dropdownIcon} />
              <Text style={{ color: theme.text }}>{transcribing ? 'Transcribing…' : 'Transcribe'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.dropdownItem} onPress={handleDetails}>
              <Feather name="info" size={17} color={theme.text} style={styles.dropdownIcon} />
              <Text style={{ color: theme.text }}>Details</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.dropdownItem} onPress={handleDelete}>
              <Feather name="trash-2" size={17} color="#E5605A" style={styles.dropdownIcon} />
              <Text style={{ color: '#E5605A' }}>Delete</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {editMenuOpen && (
        <>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setEditMenuOpen(false)} />
          <View style={[styles.dropdown, styles.editDropdown, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <TouchableOpacity
              style={styles.dropdownItem}
              onPress={() => {
                setEditMenuOpen(false);
                navigation.navigate('Trim', { entryId: entry.id });
              }}
            >
              <Feather name="crop" size={17} color={theme.text} style={styles.dropdownIcon} />
              <Text style={{ color: theme.text }}>Trim audio</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.dropdownItem}
              onPress={() => {
                setEditMenuOpen(false);
                navigation.navigate('Merge', { entryId: entry.id });
              }}
            >
              <Feather name="git-merge" size={17} color={theme.text} style={styles.dropdownIcon} />
              <Text style={{ color: theme.text }}>Merge audio</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.dropdownItem}
              onPress={() => {
                setEditMenuOpen(false);
                navigation.navigate('Append', { entryId: entry.id });
              }}
            >
              <Feather name="mic" size={17} color={theme.text} style={styles.dropdownIcon} />
              <Text style={{ color: theme.text }}>Append recording</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* Four sections: waveform+ruler gets 2/5, the rest split the remaining 3/5 */}
      <View style={styles.quadrants}>
        <View style={[styles.quadrant, styles.waveformQuadrant]}>
          <View style={styles.waveformWrap}>
            <ScrollingPlaybackTrack
              waveform={entry.waveform}
              positionMs={positionMs}
              totalDurationMs={entry.totalDurationMs}
              color={entry.categoryColor || theme.accent}
              mutedColor={theme.waveformMuted}
              height={190}
              barWidth={3}
              onSeek={seekTo}
            />
          </View>
        </View>

        <View style={[styles.quadrant, styles.centerContent]}>
          <Text style={[styles.bigTime, { color: theme.text }]}>{formatDuration(positionMs)}</Text>
        </View>

        <View style={[styles.quadrant, styles.centerContent]}>
          <Slider
            style={{ width: '100%', height: 36 }}
            minimumValue={0}
            maximumValue={entry.totalDurationMs || 1}
            value={positionMs}
            minimumTrackTintColor={theme.accent}
            maximumTrackTintColor={theme.waveformMuted}
            thumbTintColor={theme.accent}
            onSlidingComplete={seekTo}
          />
          <View style={styles.timeRow}>
            <Text style={{ color: theme.textMuted, fontSize: 12 }}>{formatDuration(positionMs)}</Text>
            <Text style={{ color: theme.textMuted, fontSize: 12 }}>{formatDuration(entry.totalDurationMs)}</Text>
          </View>
        </View>

        <View style={[styles.quadrant, styles.centerContent]}>
          <View style={styles.transportRow}>
            <TouchableOpacity onPress={() => setSettingsOpen(true)} style={styles.iconBtn}>
              <Feather name="sliders" size={22} color={theme.text} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => skip(-5000)} style={styles.iconBtn}>
              <MaterialIcons name="replay-5" size={28} color={theme.text} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={togglePlay}
              style={[styles.playPauseBtn, { backgroundColor: theme.accent }]}
            >
              <Feather name={isPlaying ? 'pause' : 'play'} size={26} color="#fff" style={isPlaying ? undefined : { marginLeft: 3 }} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => skip(5000)} style={styles.iconBtn}>
              <MaterialIcons name="forward-5" size={28} color={theme.text} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setEditMenuOpen((v) => !v)} style={styles.iconBtn}>
              <Feather name="scissors" size={20} color={theme.text} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {entry.transcript && (
        <ScrollView style={styles.transcriptScroll}>
          <View style={[styles.transcriptBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={{ color: theme.textMuted, fontSize: 12, marginBottom: 4 }}>TRANSCRIPT</Text>
            <Text style={{ color: theme.text }}>{entry.transcript}</Text>
          </View>
        </ScrollView>
      )}

      <PlaybackSettingsSheet
        visible={settingsOpen}
        speed={speed}
        skipSilence={skipSilence}
        onChangeSpeed={changeSpeed}
        onToggleSkipSilence={toggleSkipSilence}
        onClose={() => setSettingsOpen(false)}
      />

      <EntryTagSheet
        visible={tagSheetOpen}
        categories={categories}
        currentCategory={categories.find((c) => c.id === entry.categoryId) || null}
        onClose={() => setTagSheetOpen(false)}
        onApply={applyTagChange}
        onCategoriesChanged={() => listCategories().then(setCategories)}
      />

      <PromptModal
        visible={renamePromptVisible}
        title="Rename entry"
        initialValue={entry.title}
        onCancel={() => setRenamePromptVisible(false)}
        onSubmit={submitRename}
      />

      <ConfirmModal
        visible={deleteModalVisible}
        title="Delete this recording?"
        message="This cannot be undone."
        confirmLabel="Delete"
        destructive
        onCancel={() => setDeleteModalVisible(false)}
        onConfirm={confirmDelete}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  entryTitle: { fontSize: 16, fontWeight: '700', flex: 1, marginHorizontal: 8, textAlign: 'center' },
  iconBtn: { padding: 8 },
  dropdown: {
    position: 'absolute',
    right: 16,
    borderWidth: 1,
    borderRadius: 12,
    zIndex: 10,
    overflow: 'hidden',
  },
  editDropdown: {
    bottom: 110,
    right: 24,
    left: undefined,
    top: undefined,
  },
  dropdownItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16 },
  dropdownIcon: { marginRight: 10 },
  quadrants: { flex: 1, paddingHorizontal: 16 },
  quadrant: { flex: 1, justifyContent: 'center' },
  waveformQuadrant: { flex: 2 },
  centerContent: { alignItems: 'center' },
  waveformWrap: { width: '100%' },
  bigTime: { fontSize: 44, fontWeight: '200', fontVariant: ['tabular-nums'] },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginTop: -4 },
  transportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 18,
  },
  playPauseBtn: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  transcriptScroll: { maxHeight: 160, marginHorizontal: 20, marginBottom: 16 },
  transcriptBox: { padding: 14, borderRadius: 12, borderWidth: 1 },
});
