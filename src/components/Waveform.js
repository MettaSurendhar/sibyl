import React, { useEffect, useRef, useState, useMemo } from 'react';
import { View, StyleSheet, Animated, Easing, PanResponder } from 'react-native';
import Text from '../theme/Text';

const SAMPLE_INTERVAL_MS = 100;
const MAX_BARS = 60;
// Cap on bars actually rendered in the scrolling playback track.
// A 1-hour recording = 36,000 samples — rendering all as Views hangs the screen for seconds.
// We downsample to this many bars; each bar represents a chunk of real samples.
const MAX_RENDER_BARS = 800;

// Generates a natural-looking dB value for a given sample index using layered sine waves.
// Used as a fallback for imported audio that has no real waveform data.
// Produces bars between -40 and -5 dB — tall and visually rich like a music spectrum.
function dummyDbForIndex(i) {
  const t = i * 0.05;
  const combined =
    Math.sin(t * 1.0) * 12 +
    Math.sin(t * 2.7 + 1.2) * 8 +
    Math.sin(t * 7.3 + 0.6) * 5 +
    Math.sin(t * 13.1 + 2.1) * 3;
  return Math.max(-40, Math.min(-5, -20 + combined * 0.55));
}

function formatMs(ms) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// padToFullDuration removed - padding is now handled implicitly during windowing lookup

// Downsample removed - we use windowing now to prevent squishing the timeline width
// Scrolling ruler synced to the live waveform: a labeled mm:ss tick every second,
// with fine unlabeled ticks every ~100ms in between.
// IMPORTANT: ticks are keyed off the sample INDEX (deterministic, one new sample every ~100ms),
// not the raw elapsed-ms clock - real timing jitters slightly render to render, which made the
// old version flicker as ticks flipped between major/minor. Index-based math never jitters.
export function WaveformRuler({ sampleCount, barWidth = 3, gap = 2 }) {
  const slotWidth = barWidth + gap;
  const ticks = [];
  for (let i = 0; i < MAX_BARS; i++) {
    const sampleIndex = sampleCount - (MAX_BARS - 1 - i);
    const valid = sampleIndex >= 0;
    const isMajor = valid && sampleIndex % 10 === 0;
    const t = sampleIndex * SAMPLE_INTERVAL_MS;
    ticks.push({ t, isMajor, valid, key: i });
  }
  return (
    <View style={rulerStyles.row}>
      {ticks.map(({ t, isMajor, valid, key }) => (
        <View key={key} style={{ width: slotWidth, alignItems: 'center' }}>
          {isMajor && valid && <Text style={rulerStyles.label}>{formatMs(t)}</Text>}
          <View style={[rulerStyles.tick, isMajor && valid && rulerStyles.tickMajor]} />
        </View>
      ))}
    </View>
  );
}

