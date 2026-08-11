import React, { useState, useRef, useEffect } from 'react';
import { View, TouchableOpacity, Dimensions, StyleSheet, Animated } from 'react-native';
import Text from '../../theme/Text';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeContext';
import StreakLineChart from './StreakLineChart';
import TagPieChart from './TagPieChart';
import ActivityHeatmap from './ActivityHeatmap';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PAGE_PADDING = 16;
const CONTAINER_PADDING = 14;
const CHART_WIDTH = SCREEN_WIDTH - (PAGE_PADDING * 2) - (CONTAINER_PADDING * 2);

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
	const [renderedTab, setRenderedTab] = useState('line');
	const [lineDays, setLineDays] = useState(14);

	const fadeAnim = useRef(new Animated.Value(1)).current;
	const tabScales = useRef(TABS.map((_, i) => new Animated.Value(i === 0 ? 1 : 0.85))).current;

	useEffect(() => {
		if (activeTab !== renderedTab) {
			Animated.sequence([
				Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
			]).start(() => {
				setRenderedTab(activeTab);
				Animated.timing(fadeAnim, { toValue: 1, duration: 150, useNativeDriver: true }).start();
			});
		}
		
		TABS.forEach((tab, i) => {
			Animated.spring(tabScales[i], {
				toValue: activeTab === tab.key ? 1 : 0.85,
				useNativeDriver: true,
				tension: 120,
				friction: 7,
			}).start();
		});
	}, [activeTab]);

	return (
		<View style={styles.wrap}>
			{/* Chart content */}
			<Animated.View style={[styles.chartContainer, { borderColor: theme.border, opacity: fadeAnim }]}>
				{renderedTab === 'line' && (
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
				{renderedTab === 'pie' && (
					<TagPieChart
						slices={pieSlices}
						width={CHART_WIDTH}
					/>
				)}
				{renderedTab === 'heatmap' && (
					<ActivityHeatmap
						dailyRows={dailyRows}
						width={CHART_WIDTH}
					/>
				)}
			</Animated.View>

			{/* Tab buttons */}
			<View style={styles.tabRow}>
				{TABS.map((tab, index) => {
					const active = activeTab === tab.key;
					return (
						<TouchableOpacity
							key={tab.key}
							onPress={() => setActiveTab(tab.key)}
							style={[
								styles.tabBtn,
								{ 
									backgroundColor: active ? theme.accent : theme.surfaceAlt, 
									borderColor: active ? theme.accent : theme.border 
								},
							]}
							activeOpacity={0.7}
						>
							<Animated.View style={{ transform: [{ scale: tabScales[index] }] }}>
								<Feather name={tab.icon} size={20} color={active ? theme.bg : theme.textMuted} />
							</Animated.View>
						</TouchableOpacity>
					);
				})}
			</View>

		</View>
	);
}

const styles = StyleSheet.create({
	wrap: { marginTop: 8, paddingHorizontal: PAGE_PADDING },
	tabRow: {
		flexDirection: 'row',
		justifyContent: 'center',
		marginTop: 16,
		gap: 16,
	},
	tabBtn: {
		width: 44,
		height: 44,
		borderRadius: 22,
		alignItems: 'center',
		justifyContent: 'center',
		borderWidth: 1,
	},
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
