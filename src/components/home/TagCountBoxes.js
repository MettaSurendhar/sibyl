import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';

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
							borderTopColor: tag.color,
						},
					]}
				>
					<View style={styles.countRow}>
						<Text style={[styles.count, { color: theme.text }]}>{tag.count}</Text>
						<Text style={styles.icon}>{tag.icon}</Text>
					</View>
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
		borderRadius: 16,
		borderWidth: 1,
		borderTopWidth: 6,
		padding: 16,
		alignItems: 'center',
		justifyContent: 'center',
	},
	countRow: {
		flexDirection: 'row',
		alignItems: 'center',
		marginBottom: 6,
		gap: 6,
	},
	count: { fontSize: 34, fontWeight: '800' },
	icon: { fontSize: 24 },
	name: { fontSize: 13, fontWeight: '700', textAlign: 'center' },
});
