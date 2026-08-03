import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { getAllTagCounts, getPieBreakdown } from '../db/categories';
import { getStreakCount, getDailyEntryCounts } from '../db/entries';
import TagCountBoxes from '../components/home/TagCountBoxes';
import GraphCarousel from '../components/home/GraphCarousel';

const DAY_MS = 24 * 60 * 60 * 1000;
const LINE_CHART_DAYS = 14;
const HEATMAP_WEEKS = 20; // ~4-5 months; kept screen-width-sized, see ActivityHeatmap comment

// Home dashboard: tag count boxes up top, three swipeable graphs below (streak line, pie,
// activity heatmap). Replaces the old "Still up? / streak pill / recent entries" layout per
// the phase plan - the overall streak still gets a small mention, just folded into the
// header instead of being the whole screen's identity.
export default function TodayScreen({ navigation }) {
	const { theme } = useTheme();
	const insets = useSafeAreaInsets();
	const [tagCounts, setTagCounts] = useState([]);
	const [overallStreak, setOverallStreak] = useState(0);
	const [dailyRows, setDailyRows] = useState([]);
	const [pieSlices, setPieSlices] = useState([]);

	const refresh = useCallback(() => {
		const now = Date.now();
		const heatmapFrom = now - HEATMAP_WEEKS * 7 * DAY_MS;
		Promise.all([
			getAllTagCounts(),
			getStreakCount(),
			getDailyEntryCounts({ from: heatmapFrom, to: now }),
			getPieBreakdown(),
		]).then(([tags, streak, daily, pie]) => {
			setTagCounts(tags);
			setOverallStreak(streak);
			setDailyRows(daily);
			setPieSlices(pie);
		});
	}, []);

	useFocusEffect(
		useCallback(() => {
			refresh();
		}, [refresh]),
	);

	return (
		<ScrollView
			style={[styles.container, { backgroundColor: theme.bg }]}
			contentContainerStyle={{
				paddingTop: insets.top + 20,
				paddingBottom: insets.bottom + 140,
			}}
			showsVerticalScrollIndicator={false}
		>
			<View style={styles.headerRow}>
				<Text style={[styles.title, { color: theme.text }]}>Home</Text>
				{overallStreak > 0 && (
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
							{overallStreak}-day overall streak
						</Text>
					</View>
				)}
			</View>

			<TagCountBoxes tags={tagCounts} />

			<GraphCarousel
				tags={tagCounts}
				dailyRows={dailyRows}
				pieSlices={pieSlices}
				lineChartDays={LINE_CHART_DAYS}
				heatmapWeeks={HEATMAP_WEEKS}
			/>
		</ScrollView>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1 },
	headerRow: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		paddingHorizontal: 20,
		marginBottom: 18,
	},
	title: { fontSize: 24, fontWeight: '700' },
	streakPill: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingVertical: 5,
		paddingHorizontal: 10,
		borderRadius: 14,
	},
	streakText: { fontSize: 12, fontWeight: '700' },
});
