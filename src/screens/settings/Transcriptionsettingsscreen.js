import React, { useEffect, useState } from 'react';
import {
	View,
	TextInput,
	TouchableOpacity,
	ScrollView,
	Linking,
	StyleSheet,
	Switch,
} from 'react-native';
import Text from '../../theme/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';
import SettingsHeader from '../../components/SettingsHeader';
import { SettingsSection } from '../../components/SettingsNavRow';
import { getGroqApiKey, setGroqApiKey, getPrefs, setPrefs } from '../../utils/settingsStore';
import InfoPopover from '../../components/InfoPopover';

export default function TranscriptionSettingsScreen({ navigation }) {
	const { theme } = useTheme();
	const insets = useSafeAreaInsets();
	const [apiKey, setApiKey] = useState('');
	const [autoTranscribe, setAutoTranscribe] = useState(false);

	useEffect(() => {
		getGroqApiKey().then((k) => setApiKey(k || ''));
		getPrefs().then((p) => setAutoTranscribe(p.autoTranscribe || false));
	}, []);

	async function saveApiKey(text) {
		setApiKey(text);
		await setGroqApiKey(text);
	}

	async function handleAutoTranscribeChange(val) {
		setAutoTranscribe(val);
		await setPrefs({ autoTranscribe: val });
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
				title='Groq Auto-Transcription'
				right={
					<InfoPopover title='Groq Auto-Transcription'>
						{`• Generates text from your audio automatically when you save a recording.\n• Requires a free Groq API key.\n• Uses the whisper-large-v3-turbo model for incredibly fast and accurate transcription.\n• Transcripts are stored locally and are searchable in the Library.`}
					</InfoPopover>
				}
			>
				<View
					style={[
						styles.advancedCard,
						{ borderColor: theme.border, backgroundColor: theme.surfaceAlt, marginBottom: 24 },
					]}
				>
					<Text style={[styles.advancedLabel, { color: theme.textMuted }]}>
						GROQ API KEY
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

				<View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', opacity: !apiKey ? 0.5 : 1 }}>
					<Text style={{ color: theme.text, fontSize: 15, fontWeight: '500', flex: 1, paddingRight: 16 }}>
						Auto-transcribe new recordings
					</Text>
					<Switch
						value={autoTranscribe}
						onValueChange={handleAutoTranscribeChange}
						disabled={!apiKey}
						trackColor={{ false: theme.border, true: theme.accent }}
						thumbColor={autoTranscribe ? '#fff' : theme.textMuted}
					/>
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
