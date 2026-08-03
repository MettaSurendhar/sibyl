import React, { useCallback, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, ScrollView, StyleSheet, Modal } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import {
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  getCategoryEntryCount,
} from '../db/categories';
import { renderTemplate, DATE_FORMAT_PRESETS, TIME_FORMAT_PRESETS } from '../utils/naming';
import ConfirmModal from '../components/ConfirmModal';
import { TAG_COLOR_PALETTE, TAG_EMOJI_PRESETS, iconForCategory } from '../utils/tagColors';

export default function CategoriesScreen({ navigation }) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [categories, setCategories] = useState([]);
  const [counts, setCounts] = useState({});
  const [newName, setNewName] = useState('');
  const [editTarget, setEditTarget] = useState(null);
  const [editName, setEditName] = useState('');
  const [editTemplate, setEditTemplate] = useState('');
  const [editColor, setEditColor] = useState(null);
  const [editIcon, setEditIcon] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const refresh = useCallback(async () => {
    const cats = await listCategories();
    setCategories(cats);
    const countPairs = await Promise.all(cats.map(async (c) => [c.id, await getCategoryEntryCount(c.id)]));
    setCounts(Object.fromEntries(countPairs));
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  async function handleAdd() {
    const name = newName.trim();
    if (!name) return;
    const color = TAG_COLOR_PALETTE[categories.length % TAG_COLOR_PALETTE.length];
    const icon = TAG_EMOJI_PRESETS[categories.length % TAG_EMOJI_PRESETS.length];
    await createCategory({ name, prefix: name, color, icon });
    setNewName('');
    refresh();
  }

  function openEdit(cat) {
    setEditTarget(cat);
    setEditName(cat.name);
    setEditTemplate(cat.nameTemplate || '{tag} <count>');
    setEditColor(cat.color);
    setEditIcon(cat.icon);
  }

  async function saveEdit() {
    if (!editTarget) return;
    await updateCategory(editTarget.id, {
      name: editName,
      prefix: editName,
      color: editColor,
      icon: editIcon,
      nameTemplate: editTemplate,
    });
    setEditTarget(null);
    refresh();
  }

  function insertDateFormat(pattern) {
    setEditTemplate((prev) => {
      const cleaned = prev.replace(/<date(:[^>]+)?>/g, '').trim();
      return `${cleaned} <date:${pattern}>`.trim();
    });
  }

  function insertTimeFormat(pattern) {
    setEditTemplate((prev) => {
      const cleaned = prev.replace(/<time(:[^>]+)?>/g, '').trim();
      return `${cleaned} <time:${pattern}>`.trim();
    });
  }

  function handleDelete(cat) {
    setDeleteTarget(cat);
  }

  async function confirmDelete() {
    if (deleteTarget) {
      await deleteCategory(deleteTarget.id);
      setDeleteTarget(null);
      refresh();
    }
  }

  const previewCount = editTarget ? (counts[editTarget.id] || 0) + 1 : 1;

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Feather name="arrow-left" size={22} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Tags</Text>
        <View style={{ width: 22 }} />
      </View>

      <View style={styles.addRow}>
        <TextInput
          value={newName}
          onChangeText={setNewName}
          placeholder="New tag name (e.g. Ideas)"
          placeholderTextColor={theme.textMuted}
          style={[styles.input, { color: theme.text, borderColor: theme.border }]}
          onSubmitEditing={handleAdd}
        />
        <TouchableOpacity onPress={handleAdd} style={[styles.addBtn, { backgroundColor: theme.accent }]}>
          <Feather name="plus" size={18} color="#fff" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={categories}
        keyExtractor={(c) => c.id}
        contentContainerStyle={{ padding: 20 }}
        renderItem={({ item }) => (
          <View style={[styles.catRow, { borderColor: theme.border }]}>
            <View style={[styles.swatch, { backgroundColor: item.color }]} />
            <Text style={{ fontSize: 16, marginRight: 8 }}>{iconForCategory(item)}</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.text, fontWeight: '600' }}>{item.name}</Text>
              <Text style={{ color: theme.textMuted, fontSize: 12 }}>
                Next name: {renderTemplate(item.nameTemplate || '{tag} <count>', { tag: item.name, count: (counts[item.id] || 0) + 1 })}
              </Text>
            </View>
            <TouchableOpacity onPress={() => openEdit(item)} style={styles.catAction}>
              <Feather name="edit-2" size={17} color={theme.text} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleDelete(item)} style={styles.catAction}>
              <Feather name="trash-2" size={17} color="#E5605A" />
            </TouchableOpacity>
          </View>
        )}
      />

      <Modal visible={!!editTarget} transparent animationType="fade" onRequestClose={() => setEditTarget(null)}>
        <View style={styles.backdrop}>
          <View style={[styles.editCard, { backgroundColor: theme.surface }]}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={[styles.editTitle, { color: theme.text }]}>Edit tag</Text>

              <Text style={[styles.label, { color: theme.textMuted }]}>Name</Text>
              <TextInput
                value={editName}
                onChangeText={setEditName}
                style={[styles.modalInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.surfaceAlt, marginBottom: 14 }]}
              />

              <Text style={[styles.label, { color: theme.textMuted }]}>Color</Text>
              <View style={styles.colorRow}>
                {TAG_COLOR_PALETTE.map((color) => (
                  <TouchableOpacity
                    key={color}
                    onPress={() => setEditColor(color)}
                    style={[
                      styles.colorSwatch,
                      { backgroundColor: color, borderWidth: editColor === color ? 3 : 0, borderColor: theme.text }
                    ]}
                  />
                ))}
              </View>

              <Text style={[styles.label, { color: theme.textMuted, marginTop: 14 }]}>Icon</Text>
              <View style={styles.emojiRow}>
                {TAG_EMOJI_PRESETS.map((emoji) => (
                  <TouchableOpacity
                    key={emoji}
                    onPress={() => setEditIcon(emoji)}
                    style={[
                      styles.emojiBtn,
                      { backgroundColor: editIcon === emoji ? theme.surfaceAlt : 'transparent' }
                    ]}
                  >
                    <Text style={{ fontSize: 20 }}>{emoji}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.label, { color: theme.textMuted, marginTop: 14 }]}>Naming format</Text>
              <TextInput
                value={editTemplate}
                onChangeText={setEditTemplate}
                style={[styles.modalInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.surfaceAlt }]}
                placeholder="{tag} <count>"
                placeholderTextColor={theme.textMuted}
              />
              <Text style={[styles.hint, { color: theme.textMuted }]}>
                Tokens: {'{tag}'}, {'<count>'}, {'<date:PATTERN>'}, {'<time:PATTERN>'}. Tap a preset below to insert it.
              </Text>

              <Text style={[styles.presetLabel, { color: theme.textMuted }]}>DATE FORMAT</Text>
              <View style={styles.presetWrap}>
                {DATE_FORMAT_PRESETS.map((p) => (
                  <TouchableOpacity
                    key={p.key}
                    onPress={() => insertDateFormat(p.pattern)}
                    style={[styles.presetChip, { borderColor: theme.border }]}
                  >
                    <Text style={{ color: theme.text, fontSize: 12 }}>{p.key}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.presetLabel, { color: theme.textMuted, marginTop: 14 }]}>TIME FORMAT</Text>
              <View style={styles.presetWrap}>
                {TIME_FORMAT_PRESETS.map((p) => (
                  <TouchableOpacity
                    key={p.key}
                    onPress={() => insertTimeFormat(p.pattern)}
                    style={[styles.presetChip, { borderColor: theme.border }]}
                  >
                    <Text style={{ color: theme.text, fontSize: 12 }}>{p.key}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.hint, { color: theme.textMuted, marginTop: 14 }]}>
                Preview: {renderTemplate(editTemplate, { tag: editName, count: previewCount })}
              </Text>

              <View style={styles.row}>
                <TouchableOpacity style={[styles.btn, { backgroundColor: theme.surfaceAlt }]} onPress={() => setEditTarget(null)}>
                  <Text style={{ color: theme.text, fontWeight: '600' }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.btn, { backgroundColor: theme.accent }]} onPress={saveEdit}>
                  <Text style={{ color: '#fff', fontWeight: '700' }}>Save</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <ConfirmModal
        visible={!!deleteTarget}
        title="Delete tag?"
        message={`Entries tagged "${deleteTarget?.name}" will become untagged, not deleted.`}
        confirmLabel="Delete"
        destructive
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, paddingBottom: 0 },
  headerTitle: { fontSize: 20, fontWeight: '700' },
  addRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingTop: 16 },
  input: { flex: 1, borderWidth: 1, borderRadius: 12, padding: 12 },
  addBtn: { width: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  catRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 10 },
  swatch: { width: 14, height: 14, borderRadius: 7, marginRight: 12 },
  catAction: { marginLeft: 14 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  editCard: { width: '88%', maxHeight: '80%', borderRadius: 16, padding: 20 },
  editTitle: { fontSize: 17, fontWeight: '700', marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 6 },
  modalInput: { borderWidth: 1, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12, fontSize: 15 },
  hint: { fontSize: 12, marginTop: 6, lineHeight: 17 },
  presetLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.4, marginTop: 4 },
  presetWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  presetChip: { borderWidth: 1, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10 },
  row: { flexDirection: 'row', gap: 12, marginTop: 20 },
  btn: { flex: 1, padding: 12, borderRadius: 10, alignItems: 'center' },
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
  colorSwatch: { width: 30, height: 30, borderRadius: 15 },
  emojiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 },
  emojiBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
});
