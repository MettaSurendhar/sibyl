import React, { useRef, useEffect, useState } from 'react';
import { View, TouchableOpacity, Pressable, Animated, StyleSheet, PanResponder } from 'react-native';
import Text from '../theme/Text';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { formatDuration, timeLabel, fullDateTimeLabel } from '../utils/format';
import { UNTAGGED_COLOR, UNTAGGED_ICON, iconForCategory } from '../utils/tagColors';

export default React.memo(function EntryRow({
	entry,
	isActiveHere,
	isPlayingHere,
	playbackPositionMs,
	editMode,
	selected,
	onToggleSelect,
	onPressPlay,
	onPressOpen,
	onSeek,
	showAbsoluteDate,
	onLongPress,
	onSliderActiveChange,
}) {
	const { theme } = useTheme();

	const scaleAnim = useRef(new Animated.Value(1)).current;
	const editAnim = useRef(new Animated.Value(editMode ? 1 : 0)).current;

	useEffect(() => {
		Animated.timing(editAnim, {
			toValue: editMode ? 1 : 0,
			duration: 200,
			useNativeDriver: true,
		}).start();
	}, [editMode, editAnim]);

	const handlePressIn = () => {
		Animated.spring(scaleAnim, {
			toValue: 0.96,
			useNativeDriver: true,
			speed: 40,
		}).start();
	};

	const handlePressOut = () => {
		Animated.spring(scaleAnim, {
			toValue: 1,
			useNativeDriver: true,
			speed: 40,
		}).start();
	};

	return (
		<Pressable
			onPress={() => (editMode ? onToggleSelect(entry.id) : onPressOpen(entry))}
			onLongPress={() => !editMode && onLongPress && onLongPress(entry)}
			delayLongPress={300}
			onPressIn={handlePressIn}
			onPressOut={handlePressOut}
		>
			<Animated.View
				style={[
					styles.row,
					{
						transform: [{ scale: scaleAnim }],
						backgroundColor: isActiveHere ? theme.surfaceAlt : theme.surface,
						borderColor: isActiveHere
							? entry.categoryColor || theme.accent
							: theme.border,
						borderLeftWidth: 4,
						borderLeftColor: entry.categoryColor || UNTAGGED_COLOR,
					},
				]}
			>
			<View style={styles.topLine}>
				<View style={{ flex: 1 }}>
					<Text
						style={[styles.title, { color: theme.text }]}
						numberOfLines={1}
					>
						{entry.title}
					</Text>
					<View style={{ marginTop: 4 }}>
						<View style={{ flexDirection: 'row', alignItems: 'center' }}>
							<MaterialCommunityIcons name={iconForCategory({ icon: entry.categoryIcon || UNTAGGED_ICON })} size={12} color={theme.textMuted} />
							<Text style={[styles.subtitle, { color: theme.textMuted, marginTop: 0, marginLeft: 4 }]}>
								{entry.categoryName || 'Untagged'}
								{` · ${timeLabel(entry.updatedAt)}`}
							</Text>
						</View>
					</View>
					{entry.transcript ? (
						<Text style={[styles.transcriptSnippet, { color: theme.textMuted }]} numberOfLines={1}>
							"{entry.transcript}"
						</Text>
					) : entry.transcriptStatus === 'processing' ? (
						<View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
							<Feather name="loader" size={12} color={theme.textMuted} style={{ marginRight: 4 }} />
							<Text style={{ fontSize: 12, color: theme.textMuted, fontStyle: 'italic' }}>Transcribing...</Text>
						</View>
					) : null}
				</View>

				<Text style={[styles.duration, { color: theme.textMuted }]}>
					{formatDuration(entry.totalDurationMs)}
				</Text>

				<View style={{ width: 36, height: 36 }}>
					{/* Play Button */}
					<Animated.View 
						style={[
							StyleSheet.absoluteFill, 
							{ opacity: editAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }
						]} 
						pointerEvents={editMode ? 'none' : 'auto'}
					>
						<TouchableOpacity
							onPress={() => onPressPlay(entry)}
							style={[styles.playBtn, { backgroundColor: isActiveHere ? theme.accent : theme.surfaceAlt }]}
						>
							<Feather
								name={isPlayingHere ? 'pause' : 'play'}
								size={16}
								color={isActiveHere ? theme.accentDeep : theme.text}
								style={isPlayingHere ? undefined : { marginLeft: 2 }}
							/>
						</TouchableOpacity>
					</Animated.View>

					{/* Checkbox */}
					<Animated.View 
						style={[
							StyleSheet.absoluteFill, 
							{ 
								opacity: editAnim, 
								transform: [{ scale: editAnim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) }] 
							}
						]} 
						pointerEvents={editMode ? 'auto' : 'none'}
					>
						<TouchableOpacity
							onPress={() => onToggleSelect(entry.id)}
							style={styles.checkboxWrap}
						>
							<Feather
								name={selected ? 'check-square' : 'square'}
								size={22}
								color={selected ? theme.accent : theme.textMuted}
							/>
						</TouchableOpacity>
					</Animated.View>
				</View>
			</View>

			{isActiveHere && (
				<MiniPlayer
					entry={entry}
					playbackPositionMs={playbackPositionMs}
					onSeek={onSeek}
					onSliderActiveChange={onSliderActiveChange}
					theme={theme}
				/>
			)}
			</Animated.View>
		</Pressable>
	);
});

