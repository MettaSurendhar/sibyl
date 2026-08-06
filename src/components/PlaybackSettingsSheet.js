import React from 'react';
import { Modal, View, TouchableOpacity, Switch, StyleSheet } from 'react-native';
import Text from '../theme/Text';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';

const SPEEDS = [0.5, 1.0, 1.5, 2.0];

export default function PlaybackSettingsSheet({ visible, speed, skipSilence, onChangeSpeed, onToggleSkipSilence, onClose }) {
  const { theme } = useTheme();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { backgroundColor: theme.surface }]}>
          <View style={styles.headerRow}>
            <Text style={[styles.title, { color: theme.text }]}>Playback settings</Text>
            <TouchableOpacity style={[styles.headerBtn, { backgroundColor: theme.surfaceAlt }]} onPress={onClose}>
              <Feather name="x" size={20} color={theme.textMuted} />
            </TouchableOpacity>
          </View>

          <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>PLAYBACK SPEED</Text>
          {SPEEDS.map((s) => (
            <TouchableOpacity key={s} style={styles.radioRow} onPress={() => onChangeSpeed(s)}>
              <Feather
                name={speed === s ? 'check-circle' : 'circle'}
                size={20}
                color={speed === s ? theme.accent : theme.textMuted}
                style={{ marginRight: 12 }}
              />
              <Text style={{ color: theme.text, fontSize: 15 }}>{s === 1 ? 'Normal' : `${s}x`}</Text>
            </TouchableOpacity>
          ))}

          <View style={[styles.divider, { backgroundColor: theme.border }]} />

          <View style={styles.toggleRow}>
            <Text style={{ color: theme.text, fontSize: 15 }}>Skip silence</Text>
            <Switch
              value={skipSilence}
              onValueChange={onToggleSkipSilence}
              trackColor={{ false: theme.surfaceAlt, true: theme.accent }}
              thumbColor="#fff"
            />
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
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 18, fontWeight: '700' },
  sectionLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5, marginBottom: 8 },
  radioRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 16 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
