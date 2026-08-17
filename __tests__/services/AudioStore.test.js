/**
 * __tests__/services/AudioStore.test.js
 * Tests for the AudioStore global state singleton.
 * No native modules involved — pure JavaScript.
 */

import { AudioStore } from '../../src/services/AudioStore';

// Reset between every test so tests are isolated
afterEach(() => {
  AudioStore.clearRecorder();
});

// ─── Initial State ────────────────────────────────────────────────────────────
describe('AudioStore — initial state', () => {
  it('has no recorder by default', () => {
    expect(AudioStore.getRecorder()).toBeNull();
  });

  it('is not recording by default', () => {
    expect(AudioStore.isRecording()).toBe(false);
  });

  it('has zero elapsed time by default', () => {
    expect(AudioStore.getRecordingElapsedMs()).toBe(0);
  });
});

// ─── setRecorder ─────────────────────────────────────────────────────────────
describe('AudioStore — setRecorder', () => {
  it('stores the recorder and marks isRecording true', () => {
    const mockRecorder = { pause: jest.fn(), resume: jest.fn() };
    AudioStore.setRecorder(mockRecorder);
    expect(AudioStore.getRecorder()).toBe(mockRecorder);
    expect(AudioStore.isRecording()).toBe(true);
  });

  it('resets elapsed time to 0 when a new recorder is set', () => {
    AudioStore.setRecorder({ pause: jest.fn() });
    AudioStore.updateRecording(5000, true);
    expect(AudioStore.getRecordingElapsedMs()).toBe(5000);

    AudioStore.setRecorder({ pause: jest.fn() }); // set a new recorder
    expect(AudioStore.getRecordingElapsedMs()).toBe(0);
  });
});

// ─── updateRecording ──────────────────────────────────────────────────────────
describe('AudioStore — updateRecording', () => {
  it('updates elapsed time', () => {
    AudioStore.setRecorder({ pause: jest.fn() });
    AudioStore.updateRecording(12345, true);
    expect(AudioStore.getRecordingElapsedMs()).toBe(12345);
  });

  it('updates isRecording status to false (paused)', () => {
    AudioStore.setRecorder({ pause: jest.fn() });
    AudioStore.updateRecording(5000, false);
    expect(AudioStore.isRecording()).toBe(false);
  });

  it('updates isRecording status to true (resumed)', () => {
    AudioStore.setRecorder({ pause: jest.fn() });
    AudioStore.updateRecording(5000, false); // pause
    AudioStore.updateRecording(6000, true);  // resume
    expect(AudioStore.isRecording()).toBe(true);
    expect(AudioStore.getRecordingElapsedMs()).toBe(6000);
  });
});

// ─── clearRecorder ───────────────────────────────────────────────────────────
describe('AudioStore — clearRecorder', () => {
  it('clears the recorder and resets all state', () => {
    AudioStore.setRecorder({ pause: jest.fn() });
    AudioStore.updateRecording(9999, true);
    AudioStore.clearRecorder();

    expect(AudioStore.getRecorder()).toBeNull();
    expect(AudioStore.isRecording()).toBe(false);
    expect(AudioStore.getRecordingElapsedMs()).toBe(0);
  });
});
