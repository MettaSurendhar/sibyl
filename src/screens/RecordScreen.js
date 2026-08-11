import React, { useCallback, useRef, useState } from 'react';
import {
	View,
	TouchableOpacity,
	StyleSheet,
	BackHandler,
	Animated,
} from 'react-native';
import Text from '../theme/Text';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as FileSystem from 'expo-file-system';
import { useTheme } from '../theme/ThemeContext';
import { useAlert } from '../theme/AlertContext';
import { LiveWaveform, WaveformRuler } from '../components/Waveform';
import { createRecorder } from '../audio/recorder';
import {
	listCategories,
	nextNameForCategory,
	nextUntaggedName,
	previewUntaggedName,
	totalEntryCount,
} from '../db/categories';
import { createEntry, setTranscript, setTranscriptStatus } from '../db/entries';
import {
	getRecordingsFolderUri,
	getFolderHintDismissed,
	setFolderHintDismissed,
	getPrefs,
	getGroqApiKey,
} from '../utils/settingsStore';
import { isExternalFolderSupported } from '../utils/externalFolder';
import { transcribeFile } from '../groq/transcribe';
import CategorySheet from '../components/CategorySheet';
import ConfirmModal from '../components/ConfirmModal';

function formatCentis(ms) {
	const totalCentis = Math.floor(ms / 10);
	const m = Math.floor(totalCentis / 6000);
	const s = Math.floor((totalCentis % 6000) / 100);
	const cc = totalCentis % 100;
	return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cc).padStart(2, '0')}`;
}

export default function RecordScreen({ navigation }) {
	const { theme } = useTheme();
	const alert = useAlert();
	const insets = useSafeAreaInsets();
	const [status, setStatus] = useState('idle'); // idle | recording | paused
	const [elapsedMs, setElapsedMs] = useState(0);
	const [samples, setSamples] = useState([]);
	const [categories, setCategories] = useState([]);
	const [sheetVisible, setSheetVisible] = useState(false);
	const [sessionNumber, setSessionNumber] = useState(1);
	const [discardModalVisible, setDiscardModalVisible] = useState(false);
	const [folderHintVisible, setFolderHintVisible] = useState(false);
	const recorderRef = useRef(null);
	const pendingResultRef = useRef(null);
	
	const mountAnim = useRef(new Animated.Value(0)).current;
	const recordBtnScale = useRef(new Animated.Value(1)).current;

	useEffect(() => {
		Animated.spring(mountAnim, {
			toValue: 1,
			useNativeDriver: true,
			tension: 60,
			friction: 8,
		}).start();
	}, []);

	const refreshCategories = useCallback(
		() => listCategories().then(setCategories),
		[],
	);

	useFocusEffect(
		useCallback(() => {
			refreshCategories();
			totalEntryCount().then((n) => setSessionNumber(n + 1));
		}, [refreshCategories]),
	);

	// Confirm-to-discard when leaving mid-recording (back button / gesture)
	useFocusEffect(
		useCallback(() => {
			const onBack = () => {
				if (status === 'recording' || status === 'paused') {
					setDiscardModalVisible(true);
					return true;
				}
				return false;
			};
			const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
			return () => sub.remove();
		}, [status]),
	);

	async function confirmDiscard() {
		setDiscardModalVisible(false);
		await recorderRef.current?.discard();
		setStatus('idle');
		setSamples([]);
		setElapsedMs(0);
	}

	// Nudges the user, once per recording session at most, to connect a Saving folder if they
	// haven't - only relevant on Android (see externalFolder.js) and only if they haven't already
	// permanently dismissed it. Recordings are always safely stored in the app's own local
	// storage regardless; this is purely about the optional visible-outside-the-app copy.
	async function maybeShowFolderHint() {
		if (!isExternalFolderSupported()) return;
		const folderUri = await getRecordingsFolderUri();
		if (folderUri) return;
		const dismissed = await getFolderHintDismissed();
		if (dismissed) return;
		setFolderHintVisible(true);
	}

	async function dismissFolderHint() {
		setFolderHintVisible(false);
		await setFolderHintDismissed(true);
	}

	async function handleStart() {
		Animated.sequence([
			Animated.timing(recordBtnScale, { toValue: 1.15, duration: 100, useNativeDriver: true }),
			Animated.spring(recordBtnScale, { toValue: 1, friction: 5, useNativeDriver: true })
		]).start();

		recorderRef.current = createRecorder({
			// expo-av's metering callback isn't guaranteed to fire exactly every 100ms - under load
			// it can skip a beat, which was the real cause of waveforms falling short of the actual
			// recording length (previously just rendered as an empty gap / flat padding). Backfilling
			// any missed slots with the latest reading keeps samples.length in sync with real elapsed
			// time as it's captured, rather than trying to patch a mismatch after the fact at render.
			onMeter: (db, ms) => {
				setSamples((prev) => {
					const expectedCount = Math.round(ms / 100);
					if (expectedCount > prev.length + 1) {
						const gapFill = Array(expectedCount - prev.length - 1).fill(db);
						return [...prev, ...gapFill, db];
					}
					return [...prev, db];
				});
				setElapsedMs(ms);
			},
		});
		try {
			await recorderRef.current.start();
			setStatus('recording');
			setSamples([]);
			setElapsedMs(0);
			maybeShowFolderHint();
		} catch (e) {
			alert('Could not start recording', e.message);
		}
	}

	async function handlePause() {
		await recorderRef.current?.pause();
		setStatus('paused');
	}

	async function handleResume() {
		await recorderRef.current?.resume();
		setStatus('recording');
	}

	async function handleStop() {
		const result = await recorderRef.current?.stop();
		setStatus('idle');
		if (!result) return;
		pendingResultRef.current = { ...result, waveform: samples };
		Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
		setSheetVisible(true);
	}

	async function finalizeSave(categoryId, name) {
		const result = pendingResultRef.current;
		if (!result) return;
		let title = name;
		if (categoryId) {
			const suggested = await nextNameForCategory(categoryId);
			title = name || suggested;
		} else {
			const suggested = await nextUntaggedName();
			title = name || suggested;
		}
		const id = await createEntry({
			title,
			categoryId,
			uri: result.uri,
			durationMs: result.durationMs,
			waveform: result.waveform,
		});
		
		// Fire-and-forget background transcription
		getPrefs().then(async (prefs) => {
			if (prefs.autoTranscribe) {
				const apiKey = await getGroqApiKey();
				if (!apiKey) return;
				await setTranscriptStatus(id, 'processing');
				try {
					const res = await transcribeFile(result.uri, apiKey);
					await setTranscript(id, res.text, res.language);
				} catch (err) {
					await setTranscript(id, err.message || 'Transcription failed', null);
					await setTranscriptStatus(id, 'error');
				}
			}
		});

		setSheetVisible(false);
		setSamples([]);
		setElapsedMs(0);
		pendingResultRef.current = null;
		navigation.navigate('Main', { initialPage: 1 });
	}

	async function discardPendingRecording() {
		const pending = pendingResultRef.current;
		if (pending?.uri) {
			await FileSystem.deleteAsync(pending.uri, { idempotent: true });
		}
		pendingResultRef.current = null;
		setSheetVisible(false);
		setSamples([]);
		setElapsedMs(0);
	}

	const [suggestedUntagged, setSuggestedUntagged] = useState('');
	useFocusEffect(
		useCallback(() => {
			if (sheetVisible) previewUntaggedName().then(setSuggestedUntagged);
		}, [sheetVisible]),
	);

	return (
		<Animated.View
			style={[
				styles.container,
				{ 
					backgroundColor: theme.bg, 
					paddingTop: insets.top + 20,
					opacity: mountAnim,
					transform: [{ translateY: mountAnim.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) }]
				},
			]}
		>
			<Text style={[styles.sessionTitle, { color: theme.textMuted }]}>
				{status === 'idle' ? 'Ready to record' : `Recording #${sessionNumber}`}
			</Text>

			{folderHintVisible && status !== 'idle' && (
				<View
					style={[
						styles.folderHint,
						{ backgroundColor: theme.surfaceAlt, borderColor: theme.border },
					]}
				>
					<Feather
						name='folder'
						size={16}
						color={theme.textMuted}
						style={{ marginRight: 8, marginTop: 1 }}
					/>
					<Text
						style={{
							color: theme.textMuted,
							fontSize: 12,
							flex: 1,
							lineHeight: 17,
						}}
					>
						This recording is only saved on your device.{' '}
						<Text
							style={{ color: theme.accent, fontWeight: '700' }}
							onPress={() => navigation.navigate('Settings')}
						>
							Connect a saving folder
						</Text>{' '}
						to also keep a copy in your files.
					</Text>
					<TouchableOpacity
						onPress={dismissFolderHint}
						style={{ padding: 4, marginLeft: 4 }}
					>
						<Feather
							name='x'
							size={16}
							color={theme.textMuted}
						/>
					</TouchableOpacity>
				</View>
			)}

			<View style={styles.middle}>
				<View style={styles.waveformWrap}>
					{status !== 'idle' && <WaveformRuler sampleCount={samples.length} />}
					<LiveWaveform
						samples={samples}
						color={status === 'recording' ? (theme.waveformRecording || theme.accent) : theme.waveform}
					/>
				</View>

				<Text style={[styles.timer, { color: theme.text }]}>
					{formatCentis(elapsedMs)}
				</Text>
			</View>

			<View style={styles.controls}>
				{status === 'idle' && (
					<Animated.View style={{ transform: [{ scale: recordBtnScale }] }}>
						<TouchableOpacity
							style={[styles.recordBtn, { backgroundColor: theme.accent }]}
							onPress={handleStart}
						>
							<View style={styles.recordDot} />
						</TouchableOpacity>
					</Animated.View>
				)}

				{(status === 'recording' || status === 'paused') && (
					<>
						<TouchableOpacity
							style={[styles.pauseResumeBtn, { backgroundColor: theme.accent }]}
							onPress={status === 'recording' ? handlePause : handleResume}
						>
							<Feather
								name={status === 'recording' ? 'pause' : 'play'}
								size={30}
								color='#fff'
								style={status === 'recording' ? undefined : { marginLeft: 3 }}
							/>
						</TouchableOpacity>

						<View style={styles.secondaryRow}>
							<TouchableOpacity
								style={[
									styles.secondaryBtn,
									{ backgroundColor: theme.surfaceAlt },
								]}
								onPress={() => setDiscardModalVisible(true)}
							>
								<Feather
									name='x'
									size={18}
									color={theme.text}
									style={{ marginRight: 6 }}
								/>
								<Text style={{ color: theme.text, fontWeight: '600' }}>
									Cancel
								</Text>
							</TouchableOpacity>
							<TouchableOpacity
								style={[
									styles.secondaryBtn,
									{ backgroundColor: theme.surfaceAlt },
								]}
								onPress={handleStop}
							>
								<Feather
									name='square'
									size={16}
									color={theme.text}
									style={{ marginRight: 6 }}
								/>
								<Text style={{ color: theme.text, fontWeight: '600' }}>
									Stop
								</Text>
							</TouchableOpacity>
						</View>
					</>
				)}
			</View>

			<CategorySheet
				visible={sheetVisible}
				categories={categories}
				suggestedUntaggedName={suggestedUntagged}
				onSkip={(name) => finalizeSave(null, name)}
				onConfirm={(categoryId, name) => finalizeSave(categoryId, name)}
				onClose={discardPendingRecording}
				onCategoriesChanged={refreshCategories}
			/>

			<ConfirmModal
				visible={discardModalVisible}
				title='Discard recording?'
				message='Your recording is still in progress.'
				confirmLabel='Discard'
				destructive
				onCancel={() => setDiscardModalVisible(false)}
				onConfirm={confirmDiscard}
			/>
		</Animated.View>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, alignItems: 'center', paddingHorizontal: 24 },
	sessionTitle: { fontSize: 14, fontWeight: '600', letterSpacing: 0.3 },
	folderHint: {
		flexDirection: 'row',
		alignItems: 'flex-start',
		borderWidth: 1,
		borderRadius: 12,
		padding: 10,
		marginTop: 14,
		width: '100%',
	},
	middle: {
		flex: 1,
		width: '100%',
		alignItems: 'center',
		justifyContent: 'center',
	},
	waveformWrap: { width: '100%', marginBottom: 20 },
	timer: { fontSize: 40, fontWeight: '200', fontVariant: ['tabular-nums'] },
	controls: { alignItems: 'center', paddingBottom: 30 },
	recordBtn: {
		width: 84,
		height: 84,
		borderRadius: 42,
		alignItems: 'center',
		justifyContent: 'center',
	},
	recordDot: {
		width: 28,
		height: 28,
		borderRadius: 14,
		backgroundColor: '#fff',
	},
	pauseResumeBtn: {
		width: 84,
		height: 84,
		borderRadius: 42,
		alignItems: 'center',
		justifyContent: 'center',
	},
	secondaryRow: { flexDirection: 'row', gap: 14, marginTop: 20 },
	secondaryBtn: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingVertical: 12,
		paddingHorizontal: 22,
		borderRadius: 30,
	},
});
