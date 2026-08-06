import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import Text from '../../theme/Text';
import Svg, { Rect, Line, Text as SvgText } from 'react-native-svg';
import { useTheme } from '../../theme/ThemeContext';

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const CHART_HEIGHT = 160;
const PADDING_TOP = 20;
const PADDING_BOTTOM = 24;
const PADDING_LEFT = 28;
const PADDING_RIGHT = 8;
const BAR_RADIUS = 4;

export default function ActivityHeatmap({ dailyRows, width }) {
	const { theme } = useTheme();

	const { monthCounts, maxCount, year } = useMemo(() => {
		const now = new Date();
		const yr = now.getFullYear();

		// Count totals per month for the current year
		const counts = new Array(12).fill(0);
		for (const row of dailyRows) {
			const d = new Date(row.dateKey + 'T00:00:00');
			if (d.getFullYear() === yr) {
				counts[d.getMonth()] += row.count;
			}
		}
		const max = Math.max(1, ...counts);
		return { monthCounts: counts, maxCount: max, year: yr };
	}, [dailyRows]);

	const plotWidth = (width || 300) - PADDING_LEFT - PADDING_RIGHT;
	const plotHeight = CHART_HEIGHT - PADDING_TOP - PADDING_BOTTOM;
	const barGap = 4;
	const barWidth = Math.floor((plotWidth - barGap * 11) / 12);

	function withOpacity(hex, alpha) {
		const base = hex.length > 7 ? hex.slice(0, 7) : hex;
		const a = Math.round(alpha * 255).toString(16).padStart(2, '0');
		return `${base}${a}`;
	}

	// Y-axis ticks
	const yTicks = [0, Math.ceil(maxCount / 2), maxCount];

	return (
		<View>
			<Text style={[styles.title, { color: theme.text }]}>Monthly Activity — {year}</Text>
			<Svg width={width} height={CHART_HEIGHT}>
				{/* Y gridlines */}
				{yTicks.map((val, ti) => {
					const y = PADDING_TOP + plotHeight - (val / maxCount) * plotHeight;
					return (
						<React.Fragment key={`y-${ti}`}>
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
								fontSize={8}
								fill={theme.textMuted}
								textAnchor="end"
							>
								{val}
							</SvgText>
						</React.Fragment>
					);
				})}

				{/* Bars + month labels */}
				{monthCounts.map((count, mi) => {
					const barH = Math.max(2, (count / maxCount) * plotHeight);
					const x = PADDING_LEFT + mi * (barWidth + barGap);
					const y = PADDING_TOP + plotHeight - barH;
					const alpha = count === 0 ? 0.15 : 0.3 + 0.7 * (count / maxCount);
					const fill = count === 0 ? theme.border : withOpacity(theme.accent, alpha);

					return (
						<React.Fragment key={`bar-${mi}`}>
							<Rect
								x={x}
								y={y}
								width={barWidth}
								height={barH}
								rx={BAR_RADIUS}
								fill={fill}
							/>
							{/* Count label above bar */}
							{count > 0 && (
								<SvgText
									x={x + barWidth / 2}
									y={y - 3}
									fontSize={7}
									fill={theme.accent}
									textAnchor="middle"
									fontWeight="700"
								>
									{count}
								</SvgText>
							)}
							{/* Month label below bar */}
							<SvgText
								x={x + barWidth / 2}
								y={CHART_HEIGHT - 4}
								fontSize={8}
								fill={theme.textMuted}
								textAnchor="middle"
							>
								{MONTH_SHORT[mi]}
							</SvgText>
						</React.Fragment>
					);
				})}
			</Svg>
		</View>
	);
}

const styles = StyleSheet.create({
	title: { fontSize: 12, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
});
