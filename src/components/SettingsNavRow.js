import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import Text from '../theme/Text';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';

export function SettingsNavRow({ icon, label, onPress, subtitle }) {
	const { theme } = useTheme();
	return (
		<TouchableOpacity
			style={[
				styles.navButton,
				{ backgroundColor: theme.surfaceAlt, borderColor: theme.border },
			]}
			onPress={onPress}
		>
			<Feather
				name={icon}
				size={18}
				color={theme.text}
				style={{ marginRight: 10 }}
			/>
			<View style={{ flex: 1 }}>
				<Text style={{ color: theme.text, fontWeight: '600' }}>{label}</Text>
				{subtitle ? (
					<Text style={{ color: theme.textMuted, fontSize: 12, marginTop: 2 }}>
						{subtitle}
					</Text>
				) : null}
			</View>
			<Feather
				name='chevron-right'
				size={18}
				color={theme.textMuted}
			/>
		</TouchableOpacity>
	);
}

export function SettingsSection({ title, children, right }) {
	const { theme } = useTheme();
	return (
		<View style={{ marginBottom: 28 }}>
			<View style={styles.sectionTitleRow}>
				<Text style={[styles.sectionTitle, { color: theme.textMuted }]}>
					{title.toUpperCase()}
				</Text>
				{right}
			</View>
			{children}
		</View>
	);
}

const styles = StyleSheet.create({
	navButton: {
		flexDirection: 'row',
		alignItems: 'center',
		borderWidth: 1,
		borderRadius: 12,
		paddingVertical: 14,
		paddingHorizontal: 14,
		marginBottom: 10,
	},
	sectionTitleRow: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		marginBottom: 10,
	},
	sectionTitle: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
});
