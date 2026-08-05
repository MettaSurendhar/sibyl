import React, { useEffect, useState } from 'react';
import {
	View,
	TouchableOpacity,
	ScrollView,
	StyleSheet,
	Platform,
	TextInput,
	Switch,
} from 'react-native';
import Text from '../../theme/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../../theme/ThemeContext';
import { useAlert } from '../../theme/AlertContext';
import SettingsHeader from '../../components/SettingsHeader';
import { SettingsSection } from '../../components/SettingsNavRow';
import ConfirmModal from '../../components/ConfirmModal';
import InfoPopover from '../../components/InfoPopover';
import {
	setRecordingsFolderUri,
	getTranscriptFolderUri,
	setTranscriptFolderUri,
	getGroqApiKey,
	setGroqApiKey,
	getPrefs,
	setPrefs,
} from '../../utils/settingsStore';
import {
	pickFolder,
	folderDisplayName,
	isExternalFolderSupported,
} from '../../utils/externalFolder';
import { syncWithFolder } from '../../db/entries';

export default function RecordingSettingsScreen({ navigation }) {
	const { theme } = useTheme();
	const alert = useAlert();
	const insets = useSafeAreaInsets();
	const [recordingsFolderUri, setRecordingsFolderUriState] = useState(null);
	const [transcriptFolderUri, setTranscriptFolderUriState] = useState(null);
	const [syncModalVisible, setSyncModalVisible] = useState(false);
	const [syncing, setSyncing] = useState(false);
	const [syncProgress, setSyncProgress] = useState({
		done: 0,
		total: 0,
		phase: ''
	});
	const [groqKey, setGroqKeyState] = useState('');
	const [autoTranscribe, setAutoTranscribe] = useState(false);

	useEffect(() => {
		getRecordingsFolderUri().then(setRecordingsFolderUriState);
		getTranscriptFolderUri().then(setTranscriptFolderUriState);
		getGroqApiKey().then((k) => setGroqKeyState(k || ''));
		getPrefs().then((p) => setAutoTranscribe(p.autoTranscribe || false));
	}, []);

	async function handleGroqKeyChange(val) {
		setGroqKeyState(val);
		await setGroqApiKey(val);
	}

	async function handleAutoTranscribeChange(val) {
		setAutoTranscribe(val);
		await setPrefs({ autoTranscribe: val });
	}

	async function chooseRecordingsFolder() {
		if (!isExternalFolderSupported()) {
			alert(
				'Not available on iOS',
				'Choosing a save folder uses an Android-only system feature. On iOS, use the Share button on a recording to save it to Files instead.',
			);
			return;
		}
		const picked = await pickFolder();
		if (picked) {
			await setRecordingsFolderUri(picked);
			setRecordingsFolderUriState(picked);
			setSyncModalVisible(true);
		}
	}

	async function clearRecordingsFolder() {
		await setRecordingsFolderUri(null);
		setRecordingsFolderUriState(null);
	}

	async function runSync() {
		setSyncModalVisible(false);
		if (!recordingsFolderUri) return;
		setSyncing(true);
		setSyncProgress({ done: 0, total: 0, phase: 'starting' });
		const result = await syncWithFolder(
			recordingsFolderUri,
			setSyncProgress,
		);
		setSyncing(false);
		if (result.total === 0) {
			alert(
				'Folder is in sync',
				"No new recordings to push, and no new files to pull.",
			);
		} else {
			let message = [];
			if (result.pushed > 0) message.push(`Exported ${result.pushed} to folder.`);
			if (result.pulled > 0) message.push(`Imported ${result.pulled} from folder.`);
			if (result.failed > 0) message.push(`Failed to sync ${result.failed} files.`);
			
			alert(
				'Sync finished',
				message.join('\n')
			);
		}
	}

	async function chooseTranscriptFolder() {
		if (!isExternalFolderSupported()) {
			alert(
				'Not available on iOS',
				'Choosing a folder uses an Android-only system feature. On iOS, use the Share button on a transcript to save it via Files instead.',
			);
			return;
		}
		const picked = await pickFolder();
		if (picked) {
			await setTranscriptFolderUri(picked);
			setTranscriptFolderUriState(picked);
		}
	}

	async function clearTranscriptFolder() {
		await setTranscriptFolderUri(null);
		setTranscriptFolderUriState(null);
	}

	return (
		<ScrollView
			style={[styles.container, { backgroundColor: theme.bg }]}
			contentContainerStyle={{ padding: 20, paddingTop: insets.top + 16 }}
		>
			<SettingsHeader
				title='Recording'
				onBack={() => navigation.goBack()}
			/>

			<SettingsSection
				title='Recordings saving folder'
				right={
					<InfoPopover title='Recordings saving folder'>
						{`• Two-way sync: automatically saves copies of your new recordings to this folder\n• Import: sync pulls missing audio files (mp3, m4a, wav) from this folder into Sibyl\n• Note: Imported files will have a flat dummy waveform instead of a real one, but they will play normally\n• Lets you browse files outside the app\n• Recordings still play and edit from the app's internal storage\n• Android only (for now)`}
					</InfoPopover>
				}
			>
				<TouchableOpacity
					style={[
						styles.navButton,
						{ backgroundColor: theme.surfaceAlt, borderColor: theme.border },
					]}
					onPress={chooseRecordingsFolder}
				>
					<Feather
						name='folder'
						size={18}
						color={theme.text}
						style={{ marginRight: 10 }}
					/>
					<Text
						style={{ color: theme.text, flex: 1, fontWeight: '600' }}
						numberOfLines={1}
					>
						{recordingsFolderUri
							? folderDisplayName(recordingsFolderUri)
							: 'Choose a folder'}
					</Text>
					<Feather
						name='chevron-right'
						size={18}
						color={theme.textMuted}
					/>
				</TouchableOpacity>
				{!!recordingsFolderUri && (
					<>
						<TouchableOpacity
							onPress={clearRecordingsFolder}
							style={{ marginTop: 10 }}
						>
							<Text style={{ color: theme.textMuted, fontSize: 13 }}>
								Stop mirroring to this folder
							</Text>
						</TouchableOpacity>
						<TouchableOpacity
							disabled={syncing}
							onPress={() => setSyncModalVisible(true)}
							style={[
								styles.navButton,
								{
									backgroundColor: theme.surfaceAlt,
									borderColor: theme.border,
									marginTop: 12,
									opacity: syncing ? 0.6 : 1,
								},
							]}
						>
							<Feather
								name='refresh-cw'
								size={18}
								color={theme.text}
								style={{ marginRight: 10 }}
							/>
							<Text style={{ color: theme.text, flex: 1, fontWeight: '600' }}>
								{syncing
									? `Syncing (${syncProgress.phase})... ${syncProgress.done}/${syncProgress.total}`
									: 'Sync with folder (Import/Export)'}
							</Text>
						</TouchableOpacity>
						<Text
							style={{ color: theme.textMuted, marginTop: 6, fontSize: 12 }}
						>
							Pushes any of your existing Sibyl recordings into this folder, and pulls in any foreign audio files it finds there.
						</Text>
					</>
				)}
			</SettingsSection>

			<SettingsSection
				title='Transcript downloads folder'
				right={
					<InfoPopover title='Transcript downloads folder'>
						{`• Optional: sets where downloaded transcripts are saved\n• You are asked to pick a folder on your first download\n• You can change it here anytime\n• Android only (for now)`}
					</InfoPopover>
				}
			>
				<TouchableOpacity
					style={[
						styles.navButton,
						{ backgroundColor: theme.surfaceAlt, borderColor: theme.border },
					]}
					onPress={chooseTranscriptFolder}
				>
					<Feather
						name='file-text'
						size={18}
						color={theme.text}
						style={{ marginRight: 10 }}
					/>
					<Text
						style={{ color: theme.text, flex: 1, fontWeight: '600' }}
						numberOfLines={1}
					>
						{transcriptFolderUri
							? folderDisplayName(transcriptFolderUri)
							: 'Choose a folder'}
					</Text>
					<Feather
						name='chevron-right'
						size={18}
						color={theme.textMuted}
					/>
				</TouchableOpacity>
				{!!transcriptFolderUri && (
					<TouchableOpacity
						onPress={clearTranscriptFolder}
						style={{ marginTop: 10 }}
					>
						<Text style={{ color: theme.textMuted, fontSize: 13 }}>
							Ask again next time I download a transcript
						</Text>
					</TouchableOpacity>
				)}
			</SettingsSection>

			<SettingsSection
				title='Auto-Transcription (Groq Whisper)'
				right={
					<InfoPopover title='Groq Transcription'>
						{`• Generates text from your audio automatically when you save a recording.\n• Requires a free Groq API key.\n• Uses the whisper-large-v3-turbo model for incredibly fast and accurate transcription.\n• Transcripts are stored locally and are searchable in the Library.`}
					</InfoPopover>
				}
			>
				<View style={{ marginBottom: 16 }}>
					<Text style={{ color: theme.textMuted, fontSize: 13, marginBottom: 8 }}>
						Groq API Key
					</Text>
					<TextInput
						value={groqKey}
						onChangeText={handleGroqKeyChange}
						placeholder="gsk_..."
						placeholderTextColor={theme.textMuted}
						secureTextEntry
						style={[
							styles.input,
							{ borderColor: theme.border, color: theme.text, backgroundColor: theme.surfaceAlt }
						]}
					/>
				</View>
				<View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
					<Text style={{ color: theme.text, fontSize: 15, fontWeight: '500' }}>
						Auto-transcribe new recordings
					</Text>
					<Switch
						value={autoTranscribe}
						onValueChange={handleAutoTranscribeChange}
						disabled={!groqKey}
					/>
				</View>
				{!groqKey && (
					<Text style={{ color: theme.accent, fontSize: 12, marginTop: 8 }}>
						Enter an API key to enable auto-transcription.
					</Text>
				)}
			</SettingsSection>

			<ConfirmModal
				visible={syncModalVisible}
				title='Sync with folder?'
				message="This will copy any existing recordings into your chosen folder, and import any new audio files it finds there into Sibyl. Missing waveforms will be generated as flat lines."
				confirmLabel='Sync now'
				cancelLabel='Not now'
				onCancel={() => setSyncModalVisible(false)}
				onConfirm={runSync}
			/>
		</ScrollView>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1 },
	navButton: {
		flexDirection: 'row',
		alignItems: 'center',
		borderWidth: 1,
		borderRadius: 12,
		paddingVertical: 14,
		paddingHorizontal: 14,
	},
	input: {
		borderWidth: 1,
		borderRadius: 12,
		paddingHorizontal: 14,
		paddingVertical: 12,
		fontSize: 15,
	}
});
