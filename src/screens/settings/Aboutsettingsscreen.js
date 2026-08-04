import React from 'react';
import { ScrollView } from 'react-native';
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
					style={{ color: theme.textMuted, fontStyle: 'italic', marginTop: 2 }}
				>
					speak, and be remembered
				</Text>
			</SettingsSection>
		</ScrollView>
	);
}
