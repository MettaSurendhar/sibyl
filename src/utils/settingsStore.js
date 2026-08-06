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
	// Remembered screen position of the floating record button (Home/Library pager), set
	// after a long-press-drag. null means "use the default bottom-right position".
	fabPosition: null,
	// Number of days shown in the streak tracker on the Home dashboard (7, 14, or 30).
	streakDays: 14,
	// Global app font family
	appFont: 'lora',
	// Personalized greeting name
	userName: '',
	// Auto-transcribe new recordings via Groq Whisper after saving
	autoTranscribe: false,
	// Optional language code (e.g. 'ta', 'en') to force Whisper to transcribe in that language
	// instead of attempting auto-detection (which sometimes defaults to English translation)
	transcriptionLanguage: 'auto',
	// Whisper model to use for transcription.
	// 'whisper-large-v3-turbo' = fast + cheap, good for English
	// 'whisper-large-v3' = slower but more accurate, better for Indian languages
	transcriptionModel: 'whisper-large-v3-turbo',
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

// --- External-folder access (Android Storage Access Framework) ---
// Two independent SAF directory URIs, granted separately since they're picked for different
// reasons at different times: RECORDINGS_FOLDER_KEY is the user's chosen mirror-backup folder for
// finished recordings (Settings -> Saving folder), TRANSCRIPT_FOLDER_KEY is wherever they picked
// the first time they tapped "Download" on a transcript (they're nudged to pick Downloads, but the
// picker lets them choose anywhere). Both are just persisted content:// URI strings - once granted,
// SAF permission survives app restarts, so this is a one-time picker per folder, not a repeat
// prompt every time.
const RECORDINGS_FOLDER_KEY = '@voice_journal_recordings_folder_uri';
const TRANSCRIPT_FOLDER_KEY = '@voice_journal_transcript_folder_uri';

export async function getRecordingsFolderUri() {
	return AsyncStorage.getItem(RECORDINGS_FOLDER_KEY);
}

export async function setRecordingsFolderUri(uri) {
	if (!uri) {
		await AsyncStorage.removeItem(RECORDINGS_FOLDER_KEY);
	} else {
		await AsyncStorage.setItem(RECORDINGS_FOLDER_KEY, uri);
	}
}

export async function getTranscriptFolderUri() {
	return AsyncStorage.getItem(TRANSCRIPT_FOLDER_KEY);
}

export async function setTranscriptFolderUri(uri) {
	if (!uri) {
		await AsyncStorage.removeItem(TRANSCRIPT_FOLDER_KEY);
	} else {
		await AsyncStorage.setItem(TRANSCRIPT_FOLDER_KEY, uri);
	}
}

// Whether the user has dismissed RecordScreen's "connect a saving folder" hint (shown while
// recording, only when no recordings folder is configured yet). One dismissal sticks - the hint
// doesn't reappear on every future recording, since Settings remains available to connect one
// anytime.
const FOLDER_HINT_DISMISSED_KEY = '@voice_journal_folder_hint_dismissed';

export async function getFolderHintDismissed() {
	return (await AsyncStorage.getItem(FOLDER_HINT_DISMISSED_KEY)) === '1';
}

export async function setFolderHintDismissed(dismissed) {
	if (dismissed) {
		await AsyncStorage.setItem(FOLDER_HINT_DISMISSED_KEY, '1');
	} else {
		await AsyncStorage.removeItem(FOLDER_HINT_DISMISSED_KEY);
	}
}
