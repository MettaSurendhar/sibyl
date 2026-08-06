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
	const [transcriptionLanguage, setTranscriptionLanguage] = useState('auto');
	const [transcriptionModel, setTranscriptionModel] = useState('whisper-large-v3-turbo');

	useEffect(() => {
		getGroqApiKey().then((k) => setApiKey(k || ''));
		getPrefs().then((p) => {
			setAutoTranscribe(p.autoTranscribe || false);
			setTranscriptionLanguage(p.transcriptionLanguage || 'auto');
			setTranscriptionModel(p.transcriptionModel || 'whisper-large-v3-turbo');
		});
	}, []);

	async function saveApiKey(text) {
		setApiKey(text);
		await setGroqApiKey(text);
	}

	async function handleAutoTranscribeChange(val) {
		setAutoTranscribe(val);
		await setPrefs({ autoTranscribe: val });
	}

	async function handleLanguageChange(code) {
		setTranscriptionLanguage(code);
		await setPrefs({ transcriptionLanguage: code });
	}

	async function handleModelChange(modelId) {
		setTranscriptionModel(modelId);
		await setPrefs({ transcriptionModel: modelId });
	}

	const LANGUAGES = [
		{ code: 'auto', label: 'Auto-detect' },
		{ code: 'en', label: 'English' },
		{ code: 'ta', label: 'Tamil' },
		{ code: 'te', label: 'Telugu' },
		{ code: 'ml', label: 'Malayalam' },
		{ code: 'kn', label: 'Kannada' },
		{ code: 'hi', label: 'Hindi' },
	];

	const MODELS = [
		{ id: 'whisper-large-v3-turbo', label: 'Fast (Turbo)', desc: 'Fastest + cheapest, good for English.' },
		{ id: 'whisper-large-v3', label: 'Accurate (Large v3)', desc: 'Slower, but significantly more accurate for Indian languages.' },
	];

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
			
			<SettingsSection
				title='Transcription Language'
				right={
					<InfoPopover title='Force Language'>
						{`Whisper usually auto-detects the language you are speaking.\n\nHowever, for some languages (like Tamil), if Auto-detect translates your speech into English instead of writing it in the native script, you can strictly enforce the language here.`}
					</InfoPopover>
				}
			>
				<ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20, paddingHorizontal: 20 }}>
					{LANGUAGES.map((lang) => {
						const isSelected = transcriptionLanguage === lang.code;
						return (
							<TouchableOpacity
								key={lang.code}
								onPress={() => handleLanguageChange(lang.code)}
								style={[
									styles.langChip,
									{
										backgroundColor: isSelected ? theme.accent : theme.surfaceAlt,
										borderColor: isSelected ? theme.accent : theme.border,
									}
								]}
							>
								<Text style={{ 
									color: isSelected ? '#fff' : theme.text,
									fontWeight: isSelected ? '600' : '400',
									fontSize: 14,
								}}>
									{lang.label}
								</Text>
							</TouchableOpacity>
						);
					})}
					<View style={{ width: 40 }} />
				</ScrollView>
			</SettingsSection>

			<SettingsSection
				title='Whisper Model'
				right={
					<InfoPopover title='Whisper Models'>
						{`whisper-large-v3-turbo is incredibly fast and uses minimal Groq free-tier quota.\n\nHowever, whisper-large-v3 is the full model and has significantly better accuracy for languages like Tamil and Telugu, at the cost of being slightly slower and using more hourly quota.`}
					</InfoPopover>
				}
			>
				{MODELS.map((model) => {
					const isSelected = transcriptionModel === model.id;
					return (
						<TouchableOpacity
							key={model.id}
							onPress={() => handleModelChange(model.id)}
							style={[
								styles.modelCard,
								{
									backgroundColor: theme.surfaceAlt,
									borderColor: isSelected ? theme.accent : theme.border,
									borderWidth: isSelected ? 2 : 1,
								}
							]}
						>
							<Text style={{ color: theme.text, fontSize: 15, fontWeight: '600', marginBottom: 4 }}>
								{model.label}
							</Text>
							<Text style={{ color: theme.textMuted, fontSize: 13 }}>
								{model.desc}
							</Text>
						</TouchableOpacity>
					);
				})}
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
	langChip: {
		borderWidth: 1,
		paddingHorizontal: 16,
		paddingVertical: 10,
		borderRadius: 20,
		marginRight: 10,
	},
	modelCard: {
		padding: 16,
		borderRadius: 14,
		marginBottom: 12,
	}
});
