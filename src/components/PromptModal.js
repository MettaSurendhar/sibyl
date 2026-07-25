import React, { useEffect, useState } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeContext';

// visible, title, initialValue, onCancel, onSubmit(text)
export default function PromptModal({ visible, title, initialValue, onCancel, onSubmit }) {
  const { theme } = useTheme();
  const [value, setValue] = useState(initialValue || '');

  useEffect(() => {
    if (visible) setValue(initialValue || '');
  }, [visible, initialValue]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: theme.surface }]}>
          <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
          <TextInput
            value={value}
            onChangeText={setValue}
            autoFocus
            style={[styles.input, { color: theme.text, borderColor: theme.border }]}
          />
          <View style={styles.row}>
            <TouchableOpacity onPress={onCancel} style={[styles.btn, { backgroundColor: theme.surfaceAlt }]}>
              <Text style={{ color: theme.text, fontWeight: '600' }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => onSubmit(value)}
              style={[styles.btn, { backgroundColor: theme.accent }]}
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
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  card: { width: '85%', borderRadius: 16, padding: 20 },
  title: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
  input: { borderWidth: 1, borderRadius: 10, padding: 10, fontSize: 15, marginBottom: 16 },
  row: { flexDirection: 'row', gap: 12 },
  btn: { flex: 1, padding: 12, borderRadius: 10, alignItems: 'center' },
});
