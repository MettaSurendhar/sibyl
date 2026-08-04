import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Rect, Text as SvgText } from 'react-native-svg';
import { useTheme } from '../../theme/ThemeContext';

const GAP = 3;
const ROWS = 7;
const MIN_CELL = 9;
const MAX_CELL = 16;
const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const Y_LABEL_WIDTH = 14;
const X_LABEL_HEIGHT = 16;

function dateKeyLocal(d) {
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
		d.getDate(),
	).padStart(2, '0')}`;
}

export default function ActivityHeatmap({ dailyRows, weeks, width }) {
	const { theme } = useTheme();

	const availableWidth = width - Y_LABEL_WIDTH;
	const cell = Math.max(
		MIN_CELL,
		Math.min(MAX_CELL, Math.floor((availableWidth - (weeks - 1) * GAP) / weeks)),
	);

	const { cols, maxCount, monthLabels } = useMemo(() => {
		const totalsByDay = {};
		for (const row of dailyRows) {
			totalsByDay[row.dateKey] = (totalsByDay[row.dateKey] || 0) + row.count;
		}
		const today = new Date();
		const start = new Date(today);
		start.setDate(start.getDate() - weeks * 7 + 1);
		const columns = [];
		const cursor = new Date(start);
		let max = 1;
		const mLabels = [];
		let lastMonth = -1;
		for (let w = 0; w < weeks; w++) {
			const days = [];
			const colMonth = cursor.getMonth();
			if (colMonth !== lastMonth) {
				mLabels.push({ col: w, monthIndex: colMonth, label: cursor.toLocaleDateString('en', { month: 'short' }) });
				lastMonth = colMonth;
			}
			for (let d = 0; d < ROWS; d++) {
				const key = dateKeyLocal(cursor);
				const count = totalsByDay[key] || 0;
				max = Math.max(max, count);
				days.push(count);
				cursor.setDate(cursor.getDate() + 1);
			}
			columns.push(days);
		}
		return { cols: columns, maxCount: max, monthLabels: mLabels };
	}, [dailyRows, weeks]);

	function withOpacity(hex, alpha) {
		const a = Math.round(alpha * 255)
			.toString(16)
			.padStart(2, '0');
		return `${hex}${a}`;
	}

	function colorFor(count) {
		if (count === 0) return theme.border;
		const intensity = Math.min(1, count / maxCount);
		const steps = [0.3, 0.5, 0.75, 1];
		const step =
			steps[Math.min(steps.length - 1, Math.floor(intensity * steps.length))];
		return withOpacity(theme.accent, step);
	}

	const gridWidth = weeks * cell + (weeks - 1) * GAP;
	const gridHeight = ROWS * cell + (ROWS - 1) * GAP;

	return (
		<View>
			{/* Month labels row */}
			<View style={[styles.monthRow, { marginLeft: Y_LABEL_WIDTH }]}>
				{monthLabels.map(({ col, monthIndex, label }) =>
					monthIndex % 2 === 0 ? (
						<Text
							key={`m-${col}`}
							style={[
								styles.monthLabel,
								{ color: theme.textMuted, left: col * (cell + GAP) },
							]}
						>
							{label}
						</Text>
					) : null,
				)}
			</View>

			{/* Grid with Y labels */}
			<View style={styles.gridRow}>
				{/* Day-of-week labels */}
				<View style={[styles.yLabels, { height: gridHeight }]}>
					{DAY_LABELS.map((d, i) => (
						<Text
							key={i}
							style={[
								styles.dayLabel,
								{
									color: theme.textMuted,
									height: cell,
									lineHeight: cell,
									marginBottom: i < ROWS - 1 ? GAP : 0,
								},
							]}
						>
							{d}
						</Text>
					))}
				</View>

				<Svg width={gridWidth} height={gridHeight}>
					{cols.map((days, colIndex) =>
						days.map((count, rowIndex) => (
							<Rect
								key={`${colIndex}-${rowIndex}`}
								x={colIndex * (cell + GAP)}
								y={rowIndex * (cell + GAP)}
								width={cell}
								height={cell}
								rx={2}
								fill={colorFor(count)}
							/>
						)),
					)}
				</Svg>
			</View>

			{/* Legend */}
			<View style={styles.legend}>
				<Text style={[styles.legendText, { color: theme.textMuted }]}>Less</Text>
				{[0.15, 0.35, 0.6, 0.85, 1].map((alpha, i) => (
					<View
						key={i}
						style={[
							styles.legendCell,
							{
								backgroundColor:
									i === 0 ? theme.border : withOpacity(theme.accent, alpha),
								width: cell,
								height: cell,
							},
						]}
					/>
				))}
				<Text style={[styles.legendText, { color: theme.textMuted }]}>More</Text>
			</View>

			{/* Month labels bottom */}
			<View style={[styles.monthRow, { marginLeft: Y_LABEL_WIDTH, marginTop: 4, marginBottom: 0 }]}>
				{monthLabels.map(({ col, monthIndex, label }) =>
					monthIndex % 2 === 1 ? (
						<Text
							key={`m-${col}`}
							style={[
								styles.monthLabel,
								{ color: theme.textMuted, left: col * (cell + GAP) },
							]}
						>
							{label}
						</Text>
					) : null,
				)}
			</View>

			<Text style={[styles.yearLabel, { color: theme.textMuted }]}>
				{new Date().getFullYear()}
			</Text>
		</View>
	);
}

const styles = StyleSheet.create({
	monthRow: { flexDirection: 'row', position: 'relative', height: X_LABEL_HEIGHT, marginBottom: 2 },
	monthLabel: { position: 'absolute', fontSize: 9, fontWeight: '600' },
	gridRow: { flexDirection: 'row' },
	yLabels: { width: Y_LABEL_WIDTH, flexDirection: 'column' },
	dayLabel: { fontSize: 9, textAlign: 'center' },
	legend: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 8, justifyContent: 'center' },
	legendCell: { borderRadius: 2 },
	legendText: { fontSize: 9, marginHorizontal: 4 },
	yearLabel: { textAlign: 'center', fontSize: 10, marginTop: 8, fontWeight: '600' },
});
