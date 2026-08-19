import TrackPlayer, {
  Capability,
  State,
  AppKilledPlaybackBehavior,
  RepeatMode,
} from 'react-native-track-player';

const SAMPLE_INTERVAL_MS = 100;
const SILENCE_DB_THRESHOLD = -45;
const MIN_SILENCE_MS = 700;

// Computes quiet ranges from a waveform for the "Skip Silence" feature.
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

let isPlayerSetup = false;

async function ensureSetup() {
  if (isPlayerSetup) return;
  try {
    await TrackPlayer.setupPlayer({
      // Android: bufferSize = 5s, prevents gap at segment boundary
      minBuffer: 5,
      maxBuffer: 20,
      backBuffer: 5,
      waitForBuffer: true,
    });
    isPlayerSetup = true;
  } catch (e) {
    if (e.message && e.message.includes('already been initialized')) {
      isPlayerSetup = true;
    } else {
      throw e;
    }
  }

  await TrackPlayer.updateOptions({
    android: {
      appKilledPlaybackBehavior: AppKilledPlaybackBehavior.StopPlaybackAndRemoveNotification,
    },
    // Show full set of capabilities in the expanded notification
    capabilities: [
      Capability.Play,
      Capability.Pause,
      Capability.SkipToNext,
      Capability.SkipToPrevious,
      Capability.SeekTo,
      Capability.Stop,
    ],
    // Only Play/Pause/Skip in the collapsed (compact) notification
    compactCapabilities: [
      Capability.Play,
      Capability.Pause,
      Capability.SkipToNext,
    ],
    // Lock-screen / notification icon — use the app icon
    notificationCapabilities: [
      Capability.Play,
      Capability.Pause,
      Capability.SkipToNext,
      Capability.SkipToPrevious,
    ],
    icon: require('../../assets/icon.png'),
  });
}

// Module-level counter so unloaded players' intervals auto-stop.
let activePlayerId = 0;

/**
 * Creates a player that plays a list of segments [{uri, durationMs}] as one
 * seamless timeline using react-native-track-player.
 *
 * Returns { play, pause, seek, skip, setSkipSilence, unload }.
 * The onStatus callback receives { finished, positionMs, totalDurationMs, isPlaying }.
 */
