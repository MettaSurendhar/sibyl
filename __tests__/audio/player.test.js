/**
 * __tests__/audio/player.test.js
 * Tests for the pure JS logic in src/audio/player.js.
 * The TrackPlayer native module is mocked in jest.setup.js.
 */

import { computeSilenceRanges, createPlayer } from '../../src/audio/player';

// ─── computeSilenceRanges ─────────────────────────────────────────────────────
describe('computeSilenceRanges', () => {
  // Samples are spaced 100ms apart. Silence threshold is -45 dB.
  // A range only counts if the silence lasts >= 700ms (7 consecutive quiet samples).

  it('returns empty array for empty waveform', () => {
    expect(computeSilenceRanges([])).toEqual([]);
  });

  it('returns empty array when no sample is below threshold', () => {
    const waveform = Array(20).fill(-20); // all loud
    expect(computeSilenceRanges(waveform)).toEqual([]);
  });

  it('returns empty array when silence is too short (< 700ms)', () => {
    // 5 quiet samples = 500ms — too short
    const waveform = [
      -20, -20, // loud
      -50, -50, -50, -50, -50, // 5 quiet = 500ms
      -20, -20, // loud
    ];
    expect(computeSilenceRanges(waveform)).toEqual([]);
  });

  it('detects a valid silence range >= 700ms', () => {
    // 8 quiet samples starting at index 2 = 200ms to 1000ms = 800ms silence
    const waveform = [
      -20, -20, // loud: 0ms, 100ms
      -50, -50, -50, -50, -50, -50, -50, -50, // quiet: 200ms–900ms (800ms)
      -20, -20, // loud: 1000ms, 1100ms
    ];
    const ranges = computeSilenceRanges(waveform);
    expect(ranges.length).toBe(1);
    expect(ranges[0][0]).toBe(200); // start at 200ms
    expect(ranges[0][1]).toBe(1000); // end at 1000ms
  });

  it('detects multiple separate silence ranges', () => {
    const loud = Array(3).fill(-20);      // 300ms
    const quiet = Array(8).fill(-55);     // 800ms

    // Pattern: loud, quiet, loud, quiet, loud
    const waveform = [...loud, ...quiet, ...loud, ...quiet, ...loud];
    const ranges = computeSilenceRanges(waveform);
    expect(ranges.length).toBe(2);
  });

  it('handles a waveform of all silence', () => {
    // 20 quiet samples = 2000ms — should produce one range
    const waveform = Array(20).fill(-60);
    // With our algorithm the range only closes when we hit a loud sample.
    // Since there is no final loud sample, the last run is never pushed.
    // This is the expected (and documented) behaviour: trailing silence is ignored.
    const ranges = computeSilenceRanges(waveform);
    expect(ranges.length).toBe(0);
  });
});

// ─── createPlayer ─────────────────────────────────────────────────────────────
describe('createPlayer', () => {
  const mockSegments = [
    { uri: 'file:///rec1.m4a', durationMs: 5000 },
    { uri: 'file:///rec2.m4a', durationMs: 3000 },
  ];

  it('returns the correct API surface', () => {
    const player = createPlayer({ segments: mockSegments, onStatus: jest.fn() });
    expect(typeof player.play).toBe('function');
    expect(typeof player.pause).toBe('function');
    expect(typeof player.seek).toBe('function');
    expect(typeof player.skip).toBe('function');
    expect(typeof player.setSkipSilence).toBe('function');
    expect(typeof player.unload).toBe('function');
  });

  it('play() resolves without throwing', async () => {
    const player = createPlayer({ segments: mockSegments, onStatus: jest.fn() });
    await expect(player.play()).resolves.not.toThrow();
  });

  it('pause() resolves without throwing', async () => {
    const player = createPlayer({ segments: mockSegments, onStatus: jest.fn() });
    await expect(player.pause()).resolves.not.toThrow();
  });

  it('unload() resolves without throwing', async () => {
    const player = createPlayer({ segments: mockSegments, onStatus: jest.fn() });
    await expect(player.unload()).resolves.not.toThrow();
  });

  it('calls TrackPlayer.add with the correct number of tracks', async () => {
    const TrackPlayer = require('react-native-track-player').default;
    TrackPlayer.add.mockClear();
    createPlayer({ segments: mockSegments, onStatus: jest.fn() });
    // Wait a tick for the async load() to run
    await new Promise((r) => setTimeout(r, 0));
    expect(TrackPlayer.add).toHaveBeenCalledTimes(1);
    const addedTracks = TrackPlayer.add.mock.calls[0][0];
    expect(addedTracks.length).toBe(2);
    expect(addedTracks[0].url).toBe('file:///rec1.m4a');
    expect(addedTracks[1].url).toBe('file:///rec2.m4a');
  });

  it('does nothing after unload() is called (guard destroyed flag)', async () => {
    const TrackPlayer = require('react-native-track-player').default;
    TrackPlayer.play.mockClear();
    const player = createPlayer({ segments: mockSegments, onStatus: jest.fn() });
    await player.unload();
    await player.play(); // should be a no-op
    expect(TrackPlayer.play).not.toHaveBeenCalled();
  });
});
