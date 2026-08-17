/**
 * __tests__/services/NotificationService.test.js
 * Tests for the recording NotificationService public API.
 * The native RecordingNotificationModule is mocked in jest.setup.js.
 */

import { NotificationService } from '../../src/services/NotificationService';
import { NativeModules } from 'react-native';

const { RecordingNotificationModule } = NativeModules;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('NotificationService — startRecordingNotification', () => {
  it('calls native startNotification with correct isPlaying and durationMs', async () => {
    await NotificationService.startRecordingNotification(true, 12000, true);
    expect(RecordingNotificationModule.startNotification).toHaveBeenCalledWith(true, 12000);
  });

  it('calls native startNotification with isPlaying=false for paused state', async () => {
    await NotificationService.startRecordingNotification(false, 5000, true);
    expect(RecordingNotificationModule.startNotification).toHaveBeenCalledWith(false, 5000);
  });

  it('throttles calls within 1 second when isStateChange is false', async () => {
    // First call sets the lastProgressUpdateMs
    await NotificationService.startRecordingNotification(true, 1000, true);
    const callCountAfterFirst = RecordingNotificationModule.startNotification.mock.calls.length;

    // Second call immediately (no state change) — should be throttled
    await NotificationService.startRecordingNotification(true, 2000, false);
    expect(RecordingNotificationModule.startNotification.mock.calls.length).toBe(callCountAfterFirst);
  });

  it('bypasses throttle when isStateChange is true', async () => {
    await NotificationService.startRecordingNotification(true, 1000, true);
    await NotificationService.startRecordingNotification(false, 2000, true); // force update
    expect(RecordingNotificationModule.startNotification).toHaveBeenCalledTimes(2);
  });
});

describe('NotificationService — stopNotification', () => {
  it('calls native stopNotification', async () => {
    await NotificationService.stopNotification();
    expect(RecordingNotificationModule.stopNotification).toHaveBeenCalledTimes(1);
  });

  it('resets the throttle so a new notification can start immediately', async () => {
    await NotificationService.startRecordingNotification(true, 1000, true);
    await NotificationService.stopNotification();

    // After stop, the throttle should be reset
    await NotificationService.startRecordingNotification(true, 0, false);
    // The last call to startNotification should succeed (not be throttled)
    const allCalls = RecordingNotificationModule.startNotification.mock.calls;
    expect(allCalls[allCalls.length - 1]).toEqual([true, 0]);
  });
});
