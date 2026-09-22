import { NotificationService } from '../../src/services/NotificationService';
import notifee from '@notifee/react-native';

// Mock notifee
jest.mock('@notifee/react-native', () => ({
	createChannel: jest.fn().mockResolvedValue('recording_v2'),
	displayNotification: jest.fn().mockResolvedValue(),
	stopForegroundService: jest.fn().mockResolvedValue(),
	cancelNotification: jest.fn().mockResolvedValue(),
	AndroidImportance: { DEFAULT: 3 },
	AndroidVisibility: { PUBLIC: 1 },
	EventType: { ACTION_PRESS: 1 },
	onForegroundEvent: jest.fn(),
	onBackgroundEvent: jest.fn(),
}));

beforeEach(() => {
	jest.clearAllMocks();
	// Reset the module state (especially lastProgressUpdateMs) to isolate tests
	jest.isolateModules(() => {
		require('../../src/services/NotificationService');
	});
});

describe('NotificationService — startRecordingNotification', () => {
	it('calls notifee.displayNotification with correct isPlaying and duration', async () => {
		await NotificationService.startRecordingNotification(true, 12000, true);
		expect(notifee.displayNotification).toHaveBeenCalled();
		const callArgs = notifee.displayNotification.mock.calls[0][0];
		expect(callArgs.title).toBe('🔴 Recording…');
		expect(callArgs.body).toBe('0:12'); // formatDuration(12000)
	});

	it('calls notifee.displayNotification with paused state', async () => {
		await NotificationService.startRecordingNotification(false, 5000, true);
		expect(notifee.displayNotification).toHaveBeenCalled();
		const callArgs = notifee.displayNotification.mock.calls[0][0];
		expect(callArgs.title).toBe('⏸ Recording paused');
		expect(callArgs.body).toBe('0:05');
	});

	it('throttles calls within 1 second when isStateChange is false', async () => {
		// First call
		await NotificationService.startRecordingNotification(true, 1000, true);
		const callCountAfterFirst = notifee.displayNotification.mock.calls.length;

		// Second call immediately (no state change) — should be throttled
		await NotificationService.startRecordingNotification(true, 1500, false);
		expect(notifee.displayNotification.mock.calls.length).toBe(callCountAfterFirst);
	});

	it('bypasses throttle when isStateChange is true', async () => {
		await NotificationService.startRecordingNotification(true, 1000, true);
		await NotificationService.startRecordingNotification(false, 1500, true); // force update
		expect(notifee.displayNotification).toHaveBeenCalledTimes(2);
	});
});

describe('NotificationService — stopNotification', () => {
	it('calls notifee stopForegroundService and cancelNotification', async () => {
		await NotificationService.stopNotification();
		expect(notifee.stopForegroundService).toHaveBeenCalled();
		expect(notifee.cancelNotification).toHaveBeenCalled();
	});

	it('resets the throttle so a new notification can start immediately', async () => {
		await NotificationService.startRecordingNotification(true, 1000, true);
		await NotificationService.stopNotification();

		// After stop, the throttle should be reset
		await NotificationService.startRecordingNotification(true, 2000, false);
		expect(notifee.displayNotification).toHaveBeenCalledTimes(2);
	});
});
