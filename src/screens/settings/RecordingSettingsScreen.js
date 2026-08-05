import React, { useEffect, useState } from 'react';
import {
	View,
	TouchableOpacity,
	ScrollView,
	StyleSheet,
	Platform,
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
	getRecordingsFolderUri,
	setRecordingsFolderUri,
	getTranscriptFolderUri,
	setTranscriptFolderUri,
} from '../../utils/settingsStore';
import {
	pickFolder,
	folderDisplayName,
	isExternalFolderSupported,
} from '../../utils/externalFolder';
import { backfillRecordingsToFolder } from '../../db/entries';

export default function RecordingSettingsScreen({ navigation }) {
	const { theme } = useTheme();
	const alert = useAlert();
	const insets = useSafeAreaInsets();
	const [recordingsFolderUri, setRecordingsFolderUriState] = useState(null);
	const [transcriptFolderUri, setTranscriptFolderUriState] = useState(null);
	const [backfillModalVisible, setBackfillModalVisible] = useState(false);
	const [backfilling, setBackfilling] = useState(false);
	const [backfillProgress, setBackfillProgress] = useState({
		done: 0,
		total: 0,
	});

	useEffect(() => {
		getRecordingsFolderUri().then(setRecordingsFolderUriState);
		getTranscriptFolderUri().then(setTranscriptFolderUriState);
	}, []);

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
			setBackfillModalVisible(true);
		}
	}

	async function clearRecordingsFolder() {
		await setRecordingsFolderUri(null);
		setRecordingsFolderUriState(null);
	}

	async function runBackfill() {
		setBackfillModalVisible(false);
		if (!recordingsFolderUri) return;
		setBackfilling(true);
		setBackfillProgress({ done: 0, total: 0 });
		const result = await backfillRecordingsToFolder(
			recordingsFolderUri,
			setBackfillProgress,
		);
		setBackfilling(false);
		if (result.total === 0) {
			alert(
				'Nothing to copy',
				"You don't have any recordings saved locally yet.",
			);
		} else if (result.failed > 0) {
			alert(
				'Copy finished',
				`Copied ${result.copied} of ${result.total} recording${result.total === 1 ? '' : 's'}. ${result.failed} couldn't be copied.`,
			);
		} else {
			alert(
				'Copy finished',
				`Copied ${result.copied} recording${result.copied === 1 ? '' : 's'} to your chosen folder.`,
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
						{`• Optional: saves a copy of every new recording to this folder\n• Lets you browse files outside the app\n• Recordings still play and edit from the app's internal storage\n• Android only (for now)`}
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
							disabled={backfilling}
							onPress={() => setBackfillModalVisible(true)}
							style={[
								styles.navButton,
								{
									backgroundColor: theme.surfaceAlt,
									borderColor: theme.border,
									marginTop: 12,
									opacity: backfilling ? 0.6 : 1,
								},
							]}
						>
							<Feather
								name='upload'
								size={18}
								color={theme.text}
								style={{ marginRight: 10 }}
							/>
							<Text style={{ color: theme.text, flex: 1, fontWeight: '600' }}>
								{backfilling
									? `Copying ${backfillProgress.done}/${backfillProgress.total}…`
									: 'Copy existing recordings to this folder'}
							</Text>
						</TouchableOpacity>
						<Text
							style={{ color: theme.textMuted, marginTop: 6, fontSize: 12 }}
						>
							Copies everything already saved locally, not just new recordings.
							Running it again on the same folder may create duplicates for
							files already copied.
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

			<ConfirmModal
				visible={backfillModalVisible}
				title='Copy existing recordings?'
				message="This copies every recording you already have saved locally into the folder you just chose, so nothing's left behind. New recordings will keep mirroring here automatically either way."
				confirmLabel='Copy now'
				cancelLabel='Not now'
				onCancel={() => setBackfillModalVisible(false)}
				onConfirm={runBackfill}
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
});
