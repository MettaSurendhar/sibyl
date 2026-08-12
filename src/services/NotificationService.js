import notifee, {
	AndroidImportance,
	AndroidVisibility,
	AndroidForegroundServiceType,
} from '@notifee/react-native';
import { MediaController } from './MediaController';

// ─── Channel IDs ──────────────────────────────────────────────────────────────
// Suffixed with _v2 so Android creates NEW channels with DEFAULT importance.
// Once a channel is created, its importance is locked by Android — the only
// way to change it is to use a new channel ID (or reinstall the app).
const PLAYBACK_CHANNEL_ID = 'playback_channel_v2';
const RECORDING_CHANNEL_ID = 'recording_channel_v2';
const NOTIFICATION_ID = 'media_notification';

// ─── Module state ─────────────────────────────────────────────────────────────
let isServiceRunning = false;
let lastProgressUpdateMs = 0;
let channelsCreated = false;

// ─── Foreground service registration ──────────────────────────────────────────
// MUST be called once at boot. The returned Promise must never resolve —
// that is what keeps the Android Service alive until stopForegroundService().
notifee.registerForegroundService(() => {
	return new Promise(() => {});
});

// ─── Event handlers ───────────────────────────────────────────────────────────
notifee.onBackgroundEvent(async ({ type, detail }) => {
	if (type === 2) { // EventType.ACTION_PRESS
		const id = detail.pressAction?.id;
		if (id) MediaController.onAction(id);
	}
});

notifee.onForegroundEvent(({ type, detail }) => {
	if (type === 2) { // EventType.ACTION_PRESS
		const id = detail.pressAction?.id;
		if (id) MediaController.onAction(id);
	}
});

// ─── Channel setup ────────────────────────────────────────────────────────────
// DEFAULT importance = shows in status bar + on lock screen, no sound/vibration.
// Channels are cached once created; this is idempotent after first call.
async function setupChannels() {
	if (channelsCreated) return;
	await notifee.requestPermission();
	await notifee.createChannel({
		id: PLAYBACK_CHANNEL_ID,
		name: 'Media Playback',
		importance: AndroidImportance.DEFAULT,
	});
	await notifee.createChannel({
		id: RECORDING_CHANNEL_ID,
		name: 'Voice Recording',
		importance: AndroidImportance.DEFAULT,
	});
	channelsCreated = true;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDuration(ms) {
	if (isNaN(ms) || ms < 0) ms = 0;
	const total = Math.floor(ms / 1000);
	const mins = Math.floor(total / 60);
	const secs = total % 60;
	return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Background-safe press action — executes without opening/bringing up the app
function bgAction(id, title, icon) {
	return {
		title,
		icon, // drawable resource name (no extension), e.g. 'notif_ic_play'
		pressAction: {
			id,
			launchActivity: 'none', // do NOT open the app
		},
	};
}

// ─── Public API ───────────────────────────────────────────────────────────────
export const NotificationService = {

	// Start (or update) the playback foreground notification immediately.
	// This resets the throttle so the next progress update goes through.
	async startPlaybackNotification(title, isPlaying, positionMs = 0, totalMs = 0) {
		await setupChannels();
		isServiceRunning = true;
		lastProgressUpdateMs = Date.now();

		await notifee.displayNotification({
			id: NOTIFICATION_ID,
			title: title || 'Playing audio',
			body: `${formatDuration(positionMs)} / ${formatDuration(totalMs)}`,
			android: {
				channelId: PLAYBACK_CHANNEL_ID,
				asForegroundService: true,
				foregroundServiceTypes: [AndroidForegroundServiceType.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK],
				ongoing: true,
				onlyAlertOnce: true,
				// PUBLIC = show in full on lock screen
				visibility: AndroidVisibility.PUBLIC,
				color: '#10B981',
				actions: [
					bgAction('bwd', 'Back 15s', 'notif_ic_backward'),
					isPlaying
						? bgAction('pause', 'Pause', 'notif_ic_pause')
						: bgAction('play', 'Play', 'notif_ic_play'),
					bgAction('fwd', 'Skip 15s', 'notif_ic_forward'),
				],
			},
		});
	},

	// Called from onStatus (~100ms). Throttled to every 2s to prevent flicker.
	async updatePlaybackProgress(title, isPlaying, positionMs, totalMs) {
		if (!isServiceRunning) return;
		const now = Date.now();
		if (now - lastProgressUpdateMs < 2000) return;
		await this.startPlaybackNotification(title, isPlaying, positionMs, totalMs);
	},

	// Called immediately on play/pause button press (bypasses throttle).
	// Ensures the notification reflects the new state right away.
	async syncPlaybackState(title, isPlaying, positionMs, totalMs) {
		if (!isServiceRunning) return;
		await this.startPlaybackNotification(title, isPlaying, positionMs, totalMs);
	},

	// Start (or tick) the recording notification.
	// isStatChange=true bypasses the 1s throttle for immediate button feedback.
	async startRecordingNotification(isPlaying, durationMs = 0, isStateChange = false) {
		const now = Date.now();
		// Throttle ticker updates (onMeter fires every 100ms)
		if (!isStateChange && now - lastProgressUpdateMs < 1000) return;
		lastProgressUpdateMs = now;

		await setupChannels();
		isServiceRunning = true;

		await notifee.displayNotification({
			id: NOTIFICATION_ID,
			title: 'Recording...',
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
						? bgAction('pause', 'Pause', 'notif_ic_pause')
						: bgAction('play', 'Resume', 'notif_ic_play'),
					bgAction('save', 'Save', 'notif_ic_save'),
					bgAction('discard', 'Discard', 'notif_ic_discard'),
				],
			},
		});
	},

	async stopNotification() {
		isServiceRunning = false;
		lastProgressUpdateMs = 0;
		try { await notifee.stopForegroundService(); } catch (_) {}
		try { await notifee.cancelNotification(NOTIFICATION_ID); } catch (_) {}
	},
};