export function ScrollingPlaybackTrack({
  waveform,
  positionMs,
  totalDurationMs,
  color,
  mutedColor,
  rulerColor = '#9AA0AC',
  height = 170,
  barWidth = 3,
  gap = 2,
  onSeek,
}) {
  const [containerWidth, setContainerWidth] = useState(0);
  const translateX = useRef(new Animated.Value(0)).current;
  const draggingRef = useRef(false);
  const dragStartIndexRef = useRef(0);
  const dragLatestIndexRef = useRef(0);
  const positionMsRef = useRef(positionMs);
  const totalDurationMsRef = useRef(totalDurationMs);
  const slotWidth = barWidth + gap;
  const waveHeight = height - 30; // reserve top ~30px for the ruler row

  // Always use the real physical width so the ruler ticks are spaced correctly
  const totalSamples = Math.max(waveform.length, Math.ceil((totalDurationMs || 0) / SAMPLE_INTERVAL_MS));
  const fullWidth = totalSamples * slotWidth;

  const indexForMs = (ms) => ms / SAMPLE_INTERVAL_MS;
  const targetForIndex = (idx) => (containerWidth / 2) - (idx * slotWidth) - (slotWidth / 2);

  useEffect(() => {
    positionMsRef.current = positionMs;
    totalDurationMsRef.current = totalDurationMs;
  }, [positionMs, totalDurationMs]);

  useEffect(() => {
    if (draggingRef.current || !containerWidth) return;
    Animated.timing(translateX, {
      toValue: targetForIndex(indexForMs(positionMs)),
      duration: SAMPLE_INTERVAL_MS,
      easing: Easing.linear,
      useNativeDriver: true,
    }).start();
  }, [positionMs, containerWidth]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        draggingRef.current = true;
        dragStartIndexRef.current = indexForMs(positionMsRef.current);
        dragLatestIndexRef.current = dragStartIndexRef.current;
      },
      onPanResponderMove: (evt, gesture) => {
        const maxIndex = totalDurationMsRef.current / SAMPLE_INTERVAL_MS;
        const newIndex = Math.max(0, Math.min(maxIndex, dragStartIndexRef.current - gesture.dx / slotWidth));
        dragLatestIndexRef.current = newIndex;
        translateX.setValue(targetForIndex(newIndex));
      },
      onPanResponderRelease: () => {
        draggingRef.current = false;
        onSeek && onSeek(dragLatestIndexRef.current * SAMPLE_INTERVAL_MS);
      },
    })
  ).current;

  const currentIndex = Math.round(positionMs / SAMPLE_INTERVAL_MS);

  // WINDOWING: only render the bars and ticks that are currently visible on screen.
  // This completely eliminates React render lag (rendering 100 views instead of 800-20,000 views).
  const visibleBarsCount = containerWidth ? Math.ceil(containerWidth / slotWidth) : 0;
  // Add a buffer of half a screen on each side to ensure smooth scrolling
  const buffer = Math.floor(visibleBarsCount / 2);
  const visibleStart = Math.max(0, currentIndex - visibleBarsCount / 2 - buffer);
  const visibleEnd = Math.min(totalSamples, currentIndex + visibleBarsCount / 2 + buffer);

  const visibleTicks = [];
  for (let i = Math.floor(visibleStart / 10) * 10; i <= visibleEnd; i += 10) {
    if (i >= 0 && i < totalSamples) visibleTicks.push({ index: i, t: i * SAMPLE_INTERVAL_MS });
  }

  const visibleBars = [];
  for (let i = Math.floor(visibleStart); i <= Math.ceil(visibleEnd); i++) {
    if (i >= 0 && i < totalSamples) {
      // Use real waveform data if available, otherwise generate dummy pattern on-the-fly
      const db = i < waveform.length ? waveform[i] : dummyDbForIndex(i);
      visibleBars.push({ index: i, db });
    }
  }

  return (
    <View
      style={{ height, width: '100%', overflow: 'hidden' }}
      onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
      {...panResponder.panHandlers}
    >
      <View pointerEvents="none" style={[styles.playhead, { left: containerWidth / 2 - 1, height, backgroundColor: color, zIndex: 10 }]} />

      <Animated.View style={{ height: 26, width: fullWidth, transform: [{ translateX }] }}>
        {visibleTicks.map(({ index, t }) => (
          <Text
            key={index}
            style={[
              rulerStyles.floatingLabel,
              { left: index * slotWidth - 16, color: rulerColor },
            ]}
          >
            {formatMs(t)}
          </Text>
        ))}
      </Animated.View>

      <Animated.View style={[styles.row, { height: waveHeight, width: fullWidth, transform: [{ translateX }] }]}>
        {visibleBars.map(({ index, db }) => {
          const clamped = Math.max(-60, Math.min(0, db));
          const h = Math.max(3, ((clamped + 60) / 60) * waveHeight);
          const played = index <= currentIndex;
          return (
            <View
              key={index}
              style={{
                position: 'absolute',
                left: index * slotWidth + (gap / 2),
                width: barWidth,
                height: h,
                top: (waveHeight - h) / 2,
                borderRadius: barWidth / 2,
                backgroundColor: played ? color : mutedColor,
                opacity: played ? 1 : 0.5,
              }}
            />
          );
        })}
      </Animated.View>
    </View>
  );
}

