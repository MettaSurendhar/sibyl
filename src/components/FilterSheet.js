import React, { useState } from 'react';
import { Modal, View, TouchableOpacity, ScrollView, StyleSheet, Platform } from 'react-native';
import Text from '../theme/Text';
import { Feather } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTheme } from '../theme/ThemeContext';

const DATE_PRESETS = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'thisWeek', label: 'This week' },
  { key: 'lastWeek', label: 'Last week' },
  { key: 'thisMonth', label: 'This month' },
  { key: 'lastMonth', label: 'Last month' },
  { key: 'custom', label: 'Custom range' },
];

// value: { tagIds: string[], datePreset: string|null, customRange: [start,end]|null }
export default function FilterSheet({ visible, categories, value, onChange, onClose }) {
  const { theme } = useTheme();
  const [pickerTarget, setPickerTarget] = useState(null); // 'start' | 'end' | null

  function toggleTag(id) {
    const has = value.tagIds.includes(id);
    onChange({
      ...value,
      tagIds: has ? value.tagIds.filter((x) => x !== id) : [...value.tagIds, id],
    });
  }

  function selectPreset(key) {
    if (key === value.datePreset) {
      onChange({ ...value, datePreset: null, customRange: null });
    } else {
      onChange({ ...value, datePreset: key, customRange: key === 'custom' ? value.customRange || [Date.now(), Date.now()] : null });
    }
  }

  function clearAll() {
    onChange({ tagIds: [], datePreset: null, customRange: null });
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { backgroundColor: theme.surface }]}>
          <View style={styles.headerRow}>
            <Text style={[styles.title, { color: theme.text }]}>Filter</Text>
            <TouchableOpacity onPress={onClose} style={[styles.headerBtn, { backgroundColor: theme.surfaceAlt }]}>
              <Feather name="x" size={20} color={theme.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ maxHeight: 420 }}>
            <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>TAG</Text>
            <View style={styles.chipWrap}>
              {categories.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  onPress={() => toggleTag(c.id)}
                  style={[
                    styles.chip,
                    { borderColor: theme.border, backgroundColor: value.tagIds.includes(c.id) ? c.color : 'transparent' },
                  ]}
                >
                  <Text style={{ color: value.tagIds.includes(c.id) ? '#fff' : theme.text }}>{c.name}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.sectionLabel, { color: theme.textMuted, marginTop: 20 }]}>DATE</Text>
            <View style={styles.chipWrap}>
              {DATE_PRESETS.map((p) => (
                <TouchableOpacity
                  key={p.key}
                  onPress={() => selectPreset(p.key)}
                  style={[
                    styles.chip,
                    { borderColor: theme.border, backgroundColor: value.datePreset === p.key ? theme.accent : 'transparent' },
                  ]}
                >
                  <Text style={{ color: value.datePreset === p.key ? '#fff' : theme.text }}>{p.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {value.datePreset === 'custom' && (
              <View style={styles.rangeRow}>
                <TouchableOpacity
                  style={[styles.rangeBtn, { borderColor: theme.border }]}
                  onPress={() => setPickerTarget('start')}
                >
                  <Text style={{ color: theme.text }}>
                    From: {new Date(value.customRange?.[0] || Date.now()).toLocaleDateString()}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.rangeBtn, { borderColor: theme.border }]}
                  onPress={() => setPickerTarget('end')}
                >
                  <Text style={{ color: theme.text }}>
                    To: {new Date(value.customRange?.[1] || Date.now()).toLocaleDateString()}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>

          <View style={styles.footerRow}>
            <TouchableOpacity onPress={onClose} style={[styles.footerBtn, { backgroundColor: theme.surfaceAlt }]}>
              <Text style={{ color: theme.text, fontWeight: '600' }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={clearAll} style={[styles.footerBtn, { backgroundColor: theme.accent }]}>
              <Text style={{ color: theme.accentDeep, fontWeight: '700' }}>Clear filters</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {pickerTarget && (
        <DateTimePicker
          value={new Date(value.customRange?.[pickerTarget === 'start' ? 0 : 1] || Date.now())}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          onChange={(event, selected) => {
            setPickerTarget(null);
            if (!selected) return;
            const range = [...(value.customRange || [Date.now(), Date.now()])];
            range[pickerTarget === 'start' ? 0 : 1] = selected.getTime();
            onChange({ ...value, customRange: range });
          }}
        />
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { padding: 20, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  headerBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '700' },
  sectionLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  chip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1 },
  rangeRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  rangeBtn: { flex: 1, borderWidth: 1, borderRadius: 10, padding: 10, alignItems: 'center' },
  footerRow: { flexDirection: 'row', gap: 12, marginTop: 16 },
  footerBtn: { flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: 'center' },
});
