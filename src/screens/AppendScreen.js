import React, { useCallback, useRef, useState } from 'react';
import {
	View,
	Text,
	TouchableOpacity,
	StyleSheet,
	Alert,
	BackHandler,
	Modal,
	ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as FileSystem from 'expo-file-system';
import { useTheme } from '../theme/ThemeContext';
import { LiveWaveform, WaveformRuler } from '../components/Waveform';
import { createRecorder } from '../audio/recorder';
import { concatFiles } from '../audio/ffmpegModule';
import { getEntry, createEntry } from '../db/entries';
import { listCategories, getAppendTemplate } from '../db/categories';
import ConfirmModal from '../components/ConfirmModal';
import TagNameSheet from '../components/TagNameSheet';
import { renderTemplate } from '../utils/naming';

function formatCentis(ms) {
	const totalCentis = Math.floor(ms / 10);
	const m = Math.floor(totalCentis / 6000);
	const s = Math.floor((totalCentis % 6000) / 100);
	const cc = totalCentis % 100;
	return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cc).padStart(2, '0')}`;
}

export default function AppendScreen({ route, navigation }) {
	const { theme } = useTheme();
	const insets = useSafeAreaInsets();
	const { entryId } = route.params;
	const [entry, setEntry] = useState(null);
	const [status, setStatus] = useState('idle'); // idle | recording | paused
	const [elapsedMs, setElapsedMs] = useState(0);
	const [samples, setSamples] = useState([]);
	const [discardModalVisible, setDiscardModalVisible] = useState(false);
	const [processing, setProcessing] = useState(false);
	const [categories, setCategories] = useState([]);
	const [saveSheetOpen, setSaveSheetOpen] = useState(false);
	const [defaultName, setDefaultName] = useState('');
	const recorderRef = useRef(null);
	const pendingResultRef = useRef(null);
	const mergedResultRef = useRef(null); // holds {uri, combinedWaveform, combinedDurationMs} between concat and save-confirm

	useFocusEffect(
		useCallback(() => {
			getEntry(entryId).then(setEntry);
			listCategories().then(setCategories);
		}, [entryId]),
	);

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
		navigation.goBack();
	}

	async function handleStart() {
		recorderRef.current = createRecorder({
			// See RecordScreen.js for why this backfills gaps instead of pushing one sample per call.
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
		} catch (e) {
			Alert.alert('Could not start recording', e.message);
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
		await finalizeAppend();
	}

	async function finalizeAppend() {
		const result = pendingResultRef.current;
		if (!result || !entry) return;
		setProcessing(true);
		try {
			const orderedUris = [...entry.segments.map((s) => s.uri), result.uri];
			const merged = await concatFiles(orderedUris);
			const combinedWaveform = [...entry.waveform, ...result.waveform];
			const combinedDurationMs = entry.totalDurationMs + result.durationMs;

			console.log(
				`[Append] combined duration=${combinedDurationMs}ms, waveform samples=${combinedWaveform.length} ` +
					`(expected ~${Math.round(combinedDurationMs / 100)}), old=${entry.waveform.length}, new=${result.waveform.length}`,
			);

			mergedResultRef.current = {
				uri: merged.uri,
				combinedWaveform,
				combinedDurationMs,
				tempUri: result.uri,
			};
			const template = await getAppendTemplate();
			setDefaultName(renderTemplate(template, { name: entry.title }));
			setSaveSheetOpen(true);
		} catch (e) {
			Alert.alert('Append failed', e.message);
		} finally {
			setProcessing(false);
		}
	}

	async function confirmSave(categoryId, name) {
		setSaveSheetOpen(false);
		const merged = mergedResultRef.current;
		if (!merged || !entry) return;
		setProcessing(true);
		try {
			// Append always creates a NEW entry - the original recording is never modified or deleted.
			const newId = await createEntry({
				title: name || defaultName,
				categoryId,
				uri: merged.uri,
				durationMs: merged.combinedDurationMs,
				waveform: merged.combinedWaveform,
			});

			// Only the fresh temp recording is cleanup-eligible - the original entry's files must
			// stay untouched since the original entry itself is never modified or deleted.
			await FileSystem.deleteAsync(merged.tempUri, { idempotent: true });
			pendingResultRef.current = null;
			mergedResultRef.current = null;
			navigation.replace('Playback', { entryId: newId });
		} catch (e) {
			Alert.alert('Save failed', e.message);
		} finally {
			setProcessing(false);
		}
	}

	if (!entry) {
		return <View style={[styles.container, { backgroundColor: theme.bg }]} />;
	}

	return (
		<View
			style={[
				styles.container,
				{ backgroundColor: theme.bg, paddingTop: insets.top + 20 },
			]}
		>
			<Text
				style={[styles.sessionTitle, { color: theme.textMuted }]}
				numberOfLines={1}
			>
				{status === 'idle' ? `Continuing: ${entry.title}` : 'Recording…'}
			</Text>

			<View style={styles.middle}>
				<View style={styles.waveformWrap}>
					{status !== 'idle' && <WaveformRuler sampleCount={samples.length} />}
					<LiveWaveform
						samples={samples}
						color={theme.waveform}
					/>
				</View>

				<Text style={[styles.timer, { color: theme.text }]}>
					{formatCentis(elapsedMs)}
				</Text>
			</View>

			<View style={styles.controls}>
				{status === 'idle' && (
					<TouchableOpacity
						style={[styles.recordBtn, { backgroundColor: theme.accent }]}
						onPress={handleStart}
					>
						<View style={styles.recordDot} />
					</TouchableOpacity>
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
									Stop & Save
								</Text>
							</TouchableOpacity>
						</View>
					</>
				)}
			</View>

			<Modal
				visible={processing}
				transparent
				animationType='fade'
			>
				<View style={styles.processingOverlay}>
					<View
						style={[styles.processingCard, { backgroundColor: theme.surface }]}
					>
						<ActivityIndicator
							color={theme.accent}
							size='large'
						/>
						<Text
							style={{ color: theme.text, marginTop: 12, fontWeight: '600' }}
						>
							Combining audio…
						</Text>
					</View>
				</View>
			</Modal>

			<ConfirmModal
				visible={discardModalVisible}
				title='Discard this take?'
				message='This new recording will be deleted; the original entry stays unchanged.'
				confirmLabel='Discard'
				destructive
				onCancel={() => setDiscardModalVisible(false)}
				onConfirm={confirmDiscard}
			/>

			<TagNameSheet
				visible={saveSheetOpen}
				title='Save appended recording'
				categories={categories}
				initialCategory={
					categories.find((c) => c.id === entry.categoryId) || null
				}
				initialName={defaultName}
				onCancel={() => setSaveSheetOpen(false)}
				onConfirm={confirmSave}
				onCategoriesChanged={() => listCategories().then(setCategories)}
			/>
		</View>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, alignItems: 'center', paddingHorizontal: 24 },
	sessionTitle: {
		fontSize: 14,
		fontWeight: '600',
		letterSpacing: 0.3,
		maxWidth: '100%',
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
	processingOverlay: {
		flex: 1,
		backgroundColor: 'rgba(0,0,0,0.6)',
		alignItems: 'center',
		justifyContent: 'center',
	},
	processingCard: {
		padding: 28,
		borderRadius: 16,
		alignItems: 'center',
		width: '70%',
	},
});
