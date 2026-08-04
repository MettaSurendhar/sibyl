import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { useTheme } from '../../theme/ThemeContext';

const GAP = 2;
const ROWS = 7; // Sun=0 … Sat=6
const CELL = 11;
const Y_LABEL_WIDTH = 14;
const LABEL_ROW_H = 16;

// Jan=0, Feb=1, ..., Nov=10, Dec=11
// TOP  → even monthIndex (Jan, Mar, May, Jul, Sep, Nov)
// BOTTOM → odd  monthIndex (Feb, Apr, Jun, Aug, Oct, Dec)
const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function dateKeyLocal(d) {
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
		d.getDate(),
	).padStart(2, '0')}`;
}

export default function ActivityHeatmap({ dailyRows, weeks }) {
	const { theme } = useTheme();

	const { cols, maxCount, topLabels, bottomLabels, year } = useMemo(() => {
		const totalsByDay = {};
		for (const row of dailyRows) {
			totalsByDay[row.dateKey] = (totalsByDay[row.dateKey] || 0) + row.count;
		}

		// Start on the Sunday that is >= (weeks * 7) days ago so columns always start on Sunday
		const today = new Date();
		const todayDow = today.getDay(); // 0=Sun … 6=Sat
		// go back enough days so first column is a Sunday
		const startDate = new Date(today);
		startDate.setDate(today.getDate() - (weeks * 7 - 1) - todayDow);

		const columns = [];
		const cursor = new Date(startDate);
		let max = 1;
		// Track which column each month first appears in
		const monthFirstCol = {}; // key: "YYYY-M" → col index
		let colIdx = 0;
		while (colIdx < weeks) {
			const days = [];
			const colMonth = cursor.getMonth();
			const colYear = cursor.getFullYear();
			const monthKey = `${colYear}-${colMonth}`;
			if (!(monthKey in monthFirstCol)) {
				monthFirstCol[monthKey] = { col: colIdx, monthIndex: colMonth, year: colYear, label: cursor.toLocaleDateString('en', { month: 'short' }) };
			}
			for (let r = 0; r < ROWS; r++) {
				const key = dateKeyLocal(cursor);
				const count = totalsByDay[key] || 0;
				max = Math.max(max, count);
				days.push(count);
				cursor.setDate(cursor.getDate() + 1);
			}
			columns.push(days);
			colIdx++;
		}

		const allMonthEntries = Object.values(monthFirstCol).sort((a, b) => a.col - b.col);
		const top = allMonthEntries.filter(m => m.monthIndex % 2 === 0); // Jan, Mar, May, Jul, Sep, Nov
		const bottom = allMonthEntries.filter(m => m.monthIndex % 2 === 1); // Feb, Apr, Jun, Aug, Oct, Dec

		return {
			cols: columns,
			maxCount: max,
			topLabels: top,
			bottomLabels: bottom,
			year: today.getFullYear(),
		};
	}, [dailyRows, weeks]);

	function withOpacity(hex, alpha) {
		const a = Math.round(alpha * 255).toString(16).padStart(2, '0');
		return `${hex}${a}`;
	}

	function colorFor(count) {
		if (count === 0) return theme.border;
		const intensity = Math.min(1, count / maxCount);
		const steps = [0.3, 0.5, 0.75, 1];
		const step = steps[Math.min(steps.length - 1, Math.floor(intensity * steps.length))];
		return withOpacity(theme.accent, step);
	}

	const gridWidth = weeks * CELL + (weeks - 1) * GAP;
	const gridHeight = ROWS * CELL + (ROWS - 1) * GAP;

	function labelPosition(col) {
		return col * (CELL + GAP);
	}

	return (
		<View>
			{/* TOP labels: Jan, Mar, May, Jul, Sep, Nov */}
			<View style={[styles.labelRow, { marginLeft: Y_LABEL_WIDTH }]}>
				{topLabels.map(({ col, label }) => (
					<Text
						key={`top-${col}`}
						style={[styles.monthLabel, { color: theme.accent, left: labelPosition(col) }]}
					>
						{label}
					</Text>
				))}
			</View>

			{/* Grid */}
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
									height: CELL,
									lineHeight: CELL,
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
								x={colIndex * (CELL + GAP)}
								y={rowIndex * (CELL + GAP)}
								width={CELL}
								height={CELL}
								rx={2}
								fill={colorFor(count)}
							/>
						)),
					)}
				</Svg>
			</View>

			{/* BOTTOM labels: Feb, Apr, Jun, Aug, Oct, Dec */}
			<View style={[styles.labelRow, { marginLeft: Y_LABEL_WIDTH, marginTop: 4 }]}>
				{bottomLabels.map(({ col, label }) => (
					<Text
						key={`bot-${col}`}
						style={[styles.monthLabel, { color: theme.textMuted, left: labelPosition(col) }]}
					>
						{label}
					</Text>
				))}
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
								backgroundColor: i === 0 ? theme.border : withOpacity(theme.accent, alpha),
								width: CELL,
								height: CELL,
							},
						]}
					/>
				))}
				<Text style={[styles.legendText, { color: theme.textMuted }]}>More</Text>
			</View>

			{/* Year label */}
			<Text style={[styles.yearLabel, { color: theme.textMuted }]}>{year}</Text>
		</View>
	);
}

const styles = StyleSheet.create({
	labelRow: {
		position: 'relative',
		height: LABEL_ROW_H,
		marginBottom: 2,
	},
	monthLabel: {
		position: 'absolute',
		fontSize: 9,
		fontWeight: '700',
	},
	gridRow: { flexDirection: 'row' },
	yLabels: { width: Y_LABEL_WIDTH, flexDirection: 'column' },
	dayLabel: { fontSize: 9, textAlign: 'center' },
	legend: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 3,
		marginTop: 8,
		justifyContent: 'center',
	},
	legendCell: { borderRadius: 2 },
	legendText: { fontSize: 9, marginHorizontal: 4 },
	yearLabel: { textAlign: 'center', fontSize: 10, fontWeight: '700', marginTop: 6 },
});
