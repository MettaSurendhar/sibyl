import React, { useRef, useEffect } from 'react';
import { View, TouchableOpacity, Pressable, Animated, StyleSheet } from 'react-native';
import Text from '../theme/Text';
import Slider from '@react-native-community/slider';
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
				<View style={styles.miniPlayer}>
					<Slider
						style={{ width: '100%', height: 40 }}
						minimumValue={0}
						maximumValue={entry.totalDurationMs || 1}
						value={playbackPositionMs}
						minimumTrackTintColor={theme.accent}
						maximumTrackTintColor={theme.teal}
						thumbTintColor="#FFFFFF"
						onSlidingComplete={(v) => onSeek(entry, v)}
					/>
					<View style={styles.miniTimeRow}>
						<Text style={[styles.miniTime, { color: theme.textMuted }]}>
							{formatDuration(playbackPositionMs)}
						</Text>
						<Text style={[styles.miniTime, { color: theme.textMuted }]}>
							{formatDuration(entry.totalDurationMs)}
						</Text>
					</View>
				</View>
			)}
			</Animated.View>
		</Pressable>
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
		marginTop: -6,
	},
	miniTime: { fontSize: 11 },
});
