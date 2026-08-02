import React, { useEffect, useState } from 'react';
import {
	View,
	Text,
	TouchableOpacity,
	TextInput,
	ScrollView,
	StyleSheet,
	Linking,
	Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { useAlert } from '../theme/AlertContext';
import { themeList } from '../theme/themes';
import ConfirmModal from '../components/ConfirmModal';
import {
	getGroqApiKey,
	setGroqApiKey,
	getPrefs,
	setPrefs,
	getRecordingsFolderUri,
	setRecordingsFolderUri,
	getTranscriptFolderUri,
	setTranscriptFolderUri,
} from '../utils/settingsStore';
import {
	pickFolder,
	folderDisplayName,
	isExternalFolderSupported,
} from '../utils/externalFolder';
import { backfillRecordingsToFolder } from '../db/entries';
import {
	getUntaggedTemplate,
	setUntaggedTemplate,
	getTrimTemplate,
	setTrimTemplate,
	getMergeTemplate,
	setMergeTemplate,
	getAppendTemplate,
	setAppendTemplate,
} from '../db/categories';
import { renderTemplate } from '../utils/naming';

const FORMATS = [
	{ key: 'aac', label: 'AAC (.m4a) — recommended, native quality' },
	{ key: 'wav', label: 'WAV — uncompressed, larger files' },
	{ key: 'mp3', label: 'MP3 — requires the optional ffmpeg module' },
];

export default function SettingsScreen({ navigation }) {
	const { theme, themeKey, setThemeKey } = useTheme();
	const alert = useAlert();
	const insets = useSafeAreaInsets();
	const [apiKey, setApiKey] = useState('');
	const [prefs, setPrefsState] = useState({ recordingFormat: 'aac' });
	const [untaggedTemplate, setUntaggedTemplateState] = useState('');
	const [trimTemplate, setTrimTemplateState] = useState('');
	const [mergeTemplate, setMergeTemplateState] = useState('');
	const [appendTemplate, setAppendTemplateState] = useState('');
	const [recordingsFolderUri, setRecordingsFolderUriState] = useState(null);
	const [transcriptFolderUri, setTranscriptFolderUriState] = useState(null);
	const [backfillModalVisible, setBackfillModalVisible] = useState(false);
	const [backfilling, setBackfilling] = useState(false);
	const [backfillProgress, setBackfillProgress] = useState({
		done: 0,
		total: 0,
	});

	useEffect(() => {
		getGroqApiKey().then((k) => setApiKey(k || ''));
		getPrefs().then(setPrefsState);
		getUntaggedTemplate().then(setUntaggedTemplateState);
		getTrimTemplate().then(setTrimTemplateState);
		getMergeTemplate().then(setMergeTemplateState);
		getAppendTemplate().then(setAppendTemplateState);
		getRecordingsFolderUri().then(setRecordingsFolderUriState);
		getTranscriptFolderUri().then(setTranscriptFolderUriState);
	}, []);

	async function saveApiKey(text) {
		setApiKey(text);
		await setGroqApiKey(text);
	}

	async function chooseFormat(key) {
		const updated = await setPrefs({ recordingFormat: key });
		setPrefsState(updated);
	}

	async function saveUntaggedTemplate(text) {
		setUntaggedTemplateState(text);
		await setUntaggedTemplate(text);
	}

	async function saveTrimTemplate(text) {
		setTrimTemplateState(text);
		await setTrimTemplate(text);
	}

	async function saveMergeTemplate(text) {
		setMergeTemplateState(text);
		await setMergeTemplate(text);
	}

	async function saveAppendTemplate(text) {
		setAppendTemplateState(text);
		await setAppendTemplate(text);
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
			// New/changed folder only mirrors recordings made from here on - offer to back-copy
			// everything already sitting in local storage too, so nothing's left behind.
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
			<View style={styles.topBar}>
				<TouchableOpacity onPress={() => navigation.goBack()}>
					<Feather
						name='arrow-left'
						size={22}
						color={theme.text}
					/>
				</TouchableOpacity>
				<Text style={[styles.headerTitle, { color: theme.text }]}>
					Settings
				</Text>
				<View style={{ width: 22 }} />
			</View>

			<Section
				title='Tags'
				theme={theme}
			>
				<TouchableOpacity
					style={[
						styles.navButton,
						{ backgroundColor: theme.surfaceAlt, borderColor: theme.border },
					]}
					onPress={() => navigation.navigate('Categories')}
				>
					<Feather
						name='tag'
						size={18}
						color={theme.text}
						style={{ marginRight: 10 }}
					/>
					<Text style={{ color: theme.text, flex: 1, fontWeight: '600' }}>
						Manage tags
					</Text>
					<Feather
						name='chevron-right'
						size={18}
						color={theme.textMuted}
					/>
				</TouchableOpacity>
			</Section>

			<Section
				title='Untagged recording naming'
				theme={theme}
			>
				<TextInput
					value={untaggedTemplate}
					onChangeText={saveUntaggedTemplate}
					style={[
						styles.input,
						{
							color: theme.text,
							borderColor: theme.border,
							backgroundColor: theme.surfaceAlt,
						},
					]}
					placeholder='Recording <count> <date>'
					placeholderTextColor={theme.textMuted}
				/>
				<Text style={{ color: theme.textMuted, fontSize: 12, marginTop: 6 }}>
					Preview: {renderTemplate(untaggedTemplate, { count: 1 })}
				</Text>
			</Section>

			<Section
				title='Derived recording naming'
				theme={theme}
			>
				<Text
					style={{ color: theme.textMuted, fontSize: 12, marginBottom: 10 }}
				>
					Trim, Merge, and Append each create a new recording rather than
					changing the original - these control the suggested name shown when
					saving one. Use {'{name}'} for the source recording's name.
				</Text>

				<Text style={[styles.subLabel, { color: theme.text }]}>Trim</Text>
				<TextInput
					value={trimTemplate}
					onChangeText={saveTrimTemplate}
					style={[
						styles.input,
						{
							color: theme.text,
							borderColor: theme.border,
							backgroundColor: theme.surfaceAlt,
							marginBottom: 6,
						},
					]}
					placeholder='{name} trimmed <date:DD-MM-YYYY> <time:hh:mm>'
					placeholderTextColor={theme.textMuted}
				/>
				<Text
					style={{ color: theme.textMuted, fontSize: 12, marginBottom: 16 }}
				>
					Preview: {renderTemplate(trimTemplate, { name: 'Diary 3' })}
				</Text>

				<Text style={[styles.subLabel, { color: theme.text }]}>Merge</Text>
				<TextInput
					value={mergeTemplate}
					onChangeText={saveMergeTemplate}
					style={[
						styles.input,
						{
							color: theme.text,
							borderColor: theme.border,
							backgroundColor: theme.surfaceAlt,
							marginBottom: 6,
						},
					]}
					placeholder='{name} merged <date:DD-MM-YYYY> <time:hh:mm>'
					placeholderTextColor={theme.textMuted}
				/>
				<Text
					style={{ color: theme.textMuted, fontSize: 12, marginBottom: 16 }}
				>
					Preview: {renderTemplate(mergeTemplate, { name: 'Diary 3' })}
				</Text>

				<Text style={[styles.subLabel, { color: theme.text }]}>Append</Text>
				<TextInput
					value={appendTemplate}
					onChangeText={saveAppendTemplate}
					style={[
						styles.input,
						{
							color: theme.text,
							borderColor: theme.border,
							backgroundColor: theme.surfaceAlt,
							marginBottom: 6,
						},
					]}
					placeholder='{name} append <date:DD-MM-YYYY> <time:hh:mm>'
					placeholderTextColor={theme.textMuted}
				/>
				<Text style={{ color: theme.textMuted, fontSize: 12 }}>
					Preview: {renderTemplate(appendTemplate, { name: 'Diary 3' })}
				</Text>
			</Section>

			<Section
				title='Recording format'
				theme={theme}
			>
				{FORMATS.map((f) => (
					<TouchableOpacity
						key={f.key}
						style={[
							styles.optionRow,
							{
								borderColor: theme.border,
								backgroundColor:
									prefs.recordingFormat === f.key
										? theme.surfaceAlt
										: 'transparent',
							},
						]}
						onPress={() => chooseFormat(f.key)}
					>
						<Feather
							name={prefs.recordingFormat === f.key ? 'check-circle' : 'circle'}
							size={18}
							color={
								prefs.recordingFormat === f.key ? theme.accent : theme.textMuted
							}
							style={{ marginRight: 12 }}
						/>
						<Text style={{ color: theme.text, flex: 1 }}>{f.label}</Text>
					</TouchableOpacity>
				))}
			</Section>

			<Section
				title='Recordings saving folder'
				theme={theme}
			>
				<Text style={{ color: theme.textMuted, marginBottom: 8, fontSize: 13 }}>
					Optional. When set, a copy of every new recording is also saved into
					this folder on your phone, so you can browse it outside the app.
					Recordings still play and edit from the app's own storage either way -
					this is an extra, visible copy, not a replacement for it.
					{Platform.OS !== 'android' && ' Android only, for now.'}
				</Text>
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
			</Section>

			<Section
				title='Transcript downloads folder'
				theme={theme}
			>
				<Text style={{ color: theme.textMuted, marginBottom: 8, fontSize: 13 }}>
					Optional. Where the download button on a transcript saves its .txt
					file. You're asked to pick one the first time you download a
					transcript if you haven't set one here - this lets you set or change
					it anytime.
					{Platform.OS !== 'android' && ' Android only, for now.'}
				</Text>
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
			</Section>

			<Section
				title='Theme'
				theme={theme}
			>
				{themeList.map((t) => (
					<TouchableOpacity
						key={t.key}
						style={[
							styles.optionRow,
							{
								borderColor: theme.border,
								backgroundColor:
									themeKey === t.key ? theme.surfaceAlt : 'transparent',
							},
						]}
						onPress={() => setThemeKey(t.key)}
					>
						<View style={[styles.swatch, { backgroundColor: t.accent }]} />
						<Text style={{ color: theme.text, flex: 1 }}>{t.label}</Text>
					</TouchableOpacity>
				))}
			</Section>

			<Section
				title='Transcription (Groq)'
				theme={theme}
			>
				<Text style={{ color: theme.textMuted, marginBottom: 8, fontSize: 13 }}>
					Needs an internet connection and a free API key from console.groq.com.
					Recording and playback stay fully offline — only transcription calls
					out.
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
			</Section>

			<Section
				title='About'
				theme={theme}
			>
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
			</Section>

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

function Section({ title, theme, children }) {
	return (
		<View style={{ marginBottom: 28 }}>
			<Text style={[styles.sectionTitle, { color: theme.textMuted }]}>
				{title.toUpperCase()}
			</Text>
			{children}
		</View>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1 },
	topBar: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		marginBottom: 20,
	},
	headerTitle: { fontSize: 20, fontWeight: '700' },
	sectionTitle: {
		fontSize: 12,
		fontWeight: '700',
		marginBottom: 10,
		letterSpacing: 0.5,
	},
	rowBtn: { borderWidth: 1, borderRadius: 12, padding: 14 },
	navButton: {
		flexDirection: 'row',
		alignItems: 'center',
		borderWidth: 1,
		borderRadius: 12,
		paddingVertical: 14,
		paddingHorizontal: 14,
	},
	optionRow: {
		flexDirection: 'row',
		alignItems: 'center',
		borderWidth: 1,
		borderRadius: 12,
		padding: 12,
		marginBottom: 8,
	},
	swatch: { width: 18, height: 18, borderRadius: 9, marginRight: 12 },
	input: { borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 15 },
	subLabel: { fontSize: 13, fontWeight: '700', marginBottom: 6 },
});
