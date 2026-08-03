import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { useTheme } from '../../theme/ThemeContext';

const SIZE = 150;
const RADIUS = SIZE / 2;

// Angle convention: 0deg = 12 o'clock, increasing clockwise - the usual convention for pie
// charts (and the one most SVG-arc tutorials use), so slices read left-to-right/top-down in
// the natural reading order.
function polarToCartesian(cx, cy, r, angleDeg) {
	const angleRad = (angleDeg * Math.PI) / 180;
	return { x: cx + r * Math.sin(angleRad), y: cy - r * Math.cos(angleRad) };
}

function describeSlice(cx, cy, r, startAngle, endAngle) {
	// A full-circle single slice can't be drawn as one arc (start === end path-wise), so cap
	// just under 360 - visually identical at this size but keeps the SVG path valid.
	const sweep = Math.min(endAngle - startAngle, 359.99);
	const clampedEnd = startAngle + sweep;
	const p1 = polarToCartesian(cx, cy, r, startAngle);
	const p2 = polarToCartesian(cx, cy, r, clampedEnd);
	const largeArcFlag = sweep > 180 ? 1 : 0;
	return `M ${cx} ${cy} L ${p1.x} ${p1.y} A ${r} ${r} 0 ${largeArcFlag} 1 ${p2.x} ${p2.y} Z`;
}

// Single pie: real recordings broken down by tag, plus separate slices for
// Trimmed/Merged/Appended entries (see categories.getPieBreakdown for why those aren't
// folded into the tag slices). Same chart, separate slices - the phase plan's chosen
// default for this one open design call.
export default function TagPieChart({ slices, width }) {
	const { theme } = useTheme();
	const total = slices.reduce((sum, s) => sum + s.count, 0);

	const arcs = useMemo(() => {
		let angle = 0;
		return slices.map((s) => {
			const sweep = total ? (s.count / total) * 360 : 0;
			const path = describeSlice(RADIUS, RADIUS, RADIUS, angle, angle + sweep);
			angle += sweep;
			return { ...s, path };
		});
	}, [slices, total]);

	if (!total) {
		return (
			<Text
				style={{ color: theme.textMuted, textAlign: 'center', padding: 20 }}
			>
				Nothing recorded yet.
			</Text>
		);
	}

	return (
		<View style={styles.row}>
			<Svg
				width={SIZE}
				height={SIZE}
			>
				{arcs.map((a) => (
					<Path
						key={a.key}
						d={a.path}
						fill={a.color}
					/>
				))}
				<Circle
					cx={RADIUS}
					cy={RADIUS}
					r={RADIUS * 0.55}
					fill={theme.bg}
				/>
			</Svg>
			<View style={styles.legend}>
				{arcs.map((a) => (
					<View
						key={a.key}
						style={styles.legendItem}
					>
						<View style={[styles.legendDot, { backgroundColor: a.color }]} />
						<Text
							style={[styles.legendText, { color: theme.text }]}
							numberOfLines={1}
						>
							{a.icon} {a.name} · {a.count}
						</Text>
					</View>
				))}
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	row: { flexDirection: 'row', alignItems: 'center' },
	legend: { flex: 1, marginLeft: 16 },
	legendItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
	legendDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
	legendText: { fontSize: 12, flexShrink: 1 },
});
