import React, { useCallback, useState } from 'react';
import { View, ScrollView, Dimensions, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import StreakLineChart from './StreakLineChart';
import TagPieChart from './TagPieChart';
import ActivityHeatmap from './ActivityHeatmap';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PAGE_PADDING = 16;
const CHART_WIDTH = SCREEN_WIDTH - PAGE_PADDING * 2;

// Three swipeable graph pages, per spec: per-tag streak line chart, tag/operation-type pie
// chart, and a GitHub-style activity heatmap.
//
// Nesting note: this is a horizontal paging ScrollView living inside TodayScreen's vertical
// scroll, which is itself one page of the outer Home<->Library horizontal pager
// (HomeLibraryPager). Two horizontal-swipe surfaces nested inside each other (this carousel
// + the outer Home/Library swipe) is the single highest-risk spot for on-device gesture
// conflicts called out in the phase plan's QA pass - if swiping between these three graphs
// ever fights swiping to Library, that's the first place to look.
export default function GraphCarousel({
	tags,
	dailyRows,
	pieSlices,
	lineChartDays,
	heatmapWeeks,
}) {
	const { theme } = useTheme();
	const [page, setPage] = useState(0);

	const onMomentumScrollEnd = useCallback((e) => {
		setPage(Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH));
	}, []);

	const pages = [
		<StreakLineChart
			key='line'
			tags={tags}
			dailyRows={dailyRows}
			days={lineChartDays}
			width={CHART_WIDTH}
		/>,
		<TagPieChart
			key='pie'
			slices={pieSlices}
			width={CHART_WIDTH}
		/>,
		<ActivityHeatmap
			key='heatmap'
			dailyRows={dailyRows}
			weeks={heatmapWeeks}
			width={CHART_WIDTH}
		/>,
	];

	return (
		<View style={styles.wrap}>
			<ScrollView
				horizontal
				pagingEnabled
				showsHorizontalScrollIndicator={false}
				decelerationRate='fast'
				onMomentumScrollEnd={onMomentumScrollEnd}
			>
				{pages.map((p, i) => (
					<View
						key={i}
						style={{ width: SCREEN_WIDTH, paddingHorizontal: PAGE_PADDING }}
					>
						{p}
					</View>
				))}
			</ScrollView>
			<View style={styles.dots}>
				{pages.map((_, i) => (
					<View
						key={i}
						style={[
							styles.dot,
							{ backgroundColor: i === page ? theme.accent : theme.border },
						]}
					/>
				))}
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	wrap: { marginTop: 8 },
	dots: {
		flexDirection: 'row',
		justifyContent: 'center',
		marginTop: 10,
		gap: 6,
	},
	dot: { width: 6, height: 6, borderRadius: 3 },
});
