import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { useTheme } from '../../theme/ThemeContext';

const GAP = 3;
const ROWS = 7;
const MIN_CELL = 9;
const MAX_CELL = 20;

function dateKeyLocal(d) {
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
		d.getDate(),
	).padStart(2, '0')}`;
}

// GitHub-style contribution grid: one column per week, one row per weekday, covering the
// last `weeks` weeks. Color intensity (not hue) encodes how many recordings that day,
// summed across every tag - deliberately kept to a handful of months (not full years) so it
// fits on one screen without needing its own internal horizontal scroll, which would nest a
// second horizontal-swipe surface inside the outer Home<->Library pager and the graph
// carousel above it. See the phase plan's QA notes if you want to extend this to a
// scrollable multi-year view later.
export default function ActivityHeatmap({ dailyRows, weeks, width }) {
	const { theme } = useTheme();

	// Cell size is derived from the given width (not a fixed constant) so the grid always
	// fills the full available width regardless of how many weeks are shown, clamped to a
	// sensible range so cells don't become illegibly tiny or comically large.
	const cell = Math.max(
		MIN_CELL,
		Math.min(MAX_CELL, Math.floor((width - (weeks - 1) * GAP) / weeks)),
	);

	const { cols, maxCount } = useMemo(() => {
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
		for (let w = 0; w < weeks; w++) {
			const days = [];
			for (let d = 0; d < ROWS; d++) {
				const key = dateKeyLocal(cursor);
				const count = totalsByDay[key] || 0;
				max = Math.max(max, count);
				days.push(count);
				cursor.setDate(cursor.getDate() + 1);
			}
			columns.push(days);
		}
		return { cols: columns, maxCount: max };
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

	return (
		<View style={styles.wrap}>
			<Svg
				width={gridWidth}
				height={ROWS * cell + (ROWS - 1) * GAP}
			>
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
	);
}

const styles = StyleSheet.create({
	wrap: { alignItems: 'center' },
});
