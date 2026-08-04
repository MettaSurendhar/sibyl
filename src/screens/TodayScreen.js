import React, { useCallback, useState } from 'react';
import { View, Image, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import Text from '../theme/Text';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { getAllTagCounts, getPieBreakdown } from '../db/categories';
import { getStreakCount, getDailyEntryCounts } from '../db/entries';
import { getPrefs } from '../utils/settingsStore';
import TagCountBoxes from '../components/home/TagCountBoxes';
import GraphCarousel from '../components/home/GraphCarousel';

const DAY_MS = 24 * 60 * 60 * 1000;
const LINE_CHART_DAYS = 14;
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

export default function TodayScreen({ navigation }) {
	const { theme } = useTheme();
	const insets = useSafeAreaInsets();
	const [tagCounts, setTagCounts] = useState([]);
	const [overallStreak, setOverallStreak] = useState(0);
	const [dailyRows, setDailyRows] = useState([]);
	const [pieSlices, setPieSlices] = useState([]);
	const [streakDays, setStreakDays] = useState(14);

	const refresh = useCallback(() => {
		const now = Date.now();
		const fetchFrom = now - MAX_FETCH_DAYS * DAY_MS;
		Promise.all([
			getAllTagCounts(),
			getStreakCount(),
			getDailyEntryCounts({ from: fetchFrom, to: now }),
			getPieBreakdown(),
			getPrefs(),
		]).then(([tags, streak, daily, pie, prefs]) => {
			setTagCounts(tags);
			setOverallStreak(streak);
			setDailyRows(daily);
			setPieSlices(pie);
			setStreakDays(prefs.streakDays || 14);
		});
	}, []);

	useFocusEffect(
		useCallback(() => {
			refresh();
		}, [refresh]),
	);

	const streakDotList = buildStreakDays(dailyRows, streakDays);

	return (
		<ScrollView
			style={[styles.container, { backgroundColor: theme.bg }]}
			contentContainerStyle={{
				paddingTop: insets.top + 20,
				paddingBottom: insets.bottom + 80,
			}}
			showsVerticalScrollIndicator={false}
		>
			{/* Header: Title + Settings icon */}
			<View style={styles.headerRow}>
				<Image
					source={require('../../assets/header-icon.png')}
					style={styles.headerIcon}
					resizeMode="contain"
				/>
				<TouchableOpacity
					onPress={() => navigation.navigate('Settings')}
					style={[styles.settingsBtn, { backgroundColor: theme.surfaceAlt }]}
					hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
				>
					<Feather name='settings' size={18} color={theme.textMuted} />
				</TouchableOpacity>
			</View>

			{/* Tag count boxes */}
			<TagCountBoxes tags={tagCounts} />

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
					{streakDotList.map((day) => (
						<View
							key={day.key}
							style={[
								styles.streakDot,
								{
									backgroundColor: day.hasRecording ? theme.accent : theme.border,
									opacity: day.hasRecording ? 1 : 0.5,
								},
							]}
						/>
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
	headerIcon: { width: 180, height: 60, marginLeft: -16 },
	settingsBtn: {
		width: 36,
		height: 36,
		borderRadius: 18,
		alignItems: 'center',
		justifyContent: 'center',
	},
	streakCard: {
		marginHorizontal: 16,
		marginBottom: 16,
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
