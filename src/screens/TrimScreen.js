import React, { useCallback, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, PanResponder, Modal, ActivityIndicator, Alert, BackHandler } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import { useTheme } from '../theme/ThemeContext';
import { StaticWaveform, ScrollingPlaybackTrack } from '../components/Waveform';
import ConfirmModal from '../components/ConfirmModal';
import { createPlayer } from '../audio/player';
import { trimFile, concatFiles } from '../audio/ffmpegModule';
import { getEntry, replaceSegments } from '../db/entries';
import { formatDuration } from '../utils/format';

const SAMPLE_INTERVAL_MS = 100;
const MIN_SELECTION_MS = 500;

function formatCentis(ms) {
  const totalCentis = Math.floor(ms / 10);
  const m = Math.floor(totalCentis / 6000);
  const s = Math.floor((totalCentis % 6000) / 100);
  const cc = totalCentis % 100;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cc).padStart(2, '0')}`;
}

export default function TrimScreen({ route, navigation }) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { entryId } = route.params;
  const [entry, setEntry] = useState(null);
  const [startMs, setStartMs] = useState(0);
  const [endMs, setEndMs] = useState(0);
  const [activeHandle, setActiveHandle] = useState('start'); // 'start' | 'end' - which the zoomed view follows
  const [containerWidth, setContainerWidth] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [previewMs, setPreviewMs] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [discardVisible, setDiscardVisible] = useState(false);
  const playerRef = useRef(null);
  const startMsRef = useRef(0);
  const endMsRef = useRef(0);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      getEntry(entryId).then((e) => {
        if (cancelled || !e) return;
        setEntry(e);
        setStartMs(0);
        setEndMs(e.totalDurationMs);
        startMsRef.current = 0;
        endMsRef.current = e.totalDurationMs;
        playerRef.current = createPlayer({
          segments: e.segments,
          onStatus: (s) => {
            setPreviewMs(s.positionMs);
            if (s.finished || s.positionMs >= endMsRef.current) {
              playerRef.current?.pause();
              setIsPlaying(false);
            }
          },
        });
      });
      return () => {
        cancelled = true;
        playerRef.current?.unload();
        playerRef.current = null;
      };
    }, [entryId])
  );

  const hasChanges = entry && (startMs > 0 || endMs < entry.totalDurationMs);

  useFocusEffect(
    useCallback(() => {
      const onBack = () => {
        if (hasChanges && !processing) {
          setDiscardVisible(true);
          return true;
        }
        return false;
      };
      const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
      return () => sub.remove();
    }, [hasChanges, processing])
  );

  function makeHandlePanResponder(which) {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => setActiveHandle(which),
      onPanResponderMove: (evt) => {
        if (!entry || !containerWidth) return;
        const x = Math.max(0, Math.min(containerWidth, evt.nativeEvent.locationX));
        const ms = (x / containerWidth) * entry.totalDurationMs;
        if (which === 'start') {
          const clamped = Math.max(0, Math.min(ms, endMsRef.current - MIN_SELECTION_MS));
          startMsRef.current = clamped;
          setStartMs(clamped);
        } else {
          const clamped = Math.max(startMsRef.current + MIN_SELECTION_MS, Math.min(ms, entry.totalDurationMs));
          endMsRef.current = clamped;
          setEndMs(clamped);
        }
      },
    });
  }

  const startHandlePan = useRef(makeHandlePanResponder('start')).current;
  const endHandlePan = useRef(makeHandlePanResponder('end')).current;

  // Dragging directly on the zoomed detail view nudges whichever handle it's currently following.
  function handleZoomedSeek(ms) {
    if (!entry) return;
    if (activeHandle === 'start') {
      const clamped = Math.max(0, Math.min(ms, endMsRef.current - MIN_SELECTION_MS));
      startMsRef.current = clamped;
      setStartMs(clamped);
    } else {
      const clamped = Math.max(startMsRef.current + MIN_SELECTION_MS, Math.min(ms, entry.totalDurationMs));
      endMsRef.current = clamped;
      setEndMs(clamped);
    }
  }

  async function togglePreview() {
    if (isPlaying) {
      await playerRef.current?.pause();
      setIsPlaying(false);
      return;
    }
    await playerRef.current?.seek(startMs);
    await playerRef.current?.play();
    setIsPlaying(true);
  }

  function handleReset() {
    if (!entry) return;
    setStartMs(0);
    setEndMs(entry.totalDurationMs);
    startMsRef.current = 0;
    endMsRef.current = entry.totalDurationMs;
  }

  function discardAndExit() {
    setDiscardVisible(false);
    navigation.goBack();
  }

  async function handleSave() {
    if (!entry) return;
    setProcessing(true);
    await playerRef.current?.pause();
    setIsPlaying(false);
    try {
      let sourceUri = entry.segments[0].uri;
      let intermediateUri = null;
      if (entry.segments.length > 1) {
        const merged = await concatFiles(entry.segments.map((s) => s.uri));
        sourceUri = merged.uri;
        intermediateUri = merged.uri;
      }
      const trimmed = await trimFile(sourceUri, startMs, endMs);

      const startIdx = Math.round(startMs / SAMPLE_INTERVAL_MS);
      const endIdx = Math.round(endMs / SAMPLE_INTERVAL_MS);
      const newWaveform = entry.waveform.slice(startIdx, endIdx);

      await replaceSegments(entry.id, {
        uri: trimmed.uri,
        durationMs: endMs - startMs,
        waveform: newWaveform,
      });

      for (const seg of entry.segments) {
        await FileSystem.deleteAsync(seg.uri, { idempotent: true });
      }
      if (intermediateUri) {
        await FileSystem.deleteAsync(intermediateUri, { idempotent: true });
      }
      navigation.goBack();
    } catch (e) {
      Alert.alert('Trim failed', e.message);
    } finally {
      setProcessing(false);
    }
  }

  if (!entry) {
    return <View style={[styles.container, { backgroundColor: theme.bg }]} />;
  }

  const startRatio = entry.totalDurationMs ? startMs / entry.totalDurationMs : 0;
  const endRatio = entry.totalDurationMs ? endMs / entry.totalDurationMs : 1;
  const accent = entry.categoryColor || theme.accent;
  const zoomedPositionMs = activeHandle === 'start' ? startMs : endMs;

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      {/* Top bar: text Cancel/Save, matching the reference recorder app's trim screen */}
      <View style={[styles.topBar, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => (hasChanges ? setDiscardVisible(true) : navigation.goBack())}>
          <Text style={[styles.topBarAction, { color: '#E5605A' }]}>Cancel</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.text }]}>Trim recording</Text>
        <TouchableOpacity onPress={handleSave} disabled={!hasChanges}>
          <Text style={[styles.topBarAction, { color: hasChanges ? accent : theme.textMuted, fontWeight: '700' }]}>Save</Text>
        </TouchableOpacity>
      </View>

      {/* Zoomed detail view - follows whichever handle was last touched, dims the side being cut */}
      <View style={styles.zoomedSection}>
        <ScrollingPlaybackTrack
          waveform={entry.waveform}
          positionMs={zoomedPositionMs}
          totalDurationMs={entry.totalDurationMs}
          color={activeHandle === 'start' ? theme.waveformMuted : accent}
          mutedColor={activeHandle === 'start' ? accent : theme.waveformMuted}
          height={150}
          barWidth={3}
          onSeek={handleZoomedSeek}
        />
      </View>

      <View style={styles.centerInfo}>
        <Text style={[styles.bigTime, { color: theme.text }]}>{formatCentis(zoomedPositionMs)}</Text>
        <Text style={[styles.entryName, { color: theme.textMuted }]} numberOfLines={1}>{entry.title}</Text>
      </View>

      {/* Minimap: full-track overview with draggable start/end handles */}
      <View style={styles.minimapSection}>
        <View style={styles.waveformBox} onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}>
          <StaticWaveform
            waveform={entry.waveform}
            totalDurationMs={entry.totalDurationMs}
            progress={entry.totalDurationMs ? previewMs / entry.totalDurationMs : 0}
            color={accent}
            mutedColor={theme.waveformMuted}
            height={60}
            barWidth={2}
          />
          {containerWidth > 0 && (
            <>
              <View style={[styles.dimOverlay, { left: 0, width: startRatio * containerWidth }]} />
              <View
                style={[
                  styles.dimOverlay,
                  { left: endRatio * containerWidth, width: containerWidth - endRatio * containerWidth },
                ]}
              />
              <View
                {...startHandlePan.panHandlers}
                style={[styles.handle, { left: startRatio * containerWidth - 12, backgroundColor: accent }]}
              >
                <View style={styles.handleGrip} />
              </View>
              <View
                {...endHandlePan.panHandlers}
                style={[styles.handle, { left: endRatio * containerWidth - 12, backgroundColor: accent }]}
              >
                <View style={styles.handleGrip} />
              </View>
            </>
          )}
        </View>
        <View style={styles.labelsRow}>
          <Text style={[styles.labelSmall, { color: theme.textMuted }]}>{formatDuration(startMs)}</Text>
          <Text style={[styles.labelSmall, { color: theme.accent }]}>{formatDuration(endMs - startMs)} selected</Text>
          <Text style={[styles.labelSmall, { color: theme.textMuted }]}>{formatDuration(endMs)}</Text>
        </View>
      </View>

      {/* Bottom icon row: Remove / Play / Trim - matching the reference layout */}
      <View style={[styles.bottomRow, { paddingBottom: insets.bottom + 20 }]}>
        <TouchableOpacity onPress={handleReset} style={styles.bottomIconBtn}>
          <Feather name="trash-2" size={22} color={theme.textMuted} />
          <Text style={[styles.bottomIconLabel, { color: theme.textMuted }]}>Remove</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={togglePreview} style={[styles.playBtn, { backgroundColor: accent }]}>
          <Feather name={isPlaying ? 'pause' : 'play'} size={26} color="#fff" style={isPlaying ? undefined : { marginLeft: 3 }} />
        </TouchableOpacity>
        <TouchableOpacity onPress={handleSave} disabled={!hasChanges} style={styles.bottomIconBtn}>
          <Feather name="scissors" size={22} color={hasChanges ? accent : theme.textMuted} />
          <Text style={[styles.bottomIconLabel, { color: hasChanges ? accent : theme.textMuted }]}>Trim</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={processing} transparent animationType="fade">
        <View style={styles.processingOverlay}>
          <View style={[styles.processingCard, { backgroundColor: theme.surface }]}>
            <ActivityIndicator color={accent} size="large" />
            <Text style={{ color: theme.text, marginTop: 12, fontWeight: '600' }}>Trimming…</Text>
          </View>
        </View>
      </Modal>

      <ConfirmModal
        visible={discardVisible}
        title="Discard trim?"
        message="Your selection hasn't been saved."
        confirmLabel="Discard"
        destructive
        onCancel={() => setDiscardVisible(false)}
        onConfirm={discardAndExit}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 8 },
  topBarAction: { fontSize: 15, fontWeight: '600' },
  title: { fontSize: 16, fontWeight: '700' },
  zoomedSection: { marginTop: 20 },
  centerInfo: { alignItems: 'center', marginTop: 8 },
  bigTime: { fontSize: 36, fontWeight: '200', fontVariant: ['tabular-nums'] },
  entryName: { fontSize: 13, marginTop: 2 },
  minimapSection: { marginTop: 'auto', paddingHorizontal: 36 },
  waveformBox: { position: 'relative' },
  dimOverlay: { position: 'absolute', top: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.55)' },
  handle: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 24,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  handleGrip: { width: 3, height: 20, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.8)' },
  labelsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  labelSmall: { fontSize: 12, fontWeight: '600' },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginTop: 24,
    paddingHorizontal: 20,
  },
  bottomIconBtn: { alignItems: 'center' },
  bottomIconLabel: { fontSize: 12, marginTop: 4, fontWeight: '600' },
  playBtn: { width: 66, height: 66, borderRadius: 33, alignItems: 'center', justifyContent: 'center' },
  processingOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
  processingCard: { padding: 28, borderRadius: 16, alignItems: 'center', width: '70%' },
});
