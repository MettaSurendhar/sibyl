import React, { useCallback, useState } from 'react';
import { View, Dimensions, StyleSheet } from 'react-native';
import PagerView from 'react-native-pager-view';
import { useTheme } from '../../theme/ThemeContext';
import StreakLineChart from './StreakLineChart';
import TagPieChart from './TagPieChart';
import ActivityHeatmap from './ActivityHeatmap';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PAGE_PADDING = 16;
const CHART_WIDTH = SCREEN_WIDTH - PAGE_PADDING * 2;
const PAGER_HEIGHT = 240;

// Three swipeable graph pages, per spec: per-tag streak line chart, tag/operation-type pie
// chart, and a GitHub-style activity heatmap.
//
// This uses react-native-pager-view (a real native view pager) rather than a plain
// horizontal ScrollView. It used to be a ScrollView, which - nested inside TodayScreen's
// vertical scroll, itself one page of the outer Home<->Library horizontal pager - meant two
// JS-driven horizontal scrollables fighting for the same gesture, and the outer one won,
// so the inner carousel never swiped. A native pager registers its own gesture area with
// the platform directly instead of competing through React Native's JS responder system,
// which is what actually fixes the conflict rather than just reducing its odds.
export default function GraphCarousel({
	tags,
	dailyRows,
	pieSlices,
	lineChartDays,
	heatmapWeeks,
}) {
	const { theme } = useTheme();
	const [page, setPage] = useState(0);

	const onPageSelected = useCallback((e) => {
		setPage(e.nativeEvent.position);
	}, []);

	const pages = [
		<View
			key='line'
			style={styles.page}
		>
			<StreakLineChart
				tags={tags}
				dailyRows={dailyRows}
				days={lineChartDays}
				width={CHART_WIDTH}
			/>
		</View>,
		<View
			key='pie'
			style={styles.page}
		>
			<TagPieChart
				slices={pieSlices}
				width={CHART_WIDTH}
			/>
		</View>,
		<View
			key='heatmap'
			style={styles.page}
		>
			<ActivityHeatmap
				dailyRows={dailyRows}
				weeks={heatmapWeeks}
				width={CHART_WIDTH}
			/>
		</View>,
	];

	return (
		<View style={styles.wrap}>
			<PagerView
				style={styles.pager}
				initialPage={0}
				onPageSelected={onPageSelected}
			>
				{pages}
			</PagerView>
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
	pager: { width: SCREEN_WIDTH, height: PAGER_HEIGHT },
	page: {
		width: SCREEN_WIDTH,
		paddingHorizontal: PAGE_PADDING,
		justifyContent: 'center',
	},
	dots: {
		flexDirection: 'row',
		justifyContent: 'center',
		marginTop: 10,
		gap: 6,
	},
	dot: { width: 6, height: 6, borderRadius: 3 },
});