const TRACK_HEIGHT = 6;
const THUMB_SIZE = 18;
const HIT_SLOP = 48; // massive tap area height

const CustomProgressBar = React.memo(({ positionMs, durationMs, accentColor, trackColor, onScrubStart, onScrubMove, onScrubEnd }) => {
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
				animX.setValue(x);
				
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

const MiniPlayer = React.memo(({ entry, playbackPositionMs, onSeek, onSliderActiveChange, theme }) => {
	const [scrubPos, setScrubPos] = useState(null);

	return (
		<View style={styles.miniPlayer}>
			<CustomProgressBar
				positionMs={scrubPos !== null ? scrubPos : playbackPositionMs}
				durationMs={entry.totalDurationMs || 1}
				accentColor={theme.accent}
				trackColor={theme.teal}
				onScrubStart={(ms) => {
					setScrubPos(ms);
					onSliderActiveChange?.(true);
				}}
				onScrubEnd={(ms) => {
					setScrubPos(null);
					onSliderActiveChange?.(false);
					onSeek(entry, ms);
				}}
			/>
			<View style={styles.miniTimeRow}>
				<Text style={[styles.miniTime, { color: theme.textMuted }]}>
					{formatDuration(scrubPos !== null ? scrubPos : playbackPositionMs)}
				</Text>
				<Text style={[styles.miniTime, { color: theme.textMuted }]}>
					{formatDuration(entry.totalDurationMs)}
				</Text>
			</View>
		</View>
	);
});

const styles = StyleSheet.create({
	row: { borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 10 },
	topLine: { flexDirection: 'row', alignItems: 'center' },
	title: { fontSize: 16, fontWeight: '600' },
	subtitle: { fontSize: 12, marginTop: 4 },
	transcriptSnippet: { fontSize: 13, marginTop: 4, fontStyle: 'italic' },
	duration: { fontSize: 13, fontWeight: '600', marginRight: 14, minWidth: 40, textAlign: 'right' },
	playBtn: {
		width: 36,
		height: 36,
		borderRadius: 18,
		alignItems: 'center',
		justifyContent: 'center',
	},
	checkboxWrap: {
		width: 36,
		height: 36,
		alignItems: 'center',
		justifyContent: 'center',
	},
	miniPlayer: {
		paddingTop: 14,
		marginTop: 8,
		borderTopWidth: StyleSheet.hairlineWidth,
		borderColor: 'rgba(150,150,150,0.2)',
	},
	miniTimeRow: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		marginTop: 4,
	},
	miniTime: { fontSize: 11 },
	track: {
		height: TRACK_HEIGHT,
		borderRadius: TRACK_HEIGHT / 2,
		overflow: 'hidden',
	},
	trackFill: {
		height: '100%',
	},
	thumbHit: {
		position: 'absolute',
		width: HIT_SLOP,
		height: HIT_SLOP,
		borderRadius: HIT_SLOP / 2,
		alignItems: 'center',
		justifyContent: 'center',
		top: 0,
		backgroundColor: 'transparent',
	},
	thumb: {
		width: THUMB_SIZE,
		height: THUMB_SIZE,
		borderRadius: THUMB_SIZE / 2,
		backgroundColor: '#FFFFFF',
		elevation: 4,
		shadowColor: '#000',
		shadowOpacity: 0.3,
		shadowRadius: 3,
		shadowOffset: { width: 0, height: 1 },
	},
});
