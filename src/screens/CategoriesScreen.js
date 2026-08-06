import React, { useCallback, useState } from 'react';
import { View, TextInput, TouchableOpacity, FlatList, ScrollView, StyleSheet, Modal } from 'react-native';
import Text from '../theme/Text';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import {
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  getCategoryEntryCount,
} from '../db/categories';
import { renderTemplate } from '../utils/naming';
import ConfirmModal from '../components/ConfirmModal';
import TemplateChipEditor from '../components/TemplateChipEditor';
import { TAG_COLOR_PALETTE, TAG_ICON_PRESETS, iconForCategory } from '../utils/tagColors';

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
  const [editMode, setEditMode] = useState('main');
  const [deleteTarget, setDeleteTarget] = useState(null);

  const refresh = useCallback(async () => {
    let cats = await listCategories();

    // Quick migration: if an icon is not a valid feather icon (contains emojis), set to default
    let migrated = false;
    for (const c of cats) {
      if (c.icon && !/^[a-z0-9\-]+$/.test(c.icon)) {
        await updateCategory(c.id, { ...c, icon: 'tag' });
        migrated = true;
      }
    }
    if (migrated) {
      cats = await listCategories();
    }

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
    const icon = TAG_ICON_PRESETS[categories.length % TAG_ICON_PRESETS.length];
    await createCategory({ name, prefix: name, color, icon });
    setNewName('');
    refresh();
  }

  function openEdit(cat) {
    setEditTarget(cat);
    setEditName(cat.name);
    const nextTag = cat.nameTemplate || '{tag} <count>';
    setEditTemplate(nextTag);
    setEditColor(cat.color);
    setEditIcon(cat.icon);
    setEditMode('main');
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
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={[styles.headerBtn, { backgroundColor: theme.surfaceAlt }]}
        >
          <Feather
            name='arrow-left'
            size={22}
            color={theme.textMuted}
          />
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
          <Feather name="plus" size={18} color={theme.accentDeep} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={categories}
        keyExtractor={(c) => c.id}
        contentContainerStyle={{ padding: 20 }}
        renderItem={({ item }) => (
          <View style={[styles.catRow, { borderColor: theme.border }]}>
            <View style={[styles.swatch, { backgroundColor: item.color }]} />
            <MaterialCommunityIcons name={iconForCategory(item)} size={18} color={theme.text} style={{ marginRight: 10 }} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.text, fontWeight: '600' }}>{item.name}</Text>
              <Text style={{ color: theme.textMuted, fontSize: 12 }}>
                Next name: {renderTemplate(item.nameTemplate || '{tag} <count>', { tag: item.name, count: (counts[item.id] || 0) + 1 })}
              </Text>
            </View>
            <TouchableOpacity onPress={() => openEdit(item)} style={[styles.catAction, { backgroundColor: theme.surfaceAlt }]}>
              <Feather name="edit-2" size={16} color={theme.text} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleDelete(item)} style={[styles.catAction, { backgroundColor: theme.surfaceAlt }]}>
              <Feather name="trash-2" size={16} color="#E5605A" />
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

              <View style={{ flexDirection: 'row', gap: 12, marginBottom: 14, zIndex: 10 }}>
                <View style={{ flex: 1, zIndex: editMode === 'color' ? 20 : 1 }}>
                  <Text style={[styles.label, { color: theme.textMuted }]}>Color</Text>
                  <TouchableOpacity onPress={() => setEditMode(editMode === 'color' ? 'main' : 'color')} style={[styles.modalInput, { alignItems: 'center', justifyContent: 'center', borderColor: theme.border, backgroundColor: theme.surfaceAlt }]}>
                    <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: editColor, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' }} />
                  </TouchableOpacity>

                  {editMode === 'color' && (
                    <View style={{ height: 160, marginTop: 4, borderWidth: 1, borderColor: theme.border, borderRadius: 12, backgroundColor: theme.surfaceAlt, overflow: 'hidden', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 2 }}>
                      <ScrollView nestedScrollEnabled contentContainerStyle={{ flexDirection: 'row', flexWrap: 'wrap', padding: 8, justifyContent: 'center' }}>
                        {TAG_COLOR_PALETTE.map((color) => (
                          <TouchableOpacity
                            key={color}
                            onPress={() => { setEditColor(color); setEditMode('main'); }}
                            style={{ width: '50%', padding: 6, alignItems: 'center' }}
                          >
                            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: color, borderWidth: editColor === color ? 3 : 1, borderColor: editColor === color ? theme.text : 'rgba(255,255,255,0.1)' }} />
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  )}
                </View>

                <View style={{ flex: 1, zIndex: editMode === 'icon' ? 20 : 1 }}>
                  <Text style={[styles.label, { color: theme.textMuted }]}>Icon</Text>
                  <TouchableOpacity onPress={() => setEditMode(editMode === 'icon' ? 'main' : 'icon')} style={[styles.modalInput, { alignItems: 'center', justifyContent: 'center', borderColor: theme.border, backgroundColor: theme.surfaceAlt }]}>
                    <MaterialCommunityIcons name={iconForCategory({ icon: editIcon })} size={20} color={theme.text} />
                  </TouchableOpacity>

                  {editMode === 'icon' && (
                    <View style={{ height: 160, marginTop: 4, borderWidth: 1, borderColor: theme.border, borderRadius: 12, backgroundColor: theme.surfaceAlt, overflow: 'hidden', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 2 }}>
                      <ScrollView nestedScrollEnabled contentContainerStyle={{ flexDirection: 'row', flexWrap: 'wrap', padding: 8, justifyContent: 'center' }}>
                        {TAG_ICON_PRESETS.map((iconName) => (
                          <TouchableOpacity
                            key={iconName}
                            onPress={() => { setEditIcon(iconName); setEditMode('main'); }}
                            style={{ width: '50%', padding: 6, alignItems: 'center' }}
                          >
                            <View style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: editIcon === iconName ? 2 : 1, borderColor: editIcon === iconName ? theme.accent : theme.border, backgroundColor: editIcon === iconName ? `${theme.accent}22` : 'transparent' }}>
                              <MaterialCommunityIcons name={iconName} size={18} color={theme.text} />
                            </View>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  )}
                </View>
              </View>

              <Text style={[styles.label, { color: theme.textMuted, marginTop: 4 }]}>Naming format</Text>
              <TemplateChipEditor
                value={editTemplate}
                onChange={setEditTemplate}
                availableTokens={[
                  { token: '{tag}', label: 'Tag' },
                  { token: '<count>', label: 'Count' },
                  { token: '<date:DD-MM-YYYY>', label: 'Date' },
                  { token: '<time:hh:mm>', label: 'Time' },
                ]}
              />

              <Text style={[styles.label, { color: theme.textMuted, marginTop: 14, marginBottom: 8 }]}>Preview</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14, gap: 12, padding: 12, backgroundColor: theme.surfaceAlt, borderRadius: 12, borderWidth: 1, borderColor: theme.border }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 12, backgroundColor: `${editColor}22`, borderColor: editColor, borderWidth: 1 }}>
                  <MaterialCommunityIcons name={iconForCategory({ icon: editIcon })} size={12} color={editColor} style={{ marginRight: 4 }} />
                  <Text style={{ color: editColor, fontSize: 12, fontWeight: '700' }}>{editName || 'Tag'}</Text>
                </View>
                <Text style={{ color: theme.text, fontSize: 13, flex: 1 }} numberOfLines={1}>
                  {renderTemplate(editTemplate, { tag: editName || 'Tag', count: previewCount })}.m4a
                </Text>
              </View>

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
  headerBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  addRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingTop: 16 },
  input: { flex: 1, borderWidth: 1, borderRadius: 12, padding: 12 },
  addBtn: { width: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  catRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 10 },
  swatch: { width: 14, height: 14, borderRadius: 7, marginRight: 12 },
  catAction: { marginLeft: 10, width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  editCard: { width: '88%', maxHeight: '80%', borderRadius: 16, padding: 20 },
  editTitle: { fontSize: 20, fontWeight: '700', marginBottom: 16 },
  backBtn: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
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
  iconSwatch: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
});
