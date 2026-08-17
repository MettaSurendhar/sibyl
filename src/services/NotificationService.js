import { NativeModules, NativeEventEmitter, Platform } from 'react-native';
import { Audio } from 'expo-av';
import { AudioStore } from './AudioStore';
import { MediaController } from './MediaController';

const { RecordingNotificationModule } = NativeModules;
const eventEmitter = RecordingNotificationModule ? new NativeEventEmitter(RecordingNotificationModule) : null;

// ─── Module state ─────────────────────────────────────────────────────────────
let lastProgressUpdateMs = 0;
let eventsRegistered = false;

// ─── Audio session ────────────────────────────────────────────────────────────
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

async function handleAction(action) {
	const recorder = AudioStore.getRecorder();
	const isRecording = AudioStore.isRecording();
	
	// Map 'toggle' to play/pause for MediaController
	let mappedAction = action;
	if (action === 'toggle') {
		mappedAction = isRecording ? 'pause' : 'play';
	}

	// Pass to MediaController (which RecordScreen uses for foreground UI updates)
	const forwarded = MediaController.onAction(mappedAction);
	// If RecordScreen is open, it handles the action completely and updates its local state + audio + notification.
	if (forwarded) return;

	// If RecordScreen is NOT mounted (e.g. backgrounded and destroyed), handle audio directly
	switch (action) {
		case 'toggle':
			if (recorder) {
				if (isRecording) {
					await recorder.pause();
					AudioStore.updateRecording(AudioStore.getRecordingElapsedMs(), false);
					await NotificationService.startRecordingNotification(false, AudioStore.getRecordingElapsedMs(), true);
				} else {
					await recorder.resume();
					AudioStore.updateRecording(AudioStore.getRecordingElapsedMs(), true);
					await NotificationService.startRecordingNotification(true, AudioStore.getRecordingElapsedMs(), true);
				}
			}
			break;
		case 'save':
			if (recorder) {
				await recorder.stop();
				AudioStore.clearRecorder();
				await NotificationService.stopNotification();
			}
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

function registerEvents() {
	if (eventsRegistered || !eventEmitter) return;
	
	eventEmitter.addListener('onRecordingToggle', () => handleAction('toggle'));
	eventEmitter.addListener('onRecordingSave', () => handleAction('save'));
	eventEmitter.addListener('onRecordingDiscard', () => handleAction('discard'));
	
	eventsRegistered = true;
}

// ─── Public API ───────────────────────────────────────────────────────────────
export const NotificationService = {

	async startRecordingNotification(isPlaying, durationMs = 0, isStateChange = false) {
		if (Platform.OS !== 'android' || !RecordingNotificationModule) return;
		
		registerEvents();

		const now = Date.now();
		if (!isStateChange && now - lastProgressUpdateMs < 1000) return;
		lastProgressUpdateMs = now;

		RecordingNotificationModule.startNotification(isPlaying, durationMs);
	},

	async stopNotification() {
		if (Platform.OS !== 'android' || !RecordingNotificationModule) return;
		lastProgressUpdateMs = 0;
		RecordingNotificationModule.stopNotification();
	},
};
