import notifee, { AndroidImportance, AndroidColor } from '@notifee/react-native';
import { MediaController } from './MediaController';

const PLAYBACK_CHANNEL_ID = 'playback_channel';
const RECORDING_CHANNEL_ID = 'recording_channel';
const NOTIFICATION_ID = 'media_notification';

let isServiceRunning = false;

async function setupChannels() {
	await notifee.createChannel({
		id: PLAYBACK_CHANNEL_ID,
		name: 'Media Playback',
		importance: AndroidImportance.LOW,
	});
	await notifee.createChannel({
		id: RECORDING_CHANNEL_ID,
		name: 'Voice Recording',
		importance: AndroidImportance.LOW,
	});
}

// Background event handler registered in index.js or App.js
notifee.onBackgroundEvent(async ({ type, detail }) => {
	if (type === 2) { // Action pressed
		const actionId = detail.pressAction?.id;
		if (actionId) {
			MediaController.onAction(actionId);
		}
	}
});

function formatDuration(ms) {
	if (isNaN(ms) || ms < 0) ms = 0;
	const total = Math.floor(ms / 1000);
	const mins = Math.floor(total / 60);
	const secs = total % 60;
	return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export const NotificationService = {
	async startPlaybackNotification(title, isPlaying, positionMs = 0, totalMs = 0) {
		await setupChannels();
		isServiceRunning = true;
		
		const progress = `${formatDuration(positionMs)} / ${formatDuration(totalMs)}`;

		await notifee.displayNotification({
			id: NOTIFICATION_ID,
			title: title || 'Playing audio',
			body: progress,
			android: {
				channelId: PLAYBACK_CHANNEL_ID,
				asForegroundService: true,
				ongoing: true,
				color: '#10B981', // theme.accent
				actions: [
					{ title: '⏮ 15s', pressAction: { id: 'bwd' } },
					isPlaying 
						? { title: '⏸ Pause', pressAction: { id: 'pause' } }
						: { title: '▶ Play', pressAction: { id: 'play' } },
					{ title: '15s ⏭', pressAction: { id: 'fwd' } },
				],
			},
		});
	},

	async updatePlaybackProgress(title, isPlaying, positionMs, totalMs) {
		if (!isServiceRunning) return;
		// Re-displaying with same ID updates it
		await this.startPlaybackNotification(title, isPlaying, positionMs, totalMs);
	},

	async startRecordingNotification(isPlaying, durationMs = 0) {
		await setupChannels();
		isServiceRunning = true;
		
		await notifee.displayNotification({
			id: NOTIFICATION_ID,
			title: 'Recording...',
			body: formatDuration(durationMs),
			android: {
				channelId: RECORDING_CHANNEL_ID,
				asForegroundService: true,
				ongoing: true,
				color: '#EF4444',
				actions: [
					isPlaying 
						? { title: '⏸ Pause', pressAction: { id: 'pause' } }
						: { title: '▶ Resume', pressAction: { id: 'play' } },
					{ title: '💾 Save', pressAction: { id: 'save' } },
				],
			},
		});
	},

	async stopNotification() {
		isServiceRunning = false;
		await notifee.stopForegroundService();
		await notifee.cancelNotification(NOTIFICATION_ID);
	}
};
