import notifee, {
	AndroidImportance,
	AndroidVisibility,
	AndroidForegroundServiceType,
} from '@notifee/react-native';
import { Audio } from 'expo-av';
import { AudioStore } from './AudioStore';

// ─── Channel IDs ─────────────────────────────────────────────────────────────
// _v2 suffix forces Android to create NEW channels with DEFAULT importance.
const RECORDING_CHANNEL_ID = 'recording_channel_v2';
const NOTIFICATION_ID      = 'media_notification';

// ─── Module state ─────────────────────────────────────────────────────────────
let isServiceRunning    = false;
let lastProgressUpdateMs = 0;
let channelsCreated     = false;

// ─── Audio session ────────────────────────────────────────────────────────────
// Call once at startup so that:
//   • Our audio keeps playing in background
//   • Starting our audio pauses other apps (Spotify, YouTube, etc.)
export async function initAudioSession() {
	await Audio.setAudioModeAsync({
		allowsRecordingIOS: false,
		playsInSilentModeIOS: true,
		staysActiveInBackground: true,
		// Android: take audio focus exclusively → other apps pause/duck
		shouldDuckAndroid: false,
		playThroughEarpieceAndroid: false,
	});
}

// ─── Foreground service ───────────────────────────────────────────────────────
// Must be registered once at app boot. Returning a never-resolving Promise
// keeps the Android foreground service alive indefinitely.
notifee.registerForegroundService(() => new Promise(() => {}));

// ─── Event routing ────────────────────────────────────────────────────────────
// Both foreground and background events call the same handler.
// When the app is visible, onForegroundEvent fires.
// When backgrounded (foreground service keeps JS alive), onBackgroundEvent fires.
// Both paths operate via AudioStore refs (module-level, always valid in the
// same JS context) rather than React component refs (which can be stale/null).

async function handleNotifeeAction(id) {
	// Playback is now handled by react-native-track-player natively.
	// This handler only deals with recording notification actions.
	const recorder = AudioStore.getRecorder();

	switch (id) {
		case 'play':
			if (recorder && !AudioStore.isRecording()) {
				await recorder.resume();
				AudioStore.updateRecording(AudioStore.getRecordingElapsedMs(), true);
				await NotificationService.startRecordingNotification(true, AudioStore.getRecordingElapsedMs(), true);
			}
			break;
		case 'pause':
			if (recorder && AudioStore.isRecording()) {
				await recorder.pause();
				AudioStore.updateRecording(AudioStore.getRecordingElapsedMs(), false);
				await NotificationService.startRecordingNotification(false, AudioStore.getRecordingElapsedMs(), true);
			}
			break;
		case 'save':
			// Save is handled by the screen's MediaController handler only
			// (it needs to finalise the file, navigate, etc.)
			break;
		case 'discard':
			if (recorder) {
				await recorder.discard();
				AudioStore.clearRecorder();
				await NotificationService.stopNotification();
			}
			break;
	}
}

notifee.onBackgroundEvent(async ({ type, detail }) => {
	if (type === 2) { // EventType.ACTION_PRESS
		const id = detail.pressAction?.id;
		if (id) await handleNotifeeAction(id);
	}
});

notifee.onForegroundEvent(({ type, detail }) => {
	if (type === 2) { // EventType.ACTION_PRESS
		const id = detail.pressAction?.id;
		if (id) handleNotifeeAction(id);
	}
});

// ─── Channel setup ────────────────────────────────────────────────────────────
// DEFAULT = shows in status bar + on lock screen, no sound/vibration.
async function setupChannels() {
	if (channelsCreated) return;
	await notifee.requestPermission();
	await notifee.createChannel({
		id: RECORDING_CHANNEL_ID,
		name: 'Voice Recording',
		importance: AndroidImportance.DEFAULT,
	});
	channelsCreated = true;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDuration(ms) {
	if (!ms || isNaN(ms) || ms < 0) ms = 0;
	const total = Math.floor(ms / 1000);
	const mins  = Math.floor(total / 60);
	const secs  = total % 60;
	return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Background-safe press action — pure BroadcastReceiver, no Activity launch.
// CRITICAL: Do NOT set launchActivity to any value (including the string 'none').
// Notifee's native code: if pressAction has launchActivity key (any value)
//   → PendingIntent.getActivity() → demands unlock on lock screen + closes shade.
// If launchActivity is completely absent (key missing)
//   → PendingIntent.getBroadcast() → works on lock screen + shade stays open.
function bgAction(id, title, icon) {
	return {
		title,
		icon,           // Android drawable resource name, e.g. 'notif_ic_play'
		pressAction: { id },  // NO launchActivity key
	};
}

// ─── Public API ───────────────────────────────────────────────────────────────
export const NotificationService = {

	// Recording notification.
	// isStateChange=true bypasses the 1s throttle for immediate feedback.
	async startRecordingNotification(isPlaying, durationMs = 0, isStateChange = false) {
		const now = Date.now();
		if (!isStateChange && now - lastProgressUpdateMs < 1000) return;
		lastProgressUpdateMs = now;

		await setupChannels();
		isServiceRunning = true;

		await notifee.displayNotification({
			id: NOTIFICATION_ID,
			title: 'Recording…',
			body: formatDuration(durationMs),
			android: {
				channelId: RECORDING_CHANNEL_ID,
				asForegroundService: true,
				foregroundServiceTypes: [AndroidForegroundServiceType.FOREGROUND_SERVICE_TYPE_MICROPHONE],
				ongoing: true,
				onlyAlertOnce: true,
				visibility: AndroidVisibility.PUBLIC,
				color: '#EF4444',
				actions: [
					isPlaying
						? bgAction('pause',   'Pause',   'notif_ic_pause')
						: bgAction('play',    'Resume',  'notif_ic_play'),
					bgAction('save',    'Save',    'notif_ic_save'),
					bgAction('discard', 'Discard', 'notif_ic_discard'),
				],
			},
		});
	},

	async stopNotification() {
		isServiceRunning     = false;
		lastProgressUpdateMs = 0;
		try { await notifee.stopForegroundService(); } catch (_) {}
		try { await notifee.cancelNotification(NOTIFICATION_ID); } catch (_) {}
	},
};
