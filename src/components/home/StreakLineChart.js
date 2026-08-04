import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Line, Polyline, Text as SvgText } from 'react-native-svg';
import { useTheme } from '../../theme/ThemeContext';

const CHART_HEIGHT = 180;
const PADDING_LEFT = 32; // space for Y-axis labels
const PADDING_RIGHT = 10;
const PADDING_TOP = 10;
const PADDING_BOTTOM = 28; // space for X-axis labels

function dateKeyLocal(d) {
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
		d.getDate(),
	).padStart(2, '0')}`;
}

function shortDay(dateKey) {
	const d = new Date(dateKey + 'T00:00:00');
	return d.toLocaleDateString('en', { weekday: 'short' }).slice(0, 2);
}

export default function StreakLineChart({ tags, dailyRows, days, width }) {
	const { theme } = useTheme();

	const { seriesByTag, overallSeries, maxValue, dateKeys } = useMemo(() => {
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
			dateKeys: keys,
		};
	}, [tags, dailyRows, days]);

	const plotWidth = width - PADDING_LEFT - PADDING_RIGHT;
	const plotHeight = CHART_HEIGHT - PADDING_TOP - PADDING_BOTTOM;
	const stepX = plotWidth / Math.max(1, days - 1);

	function pointsFor(values) {
		return values
			.map((v, i) => {
				const x = PADDING_LEFT + i * stepX;
				const y = PADDING_TOP + plotHeight - (v / maxValue) * plotHeight;
				return `${x},${y}`;
			})
			.join(' ');
	}

	// Y-axis ticks: 0, mid, max
	const yTicks = [0, Math.round(maxValue / 2), maxValue];
	// X-axis ticks: show every ~3 days to avoid crowding
	const xTickEvery = Math.max(1, Math.floor(days / 5));

	return (
		<View>
			<Svg width={width} height={CHART_HEIGHT}>
				{/* Y gridlines and labels */}
				{yTicks.map((val) => {
					const y = PADDING_TOP + plotHeight - (val / maxValue) * plotHeight;
					return (
						<React.Fragment key={`y-${val}`}>
							<Line
								x1={PADDING_LEFT}
								y1={y}
								x2={PADDING_LEFT + plotWidth}
								y2={y}
								stroke={theme.border}
								strokeWidth={0.8}
								strokeDasharray={val === 0 ? undefined : '3,3'}
							/>
							<SvgText
								x={PADDING_LEFT - 4}
								y={y + 4}
								fontSize={9}
								fill={theme.textMuted}
								textAnchor='end'
							>
								{val}
							</SvgText>
						</React.Fragment>
					);
				})}

				{/* X-axis labels */}
				{dateKeys.map((key, i) => {
					if (i % xTickEvery !== 0 && i !== days - 1) return null;
					const x = PADDING_LEFT + i * stepX;
					return (
						<SvgText
							key={`x-${i}`}
							x={x}
							y={CHART_HEIGHT - 4}
							fontSize={9}
							fill={theme.textMuted}
							textAnchor='middle'
						>
							{shortDay(key)}
						</SvgText>
					);
				})}

				{/* Data lines */}
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

			{/* Legend */}
			<View style={styles.legend}>
				{tags.map((tag) => (
					<View key={tag.id ?? 'untagged'} style={styles.legendItem}>
						<View style={[styles.legendDot, { backgroundColor: tag.color }]} />
						<Text style={[styles.legendText, { color: theme.textMuted }]} numberOfLines={1}>
							{tag.name}
						</Text>
					</View>
				))}
				<View style={styles.legendItem}>
					<View style={[styles.legendDot, { backgroundColor: theme.text }]} />
					<Text style={[styles.legendText, { color: theme.textMuted }]}>Overall</Text>
				</View>
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	legend: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8, gap: 10 },
	legendItem: { flexDirection: 'row', alignItems: 'center', marginRight: 4 },
	legendDot: { width: 8, height: 8, borderRadius: 4, marginRight: 5 },
	legendText: { fontSize: 11 },
});
