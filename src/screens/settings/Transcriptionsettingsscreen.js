import React, { useEffect, useState } from 'react';
import {
	View,
	Text,
	TextInput,
	TouchableOpacity,
	ScrollView,
	Linking,
	StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';
import SettingsHeader from '../../components/SettingsHeader';
import { SettingsSection } from '../../components/SettingsNavRow';
import { getGroqApiKey, setGroqApiKey } from '../../utils/settingsStore';
import InfoPopover from '../../components/InfoPopover';

export default function TranscriptionSettingsScreen({ navigation }) {
	const { theme } = useTheme();
	const insets = useSafeAreaInsets();
	const [apiKey, setApiKey] = useState('');

	useEffect(() => {
		getGroqApiKey().then((k) => setApiKey(k || ''));
	}, []);

	async function saveApiKey(text) {
		setApiKey(text);
		await setGroqApiKey(text);
	}

	return (
		<ScrollView
			style={{ flex: 1, backgroundColor: theme.bg }}
			contentContainerStyle={{ padding: 20, paddingTop: insets.top + 16 }}
		>
			<SettingsHeader
				title='Transcription'
				onBack={() => navigation.goBack()}
			/>

			<SettingsSection
				title='Groq'
				right={
					<InfoPopover title='Groq API'>
						{`• Needs an internet connection\n• Requires a free API key from console.groq.com\n• Recording and playback stay fully offline\n• Only transcription connects to the internet`}
					</InfoPopover>
				}
			>

				<View
					style={[
						styles.advancedCard,
						{ borderColor: theme.border, backgroundColor: theme.surfaceAlt },
					]}
				>
					<Text style={[styles.advancedLabel, { color: theme.textMuted }]}>
						ADVANCED
					</Text>
					<TextInput
						value={apiKey}
						onChangeText={saveApiKey}
						placeholder='gsk_...'
						placeholderTextColor={theme.textMuted}
						secureTextEntry
						style={[
							styles.input,
							{ color: theme.text, borderColor: theme.border },
						]}
					/>
					<TouchableOpacity
						onPress={() => Linking.openURL('https://console.groq.com/keys')}
					>
						<Text style={{ color: theme.accent, marginTop: 8 }}>
							Get a free API key →
						</Text>
					</TouchableOpacity>
				</View>
			</SettingsSection>
		</ScrollView>
	);
}

const styles = StyleSheet.create({
	advancedCard: { borderWidth: 1, borderRadius: 14, padding: 14 },
	advancedLabel: {
		fontSize: 11,
		fontWeight: '700',
		letterSpacing: 0.6,
		marginBottom: 10,
	},
	input: { borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 15 },
});
