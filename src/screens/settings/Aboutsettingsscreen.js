import React from 'react';
import { ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Text from '../../theme/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';
import SettingsHeader from '../../components/SettingsHeader';
import { SettingsSection } from '../../components/SettingsNavRow';
import InfoPopover from '../../components/InfoPopover';

export default function AboutSettingsScreen({ navigation }) {
	const { theme } = useTheme();
	const insets = useSafeAreaInsets();

	return (
		<ScrollView
			style={{ flex: 1, backgroundColor: theme.bg }}
			contentContainerStyle={{ padding: 20, paddingTop: insets.top + 16 }}
		>
			<SettingsHeader
				title='About'
				onBack={() => navigation.goBack()}
			/>

			<SettingsSection
				title='About'
				right={
					<InfoPopover title='Local-first architecture'>
						{`• All recordings and metadata stay strictly on your device\n• We do not sync, store, or have access to your data\n• Deleting the app deletes your data permanently (unless you use the external saving folder option)`}
					</InfoPopover>
				}
			>
				<Text style={{ color: theme.textMuted }}>Sibyl — v1.0.0</Text>
				<Text
					style={{ color: theme.textMuted, fontStyle: 'italic', marginTop: 2, marginBottom: 12 }}
				>
					speak, and be remembered
				</Text>
			</SettingsSection>

			<SettingsSection title='Legal'>
				<TouchableOpacity style={[styles.optionRow, { borderColor: theme.border }]}>
					<Text style={{ color: theme.text, flex: 1 }}>Privacy Policy</Text>
					<Feather name="chevron-right" size={18} color={theme.textMuted} />
				</TouchableOpacity>
				<TouchableOpacity style={[styles.optionRow, { borderColor: theme.border }]}>
					<Text style={{ color: theme.text, flex: 1 }}>Terms of Service</Text>
					<Feather name="chevron-right" size={18} color={theme.textMuted} />
				</TouchableOpacity>
				<TouchableOpacity style={[styles.optionRow, { borderColor: theme.border }]}>
					<Text style={{ color: theme.text, flex: 1 }}>Open Source Licenses</Text>
					<Feather name="chevron-right" size={18} color={theme.textMuted} />
				</TouchableOpacity>
			</SettingsSection>
		</ScrollView>
	);
}

const styles = StyleSheet.create({
	optionRow: {
		flexDirection: 'row',
		alignItems: 'center',
		borderWidth: 1,
		borderRadius: 12,
		padding: 12,
		marginBottom: 8,
	},
});
