import React, { useCallback, useState } from 'react';
import {
	View,
	Text,
	TouchableOpacity,
	FlatList,
	StyleSheet,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { getStreakCount, getRecentEntries } from '../db/entries';
import { formatDuration, dateGroupLabel, timeLabel } from '../utils/format';
import { greetingForNow } from '../components/HomeHeader';

// NOTE: this screen's content (greeting/streak/recent-list) is unchanged from before -
// only its own floating record button was removed, since HomeLibraryPager now renders one
// persistent FloatingRecordButton above both Home and Library. Full content redesign
// (tag boxes + charts) is Phase 2, not this pass.
export default function TodayScreen({ navigation }) {
	const { theme } = useTheme();
	const insets = useSafeAreaInsets();
	const [streak, setStreak] = useState(0);
	const [recent, setRecent] = useState([]);

	const refresh = useCallback(() => {
		getStreakCount().then(setStreak);
		getRecentEntries(5).then(setRecent);
	}, []);

	useFocusEffect(
		useCallback(() => {
			refresh();
		}, [refresh]),
	);

	return (
		<View
			style={[
				styles.container,
				{ backgroundColor: theme.bg, paddingTop: insets.top + 20 },
			]}
		>
			<View style={styles.headerRow}>
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

			<Text style={[styles.sectionLabel, { color: theme.textMuted }]}>
				RECENT ENTRIES
			</Text>

			<FlatList
				data={recent}
				keyExtractor={(item) => item.id}
				contentContainerStyle={{
					paddingBottom: insets.bottom + 100,
					flexGrow: 1,
				}}
				ListEmptyComponent={
					<View style={styles.emptyWrap}>
						<Feather
							name='mic'
							size={26}
							color={theme.textMuted}
						/>
						<Text style={[styles.emptyTitle, { color: theme.text }]}>
							Nothing here yet
						</Text>
						<Text style={[styles.emptySubtitle, { color: theme.textMuted }]}>
							Tap the record button below to make your first entry.
						</Text>
					</View>
				}
				renderItem={({ item }) => (
					<TouchableOpacity
						style={[
							styles.entryRow,
							{ backgroundColor: theme.surface, borderColor: theme.border },
						]}
						onPress={() =>
							navigation.navigate('Playback', { entryId: item.id })
						}
					>
						<View style={{ flex: 1 }}>
							<Text
								style={[styles.entryTitle, { color: theme.text }]}
								numberOfLines={1}
							>
								{item.title}
							</Text>
							<Text style={[styles.entrySubtitle, { color: theme.textMuted }]}>
								{item.categoryName || 'Untagged'} ·{' '}
								{dateGroupLabel(item.updatedAt)}, {timeLabel(item.updatedAt)}
							</Text>
						</View>
						<Text style={[styles.entryDuration, { color: theme.textMuted }]}>
							{formatDuration(item.totalDurationMs)}
						</Text>
					</TouchableOpacity>
				)}
			/>
		</View>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, paddingHorizontal: 20 },
	headerRow: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		marginBottom: 18,
	},
	greeting: { fontSize: 24, fontWeight: '700' },
	streakPill: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingVertical: 5,
		paddingHorizontal: 10,
		borderRadius: 14,
	},
	streakText: { fontSize: 12, fontWeight: '700' },
	sectionLabel: {
		fontSize: 12,
		fontWeight: '700',
		letterSpacing: 0.5,
		marginBottom: 10,
	},
	entryRow: {
		flexDirection: 'row',
		alignItems: 'center',
		borderWidth: 1,
		borderRadius: 14,
		padding: 14,
		marginBottom: 10,
	},
	entryTitle: { fontSize: 15, fontWeight: '600' },
	entrySubtitle: { fontSize: 12.5, marginTop: 2 },
	entryDuration: { fontSize: 13, marginLeft: 10 },
	emptyWrap: { alignItems: 'center', paddingTop: 60 },
	emptyTitle: {
		fontSize: 16,
		fontWeight: '700',
		marginTop: 14,
		marginBottom: 4,
	},
	emptySubtitle: { fontSize: 13, textAlign: 'center', paddingHorizontal: 20 },
});
