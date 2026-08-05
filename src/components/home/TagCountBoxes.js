import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import Text from '../../theme/Text';
import { useTheme } from '../../theme/ThemeContext';

export default function TagCountBoxes({ tags, onTagPress }) {
	const { theme } = useTheme();
	if (!tags.length) return null;

	return (
		<View style={styles.grid}>
			{tags.map((tag) => (
				<TouchableOpacity
					key={tag.id ?? 'untagged'}
					onPress={() => onTagPress && onTagPress(tag.id)}
					activeOpacity={0.7}
					style={[
						styles.box,
						{
							backgroundColor: theme.surface,
							borderColor: theme.border,
							borderTopColor: tag.color,
						},
					]}
				>
					{tag.count === 0 ? (
						<>
							<Text style={styles.icon}>{tag.icon}</Text>
							<Text style={[styles.emptyText, { color: theme.textMuted }]} numberOfLines={2}>
								Start your first {tag.name.toLowerCase()}
							</Text>
						</>
					) : (
						<>
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
						</>
					)}
				</TouchableOpacity>
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
	name: { fontSize: 12, fontWeight: '600' },
	emptyText: {
		fontSize: 11,
		fontWeight: '500',
		textAlign: 'center',
		marginTop: 6,
		fontStyle: 'italic',
		paddingHorizontal: 4,
	}
});
