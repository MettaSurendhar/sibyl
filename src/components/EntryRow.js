import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Slider from '@react-native-community/slider';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { formatDuration, timeLabel, fullDateTimeLabel } from '../utils/format';
import { UNTAGGED_COLOR, UNTAGGED_ICON } from '../utils/tagColors';

export default function EntryRow({
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

	return (
		<TouchableOpacity
			activeOpacity={0.8}
			onPress={() => (editMode ? onToggleSelect(entry.id) : onPressOpen(entry))}
			onLongPress={() => !editMode && onLongPress && onLongPress(entry)}
			style={[
				styles.row,
				{
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
					<Text style={[styles.subtitle, { color: theme.textMuted }]}>
						{entry.categoryIcon || UNTAGGED_ICON} {entry.categoryName || 'Untagged'} ·{' '}
						{showAbsoluteDate
							? fullDateTimeLabel(entry.updatedAt)
							: timeLabel(entry.updatedAt)}
					</Text>
				</View>

				<Text style={[styles.duration, { color: theme.textMuted }]}>
					{formatDuration(entry.totalDurationMs)}
				</Text>

				{editMode ? (
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
				) : (
					<TouchableOpacity
						onPress={() => onPressPlay(entry)}
						style={[styles.playBtn, { backgroundColor: theme.surfaceAlt }]}
					>
						<Feather
							name={isPlayingHere ? 'pause' : 'play'}
							size={16}
							color={theme.text}
							style={isPlayingHere ? undefined : { marginLeft: 2 }}
						/>
					</TouchableOpacity>
				)}
			</View>

			{isActiveHere && (
				<View style={styles.miniPlayer}>
					<Slider
						style={{ width: '100%', height: 28 }}
						minimumValue={0}
						maximumValue={entry.totalDurationMs || 1}
						value={playbackPositionMs}
						minimumTrackTintColor={entry.categoryColor || theme.accent}
						maximumTrackTintColor={theme.waveformMuted}
						thumbTintColor={entry.categoryColor || theme.accent}
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
		</TouchableOpacity>
	);
}

const styles = StyleSheet.create({
	row: { borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 10 },
	topLine: { flexDirection: 'row', alignItems: 'center' },
	checkboxWrap: { marginLeft: 14 },
	title: { fontSize: 16, fontWeight: '600' },
	subtitle: { fontSize: 13, marginTop: 2 },
	duration: { fontSize: 13, marginLeft: 10 },
	playBtn: {
		width: 36,
		height: 36,
		borderRadius: 18,
		alignItems: 'center',
		justifyContent: 'center',
		marginLeft: 12,
	},
	miniPlayer: { marginTop: 4 },
	miniTimeRow: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		marginTop: -6,
	},
	miniTime: { fontSize: 11 },
});
