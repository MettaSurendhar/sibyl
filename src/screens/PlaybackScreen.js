import React, { useCallback, useRef, useState } from 'react';
import {
	View,
	TouchableOpacity,
	Pressable,
	StyleSheet,
	ScrollView,
	Modal,
	BackHandler,
	useWindowDimensions,
	ActivityIndicator,
} from 'react-native';
import Text from '../theme/Text';
import Slider from '@react-native-community/slider';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, MaterialIcons } from '@expo/vector-icons';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import * as Clipboard from 'expo-clipboard';
import { useTheme } from '../theme/ThemeContext';
import { useAlert } from '../theme/AlertContext';
import { ScrollingPlaybackTrack } from '../components/Waveform';
import PromptModal from '../components/PromptModal';
import ConfirmModal from '../components/ConfirmModal';
import PlaybackSettingsSheet from '../components/PlaybackSettingsSheet';
import EntryTagSheet from '../components/EntryTagSheet';
import { createPlayer } from '../audio/player';
import { formatDuration } from '../utils/format';
import {
	getEntry,
	renameEntry,
	deleteEntries,
	setTranscript,
	setTranscriptStatus,
	setEntryCategory,
	getExternalUrisForEntries,
} from '../db/entries';
import { listCategories, nextNameForCategory } from '../db/categories';
import {
	getGroqApiKey,
	getRecordingsFolderUri,
	getTranscriptFolderUri,
	setTranscriptFolderUri,
	getPrefs,
} from '../utils/settingsStore';
import {
	pickFolder,
	writeTextFileToFolder,
	folderDisplayName,
	isExternalFolderSupported,
} from '../utils/externalFolder';
import { transcribeSegments, languageDisplayName } from '../groq/transcribe';

// Page 2's "no API key" case is by far the most common failure - give it a distinct sentinel
// so the warning under the Transcribe button can show a tappable Settings link instead of a
// plain error string.
const NO_API_KEY = 'no-api-key';

