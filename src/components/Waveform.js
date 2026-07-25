import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Easing, PanResponder } from 'react-native';

const SAMPLE_INTERVAL_MS = 100;
const MAX_BARS = 60;

function formatMs(ms) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// If the stored waveform is shorter than the audio's real duration (can happen after an
// edit operation touches duration/waveform slightly out of step), pad the tail with silence
// so the track always visually spans its full length instead of cutting off partway through.
function padToFullDuration(waveform, totalDurationMs) {
  const expectedSamples = Math.ceil((totalDurationMs || 0) / SAMPLE_INTERVAL_MS);
  if (waveform.length >= expectedSamples) return waveform;
  return waveform.concat(Array(expectedSamples - waveform.length).fill(-60));
}

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

// Moving playback TRACK: ruler ticks + waveform bars share exactly one Animated.Value, so they
// scroll in perfect lockstep under a fixed center playhead - the same motion language as the
// live recording waveform (which also scrolls, just append-driven instead of position-driven).
// Single-color only: played = color, not-yet-played/silent = mutedColor (grey). No peak tier.
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
  const slotWidth = barWidth + gap;
  const waveHeight = height - 30; // reserve top ~30px for the ruler row
  const displayWaveform = padToFullDuration(waveform, totalDurationMs);

  const indexForMs = (ms) => ms / SAMPLE_INTERVAL_MS;
  const targetForIndex = (idx) => containerWidth / 2 - idx * slotWidth - slotWidth / 2;

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
        dragStartIndexRef.current = indexForMs(positionMs);
        dragLatestIndexRef.current = dragStartIndexRef.current;
      },
      onPanResponderMove: (evt, gesture) => {
        const maxIndex = totalDurationMs / SAMPLE_INTERVAL_MS;
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
  const totalSamples = Math.max(displayWaveform.length, Math.ceil(totalDurationMs / SAMPLE_INTERVAL_MS));

  // Ruler ticks span the same index range as the waveform bars, one tick per bar slot,
  // a labeled mm:ss every ~1s (every 10 samples).
  const ticks = [];
  for (let i = 0; i < totalSamples; i++) {
    if (i % 10 === 0) ticks.push({ index: i, t: i * SAMPLE_INTERVAL_MS });
  }

  return (
    <View
      style={{ height, width: '100%', overflow: 'hidden' }}
      onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
      {...panResponder.panHandlers}
    >
      <View pointerEvents="none" style={[styles.playhead, { left: containerWidth / 2 - 1, height, backgroundColor: color }]} />

      <Animated.View style={{ height: 26, transform: [{ translateX }] }}>
        {ticks.map(({ index, t }) => (
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

      <Animated.View style={[styles.row, { height: waveHeight, transform: [{ translateX }] }]}>
        {displayWaveform.map((db, i) => {
          const clamped = Math.max(-60, Math.min(0, db));
          const h = Math.max(3, ((clamped + 60) / 60) * waveHeight);
          const played = i <= currentIndex;
          return (
            <View
              key={i}
              style={{
                width: barWidth,
                marginHorizontal: gap / 2,
                height: h,
                borderRadius: barWidth / 2,
                backgroundColor: played ? color : mutedColor,
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
  const source = totalDurationMs ? padToFullDuration(waveform, totalDurationMs) : waveform;
  const maxBars = 80;
  const step = Math.max(1, Math.floor(source.length / maxBars));
  const bars = [];
  for (let i = 0; i < source.length; i += step) bars.push(source[i]);

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
