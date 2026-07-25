import React, { useEffect, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, TextInput, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import TagDropdown from './TagDropdown';
import { createCategory, previewNameForCategory } from '../db/categories';

// visible, categories (refreshed by parent), suggestedUntaggedName, onSkip(name), onConfirm(categoryId, name), onClose, onCategoriesChanged
export default function CategorySheet({
  visible,
  categories,
  suggestedUntaggedName,
  onSkip,
  onConfirm,
  onClose,
  onCategoriesChanged,
}) {
  const { theme } = useTheme();
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [name, setName] = useState('');
  const [nameEditedByUser, setNameEditedByUser] = useState(false);

  useEffect(() => {
    if (visible) {
      setSelectedCategory(null);
      setName(suggestedUntaggedName || '');
      setNameEditedByUser(false);
    }
  }, [visible, suggestedUntaggedName]);

  async function handleSelectCategory(cat) {
    setSelectedCategory(cat);
    if (!nameEditedByUser) {
      setName(cat ? await previewNameForCategory(cat) : suggestedUntaggedName || '');
    }
  }

  async function handleCreateNew(newName) {
    const id = await createCategory({ name: newName, prefix: newName });
    await onCategoriesChanged?.();
    const fakeCat = { id, name: newName, counter: 0, color: '#6C8EF5' };
    handleSelectCategory(fakeCat);
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { backgroundColor: theme.surface }]}>
          <View style={styles.headerRow}>
            <Text style={[styles.title, { color: theme.text }]}>Tag this recording</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Feather name="x" size={20} color={theme.textMuted} />
            </TouchableOpacity>
          </View>

          <TagDropdown
            label="Tag"
            value={selectedCategory}
            categories={categories}
            onChange={handleSelectCategory}
            onCreateNew={handleCreateNew}
          />

          <Text style={[styles.label, { color: theme.textMuted }]}>Name</Text>
          <TextInput
            value={name}
            onChangeText={(t) => {
              setName(t);
              setNameEditedByUser(true);
            }}
            style={[styles.input, { color: theme.text, borderColor: theme.border }]}
            placeholder="Entry name"
            placeholderTextColor={theme.textMuted}
          />

          <View style={styles.row}>
            <TouchableOpacity
              style={[styles.btn, { backgroundColor: theme.surfaceAlt }]}
              onPress={() => onSkip(name || suggestedUntaggedName)}
            >
              <Text style={{ color: theme.text, fontWeight: '600' }}>Skip / tag later</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, { backgroundColor: theme.accent }]}
              onPress={() => onConfirm(selectedCategory?.id || null, name || suggestedUntaggedName)}
            >
              <Text style={{ color: '#fff', fontWeight: '700' }}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { padding: 20, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  title: { fontSize: 18, fontWeight: '700' },
  closeBtn: { padding: 4 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 16, marginBottom: 20 },
  row: { flexDirection: 'row', gap: 12 },
  btn: { flex: 1, padding: 14, borderRadius: 12, alignItems: 'center' },
});
