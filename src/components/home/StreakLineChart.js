import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Line, Polyline } from 'react-native-svg';
import { useTheme } from '../../theme/ThemeContext';

const CHART_HEIGHT = 160;
const PADDING = 20;

function dateKeyLocal(d) {
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
		d.getDate(),
	).padStart(2, '0')}`;
}

// Daily entry counts per tag over the last `days` days, plus one "overall" dashed line
// summing every tag that day. This shows day-to-day consistency per tag rather than the
// single monotonic streak number, which would just be a flat step function and wouldn't be
// very informative as a chart.
export default function StreakLineChart({ tags, dailyRows, days, width }) {
	const { theme } = useTheme();

	const { seriesByTag, overallSeries, maxValue } = useMemo(() => {
		const keys = [];
		const now = new Date();
		for (let i = days - 1; i >= 0; i--) {
			const d = new Date(now);
			d.setDate(d.getDate() - i);
			keys.push(dateKeyLocal(d));
		}
		const byTagByDay = {};
		const overallByDay = {};
		for (const row of dailyRows) {
			const tagKey = row.categoryId ?? 'untagged';
			byTagByDay[tagKey] = byTagByDay[tagKey] || {};
			byTagByDay[tagKey][row.dateKey] =
				(byTagByDay[tagKey][row.dateKey] || 0) + row.count;
			overallByDay[row.dateKey] = (overallByDay[row.dateKey] || 0) + row.count;
		}
		const seriesByTagLocal = tags.map((tag) => ({
			tag,
			values: keys.map((k) => byTagByDay[tag.id ?? 'untagged']?.[k] || 0),
		}));
		const overall = keys.map((k) => overallByDay[k] || 0);
		const max = Math.max(
			1,
			...seriesByTagLocal.flatMap((s) => s.values),
			...overall,
		);
		return {
			seriesByTag: seriesByTagLocal,
			overallSeries: overall,
			maxValue: max,
		};
	}, [tags, dailyRows, days]);

	const plotWidth = width - PADDING * 2;
	const plotHeight = CHART_HEIGHT - PADDING * 2;
	const stepX = plotWidth / Math.max(1, days - 1);

	function pointsFor(values) {
		return values
			.map((v, i) => {
				const x = PADDING + i * stepX;
				const y = PADDING + plotHeight - (v / maxValue) * plotHeight;
				return `${x},${y}`;
			})
			.join(' ');
	}

	return (
		<View>
			<Svg
				width={width}
				height={CHART_HEIGHT}
			>
				<Line
					x1={PADDING}
					y1={PADDING + plotHeight}
					x2={width - PADDING}
					y2={PADDING + plotHeight}
					stroke={theme.border}
					strokeWidth={1}
				/>
				{seriesByTag.map(({ tag, values }) => (
					<Polyline
						key={tag.id ?? 'untagged'}
						points={pointsFor(values)}
						fill='none'
						stroke={tag.color}
						strokeWidth={2}
						strokeLinejoin='round'
						strokeLinecap='round'
					/>
				))}
				<Polyline
					points={pointsFor(overallSeries)}
					fill='none'
					stroke={theme.text}
					strokeWidth={2.5}
					strokeDasharray='5,4'
					strokeLinejoin='round'
					strokeLinecap='round'
				/>
			</Svg>
			<View style={styles.legend}>
				{tags.map((tag) => (
					<View
						key={tag.id ?? 'untagged'}
						style={styles.legendItem}
					>
						<View style={[styles.legendDot, { backgroundColor: tag.color }]} />
						<Text
							style={[styles.legendText, { color: theme.textMuted }]}
							numberOfLines={1}
						>
							{tag.name}
						</Text>
					</View>
				))}
				<View style={styles.legendItem}>
					<View style={[styles.legendDot, { backgroundColor: theme.text }]} />
					<Text style={[styles.legendText, { color: theme.textMuted }]}>
						Overall
					</Text>
				</View>
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	legend: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 10, gap: 10 },
	legendItem: { flexDirection: 'row', alignItems: 'center', marginRight: 4 },
	legendDot: { width: 8, height: 8, borderRadius: 4, marginRight: 5 },
	legendText: { fontSize: 11 },
});
