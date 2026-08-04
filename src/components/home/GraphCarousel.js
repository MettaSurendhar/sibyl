import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Dimensions, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeContext';
import StreakLineChart from './StreakLineChart';
import TagPieChart from './TagPieChart';
import ActivityHeatmap from './ActivityHeatmap';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PAGE_PADDING = 16;
const CHART_WIDTH = SCREEN_WIDTH - PAGE_PADDING * 2;

const TABS = [
	{ key: 'line', label: 'Activity', icon: 'trending-up' },
	{ key: 'pie', label: 'Breakdown', icon: 'pie-chart' },
	{ key: 'heatmap', label: 'Heatmap', icon: 'calendar' },
];

const TIME_OPTIONS = [
	{ label: '7D', value: 7 },
	{ label: '14D', value: 14 },
	{ label: '30D', value: 30 },
	{ label: '3M', value: 90 },
	{ label: '6M', value: 180 },
	{ label: '1Y', value: 365 },
];

export default function GraphCarousel({
	tags,
	dailyRows,
	pieSlices,
	heatmapWeeks,
}) {
	const { theme } = useTheme();
	const [activeTab, setActiveTab] = useState('line');
	const [lineDays, setLineDays] = useState(14);

	return (
		<View style={styles.wrap}>
			{/* Tab buttons */}
			<View style={[styles.tabRow, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}>
				{TABS.map((tab) => {
					const active = activeTab === tab.key;
					return (
						<TouchableOpacity
							key={tab.key}
							onPress={() => setActiveTab(tab.key)}
							style={[
								styles.tabBtn,
								active && { backgroundColor: theme.surface, borderColor: theme.accent, borderWidth: 1 },
							]}
							activeOpacity={0.7}
						>
							<Feather name={tab.icon} size={18} color={active ? theme.accent : theme.textMuted} />
							<Text style={[styles.tabLabel, { color: active ? theme.accent : theme.textMuted }]}>
								{tab.label}
							</Text>
						</TouchableOpacity>
					);
				})}
			</View>

			{/* Chart content */}
			<View style={[styles.chartContainer, { borderColor: theme.border }]}>
				{activeTab === 'line' && (
					<>
						<View style={styles.timeSelectorRow}>
							{TIME_OPTIONS.map((opt) => (
								<TouchableOpacity
									key={opt.value}
									onPress={() => setLineDays(opt.value)}
									style={[
										styles.timeBtn,
										lineDays === opt.value && { backgroundColor: theme.surfaceAlt },
									]}
								>
									<Text
										style={[
											styles.timeBtnText,
											{ color: lineDays === opt.value ? theme.accent : theme.textMuted },
										]}
									>
										{opt.label}
									</Text>
								</TouchableOpacity>
							))}
						</View>
						<StreakLineChart
							tags={tags}
							dailyRows={dailyRows}
							days={lineDays}
							width={CHART_WIDTH}
						/>
					</>
				)}
				{activeTab === 'pie' && (
					<TagPieChart
						slices={pieSlices}
						width={CHART_WIDTH}
					/>
				)}
				{activeTab === 'heatmap' && (
					<ActivityHeatmap
						dailyRows={dailyRows}
						weeks={heatmapWeeks}
						width={CHART_WIDTH}
					/>
				)}
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	wrap: { marginTop: 8, paddingHorizontal: PAGE_PADDING },
	tabRow: {
		flexDirection: 'row',
		borderRadius: 14,
		borderWidth: 1,
		padding: 4,
		marginBottom: 12,
		gap: 4,
	},
	tabBtn: {
		flex: 1,
		alignItems: 'center',
		paddingVertical: 10,
		borderRadius: 10,
		gap: 4,
	},
	tabLabel: { fontSize: 11, fontWeight: '700' },
	chartContainer: {
		borderWidth: 1,
		borderRadius: 16,
		padding: 14,
		paddingTop: 16,
	},
	timeSelectorRow: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		marginBottom: 16,
		paddingHorizontal: 4,
	},
	timeBtn: {
		paddingVertical: 4,
		paddingHorizontal: 8,
		borderRadius: 8,
	},
	timeBtnText: {
		fontSize: 11,
		fontWeight: '700',
	},
});
