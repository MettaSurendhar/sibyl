import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, ScrollView, StyleSheet, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { themeList } from '../theme/themes';
import { getGroqApiKey, setGroqApiKey, getPrefs, setPrefs } from '../utils/settingsStore';
import { getUntaggedTemplate, setUntaggedTemplate } from '../db/categories';
import { renderTemplate } from '../utils/naming';

const FORMATS = [
  { key: 'aac', label: 'AAC (.m4a) — recommended, native quality' },
  { key: 'wav', label: 'WAV — uncompressed, larger files' },
  { key: 'mp3', label: 'MP3 — requires the optional ffmpeg module' },
];

export default function SettingsScreen({ navigation }) {
  const { theme, themeKey, setThemeKey } = useTheme();
  const insets = useSafeAreaInsets();
  const [apiKey, setApiKey] = useState('');
  const [prefs, setPrefsState] = useState({ recordingFormat: 'aac' });
  const [untaggedTemplate, setUntaggedTemplateState] = useState('');

  useEffect(() => {
    getGroqApiKey().then((k) => setApiKey(k || ''));
    getPrefs().then(setPrefsState);
    getUntaggedTemplate().then(setUntaggedTemplateState);
  }, []);

  async function saveApiKey(text) {
    setApiKey(text);
    await setGroqApiKey(text);
  }

  async function chooseFormat(key) {
    const updated = await setPrefs({ recordingFormat: key });
    setPrefsState(updated);
  }

  async function saveUntaggedTemplate(text) {
    setUntaggedTemplateState(text);
    await setUntaggedTemplate(text);
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.bg }]} contentContainerStyle={{ padding: 20, paddingTop: insets.top + 16 }}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Feather name="arrow-left" size={22} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Settings</Text>
        <View style={{ width: 22 }} />
      </View>

      <Section title="Tags" theme={theme}>
        <TouchableOpacity
          style={[styles.navButton, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}
          onPress={() => navigation.navigate('Categories')}
        >
          <Feather name="tag" size={18} color={theme.text} style={{ marginRight: 10 }} />
          <Text style={{ color: theme.text, flex: 1, fontWeight: '600' }}>Manage tags</Text>
          <Feather name="chevron-right" size={18} color={theme.textMuted} />
        </TouchableOpacity>
      </Section>

      <Section title="Untagged recording naming" theme={theme}>
        <TextInput
          value={untaggedTemplate}
          onChangeText={saveUntaggedTemplate}
          style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.surfaceAlt }]}
          placeholder="Recording <count> <date>"
          placeholderTextColor={theme.textMuted}
        />
        <Text style={{ color: theme.textMuted, fontSize: 12, marginTop: 6 }}>
          Preview: {renderTemplate(untaggedTemplate, { count: 1 })}
        </Text>
      </Section>

      <Section title="Recording format" theme={theme}>
        {FORMATS.map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[
              styles.optionRow,
              { borderColor: theme.border, backgroundColor: prefs.recordingFormat === f.key ? theme.surfaceAlt : 'transparent' },
            ]}
            onPress={() => chooseFormat(f.key)}
          >
            <Feather
              name={prefs.recordingFormat === f.key ? 'check-circle' : 'circle'}
              size={18}
              color={prefs.recordingFormat === f.key ? theme.accent : theme.textMuted}
              style={{ marginRight: 12 }}
            />
            <Text style={{ color: theme.text, flex: 1 }}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </Section>

      <Section title="Theme" theme={theme}>
        {themeList.map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[
              styles.optionRow,
              { borderColor: theme.border, backgroundColor: themeKey === t.key ? theme.surfaceAlt : 'transparent' },
            ]}
            onPress={() => setThemeKey(t.key)}
          >
            <View style={[styles.swatch, { backgroundColor: t.accent }]} />
            <Text style={{ color: theme.text, flex: 1 }}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </Section>

      <Section title="Transcription (Groq)" theme={theme}>
        <Text style={{ color: theme.textMuted, marginBottom: 8, fontSize: 13 }}>
          Needs an internet connection and a free API key from console.groq.com. Recording and
          playback stay fully offline — only transcription calls out.
        </Text>
        <TextInput
          value={apiKey}
          onChangeText={saveApiKey}
          placeholder="gsk_..."
          placeholderTextColor={theme.textMuted}
          secureTextEntry
          style={[styles.input, { color: theme.text, borderColor: theme.border }]}
        />
        <TouchableOpacity onPress={() => Linking.openURL('https://console.groq.com/keys')}>
          <Text style={{ color: theme.accent, marginTop: 8 }}>Get a free API key →</Text>
        </TouchableOpacity>
      </Section>

      <Section title="About" theme={theme}>
        <Text style={{ color: theme.textMuted }}>Sibyl — v1.0.0</Text>
        <Text style={{ color: theme.textMuted, fontStyle: 'italic', marginTop: 2 }}>speak, and be remembered</Text>
        <Text style={{ color: theme.textMuted, marginTop: 4 }}>
          A local-first voice diary. All recordings and metadata stay on your device.
        </Text>
      </Section>
    </ScrollView>
  );
}

function Section({ title, theme, children }) {
  return (
    <View style={{ marginBottom: 28 }}>
      <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>{title.toUpperCase()}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  headerTitle: { fontSize: 20, fontWeight: '700' },
  sectionTitle: { fontSize: 12, fontWeight: '700', marginBottom: 10, letterSpacing: 0.5 },
  rowBtn: { borderWidth: 1, borderRadius: 12, padding: 14 },
  navButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  optionRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 8 },
  swatch: { width: 18, height: 18, borderRadius: 9, marginRight: 12 },
  input: { borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 15 },
});
