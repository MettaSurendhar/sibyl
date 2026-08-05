import React, { useCallback, useState, useEffect, useRef } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import Text from '../theme/Text';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { getAllTagCounts, getPieBreakdown } from '../db/categories';
import { getStreakCount, getDailyEntryCounts, getAnalyticsSummary } from '../db/entries';
import { getPrefs } from '../utils/settingsStore';
import GraphCarousel from '../components/home/GraphCarousel';

const DAY_MS = 24 * 60 * 60 * 1000;
const HEATMAP_WEEKS = 52;
const MAX_FETCH_DAYS = 365;

function dateKeyLocal(d) {
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
		d.getDate(),
	).padStart(2, '0')}`;
}

function buildStreakDays(dailyRows, count) {
	const totalsByDay = {};
	for (const row of dailyRows) {
		totalsByDay[row.dateKey] = (totalsByDay[row.dateKey] || 0) + row.count;
	}
	const result = [];
	const now = new Date();
	for (let i = count - 1; i >= 0; i--) {
		const d = new Date(now);
		d.setDate(d.getDate() - i);
		const key = dateKeyLocal(d);
		result.push({ key, hasRecording: (totalsByDay[key] || 0) > 0 });
	}
	return result;
}

function formatDuration(ms) {
	if (!ms) return '0m';
	const totalSeconds = Math.floor(ms / 1000);
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	if (hours > 0) return `${hours}h ${minutes}m`;
	return `${minutes}m`;
}

function getBestTimeOfDay(timeOfDay) {
	if (!timeOfDay) return 'N/A';
	let best = 'morning';
	let max = timeOfDay.morning;
	if (timeOfDay.afternoon > max) { best = 'Afternoon'; max = timeOfDay.afternoon; }
	if (timeOfDay.evening > max) { best = 'Evening'; max = timeOfDay.evening; }
	if (timeOfDay.night > max) { best = 'Night'; max = timeOfDay.night; }
	if (max === 0) return 'N/A';
	if (best === 'morning') return 'Morning';
	return best;
}

function AnimatedStreakDot({ day, index, theme }) {
	const anim = useRef(new Animated.Value(0)).current;

	useEffect(() => {
		Animated.timing(anim, {
			toValue: 1,
			duration: 300,
			delay: index * 20,
			useNativeDriver: true,
		}).start();
	}, [index]);

	return (
		<Animated.View
			style={[
				styles.streakDot,
				{
					backgroundColor: day.hasRecording ? theme.accent : theme.border,
					opacity: anim.interpolate({ inputRange: [0, 1], outputRange: [0, day.hasRecording ? 1 : 0.5] }),
					transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }],
				},
			]}
		/>
	);
}

export default function AnalyticsScreen({ navigation }) {
	const { theme } = useTheme();
	const insets = useSafeAreaInsets();
	const [tagCounts, setTagCounts] = useState([]);
	const [overallStreak, setOverallStreak] = useState(0);
	const [dailyRows, setDailyRows] = useState([]);
	const [pieSlices, setPieSlices] = useState([]);
	const [streakDays, setStreakDays] = useState(14);
	const [summary, setSummary] = useState({ totalTime: 0, totalEntries: 0, avgEntryLength: 0, timeOfDay: {} });

	const refresh = useCallback(() => {
		const now = Date.now();
		const fetchFrom = now - MAX_FETCH_DAYS * DAY_MS;
		Promise.all([
			getAllTagCounts(),
			getStreakCount(),
			getDailyEntryCounts({ from: fetchFrom, to: now }),
			getPieBreakdown(),
			getPrefs(),
			getAnalyticsSummary()
		]).then(([tags, streak, daily, pie, prefs, sum]) => {
			setTagCounts(tags);
			setOverallStreak(streak);
			setDailyRows(daily);
			setPieSlices(pie);
			setStreakDays(prefs.streakDays || 14);
			setSummary(sum);
		});
	}, []);

	useFocusEffect(
		useCallback(() => {
			refresh();
		}, [refresh]),
	);

	const streakDotList = buildStreakDays(dailyRows, streakDays);

	return (
		<View style={[styles.container, { backgroundColor: theme.bg }]}>
			<View style={[styles.topBar, { paddingTop: insets.top + 16, paddingHorizontal: 20 }]}>
				<TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 4, marginLeft: -4 }}>
					<Feather name='arrow-left' size={24} color={theme.text} />
				</TouchableOpacity>
				<Text style={[styles.headerTitle, { color: theme.text }]}>Analytics</Text>
				<View style={{ width: 32 }} />
			</View>

			<ScrollView
				contentContainerStyle={{
					paddingTop: 10,
					paddingBottom: insets.bottom + 20,
				}}
				showsVerticalScrollIndicator={false}
			>
				{/* Analytics Summary Cards */}
				<View style={styles.summaryGrid}>
					<View style={[styles.summaryCard, { backgroundColor: theme.surfaceAlt }]}>
						<Feather name='clock' size={16} color={theme.textMuted} style={{ marginBottom: 6 }} />
						<Text style={[styles.summaryValue, { color: theme.text }]}>{formatDuration(summary.totalTime)}</Text>
						<Text style={[styles.summaryLabel, { color: theme.textMuted }]}>Total Time</Text>
					</View>
					<View style={[styles.summaryCard, { backgroundColor: theme.surfaceAlt }]}>
						<Feather name='activity' size={16} color={theme.textMuted} style={{ marginBottom: 6 }} />
						<Text style={[styles.summaryValue, { color: theme.text }]}>{formatDuration(summary.avgEntryLength)}</Text>
						<Text style={[styles.summaryLabel, { color: theme.textMuted }]}>Avg Length</Text>
					</View>
					<View style={[styles.summaryCard, { backgroundColor: theme.surfaceAlt }]}>
						<Feather name='sun' size={16} color={theme.textMuted} style={{ marginBottom: 6 }} />
						<Text style={[styles.summaryValue, { color: theme.text }]}>{getBestTimeOfDay(summary.timeOfDay)}</Text>
						<Text style={[styles.summaryLabel, { color: theme.textMuted }]}>Peak Time</Text>
					</View>
				</View>

				{/* Streak tracker */}
				<View style={[styles.streakCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
					<View style={styles.streakHeader}>
						<View style={styles.streakTitleRow}>
							<Feather name='zap' size={15} color={theme.accent} style={{ marginRight: 5 }} />
							<Text style={[styles.streakTitle, { color: theme.text }]}>
								{overallStreak > 0 ? `${overallStreak}-day streak` : 'No streak yet'}
							</Text>
						</View>
						<Text style={[styles.streakSub, { color: theme.textMuted }]}>last {streakDays} days</Text>
					</View>
					<View style={styles.streakDots}>
						{streakDotList.map((day, i) => (
							<AnimatedStreakDot key={day.key} day={day} index={i} theme={theme} />
						))}
					</View>
					<View style={styles.streakFooter}>
						<View style={styles.streakLegendItem}>
							<View style={[styles.streakLegendDot, { backgroundColor: theme.accent }]} />
							<Text style={[styles.streakLegendText, { color: theme.textMuted }]}>Recorded</Text>
						</View>
						<View style={styles.streakLegendItem}>
							<View style={[styles.streakLegendDot, { backgroundColor: theme.border, opacity: 0.5 }]} />
							<Text style={[styles.streakLegendText, { color: theme.textMuted }]}>Missed</Text>
						</View>
					</View>
				</View>

				{/* Graphs */}
				<GraphCarousel
					tags={tagCounts}
					dailyRows={dailyRows}
					pieSlices={pieSlices}
					heatmapWeeks={HEATMAP_WEEKS}
				/>
			</ScrollView>
		</View>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1 },
	topBar: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		marginBottom: 10,
	},
	headerTitle: { fontSize: 20, fontWeight: '700' },
	summaryGrid: {
		flexDirection: 'row',
		paddingHorizontal: 16,
		gap: 12,
		marginBottom: 20,
	},
	summaryCard: {
		flex: 1,
		borderRadius: 16,
		padding: 14,
		alignItems: 'flex-start'
	},
	summaryValue: {
		fontSize: 16,
		fontWeight: '700',
		marginBottom: 4,
	},
	summaryLabel: {
		fontSize: 11,
		fontWeight: '600'
	},
	streakCard: {
		marginHorizontal: 16,
		marginBottom: 20,
		borderWidth: 1,
		borderRadius: 16,
		padding: 14,
	},
	streakHeader: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		marginBottom: 12,
	},
	streakTitleRow: { flexDirection: 'row', alignItems: 'center' },
	streakTitle: { fontSize: 14, fontWeight: '700' },
	streakSub: { fontSize: 11 },
	streakDots: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, justifyContent: 'center' },
	streakDot: { width: 14, height: 14, borderRadius: 7 },
	streakFooter: { flexDirection: 'row', gap: 16, marginTop: 12, justifyContent: 'center' },
	streakLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
	streakLegendDot: { width: 8, height: 8, borderRadius: 4 },
	streakLegendText: { fontSize: 11 },
});
