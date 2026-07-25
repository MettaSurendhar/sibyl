import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

const GROQ_KEY_STORAGE = 'groq_api_key';
const PREFS_KEY = '@voice_journal_prefs';

export async function getGroqApiKey() {
  return SecureStore.getItemAsync(GROQ_KEY_STORAGE);
}

export async function setGroqApiKey(key) {
  if (!key) {
    await SecureStore.deleteItemAsync(GROQ_KEY_STORAGE);
  } else {
    await SecureStore.setItemAsync(GROQ_KEY_STORAGE, key);
  }
}

const DEFAULT_PREFS = {
  recordingFormat: 'aac', // 'aac' | 'wav' | 'mp3' (mp3 requires the ffmpeg transcode module)
  shareFormat: 'mp3',
};

export async function getPrefs() {
  const raw = await AsyncStorage.getItem(PREFS_KEY);
  return raw ? { ...DEFAULT_PREFS, ...JSON.parse(raw) } : DEFAULT_PREFS;
}

export async function setPrefs(patch) {
  const current = await getPrefs();
  const updated = { ...current, ...patch };
  await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(updated));
  return updated;
}
