import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import Text from '../theme/Text';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';

export default function SettingsHeader({ title, onBack }) {
	const { theme } = useTheme();
	return (
		<View style={styles.topBar}>
			<TouchableOpacity style={[styles.headerBtn, { backgroundColor: theme.surfaceAlt }]} onPress={onBack}>
				<Feather
					name='arrow-left'
					size={22}
					color={theme.textMuted}
				/>
			</TouchableOpacity>
			<Text style={[styles.headerTitle, { color: theme.text }]}>{title}</Text>
			<View style={{ width: 22 }} />
		</View>
	);
}

const styles = StyleSheet.create({
	topBar: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		marginBottom: 20,
	},
	headerBtn: {
		width: 36,
		height: 36,
		borderRadius: 18,
		alignItems: 'center',
		justifyContent: 'center',
	},
	headerTitle: { fontSize: 20, fontWeight: '700' },
});