export default function PlaybackScreen({ route, navigation }) {
	const { theme } = useTheme();
	const alert = useAlert();
	const insets = useSafeAreaInsets();
	const { width } = useWindowDimensions();
	const { entryId } = route.params;
	const [entry, setEntry] = useState(null);
	const [categories, setCategories] = useState([]);
	const [positionMs, setPositionMs] = useState(0);
	const [isPlaying, setIsPlaying] = useState(false);
	const [speed, setSpeed] = useState(1.0);
	const [skipSilence, setSkipSilence] = useState(false);
	const [menuOpen, setMenuOpen] = useState(false);
	const [editMenuOpen, setEditMenuOpen] = useState(false);
	const [settingsOpen, setSettingsOpen] = useState(false);
	const [tagSheetOpen, setTagSheetOpen] = useState(false);
	const [transcribing, setTranscribing] = useState(false);
	const [transcribeError, setTranscribeError] = useState('');
	const [transcribeProgress, setTranscribeProgress] = useState(null); // { done, total }
	const [transcriptionLanguage, setTranscriptionLanguage] = useState('Auto');
	const [page, setPage] = useState(0); // 0 = Playback, 1 = Transcribe
	const [renamePromptVisible, setRenamePromptVisible] = useState(false);
	const [deleteModalVisible, setDeleteModalVisible] = useState(false);
	const [deleteFromFolderModalVisible, setDeleteFromFolderModalVisible] =
		useState(false);
	const [folderNameForDelete, setFolderNameForDelete] = useState('');
	const [detailsSheetOpen, setDetailsSheetOpen] = useState(false);
	const [detailsData, setDetailsData] = useState(null);
	const playerRef = useRef(null);
	const entryRef = useRef(null);
	const pagerRef = useRef(null);

	const load = useCallback(async () => {
		const e = await getEntry(entryId);
		setEntry(e);
		entryRef.current = e;

		// Resume transcription spinner if it was left running
		if (e.transcriptStatus === 'processing') setTranscribing(true);

		const prefs = await getPrefs();
		const langMap = { auto: 'Auto', en: 'English', ta: 'Tamil', te: 'Telugu', ml: 'Malayalam', kn: 'Kannada', hi: 'Hindi' };
		setTranscriptionLanguage(langMap[prefs.transcriptionLanguage || 'auto'] || prefs.transcriptionLanguage);

		return e;
	}, [entryId]);

	useFocusEffect(
		useCallback(() => {
			let cancelled = false;
			listCategories().then(setCategories);
			load().then((e) => {
				if (cancelled || !e) return;
				playerRef.current = createPlayer({
					segments: e.segments,
					onStatus: (s) => {
						setPositionMs(s.positionMs);
						if (s.finished) setIsPlaying(false);
					},
				});
			});
			return () => {
				cancelled = true;
				playerRef.current?.unload();
				playerRef.current = null;
			};
		}, [load]),
	);

	// Reset to the Playback page and clear any stale transcription error whenever a fresh entry
	// is focused, so navigating Library -> entry A -> back -> entry B doesn't land on B already
	// scrolled to page 2 or showing A's error message.
	useFocusEffect(
		useCallback(() => {
			pagerRef.current?.scrollTo({ x: 0, animated: false });
			setPage(0);
			setTranscribeError('');
		}, [entryId]),
	);

	function goToPlaybackPage() {
		pagerRef.current?.scrollTo({ x: 0, animated: true });
	}

	function goToTranscribePage() {
		pagerRef.current?.scrollTo({ x: width, animated: true });
	}

	function onPagerScroll(e) {
		const x = e.nativeEvent.contentOffset.x;
		setPage(x >= width / 2 ? 1 : 0);
	}

	// These dropdowns/pages aren't RN Modal components, so unlike the sheet modals below, Android's
	// back button/gesture won't auto-close/navigate them - handle that explicitly. Priority:
	// dropdowns first, then falling back from the Transcribe page to the Playback page, then the
	// screen's default back behavior.
	useFocusEffect(
		useCallback(() => {
			const onBack = () => {
				if (menuOpen) {
					setMenuOpen(false);
					return true;
				}
				if (editMenuOpen) {
					setEditMenuOpen(false);
					return true;
				}
				if (page === 1) {
					goToPlaybackPage();
					return true;
				}
				return false;
			};
			const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
			return () => sub.remove();
		}, [menuOpen, editMenuOpen, page]),
	);

	if (!entry) {
		return <View style={[styles.container, { backgroundColor: theme.bg }]} />;
	}

	async function togglePlay() {
		if (isPlaying) {
			await playerRef.current?.pause();
			setIsPlaying(false);
		} else {
			await playerRef.current?.play();
			setIsPlaying(true);
		}
	}

	async function skip(deltaMs) {
		await playerRef.current?.skip(deltaMs);
	}

	async function seekTo(ms) {
		await playerRef.current?.seek(ms);
		setPositionMs(ms);
	}

	async function changeSpeed(newSpeed) {
		setSpeed(newSpeed);
		await playerRef.current?.setRate(newSpeed);
	}

	function toggleSkipSilence(next) {
		setSkipSilence(next);
		playerRef.current?.setSkipSilence(next, entry.waveform);
	}

	// --- 3-dot menu actions ---
	async function handleShare() {
		setMenuOpen(false);
		const lastUri = entry.segments[entry.segments.length - 1]?.uri;
		if (!lastUri || !(await Sharing.isAvailableAsync())) return;

		try {
			// Copy to a temp file with the user-defined entry name so the share sheet shows the right filename
			const ext = lastUri.split('.').pop() || 'm4a';
			const cleanName = (entry.title || 'Recording').replace(/[^a-zA-Z0-9 \-_]/g, '_').trim();
			const tempUri = FileSystem.cacheDirectory + cleanName + '.' + ext;
			await FileSystem.copyAsync({ from: lastUri, to: tempUri });
			await Sharing.shareAsync(tempUri);
			await FileSystem.deleteAsync(tempUri, { idempotent: true });
		} catch {
			// Fallback to sharing internal URI directly
			await Sharing.shareAsync(lastUri);
		}
	}

	function handleRename() {
		setMenuOpen(false);
		setRenamePromptVisible(true);
	}

	async function submitRename(text) {
		setRenamePromptVisible(false);
		if (text) {
			await renameEntry(entry.id, text);
			load();
		}
	}

	async function handleRingtone() {
		setMenuOpen(false);
		const lastUri = entry.segments[entry.segments.length - 1]?.uri;
		if (lastUri && (await Sharing.isAvailableAsync())) {
			alert(
				'Set as ringtone',
				'Choose "Set as ringtone" from the share sheet, or save and set it from Sound settings.',
			);
			await Sharing.shareAsync(lastUri);
		}
	}

	async function handleDetails() {
		setMenuOpen(false);
		try {
			let totalSizeBytes = 0;
			for (const seg of entry.segments) {
				const info = await FileSystem.getInfoAsync(seg.uri);
				if (info.exists) totalSizeBytes += info.size || 0;
			}
			const sizeStr = totalSizeBytes > 1024 * 1024
				? (totalSizeBytes / (1024 * 1024)).toFixed(2) + ' MB'
				: (totalSizeBytes / 1024).toFixed(2) + ' KB';

			// The internal app path for the audio file(s)
			const lastUri = entry.segments[entry.segments.length - 1]?.uri || '';
			const internalUri = entry.segments.length === 1
				? lastUri
				: `${entry.segments.length} segments stored internally`;

			// File type from extension
			const ext = lastUri.split('.').pop()?.toUpperCase() || '—';

			// User-configured save folders (may be null if not set)
			const recFolderUri = await getRecordingsFolderUri();
			const transcriptFolderUri = await getTranscriptFolderUri();

			const friendlyFolder = (uri) => {
				if (!uri) return 'Not set';

				// Android SAF content URI format:
				// content://com.android.externalstorage.documents/tree/<volumeId>%3A<path>
				// or the decoded /tree/<volumeId>:<path>
				// We want to turn this into "Internal Storage/path" or "SD Card/path"
				try {
					// Extract the document ID from /tree/... part
					const treeMatch = uri.match(/\/tree\/([^/]+)/);
					if (treeMatch) {
						// URL-decode the extracted segment (e.g. %3A → :)
						const decoded = decodeURIComponent(treeMatch[1]);
						// Split on first colon: [volumeId, ...pathParts]
						const colonIdx = decoded.indexOf(':');
						if (colonIdx !== -1) {
							const volumeId = decoded.substring(0, colonIdx);
							const folderPath = decoded.substring(colonIdx + 1);
							const volumeLabel = volumeId.toLowerCase() === 'primary'
								? 'Internal Storage'
								: 'SD Card';
							return folderPath
								? `${volumeLabel}/${folderPath}`
								: volumeLabel;
						}
					}
				} catch {
					// Fall through to simple strip below
				}

				// Fallback: strip the scheme + authority
				return uri.replace(/^(content|file):\/\/[^/]*/, '');
			};

			setDetailsData({
				name: entry.title,
				time: new Date(entry.createdAt).toLocaleString(),
				duration: formatDuration(entry.totalDurationMs),
				size: sizeStr,
				fileType: ext,
				appPath: internalUri,
				recordingsFolder: friendlyFolder(recFolderUri),
				transcriptFolder: friendlyFolder(transcriptFolderUri),
			});
		} catch (e) {
			setDetailsData({
				name: entry.title,
				time: new Date(entry.createdAt).toLocaleString(),
				duration: formatDuration(entry.totalDurationMs),
				size: '—',
				fileType: '—',
				appPath: '—',
				recordingsFolder: '—',
				transcriptFolder: '—',
			});
		}
		setDetailsSheetOpen(true);
	}

	function handleDelete() {
		setMenuOpen(false);
		setDeleteModalVisible(true);
	}

	async function confirmDelete() {
		setDeleteModalVisible(false);
		const folderUri = await getRecordingsFolderUri();
		if (isExternalFolderSupported() && folderUri) {
			const externalUris = await getExternalUrisForEntries([entry.id]);
			if (externalUris.length > 0) {
				setFolderNameForDelete(folderDisplayName(folderUri));
				setDeleteFromFolderModalVisible(true);
				return;
			}
		}
		await deleteEntries([entry.id]);
		navigation.goBack();
	}

	async function finishDelete(alsoDeleteExternal) {
		setDeleteFromFolderModalVisible(false);
		await deleteEntries([entry.id], { alsoDeleteExternal });
		navigation.goBack();
	}

	function handleOpenTag() {
		setMenuOpen(false);
		setTagSheetOpen(true);
	}

	async function applyTagChange(categoryId) {
		let title = entry.title;
		if (categoryId && categoryId !== entry.categoryId) {
			title = (await nextNameForCategory(categoryId)) || entry.title;
		}
		await setEntryCategory(entry.id, categoryId, title);
		setTagSheetOpen(false);
		load();
		listCategories().then(setCategories);
	}

	// --- Transcription ---
	// Shared by both trigger paths: the 3-dot menu's "Transcribe" action and the Transcribe page's
	// own button. Both end up calling this, so there's one source of truth for transcribing/
	// transcript/error state instead of two independent copies.
	async function startTranscribe() {
		setTranscribeError('');
		setTranscribeProgress(null);
		const apiKey = await getGroqApiKey();
		if (!apiKey) {
			setTranscribeError(NO_API_KEY);
			return;
		}
		setTranscribing(true);
		await setTranscriptStatus(entry.id, 'processing');
		try {
			const { text, language } = await transcribeSegments(
				entry.segments,
				apiKey,
				{ onProgress: (p) => setTranscribeProgress(p) },
			);
			setTranscribeProgress(null);
			await setTranscript(entry.id, text, language);
			await load();
		} catch (e) {
			setTranscribeProgress(null);
			setTranscribeError(e.message);
			await setTranscriptStatus(entry.id, 'error');
			await load();
		} finally {
			setTranscribing(false);
		}
	}

	function handleTranscribeFromMenu() {
		setMenuOpen(false);
		goToTranscribePage();
		startTranscribe();
	}

	// --- Transcript actions (copy / share / download) ---
	function transcriptFilename() {
		const safe =
			(entry.title || 'transcript').replace(/[\\/:*?"<>|]/g, '_').trim() ||
			'transcript';
		return `${safe}.txt`;
	}

	async function handleCopyTranscript() {
		if (!entry.transcript) return;
		await Clipboard.setStringAsync(entry.transcript);
		alert('Copied', 'Transcript copied to clipboard.');
	}

	async function handleShareTranscript() {
		if (!entry.transcript) return;
		const fileUri = FileSystem.cacheDirectory + transcriptFilename();
		await FileSystem.writeAsStringAsync(fileUri, entry.transcript, {
			encoding: FileSystem.EncodingType.UTF8,
		});
		if (await Sharing.isAvailableAsync()) {
			await Sharing.shareAsync(fileUri, {
				mimeType: 'text/plain',
				dialogTitle: 'Share transcript',
			});
		}
	}

	async function writeTranscriptToFolder(folderUri) {
		try {
			await writeTextFileToFolder(
				folderUri,
				transcriptFilename(),
				entry.transcript,
			);
			alert('Saved', 'Transcript saved to your chosen folder.');
		} catch (e) {
			alert(
				"Couldn't save",
				e.message || 'Something went wrong saving the transcript.',
			);
		}
	}

	async function handleDownloadTranscript() {
		if (!entry.transcript) return;
		if (!isExternalFolderSupported()) {
			// No direct folder-write API on iOS - the share sheet's "Save to Files" covers the same
			// end result, so that's the closest equivalent to "download" there.
			await handleShareTranscript();
			return;
		}
		const existingFolder = await getTranscriptFolderUri();
		if (existingFolder) {
			await writeTranscriptToFolder(existingFolder);
			return;
		}
		alert(
			'Choose a folder',
			'Pick where transcripts should be saved (e.g. your Downloads folder). You only need to do this once.',
			[
				{ text: 'Cancel', style: 'cancel' },
				{
					text: 'Choose folder',
					onPress: async () => {
						const picked = await pickFolder();
						if (picked) {
							await setTranscriptFolderUri(picked);
							await writeTranscriptToFolder(picked);
						}
					},
				},
			],
		);
	}

	// --- Transcribe button state (drives label + warning message on page 2) ---
	const transcribed =
		!transcribing && entry.transcriptStatus === 'done' && !!entry.transcript;
	const noApiKey = transcribeError === NO_API_KEY;
	const failed =
		!transcribing &&
		!transcribed &&
		(noApiKey || !!transcribeError || entry.transcriptStatus === 'error');

	let transcribeLabel = 'Transcribe';
	let progressPercent = 0;
	let timeRemainingLabel = '';
	if (transcribing) {
		transcribeLabel = 'Transcribing...';

		// 5 minutes per chunk (300000 ms)
		const estimatedTotalChunks = Math.max(1, Math.ceil((entry?.durationMs || 0) / 300000));

		if (transcribeProgress && transcribeProgress.total > 1) {
			// Upload phase (scales 15% -> 100%)
			progressPercent = 15 + ((transcribeProgress.done / transcribeProgress.total) * 85);

			const remainingChunks = transcribeProgress.total - transcribeProgress.done;
			if (remainingChunks > 0) {
				const secs = remainingChunks * 20; // ~20s per chunk for upload/transcribe
				const mins = Math.floor(secs / 60);
				const remSecs = secs % 60;
				timeRemainingLabel = mins > 0 ? `(~${mins}m ${remSecs}s left)` : `(~${remSecs}s left)`;
			}
		} else {
			// Chunking phase (ffmpeg processing)
			progressPercent = estimatedTotalChunks > 1 ? 15 : 0;

			if (estimatedTotalChunks > 1) {
				// Estimate ~25s total per chunk (5s for chunking + 20s for API)
				const secs = estimatedTotalChunks * 25;
				const mins = Math.floor(secs / 60);
				const remSecs = secs % 60;
				timeRemainingLabel = mins > 0 ? `(~${mins}m ${remSecs}s left)` : `(~${remSecs}s left)`;
			}
		}
	}
	else if (transcribed) transcribeLabel = 'Transcribed';
	else if (failed) transcribeLabel = 'Not transcribed';

	let warningMessage = '';
	if (failed) {
		if (noApiKey)
			warningMessage =
				'Add your free Groq API key in Settings to enable transcription.';
		else if (transcribeError) warningMessage = transcribeError;
		else warningMessage = 'Transcription failed. Tap Transcribe to try again.';
	}

	return (
		<View style={[styles.container, { backgroundColor: theme.bg }]}>
			{menuOpen && (
				<>
					<Pressable
						style={StyleSheet.absoluteFill}
						onPress={() => setMenuOpen(false)}
					/>
					<View
						style={[
							styles.dropdown,
							{
								top: insets.top + 46,
								backgroundColor: theme.surface,
								borderColor: theme.border,
							},
						]}
					>
						<TouchableOpacity
							style={styles.dropdownItem}
							onPress={handleShare}
						>
							<Feather
								name='share-2'
								size={17}
								color={theme.text}
								style={styles.dropdownIcon}
							/>
							<Text style={{ color: theme.text }}>Share</Text>
						</TouchableOpacity>
						<TouchableOpacity
							style={styles.dropdownItem}
							onPress={handleOpenTag}
						>
							<Feather
								name='tag'
								size={17}
								color={theme.text}
								style={styles.dropdownIcon}
							/>
							<Text style={{ color: theme.text }}>Tag</Text>
						</TouchableOpacity>
						<TouchableOpacity
							style={styles.dropdownItem}
							onPress={handleRename}
						>
							<Feather
								name='edit-2'
								size={17}
								color={theme.text}
								style={styles.dropdownIcon}
							/>
							<Text style={{ color: theme.text }}>Rename</Text>
						</TouchableOpacity>
						<TouchableOpacity
							style={styles.dropdownItem}
							onPress={handleRingtone}
						>
							<Feather
								name='bell'
								size={17}
								color={theme.text}
								style={styles.dropdownIcon}
							/>
							<Text style={{ color: theme.text }}>Set as ringtone</Text>
						</TouchableOpacity>
						<TouchableOpacity
							style={styles.dropdownItem}
							onPress={handleTranscribeFromMenu}
						>
							<Feather
								name='file-text'
								size={17}
								color={theme.text}
								style={styles.dropdownIcon}
							/>
							<Text style={{ color: theme.text }}>
								{transcribing ? 'Transcribing…' : 'Transcribe'}
							</Text>
						</TouchableOpacity>
						<TouchableOpacity
							style={styles.dropdownItem}
							onPress={handleDetails}
						>
							<Feather
								name='info'
								size={17}
								color={theme.text}
								style={styles.dropdownIcon}
							/>
							<Text style={{ color: theme.text }}>Details</Text>
						</TouchableOpacity>
						<TouchableOpacity
							style={styles.dropdownItem}
							onPress={handleDelete}
						>
							<Feather
								name='trash-2'
								size={17}
								color='#E5605A'
								style={styles.dropdownIcon}
							/>
							<Text style={{ color: '#E5605A' }}>Delete</Text>
						</TouchableOpacity>
					</View>
				</>
			)}

			{editMenuOpen && (
				<>
					<Pressable
						style={StyleSheet.absoluteFill}
						onPress={() => setEditMenuOpen(false)}
					/>
					<View
						style={[
							styles.dropdown,
							styles.editDropdown,
							{ backgroundColor: theme.surface, borderColor: theme.border },
						]}
					>
						<TouchableOpacity
							style={styles.dropdownItem}
							onPress={() => {
								setEditMenuOpen(false);
								navigation.navigate('Trim', { entryId: entry.id });
							}}
						>
							<Feather
								name='crop'
								size={17}
								color={theme.text}
								style={styles.dropdownIcon}
							/>
							<Text style={{ color: theme.text }}>Trim audio</Text>
						</TouchableOpacity>
						<TouchableOpacity
							style={styles.dropdownItem}
							onPress={() => {
								setEditMenuOpen(false);
								navigation.navigate('Merge', { entryId: entry.id });
							}}
						>
							<Feather
								name='git-merge'
								size={17}
								color={theme.text}
								style={styles.dropdownIcon}
							/>
							<Text style={{ color: theme.text }}>Merge audio</Text>
						</TouchableOpacity>
						<TouchableOpacity
							style={styles.dropdownItem}
							onPress={() => {
								setEditMenuOpen(false);
								navigation.navigate('Append', { entryId: entry.id });
							}}
						>
							<Feather
								name='mic'
								size={17}
								color={theme.text}
								style={styles.dropdownIcon}
							/>
							<Text style={{ color: theme.text }}>Append recording</Text>
						</TouchableOpacity>
					</View>
				</>
			)}

			<ScrollView
				ref={pagerRef}
				horizontal
				pagingEnabled
				showsHorizontalScrollIndicator={false}
				bounces={false}
				scrollEventThrottle={16}
				onScroll={onPagerScroll}
				onMomentumScrollEnd={onPagerScroll}
			>
				{/* --- Page 1: Playback --- */}
				<View style={{ width }}>
					<View style={[styles.topBar, { paddingTop: insets.top + 10 }]}>
						<TouchableOpacity
							onPress={() => navigation.goBack()}
							style={[styles.headerBtn, { backgroundColor: theme.surfaceAlt }]}
						>
							<Feather
								name='arrow-left'
								size={22}
								color={theme.textMuted}
							/>
						</TouchableOpacity>
						<Text
							style={[styles.entryTitle, { color: theme.text }]}
							numberOfLines={1}
						>
							{entry.title}
						</Text>
						<TouchableOpacity
							onPress={() => setMenuOpen((v) => !v)}
							style={[styles.headerBtn, { backgroundColor: theme.surfaceAlt }]}
						>
							<Feather
								name='more-vertical'
								size={20}
								color={theme.textMuted}
							/>
						</TouchableOpacity>
					</View>

					{/* Four sections: waveform+ruler gets 2/5, the rest split the remaining 3/5 */}
					<View style={styles.quadrants}>
						<View style={[styles.quadrant, styles.waveformQuadrant]}>
							<View style={styles.waveformWrap}>
								<ScrollingPlaybackTrack
									waveform={entry.waveform}
									positionMs={positionMs}
									totalDurationMs={entry.totalDurationMs}
									color={entry.categoryColor || theme.accent}
									mutedColor={theme.waveformMuted}
									height={190}
									barWidth={3}
									onSeek={seekTo}
								/>
							</View>
						</View>

						<View style={[styles.quadrant, styles.centerContent]}>
							<Text style={[styles.bigTime, { color: theme.text }]}>
								{formatDuration(positionMs)}
							</Text>
						</View>

						<View style={[styles.quadrant, styles.centerContent]}>
							<Slider
								style={{ width: '100%', height: 36 }}
								minimumValue={0}
								maximumValue={entry.totalDurationMs || 1}
								value={positionMs}
								minimumTrackTintColor={theme.accent}
								maximumTrackTintColor={theme.teal}
								thumbTintColor={theme.text}
								onSlidingComplete={seekTo}
							/>
							<View style={styles.timeRow}>
								<Text style={{ color: theme.textMuted, fontSize: 12 }}>
									{formatDuration(positionMs)}
								</Text>
								<Text style={{ color: theme.textMuted, fontSize: 12 }}>
									{formatDuration(entry.totalDurationMs)}
								</Text>
							</View>
						</View>

						<View style={[styles.quadrant, styles.centerContent]}>
							<View style={styles.transportRow}>
								<TouchableOpacity
									onPress={() => setSettingsOpen(true)}
									style={[styles.headerBtn, { backgroundColor: theme.surfaceAlt }]}
								>
									<Feather
										name='sliders'
										size={22}
										color={theme.text}
									/>
								</TouchableOpacity>
								<TouchableOpacity
									onPress={() => skip(-5000)}
									style={styles.iconBtn}
								>
									<MaterialIcons
										name='replay-5'
										size={28}
										color={theme.text}
									/>
								</TouchableOpacity>
								<TouchableOpacity
									onPress={togglePlay}
									style={[
										styles.playPauseBtn,
										{ backgroundColor: theme.accent },
									]}
								>
									<Feather
										name={isPlaying ? 'pause' : 'play'}
										size={26}
										color={theme.accentDeep}
										style={isPlaying ? undefined : { marginLeft: 3 }}
									/>
								</TouchableOpacity>
								<TouchableOpacity
									onPress={() => skip(5000)}
									style={styles.iconBtn}
								>
									<MaterialIcons
										name='forward-5'
										size={28}
										color={theme.text}
									/>
								</TouchableOpacity>
								<TouchableOpacity
									onPress={() => setEditMenuOpen((v) => !v)}
									style={[styles.headerBtn, { backgroundColor: theme.surfaceAlt }]}
								>
									<Feather
										name='scissors'
										size={22}
										color={theme.text}
									/>
								</TouchableOpacity>
							</View>
						</View>
					</View>
				</View>

				{/* --- Page 2: Transcribe --- */}
				<View style={{ width }}>
					<View style={[styles.topBar, { paddingTop: insets.top + 10 }]}>
						<TouchableOpacity
							onPress={goToPlaybackPage}
							style={[styles.headerBtn, { backgroundColor: theme.surfaceAlt }]}
						>
							<Feather
								name='arrow-left'
								size={22}
								color={theme.textMuted}
							/>
						</TouchableOpacity>
						<Text
							style={[styles.entryTitle, { color: theme.text }]}
							numberOfLines={1}
						>
							{entry.title}
						</Text>
						<View style={styles.iconBtn} />
					</View>

					<ScrollView
						style={styles.transcribePageScroll}
						contentContainerStyle={styles.transcribePageContent}
					>
						<TouchableOpacity
							onPress={startTranscribe}
							disabled={transcribing}
							style={[
								styles.transcribeBtn,
								{
									backgroundColor: failed ? theme.surfaceAlt : theme.accent,
									opacity: transcribing ? 0.8 : 1,

								},

							]}
						>
							{transcribing && progressPercent > 0 && (
								<View
									style={{
										position: 'absolute',
										left: 0, top: 0, bottom: 0,
										width: `${progressPercent}%`,
										backgroundColor: 'rgba(255,255,255,0.25)',

									}}
								/>
							)}
							{transcribing ? (
								<ActivityIndicator size="small" color={theme.text} style={{ marginRight: 8 }} />
							) : (
								<Feather
									name={
										transcribed
											? 'check-circle'
											: failed
												? 'alert-circle'
												: 'file-text'
									}
									size={18}
									color={failed ? theme.text : theme.accentDeep}
									style={{ marginRight: 8 }}
								/>
							)}
							<View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
								<Text
									style={{
										color: (transcribing || failed) ? theme.text : theme.accentDeep,
										fontWeight: '700',
										fontSize: 15,
									}}
								>
									{transcribeLabel}
								</Text>
								{!!timeRemainingLabel && (
									<Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: '600' }}>
										{timeRemainingLabel}
									</Text>
								)}
							</View>
						</TouchableOpacity>

						<TouchableOpacity onPress={() => { setMenuOpen(false); navigation.navigate('TranscriptionSettings'); }} style={{ marginBottom: 32 }}>
							<Text style={{ color: theme.textMuted, fontSize: 13, textDecorationLine: 'underline', textAlign: 'center', marginTop: 16 }}>
								Change audio language ({transcriptionLanguage})
							</Text>
						</TouchableOpacity>

						{!!warningMessage && (
							<View
								style={[
									styles.warningBox,
									{ backgroundColor: theme.surface, borderColor: theme.border },
								]}
							>
								<Text
									style={{
										color: theme.textMuted,
										fontSize: 13,
										lineHeight: 19,
									}}
								>
									{noApiKey ? 'Add your free Groq API key in ' : warningMessage}
									{noApiKey && (
										<Text
											style={{ color: theme.accent, fontWeight: '700' }}
											onPress={() => navigation.navigate('Settings')}
										>
											Settings
										</Text>
									)}
									{noApiKey && ' to enable transcription.'}
								</Text>
							</View>
						)}

						{!!entry.transcript && (
							<View
								style={[
									styles.transcriptBox,
									{ backgroundColor: theme.surface, borderColor: theme.border },
								]}
							>
								<Text
									style={{
										color: theme.textMuted,
										fontSize: 12,
										marginBottom: 8,
									}}
								>
									Language: {languageDisplayName(entry.transcriptLanguage)}
								</Text>
								<Text
									style={{ color: theme.text, fontSize: 15, lineHeight: 23 }}
								>
									{entry.transcript}
								</Text>
								<View style={styles.transcriptActionsRow}>
									<TouchableOpacity
										onPress={handleCopyTranscript}
										style={styles.transcriptActionBtn}
									>
										<Feather
											name='copy'
											size={18}
											color={theme.textMuted}
										/>
									</TouchableOpacity>
									<TouchableOpacity
										onPress={handleShareTranscript}
										style={styles.transcriptActionBtn}
									>
										<Feather
											name='share-2'
											size={18}
											color={theme.textMuted}
										/>
									</TouchableOpacity>
									<TouchableOpacity
										onPress={handleDownloadTranscript}
										style={styles.transcriptActionBtn}
									>
										<Feather
											name='download'
											size={18}
											color={theme.textMuted}
										/>
									</TouchableOpacity>
								</View>
							</View>
						)}
					</ScrollView>
				</View>
			</ScrollView>

			<PlaybackSettingsSheet
				visible={settingsOpen}
				speed={speed}
				skipSilence={skipSilence}
				onChangeSpeed={changeSpeed}
				onToggleSkipSilence={toggleSkipSilence}
				onClose={() => setSettingsOpen(false)}
			/>

			{/* ---- Details bottom sheet ---- */}
			{detailsSheetOpen && detailsData && (
				<Modal
					visible={detailsSheetOpen}
					transparent
					animationType='slide'
					onRequestClose={() => setDetailsSheetOpen(false)}
				>
					<Pressable
						style={styles.detailsBackdrop}
						onPress={() => setDetailsSheetOpen(false)}
					/>
					<View style={[styles.detailsSheet, { backgroundColor: theme.surface }]}>
						<View style={styles.detailsHandleBar} />
						<View style={styles.detailsHeaderRow}>
							<Text style={[styles.detailsTitle, { color: theme.text }]}>Details</Text>
							<TouchableOpacity
								style={[styles.headerBtn, { backgroundColor: theme.surfaceAlt }]}
								onPress={() => setDetailsSheetOpen(false)}
							>
								<Feather
									name='x'
									size={20}
									color={theme.textMuted}
								/>
							</TouchableOpacity>
						</View>
						<ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
							{[
								{ label: 'Name', value: detailsData.name },
								{ label: 'Created', value: detailsData.time },
								{ label: 'Duration', value: detailsData.duration },
								{ label: 'Size', value: detailsData.size },
								{ label: 'File Type', value: detailsData.fileType },
								{ label: 'App Path', value: detailsData.appPath },
								{ label: 'Recordings Save Folder', value: detailsData.recordingsFolder },
								{ label: 'Transcript Download Folder', value: detailsData.transcriptFolder },
							].map(({ label, value }) => (
								<View key={label} style={[styles.detailsRow, { borderBottomColor: theme.border }]}>
									<Text style={[styles.detailsLabel, { color: theme.textMuted }]}>{label}</Text>
									<Text style={[styles.detailsValue, { color: theme.text }]} selectable>{value}</Text>
								</View>
							))}
						</ScrollView>
					</View>
				</Modal>
			)}

			<EntryTagSheet
				visible={tagSheetOpen}
				categories={categories}
				currentCategory={
					categories.find((c) => c.id === entry.categoryId) || null
				}
				onClose={() => setTagSheetOpen(false)}
				onApply={applyTagChange}
				onCategoriesChanged={() => listCategories().then(setCategories)}
			/>

			<PromptModal
				visible={renamePromptVisible}
				title='Rename entry'
				initialValue={entry.title}
				onCancel={() => setRenamePromptVisible(false)}
				onSubmit={submitRename}
			/>

			<ConfirmModal
				visible={deleteModalVisible}
				title='Delete this recording?'
				message='This cannot be undone.'
				confirmLabel='Delete'
				destructive
				onCancel={() => setDeleteModalVisible(false)}
				onConfirm={confirmDelete}
			/>

			<ConfirmModal
				visible={deleteFromFolderModalVisible}
				title='Also delete from folder?'
				message={`This recording is also saved in ${folderNameForDelete}. Delete the copy there too?`}
				confirmLabel='Delete'
				cancelLabel='Keep copy'
				destructive
				onCancel={() => finishDelete(false)}
				onConfirm={() => finishDelete(true)}
			/>
		</View>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1 },
	topBar: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		paddingHorizontal: 8,
		paddingBottom: 8,
	},
	entryTitle: {
		fontSize: 16,
		fontWeight: '700',
		flex: 1,
		marginHorizontal: 8,
		textAlign: 'center',
	},
	iconBtn: { padding: 8 },
	headerBtn: {
		width: 36,
		height: 36,
		borderRadius: 18,
		alignItems: 'center',
		justifyContent: 'center',
	},
	dropdown: {
		position: 'absolute',
		right: 16,
		borderWidth: 1,
		borderRadius: 12,
		zIndex: 10,
		overflow: 'hidden',
	},
	editDropdown: {
		bottom: 110,
		right: 24,
		left: undefined,
		top: undefined,
	},
	dropdownItem: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingVertical: 12,
		paddingHorizontal: 16,
	},
	dropdownIcon: { marginRight: 10 },
	quadrants: { flex: 1, paddingHorizontal: 16 },
	quadrant: { flex: 1, justifyContent: 'center' },
	waveformQuadrant: { flex: 2 },
	centerContent: { alignItems: 'center' },
	waveformWrap: { width: '100%' },
	bigTime: { fontSize: 44, fontWeight: '200', fontVariant: ['tabular-nums'] },
	timeRow: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		width: '100%',
		marginTop: -4,
	},
	transportRow: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		gap: 18,
	},
	playPauseBtn: {
		width: 64,
		height: 64,
		borderRadius: 32,
		alignItems: 'center',
		justifyContent: 'center',
	},
	transcribePageScroll: { flex: 1 },
	transcribePageContent: {
		paddingHorizontal: 20,
		paddingTop: 8,
		paddingBottom: 32,
	},
	transcribeBtn: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		paddingVertical: 14,
		borderRadius: 14,
		marginBottom: 14,
		overflow: 'hidden',
	},
	warningBox: {
		padding: 14,
		borderRadius: 12,
		borderWidth: 1,
		marginBottom: 14,
	},
	transcriptBox: { padding: 14, borderRadius: 12, borderWidth: 1 },
	transcriptActionsRow: {
		flexDirection: 'row',
		justifyContent: 'flex-end',
		marginTop: 12,
		gap: 4,
	},
	transcriptActionBtn: { padding: 8 },
	// Details sheet
	detailsBackdrop: {
		flex: 1,
		backgroundColor: 'rgba(0,0,0,0.5)',
	},
	detailsSheet: {
		padding: 20,
		paddingBottom: 36,
		borderTopLeftRadius: 24,
		borderTopRightRadius: 24,
	},
	detailsHandleBar: {
		width: 40,
		height: 4,
		borderRadius: 2,
		backgroundColor: 'rgba(255,255,255,0.2)',
		alignSelf: 'center',
		marginBottom: 16,
	},
	detailsHeaderRow: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		marginBottom: 16,
	},
	detailsTitle: { fontSize: 18, fontWeight: '700' },
	detailsRow: {
		paddingVertical: 12,
		borderBottomWidth: StyleSheet.hairlineWidth,
	},
	detailsLabel: { fontSize: 12, fontWeight: '600', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.4 },
	detailsValue: { fontSize: 14, lineHeight: 20 },
});
