import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';

// Grid of "how many recordings does each tag have" boxes, replacing the old plain
// "RECENT ENTRIES" list per the phase plan. Each box uses the tag's own color/icon (set in
// Manage Tags, Phase 3) as a left accent stripe, so a tag's identity is consistent here and
// wherever else it appears (Library rows, tag pickers - Phase 4).
export default function TagCountBoxes({ tags }) {
	const { theme } = useTheme();
	if (!tags.length) return null;

	return (
		<View style={styles.grid}>
			{tags.map((tag) => (
				<View
					key={tag.id ?? 'untagged'}
					style={[
						styles.box,
						{
							backgroundColor: theme.surface,
							borderColor: theme.border,
							borderLeftColor: tag.color,
						},
					]}
				>
					<Text style={styles.icon}>{tag.icon}</Text>
					<Text style={[styles.count, { color: theme.text }]}>{tag.count}</Text>
					<Text
						style={[styles.name, { color: theme.textMuted }]}
						numberOfLines={1}
					>
						{tag.name}
					</Text>
				</View>
			))}
		</View>
	);
}

const styles = StyleSheet.create({
	grid: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		paddingHorizontal: 16,
		marginBottom: 8,
	},
	box: {
		width: '46%',
		margin: '2%',
		borderRadius: 14,
		borderWidth: 1,
		borderLeftWidth: 4,
		padding: 14,
	},
	icon: { fontSize: 20, marginBottom: 6 },
	count: { fontSize: 22, fontWeight: '700' },
	name: { fontSize: 13, marginTop: 2 },
});
