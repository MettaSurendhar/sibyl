import React from 'react';
import { Text, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';
import SettingsHeader from '../../components/SettingsHeader';
import { SettingsSection } from '../../components/SettingsNavRow';

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

			<SettingsSection title='About'>
				<Text style={{ color: theme.textMuted }}>Sibyl — v1.0.0</Text>
				<Text
					style={{ color: theme.textMuted, fontStyle: 'italic', marginTop: 2 }}
				>
					speak, and be remembered
				</Text>
				<Text style={{ color: theme.textMuted, marginTop: 4 }}>
					A local-first voice diary. All recordings and metadata stay on your
					device.
				</Text>
			</SettingsSection>
		</ScrollView>
	);
}