export function createPlayer({ segments, onStatus }) {
  const myId = ++activePlayerId;
  let destroyed = false;
  let skipSilence = false;
  let silenceRanges = [];
  let tickInterval = null;

  // Cumulative segment start times in ms — built once.
  const segmentStartMs = [];
  let acc = 0;
  for (const seg of segments) {
    segmentStartMs.push(acc);
    acc += seg.durationMs;
  }
  const totalDurationMs = acc;

  // Convert segments to TrackPlayer track objects.
  const tracks = segments.map((s, i) => ({
    id: String(i),
    url: s.uri,
    title: 'Voice Recording',
    artist: 'Sibyl',
    artwork: require('../../assets/icon.png'),
    // duration in seconds — TrackPlayer uses this for the seekbar
    duration: s.durationMs / 1000,
  }));

  async function load() {
    await ensureSetup();
    if (destroyed) return;
    await TrackPlayer.reset();
    await TrackPlayer.add(tracks);
    await TrackPlayer.setRepeatMode(RepeatMode.Off);
    startTicker();
  }

  // ─── Progress ticker ───────────────────────────────────────────────────────
  // TrackPlayer events work well for seeking but don't give global position
  // across segments. We poll every 100ms to compute it ourselves.
  function startTicker() {
    if (tickInterval) clearInterval(tickInterval);
    tickInterval = setInterval(async () => {
      if (destroyed || myId !== activePlayerId) {
        clearInterval(tickInterval);
        tickInterval = null;
        return;
      }
      if (Date.now() < ignoreTicksUntil) return;

      let stateObj, activeIndex, progress;
      try {
        [stateObj, activeIndex, progress] = await Promise.all([
          TrackPlayer.getPlaybackState(),
          TrackPlayer.getActiveTrackIndex(),
          TrackPlayer.getProgress(),
        ]);
      } catch {
        return; // player may be mid-reset
      }

      const currentState = stateObj?.state;
      const isPlaying = currentState === State.Playing;

      // Queue ended
      if (currentState === State.Ended) {
        onStatus?.({ finished: true, positionMs: totalDurationMs, totalDurationMs, isPlaying: false });
        return;
      }

      // Compute global position
      const trackIdx = activeIndex ?? 0;
      const posInSegMs = (progress?.position ?? 0) * 1000;
      let globalPosMs = (segmentStartMs[trackIdx] ?? 0) + posInSegMs;
      if (isNaN(globalPosMs) || globalPosMs < 0) globalPosMs = 0;

      // Skip-silence: jump over quiet stretches
      if (skipSilence && isPlaying) {
        const range = silenceRanges.find(
          (r) => globalPosMs >= r[0] && globalPosMs < r[1] - 150
        );
        if (range) {
          seek(range[1]).catch(() => {});
          return;
        }
      }

      onStatus?.({ finished: false, positionMs: globalPosMs, totalDurationMs, isPlaying });
    }, 100);
  }

  const loadPromise = load().catch((e) => console.warn('Player load error:', e));

  // ─── Controls ─────────────────────────────────────────────────────────────
  async function play() {
    if (destroyed) return;
    await loadPromise;
    await ensureSetup();
    let stateObj;
    try { stateObj = await TrackPlayer.getPlaybackState(); } catch {}
    if (stateObj?.state === State.Ended) {
      // Restart from the beginning if ended
      try { await TrackPlayer.skip(0); } catch {}
      await TrackPlayer.seekTo(0);
    }
    await TrackPlayer.play();
    if (!tickInterval) startTicker();
  }

  async function pause() {
    if (destroyed) return;
    await loadPromise;
    await ensureSetup();
    await TrackPlayer.pause();
  }

  let ignoreTicksUntil = 0;

  // Seek to absolute global position in ms.
  async function seek(globalMs) {
    if (destroyed) return;
    ignoreTicksUntil = Date.now() + 600; // Ignore native progress updates for 600ms to prevent UI jitter
    await loadPromise;
    const clamped = Math.max(0, Math.min(globalMs, totalDurationMs - 1));

    // Find which segment this position falls in
    let targetIdx = segments.length - 1;
    for (let i = 0; i < segments.length; i++) {
      if (clamped < segmentStartMs[i] + segments[i].durationMs) {
        targetIdx = i;
        break;
      }
    }
    const posInSegMs = clamped - segmentStartMs[targetIdx];

    const currentIdx = await TrackPlayer.getActiveTrackIndex();
    if (currentIdx !== targetIdx) {
      await TrackPlayer.skip(targetIdx);
    }
    await TrackPlayer.seekTo(posInSegMs / 1000);
    
    // Manually force one status update immediately so UI feels responsive
    let stateObj;
    try { stateObj = await TrackPlayer.getPlaybackState(); } catch {}
    const isPlaying = stateObj?.state === State.Playing;
    onStatus?.({ finished: false, positionMs: clamped, totalDurationMs, isPlaying });
  }

  // Relative skip (+/- ms from current position).
  async function skip(deltaMs) {
    if (destroyed) return;
    await loadPromise;
    let stateObj, activeIndex, progress;
    try {
      [stateObj, activeIndex, progress] = await Promise.all([
        TrackPlayer.getPlaybackState(),
        TrackPlayer.getActiveTrackIndex(),
        TrackPlayer.getProgress(),
      ]);
    } catch {
      return;
    }
    const trackIdx = activeIndex ?? 0;
    const posInSegMs = (progress?.position ?? 0) * 1000;
    const globalPosMs = (segmentStartMs[trackIdx] ?? 0) + posInSegMs;
    await seek(globalPosMs + deltaMs);
  }

  function setSkipSilence(enabled, ranges = []) {
    skipSilence = enabled;
    silenceRanges = ranges;
  }

  async function unload() {
    destroyed = true;
    if (tickInterval) { clearInterval(tickInterval); tickInterval = null; }
    if (myId === activePlayerId) {
      try { await TrackPlayer.reset(); } catch {}
    }
  }

  return { play, pause, seek, skip, setSkipSilence, unload, ready: loadPromise };
}
