import React, { useEffect, useState } from 'react';
import { Modal, View, TouchableOpacity, StyleSheet } from 'react-native';
import Text from '../theme/Text';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import TagDropdown from './TagDropdown';
import { createCategory } from '../db/categories';

// visible, categories, currentCategory (or null), onClose, onApply(categoryId|null)
export default function EntryTagSheet({ visible, categories, currentCategory, onClose, onApply, onCategoriesChanged }) {
  const { theme } = useTheme();
  const [selected, setSelected] = useState(currentCategory || null);

  useEffect(() => {
    if (visible) setSelected(currentCategory || null);
  }, [visible, currentCategory]);

  async function handleCreateNew(name) {
    const id = await createCategory({ name, prefix: name });
    await onCategoriesChanged?.();
    setSelected({ id, name, counter: 0, color: '#6C8EF5' });
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { backgroundColor: theme.surface }]}>
          <View style={styles.headerRow}>
            <Text style={[styles.title, { color: theme.text }]}>Change tag</Text>
            <TouchableOpacity onPress={onClose}>
              <Feather name="x" size={20} color={theme.textMuted} />
            </TouchableOpacity>
          </View>

          <TagDropdown
            label="Tag"
            value={selected}
            categories={categories}
            onChange={setSelected}
            onCreateNew={handleCreateNew}
          />

          <TouchableOpacity
            style={[styles.applyBtn, { backgroundColor: theme.accent }]}
            onPress={() => onApply(selected?.id || null)}
          >
            <Text style={{ color: '#fff', fontWeight: '700' }}>Apply</Text>
          </TouchableOpacity>
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
  applyBtn: { padding: 14, borderRadius: 12, alignItems: 'center', marginTop: 8 },
});
