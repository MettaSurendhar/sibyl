import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { getStreakCount, getRecentEntries } from '../db/entries';
import { formatDuration } from '../utils/format';

export function greetingForNow() {
	const h = new Date().getHours();
	if (h < 5) return 'Still up?';
	if (h < 12) return 'Good morning';
	if (h < 17) return 'Good afternoon';
	if (h < 21) return 'Good evening';
	return 'Good night';
}

// Small context header rendered above the Record screen's own UI: a time-of-day greeting, a
// streak pill (only shown once there's a streak to show), and a one-line tappable preview of
// the most recent recording that jumps straight to it in Playback. Purely additive - it doesn't
// touch anything about the recording flow itself.
export default function HomeHeader({ navigation }) {
	const { theme } = useTheme();
	const [streak, setStreak] = useState(0);
	const [lastEntry, setLastEntry] = useState(null);

	useFocusEffect(
		useCallback(() => {
			getStreakCount().then(setStreak);
			getRecentEntries(1).then((rows) => setLastEntry(rows[0] || null));
		}, []),
	);

	return (
		<View style={styles.wrap}>
			<View style={styles.topRow}>
				<Text style={[styles.greeting, { color: theme.text }]}>
					{greetingForNow()}
				</Text>
				{streak > 0 && (
					<View
						style={[styles.streakPill, { backgroundColor: theme.surfaceAlt }]}
					>
						<Feather
							name='zap'
							size={13}
							color={theme.accent}
							style={{ marginRight: 4 }}
						/>
						<Text style={[styles.streakText, { color: theme.text }]}>
							{streak}-day streak
						</Text>
					</View>
				)}
			</View>

			{lastEntry && (
				<TouchableOpacity
					style={[
						styles.lastRow,
						{ backgroundColor: theme.surfaceAlt, borderColor: theme.border },
					]}
					onPress={() =>
						navigation.navigate('Playback', { entryId: lastEntry.id })
					}
				>
					<Feather
						name='clock'
						size={14}
						color={theme.textMuted}
						style={{ marginRight: 8 }}
					/>
					<Text
						style={[styles.lastText, { color: theme.textMuted }]}
						numberOfLines={1}
					>
						{lastEntry.title} · {lastEntry.categoryName || 'Untagged'} ·{' '}
						{formatDuration(lastEntry.totalDurationMs)}
					</Text>
					<Feather
						name='chevron-right'
						size={14}
						color={theme.textMuted}
					/>
				</TouchableOpacity>
			)}
		</View>
	);
}

const styles = StyleSheet.create({
	wrap: { width: '100%', marginBottom: 4 },
	topRow: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		marginBottom: 10,
	},
	greeting: { fontSize: 20, fontWeight: '700' },
	streakPill: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingVertical: 5,
		paddingHorizontal: 10,
		borderRadius: 14,
	},
	streakText: { fontSize: 12, fontWeight: '700' },
	lastRow: {
		flexDirection: 'row',
		alignItems: 'center',
		borderWidth: 1,
		borderRadius: 12,
		padding: 10,
	},
	lastText: { flex: 1, fontSize: 12.5 },
});
