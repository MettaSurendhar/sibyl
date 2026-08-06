import React, { useMemo, useState } from 'react';
import { View, TextInput, TouchableOpacity, FlatList, StyleSheet, Modal } from 'react-native';
import Text from '../theme/Text';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { iconForCategory, colorForCategory, UNTAGGED_COLOR, UNTAGGED_ICON } from '../utils/tagColors';

// value: selected category object or null, categories: full list, onChange(category|null), onCreateNew(name)
export default function TagDropdown({ label, value, categories, onChange, onCreateNew }) {
  const { theme } = useTheme();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    if (!query.trim()) return categories;
    const q = query.toLowerCase();
    return categories.filter((c) => c.name.toLowerCase().includes(q));
  }, [categories, query]);

  const exactMatch = categories.some((c) => c.name.toLowerCase() === query.trim().toLowerCase());
  const canCreate = query.trim().length > 0 && !exactMatch;

  function select(cat) {
    onChange(cat);
    setOpen(false);
    setQuery('');
  }

  async function createAndSelect() {
    const name = query.trim();
    if (!name) return;
    await onCreateNew(name);
    setOpen(false);
    setQuery('');
  }

  return (
    <View style={{ marginBottom: 16 }}>
      {label && <Text style={[styles.label, { color: theme.textMuted }]}>{label}</Text>}
      <TouchableOpacity
        onPress={() => setOpen(true)}
        style={[styles.field, { borderColor: theme.border, backgroundColor: theme.surfaceAlt }]}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          {value ? (
            <>
              <View style={[styles.dot, { backgroundColor: colorForCategory(value) }]} />
              <Feather name={iconForCategory(value)} size={16} color={theme.text} style={{ marginRight: 8 }} />
              <Text style={{ color: theme.text, fontSize: 15 }}>{value.name}</Text>
            </>
          ) : (
            <>
              <View style={[styles.dot, { backgroundColor: UNTAGGED_COLOR }]} />
              <Feather name={UNTAGGED_ICON} size={16} color={theme.textMuted} style={{ marginRight: 8 }} />
              <Text style={{ color: theme.textMuted, fontSize: 15 }}>Untagged (choose a tag...)</Text>
            </>
          )}
        </View>
        <Feather name="chevron-down" size={18} color={theme.textMuted} />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setOpen(false)}>
          <TouchableOpacity activeOpacity={1} style={[styles.sheet, { backgroundColor: theme.surface }]}>
            <View style={[styles.searchRow, { borderColor: theme.border }]}>
              <Feather name="search" size={16} color={theme.textMuted} style={{ marginRight: 8 }} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search or add a tag..."
                placeholderTextColor={theme.textMuted}
                autoFocus
                style={{ flex: 1, color: theme.text, fontSize: 15 }}
              />
            </View>

            <TouchableOpacity onPress={() => select(null)} style={styles.option}>
              <View style={[styles.dot, { backgroundColor: UNTAGGED_COLOR }]} />
              <Feather name={UNTAGGED_ICON} size={16} color={theme.textMuted} style={{ marginRight: 8 }} />
              <Text style={{ color: theme.textMuted }}>Untagged</Text>
            </TouchableOpacity>

            <FlatList
              data={filtered}
              keyExtractor={(c) => c.id}
              style={{ maxHeight: 240 }}
              renderItem={({ item }) => (
                <TouchableOpacity onPress={() => select(item)} style={styles.option}>
                  <View style={[styles.dot, { backgroundColor: colorForCategory(item) }]} />
                  <Feather name={iconForCategory(item)} size={16} color={theme.text} style={{ marginRight: 8 }} />
                  <Text style={{ color: theme.text }}>{item.name}</Text>
                </TouchableOpacity>
              )}
            />

            {canCreate && (
              <TouchableOpacity onPress={createAndSelect} style={[styles.option, styles.createOption]}>
                <Feather name="plus-circle" size={16} color={theme.accent} style={{ marginRight: 8 }} />
                <Text style={{ color: theme.accent, fontWeight: '600' }}>Add "{query.trim()}"</Text>
              </TouchableOpacity>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 13, fontWeight: '600', marginBottom: 6 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 },
  sheet: { borderRadius: 16, padding: 16, maxHeight: 420 },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  option: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 6 },
  createOption: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(128,128,128,0.3)', marginTop: 4 },
});