// Static ruler for a fixed-duration track: evenly spaced mm:ss labels across the full
// waveform width, not scrolling. (Kept for any screen that wants a non-moving overview ruler.)
export function StaticWaveformRuler({ totalDurationMs, segments = 6 }) {
  const marks = [];
  for (let i = 0; i <= segments; i++) {
    marks.push((totalDurationMs * i) / segments);
  }
  return (
    <View style={rulerStyles.staticRow}>
      {marks.map((t, i) => (
        <Text key={i} style={rulerStyles.staticLabel}>
          {formatMs(t)}
        </Text>
      ))}
    </View>
  );
}

const rulerStyles = StyleSheet.create({
  row: { flexDirection: 'row', height: 26 },
  label: { fontSize: 9, color: '#9AA0AC', position: 'absolute', top: -2, left: -10, width: 40, textAlign: 'center' },
  tick: { width: 1, height: 4, backgroundColor: '#5A5F6A', marginTop: 20 },
  tickMajor: { height: 7, marginTop: 17, backgroundColor: '#8A909C' },
  staticRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  staticLabel: { fontSize: 10, color: '#9AA0AC' },
  floatingLabel: { position: 'absolute', top: 0, width: 32, fontSize: 10, textAlign: 'center' },
});

// dB (~-60 quiet to 0 loud) -> 0..1 bar height, with a floor so silence still shows a thin line
function dbToHeight(db) {
  const clamped = Math.max(-60, Math.min(0, db));
  return (clamped + 60) / 60; // 0..1
}

// Live recording waveform: renders the most recent N samples as scrolling bars, like a native
// recorder. Single color only - no separate "peak" tint (removed per feedback: alternating
// colors read as a bug, not a feature). Grey/muted is reserved for not-yet-recorded space only.
export function LiveWaveform({ samples, color, height = 90, barWidth = 3, gap = 2 }) {
  const maxBars = 60;
  const visible = samples.slice(-maxBars);
  const padded = Array(Math.max(0, maxBars - visible.length)).fill(-60).concat(visible);

  return (
    <View style={[styles.row, { height }]}>
      {padded.map((db, i) => {
        const h = Math.max(4, dbToHeight(db) * height);
        return (
          <View
            key={i}
            style={{
              width: barWidth,
              marginHorizontal: gap / 2,
              height: h,
              borderRadius: barWidth / 2,
              backgroundColor: color,
            }}
          />
        );
      })}
    </View>
  );
}

// Static waveform for an entry row / trim minimap, drawn from stored samples, with a progress wipe.
export function StaticWaveform({ waveform, progress = 0, color, mutedColor, totalDurationMs, height = 60, barWidth = 3, gap = 2 }) {
  const sourceLength = Math.max(waveform.length, Math.ceil((totalDurationMs || 0) / SAMPLE_INTERVAL_MS));
  const maxBars = 80;
  const step = Math.max(1, Math.floor(sourceLength / maxBars));
  const bars = [];
  for (let i = 0; i < sourceLength; i += step) {
    bars.push(i < waveform.length ? waveform[i] : -60);
  }

  return (
    <View style={[styles.row, { height }]}>
      {bars.map((db, i) => {
        const h = Math.max(3, dbToHeight(db) * height);
        const isPlayed = i / bars.length <= progress;
        return (
          <View
            key={i}
            style={{
              width: barWidth,
              marginHorizontal: gap / 2,
              height: h,
              borderRadius: barWidth / 2,
              backgroundColor: isPlayed ? color : mutedColor,
            }}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  playhead: {
    position: 'absolute',
    top: 0,
    width: 2,
    zIndex: 2,
    borderRadius: 1,
  },
});
