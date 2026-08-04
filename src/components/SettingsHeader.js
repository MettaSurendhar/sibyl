import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import Text from '../theme/Text';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';

export default function SettingsHeader({ title, onBack }) {
	const { theme } = useTheme();
	return (
		<View style={styles.topBar}>
			<TouchableOpacity onPress={onBack}>
				<Feather
					name='arrow-left'
					size={22}
					color={theme.text}
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
	headerTitle: { fontSize: 20, fontWeight: '700' },
});
