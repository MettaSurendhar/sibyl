import notifee, { AndroidImportance, AndroidVisibility, EventType } from '@notifee/react-native';
import { Platform, DeviceEventEmitter } from 'react-native';
import { Audio } from 'expo-av';
import { AudioStore } from './AudioStore';
import { MediaController } from './MediaController';

// ─── Constants ────────────────────────────────────────────────────────────────
const CHANNEL_ID       = 'recording_v2';
const NOTIFICATION_ID  = 'recording_notification';

// Action IDs used in notification buttons
const ACTION_TOGGLE  = 'toggle';
const ACTION_SAVE    = 'save';
const ACTION_DISCARD = 'discard';

// DeviceEventEmitter event name — RecordScreen listens to this
export const RECORDING_ACTION_EVENT = 'RECORDING_NOTIF_ACTION';

// ─── Module state ─────────────────────────────────────────────────────────────
let channelId            = null;
let lastProgressUpdateMs = 0;
let foregroundUnsub      = null;

// ─── Audio session ────────────────────────────────────────────────────────────
export async function initAudioSession() {
	try {
		await Audio.setAudioModeAsync({
			allowsRecordingIOS: false,
			playsInSilentModeIOS: true,
			staysActiveInBackground: true,
			shouldDuckAndroid: false,
			playThroughEarpieceAndroid: false,
		});
	} catch (e) {
		console.warn('[Notif] initAudioSession error:', e);
	}

	// Android 13+ requires runtime permission — no-op on older versions
	if (Platform.OS === 'android') {
		try {
			await notifee.requestPermission();
		} catch {}
	}
}

// ─── Foreground event listener ────────────────────────────────────────────────
// Called once. Registers a global Notifee foreground event handler.
function registerForegroundListener() {
	if (foregroundUnsub) return;
	foregroundUnsub = notifee.onForegroundEvent(({ type, detail }) => {
		if (type === EventType.ACTION_PRESS) {
			handleRecordingAction(detail.pressAction?.id);
		}
	});
}

// ─── Core action dispatcher ───────────────────────────────────────────────────
// Called by both onForegroundEvent (app open) and onBackgroundEvent (app locked).
export async function handleRecordingAction(actionId) {
	if (!actionId) return;

	const recorder    = AudioStore.getRecorder();
	const isRecording = AudioStore.isRecording();
	const elapsedMs   = AudioStore.getRecordingElapsedMs();

	// Map toggle → pause/resume based on current recording state
	const resolvedAction = actionId === ACTION_TOGGLE
		? (isRecording ? 'pause' : 'resume')
		: actionId; // 'save' | 'discard'

	// ── Step 1: Emit DeviceEventEmitter so RecordScreen UI updates (most reliable) ──
	DeviceEventEmitter.emit(RECORDING_ACTION_EVENT, { action: resolvedAction });

	// ── Step 2: Also try MediaController (RecordScreen may or may not be mounted) ──
	const mcAction = resolvedAction === 'resume' ? 'play' : resolvedAction;
	const forwarded = MediaController.onAction(mcAction);

	// ── Step 3: If RecordScreen is NOT handling it, handle audio directly ─────────
	if (!forwarded) {
		try {
			switch (actionId) {
				case ACTION_TOGGLE:
					if (recorder) {
						if (isRecording) {
							await recorder.pause();
							AudioStore.updateRecording(elapsedMs, false);
							await NotificationService.startRecordingNotification(false, elapsedMs, true);
						} else {
							await recorder.resume();
							AudioStore.updateRecording(elapsedMs, true);
							await NotificationService.startRecordingNotification(true, elapsedMs, true);
						}
					}
					break;
				case ACTION_SAVE:
					if (recorder) {
						await recorder.stop();
						AudioStore.clearRecorder();
						await NotificationService.stopNotification();
					}
					break;
				case ACTION_DISCARD:
					if (recorder) {
						await recorder.discard();
						AudioStore.clearRecorder();
						await NotificationService.stopNotification();
					}
					break;
			}
		} catch (e) {
			// Ignore "Recorder does not exist" errors caused by duplicate events
			console.log('[Notif] handled audio action error:', e.message);
		}
	}
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
async function ensureChannel() {
	if (channelId) return channelId;
	try {
		channelId = await notifee.createChannel({
			id: CHANNEL_ID,
			name: 'Voice Recording',
			importance: AndroidImportance.DEFAULT,
			visibility: AndroidVisibility.PUBLIC, // Required for lock screen visibility
			vibration: false,
		});
	} catch (e) {
		console.error('[Notif] createChannel error:', e);
		channelId = CHANNEL_ID;
	}
	return channelId;
}

function formatDuration(ms) {
	const totalSecs = Math.floor(Math.max(0, ms) / 1000);
	const m = Math.floor(totalSecs / 60);
	const s = totalSecs % 60;
	return `${m}:${s.toString().padStart(2, '0')}`;
}

// ─── Public API ───────────────────────────────────────────────────────────────
export const NotificationService = {

	async startRecordingNotification(isPlaying, durationMs = 0, isStateChange = false) {
		if (Platform.OS !== 'android') return;

		const now = Date.now();
		if (!isStateChange && now - lastProgressUpdateMs < 1000) return;
		lastProgressUpdateMs = now;

		const cId = await ensureChannel();
		registerForegroundListener();

		try {
			await notifee.displayNotification({
				id: NOTIFICATION_ID,
				title: isPlaying ? '🔴 Recording…' : '⏸ Recording paused',
				body: formatDuration(durationMs),
				android: {
					channelId: cId,
					asForegroundService: true,
					ongoing: true,
					onlyAlertOnce: true,
					smallIcon: 'ic_notification',
					visibility: AndroidVisibility.PUBLIC,
					pressAction: { id: 'default', launchActivity: 'default' },
					actions: [
						{
							title: isPlaying ? '⏸ Pause' : '▶ Resume',
							pressAction: { id: ACTION_TOGGLE },
						},
						{ title: '✓ Save',    pressAction: { id: ACTION_SAVE } },
						{ title: '✕ Discard', pressAction: { id: ACTION_DISCARD } },
					],
				},
			});
		} catch (e) {
			console.error('[Notif] displayNotification FAILED:', e?.message ?? e);
		}
	},

	async stopNotification() {
		if (Platform.OS !== 'android') return;
		lastProgressUpdateMs = 0;
		channelId = null; // force re-creation next time
		try { await notifee.stopForegroundService(); } catch {}
		try { await notifee.cancelNotification(NOTIFICATION_ID); } catch {}
	},
};
