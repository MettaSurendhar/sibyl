import React, { useCallback, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, Modal, ActivityIndicator, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import { useTheme } from '../theme/ThemeContext';
import ConfirmModal from '../components/ConfirmModal';
import PromptModal from '../components/PromptModal';
import { concatFiles } from '../audio/ffmpegModule';
import { listEntries, getEntry, replaceSegments, deleteEntries, renameEntry } from '../db/entries';
import { formatDuration } from '../utils/format';

export default function MergeScreen({ route, navigation }) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { entryId } = route.params;
  const [currentEntry, setCurrentEntry] = useState(null);
  const [others, setOthers] = useState([]);
  const [search, setSearch] = useState('');
  const [targetId, setTargetId] = useState(null);
  const [currentFirst, setCurrentFirst] = useState(true);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [renamePromptVisible, setRenamePromptVisible] = useState(false);
  const [processing, setProcessing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      getEntry(entryId).then((e) => !cancelled && setCurrentEntry(e));
      listEntries().then((all) => !cancelled && setOthers(all.filter((e) => e.id !== entryId)));
      return () => {
        cancelled = true;
      };
    }, [entryId])
  );

  const filtered = others.filter((e) => e.title.toLowerCase().includes(search.toLowerCase()));
  const target = others.find((e) => e.id === targetId) || null;

  async function performMerge(newTitle) {
    setConfirmVisible(false);
    setProcessing(true);
    try {
      const orderedEntries = currentFirst ? [currentEntry, target] : [target, currentEntry];
      const orderedUris = orderedEntries.flatMap((e) => e.segments.map((s) => s.uri));
      const orderedWaveform = orderedEntries.flatMap((e) => e.waveform);

      const merged = await concatFiles(orderedUris);
      const combinedDurationMs = currentEntry.totalDurationMs + target.totalDurationMs;

      await replaceSegments(currentEntry.id, {
        uri: merged.uri,
        durationMs: combinedDurationMs,
        waveform: orderedWaveform,
      });
      if (newTitle) await renameEntry(currentEntry.id, newTitle);

      for (const uri of orderedUris) {
        await FileSystem.deleteAsync(uri, { idempotent: true });
      }
      await deleteEntries([target.id]);

      navigation.goBack();
    } catch (e) {
      Alert.alert('Merge failed', e.message);
    } finally {
      setProcessing(false);
    }
  }

  if (!currentEntry) {
    return <View style={[styles.container, { backgroundColor: theme.bg }]} />;
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <View style={[styles.topBar, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
          <Feather name="arrow-left" size={22} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.text }]}>Merge recording</Text>
        <View style={{ width: 22 }} />
      </View>

      <View style={[styles.searchWrap, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Feather name="search" size={16} color={theme.textMuted} style={{ marginRight: 8 }} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search recordings to merge with..."
          placeholderTextColor={theme.textMuted}
          style={{ flex: 1, color: theme.text, fontSize: 15 }}
        />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(e) => e.id}
        contentContainerStyle={{ padding: 16, paddingTop: 8 }}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => setTargetId(targetId === item.id ? null : item.id)}
            style={[
              styles.row,
              { borderColor: targetId === item.id ? theme.accent : theme.border, backgroundColor: theme.surface },
            ]}
          >
            <Feather
              name={targetId === item.id ? 'check-circle' : 'circle'}
              size={20}
              color={targetId === item.id ? theme.accent : theme.textMuted}
              style={{ marginRight: 12 }}
            />
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.text, fontWeight: '600' }} numberOfLines={1}>{item.title}</Text>
              <Text style={{ color: theme.textMuted, fontSize: 12 }}>{item.categoryName || 'Untagged'}</Text>
            </View>
            <Text style={{ color: theme.textMuted, fontSize: 13 }}>{formatDuration(item.totalDurationMs)}</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <Text style={{ color: theme.textMuted, textAlign: 'center', marginTop: 40 }}>
            No other recordings to merge with.
          </Text>
        }
      />

      {target && (
        <View style={[styles.orderCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.orderLabel, { color: theme.textMuted }]}>PLAY ORDER</Text>
          <View style={styles.orderRow}>
            <View style={[styles.orderChip, { backgroundColor: theme.surfaceAlt }]}>
              <Text style={{ color: theme.text, fontWeight: '600' }} numberOfLines={1}>
                {currentFirst ? currentEntry.title : target.title}
              </Text>
            </View>
            <TouchableOpacity onPress={() => setCurrentFirst((v) => !v)} style={styles.swapBtn}>
              <Feather name="repeat" size={18} color={theme.accent} />
            </TouchableOpacity>
            <View style={[styles.orderChip, { backgroundColor: theme.surfaceAlt }]}>
              <Text style={{ color: theme.text, fontWeight: '600' }} numberOfLines={1}>
                {currentFirst ? target.title : currentEntry.title}
              </Text>
            </View>
          </View>
        </View>
      )}

      <View style={[styles.bottomRow, { paddingBottom: insets.bottom + 20 }]}>
        <TouchableOpacity
          disabled={!target}
          onPress={() => setConfirmVisible(true)}
          style={[styles.mergeBtn, { backgroundColor: target ? theme.accent : theme.surfaceAlt }]}
        >
          <Text style={{ color: target ? '#fff' : theme.textMuted, fontWeight: '700' }}>Merge</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={processing} transparent animationType="fade">
        <View style={styles.processingOverlay}>
          <View style={[styles.processingCard, { backgroundColor: theme.surface }]}>
            <ActivityIndicator color={theme.accent} size="large" />
            <Text style={{ color: theme.text, marginTop: 12, fontWeight: '600' }}>Merging…</Text>
          </View>
        </View>
      </Modal>

      <ConfirmModal
        visible={confirmVisible}
        title="Merge these recordings?"
        message="This combines both into one and deletes the other - this cannot be undone."
        confirmLabel="Merge"
        destructive
        onCancel={() => setConfirmVisible(false)}
        onConfirm={() => {
          setConfirmVisible(false);
          setRenamePromptVisible(true);
        }}
      />

      <PromptModal
        visible={renamePromptVisible}
        title="Name the merged recording"
        initialValue={currentEntry.title}
        onCancel={() => {
          setRenamePromptVisible(false);
          performMerge(null);
        }}
        onSubmit={(text) => {
          setRenamePromptVisible(false);
          performMerge(text);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, paddingBottom: 8 },
  iconBtn: { padding: 8 },
  title: { fontSize: 16, fontWeight: '700' },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 42,
  },
  row: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 10 },
  orderCard: { marginHorizontal: 16, marginBottom: 12, padding: 14, borderRadius: 12, borderWidth: 1 },
  orderLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginBottom: 10 },
  orderRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  orderChip: { flex: 1, padding: 10, borderRadius: 10 },
  swapBtn: { padding: 8 },
  bottomRow: { paddingHorizontal: 20 },
  mergeBtn: { paddingVertical: 15, borderRadius: 12, alignItems: 'center' },
  processingOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
  processingCard: { padding: 28, borderRadius: 16, alignItems: 'center', width: '70%' },
});
