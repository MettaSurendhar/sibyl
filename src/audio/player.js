import { Audio } from 'expo-av';

const SAMPLE_INTERVAL_MS = 100; // matches recorder.js progress update interval
const SILENCE_DB_THRESHOLD = -45;
const MIN_SILENCE_MS = 700;

// Finds [startMs, endMs] ranges in the waveform that are quiet for at least MIN_SILENCE_MS.
// Used only when the "Skip silence" toggle is on.
export function computeSilenceRanges(waveform) {
  const ranges = [];
  let runStart = null;
  waveform.forEach((db, i) => {
    const t = i * SAMPLE_INTERVAL_MS;
    const isQuiet = db < SILENCE_DB_THRESHOLD;
    if (isQuiet && runStart === null) runStart = t;
    if (!isQuiet && runStart !== null) {
      if (t - runStart >= MIN_SILENCE_MS) ranges.push([runStart, t]);
      runStart = null;
    }
  });
  return ranges;
}

// Plays a list of segments [{uri, durationMs}] as one continuous timeline.
export function createPlayer({ segments, onStatus }) {
  let sound = null;
  let currentIndex = 0;
  let rate = 1.0;
  let skipSilence = false;
  let silenceRanges = [];
  let offsetBeforeCurrent = 0; // ms of all previous segments combined
  let transitioning = false; // guards against overlapping loadSegment/seek calls
  let destroyed = false;

  const totalDurationMs = segments.reduce((sum, s) => sum + s.durationMs, 0);

  function segmentOffset(index) {
    return segments.slice(0, index).reduce((sum, s) => sum + s.durationMs, 0);
  }

  // expo-av can throw "Player does not exist" if a sound was unloaded (or is mid-unload)
  // when another call reaches it - this wraps any native call so that case degrades to a
  // no-op instead of becoming an unhandled promise rejection.
  async function safely(fn) {
    try {
      return await fn();
    } catch (e) {
      if (!String(e?.message || e).includes('Player does not exist')) {
        console.warn('Player operation failed:', e);
      }
      return null;
    }
  }

  async function loadSegment(index, initialPositionMs = 0) {
    const soundToUnload = sound;
    sound = null; // detach immediately so no other call can reach the outgoing sound
    if (soundToUnload) {
      await safely(() => soundToUnload.setOnPlaybackStatusUpdate(null));
      await safely(() => soundToUnload.unloadAsync());
    }
    if (destroyed) return;
    if (index >= segments.length) {
      onStatus && onStatus({ finished: true, positionMs: totalDurationMs, totalDurationMs });
      return;
    }
    currentIndex = index;
    offsetBeforeCurrent = segmentOffset(index);
    const created = await safely(async () => {
      const { sound: s } = await Audio.Sound.createAsync(
        { uri: segments[index].uri },
        {
          positionMillis: initialPositionMs,
          rate,
          shouldCorrectPitch: true,
          shouldPlay: false,
          progressUpdateIntervalMillis: 100,
        }
      );
      return s;
    });
    if (destroyed || !created) return;
    sound = created;
    sound.setOnPlaybackStatusUpdate(handleStatus);
  }

  function handleStatus(status) {
    if (destroyed || !status.isLoaded) return;
    const globalPos = offsetBeforeCurrent + status.positionMillis;

    if (status.didJustFinish) {
      if (transitioning) return;
      transitioning = true;
      loadSegment(currentIndex + 1, 0)
        .then(() => sound && play())
        .catch((e) => console.warn('Auto-advance failed:', e))
        .finally(() => (transitioning = false));
      return;
    }

    // skip-silence: if we've entered a long silent stretch, jump to its end.
    // Guarded so overlapping status ticks during the async seek can't trigger it twice.
    if (skipSilence && status.isPlaying && !transitioning) {
      const range = silenceRanges.find((r) => globalPos >= r[0] && globalPos < r[1] - 150);
      if (range) {
        transitioning = true;
        seek(range[1])
          .catch((e) => console.warn('Skip-silence seek failed:', e))
          .finally(() => (transitioning = false));
        return;
      }
    }

    onStatus &&
      onStatus({
        finished: false,
        positionMs: globalPos,
        totalDurationMs,
        isPlaying: status.isPlaying,
      });
  }

  async function play() {
    if (!sound) await loadSegment(currentIndex);
    if (sound) await safely(() => sound.playAsync());
  }

  async function pause() {
    if (sound) await safely(() => sound.pauseAsync());
  }

  // seek to an absolute position (ms) within the whole concatenated entry
  async function seek(globalMs) {
    let clamped = Math.max(0, Math.min(globalMs, totalDurationMs - 1));
    let idx = 0;
    let acc = 0;
    for (; idx < segments.length; idx++) {
      if (clamped < acc + segments[idx].durationMs) break;
      acc += segments[idx].durationMs;
    }
    const priorStatus = sound ? await safely(() => sound.getStatusAsync()) : null;
    const wasPlaying = priorStatus?.isLoaded ? priorStatus.isPlaying : false;
    await loadSegment(idx, clamped - acc);
    if (wasPlaying) await play();
  }

  async function skip(deltaMs) {
    const status = sound ? await safely(() => sound.getStatusAsync()) : null;
    const current = status?.isLoaded ? offsetBeforeCurrent + status.positionMillis : 0;
    await seek(current + deltaMs);
  }

  async function setRate(newRate) {
    rate = newRate;
    if (sound) await safely(() => sound.setRateAsync(rate, true));
  }

  function setSkipSilence(enabled, waveform) {
    skipSilence = enabled;
    silenceRanges = enabled ? computeSilenceRanges(waveform || []) : [];
  }

  async function unload() {
    destroyed = true;
    const toUnload = sound;
    sound = null;
    if (toUnload) {
      await safely(() => toUnload.setOnPlaybackStatusUpdate(null));
      await safely(() => toUnload.unloadAsync());
    }
  }

  return { play, pause, seek, skip, setRate, setSkipSilence, unload, totalDurationMs };
}
