import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, Animated, PanResponder } from 'react-native';
import Text from '../theme/Text';
import { formatDuration } from '../utils/format';

const TRACK_HEIGHT = 6;
const THUMB_SIZE = 18;
const HIT_SLOP = 48; // massive tap area height

export const CustomProgressBar = React.memo(({ positionMs, durationMs, accentColor, trackColor, onScrubStart, onScrubMove, onScrubEnd }) => {
	const [trackWidth, setTrackWidth] = useState(0);
	
	// Use Animated values for perfectly smooth 60fps tracking (bypasses React state)
	const animX = useRef(new Animated.Value(0)).current;
	const isScrubbing = useRef(false);
	const pendingSeekX = useRef(null); // holds the target X until audio catches up

	const stateRef = useRef({ trackWidth: 0, durationMs: 1, onScrubStart, onScrubMove, onScrubEnd, initialScrubX: 0 });
	stateRef.current = { ...stateRef.current, trackWidth, durationMs, onScrubStart, onScrubMove, onScrubEnd };

	const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

	// When not dragging, sync the Animated value with the audio's real position
	useEffect(() => {
		if (isScrubbing.current) return; // actively dragging — don't override
		if (trackWidth <= 0 || durationMs <= 0) return;

		const safePos = Number(positionMs) || 0;
		const safeDur = Number(durationMs) || 1;
		const audioX = clamp((safePos / safeDur) * trackWidth, 0, trackWidth);

		if (pendingSeekX.current !== null) {
			// Wait until audio position is within 2% of the seek target before releasing lock
			const threshold = trackWidth * 0.02;
			if (Math.abs(audioX - pendingSeekX.current) < threshold) {
				pendingSeekX.current = null; // audio caught up, release lock
			} else {
				return; // still waiting — don't let old positionMs snap thumb back
			}
		}

		animX.setValue(audioX);
	}, [positionMs, durationMs, trackWidth]);

	const panResponder = useRef(
		PanResponder.create({
			onStartShouldSetPanResponder: () => true,
			onMoveShouldSetPanResponder: () => true,
			onPanResponderGrant: (e) => {
				const { trackWidth: tw, durationMs: dm, onScrubStart: startCb } = stateRef.current;
				const stw = Number(tw) || 0;
				const sdm = Number(dm) || 1;
				const initialX = clamp(e.nativeEvent.locationX, 0, stw || 1);
				
				stateRef.current.initialScrubX = initialX;
				pendingSeekX.current = null; // cancel any pending seek if user touches again
				isScrubbing.current = true;
				animX.setValue(initialX);
				
				startCb?.((initialX / (stw || 1)) * sdm);
			},
			onPanResponderMove: (e, gestureState) => {
				const { trackWidth: tw, durationMs: dm, onScrubMove: moveCb, initialScrubX } = stateRef.current;
				const stw = Number(tw) || 0;
				const sdm = Number(dm) || 1;
				
				const x = clamp(initialScrubX + gestureState.dx, 0, stw || 1);
				animX.setValue(x); // update UI instantly (no setState lag)
				
				moveCb?.((x / (stw || 1)) * sdm);
			},
			onPanResponderRelease: (e, gestureState) => {
				const { trackWidth: tw, durationMs: dm, onScrubEnd: endCb, initialScrubX } = stateRef.current;
				const stw = Number(tw) || 0;
				const sdm = Number(dm) || 1;
				
				const x = clamp(initialScrubX + gestureState.dx, 0, stw || 1);
				pendingSeekX.current = x; // block useEffect until audio reaches this position
				isScrubbing.current = false;
				endCb?.((x / (stw || 1)) * sdm);
			},
			onPanResponderTerminate: () => {
				isScrubbing.current = false;
				pendingSeekX.current = null;
			}
		})
	).current;

	const translateX = animX.interpolate({
		inputRange: [0, trackWidth > 0 ? trackWidth : 1],
		outputRange: [-HIT_SLOP / 2, (trackWidth > 0 ? trackWidth : 1) - (HIT_SLOP / 2)],
		extrapolate: 'clamp'
	});

	// For the track fill width, we must also use an Animated.View
	const fillWidth = animX.interpolate({
		inputRange: [0, trackWidth > 0 ? trackWidth : 1],
		outputRange: ['0%', '100%'],
		extrapolate: 'clamp'
	});

	return (
		<View
			{...panResponder.panHandlers}
			pointerEvents="box-only"
			style={{ width: '100%', paddingVertical: HIT_SLOP / 2 - TRACK_HEIGHT / 2, justifyContent: 'center' }}
			onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
		>
			<View style={[styles.track, { backgroundColor: trackColor }]}>
				<Animated.View style={[styles.trackFill, { width: fillWidth, backgroundColor: accentColor }]} />
			</View>
			<Animated.View style={[styles.thumbHit, { transform: [{ translateX }] }]}>
				<View style={[styles.thumb]} />
			</Animated.View>
		</View>
	);
});

export const PlaybackSlider = React.memo(({ positionMs, totalDurationMs, seekTo, theme }) => {
	return (
		<>
			<CustomProgressBar
				positionMs={positionMs}
				durationMs={totalDurationMs || 1}
				accentColor={theme.accent}
				trackColor={theme.teal}
				onScrubEnd={(ms) => seekTo(ms)}
			/>
			<View style={styles.timeRow}>
				<Text style={{ color: theme.textMuted, fontSize: 12 }}>
					{formatDuration(positionMs)}
				</Text>
				<Text style={{ color: theme.textMuted, fontSize: 12 }}>
					{formatDuration(totalDurationMs)}
				</Text>
			</View>
		</>
	);
});

const styles = StyleSheet.create({
	track: {
		height: TRACK_HEIGHT,
		borderRadius: TRACK_HEIGHT / 2,
		overflow: 'hidden',
		width: '100%'
	},
	trackFill: {
		position: 'absolute',
		left: 0,
		top: 0,
		bottom: 0
	},
	thumbHit: {
		position: 'absolute',
		left: 0,
		width: HIT_SLOP,
		height: HIT_SLOP,
		alignItems: 'center',
		justifyContent: 'center',
	},
	thumb: {
		width: THUMB_SIZE,
		height: THUMB_SIZE,
		borderRadius: THUMB_SIZE / 2,
		backgroundColor: '#fff',
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.25,
		shadowRadius: 3.84,
		elevation: 5,
	},
	timeRow: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		marginTop: 8,
		paddingHorizontal: 4,
	},
});
