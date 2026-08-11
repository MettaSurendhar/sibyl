import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
	View,
	TouchableOpacity,
	StyleSheet,
	PanResponder,
	Modal,
	ActivityIndicator,
	BackHandler,
	TextInput,
	Keyboard,
	Animated,
} from 'react-native';
import Text from '../theme/Text';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import { useTheme } from '../theme/ThemeContext';
import { useAlert } from '../theme/AlertContext';
import { StaticWaveform, ScrollingPlaybackTrack } from '../components/Waveform';
import ConfirmModal from '../components/ConfirmModal';
import TagNameSheet from '../components/TagNameSheet';
import { createPlayer } from '../audio/player';
import { trimFile, concatFiles } from '../audio/ffmpegModule';
import { getEntry, createEntry } from '../db/entries';
import { listCategories, getTrimTemplate } from '../db/categories';
import { formatDuration } from '../utils/format';
import { renderTemplate } from '../utils/naming';

const SAMPLE_INTERVAL_MS = 100;
const MIN_SELECTION_MS = 500;

function formatCentis(ms) {
	const totalCentis = Math.floor(ms / 10);
	const m = Math.floor(totalCentis / 6000);
	const s = Math.floor((totalCentis % 6000) / 100);
	const cc = totalCentis % 100;
	return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cc).padStart(2, '0')}`;
}

function parseTimeString(str, fallbackMs) {
	if (!str) return fallbackMs;
	str = str.replace(/[^0-9:.]/g, '');
	if (!str) return fallbackMs;
	let m = 0;
	let s = 0;
	const parts = str.split(':');
	if (parts.length > 1) {
		m = parseInt(parts[0], 10) || 0;
		s = parseFloat(parts[1]) || 0;
	} else {
		s = parseFloat(parts[0]) || 0;
	}
	const ms = Math.floor((m * 60 + s) * 1000);
	return isNaN(ms) ? fallbackMs : ms;
}

export default function TrimScreen({ route, navigation }) {
	const { theme } = useTheme();
	const alert = useAlert();
	const insets = useSafeAreaInsets();
	const { entryId } = route.params;
	const [entry, setEntry] = useState(null);
	const [categories, setCategories] = useState([]);
	const [startMs, setStartMs] = useState(0);
	const [endMs, setEndMs] = useState(0);
	const [startInput, setStartInput] = useState('');
	const [endInput, setEndInput] = useState('');
	const [activeHandle, setActiveHandle] = useState('start'); // 'start' | 'end' - which the zoomed view follows
	const [containerWidth, setContainerWidth] = useState(0);
	const [isPlaying, setIsPlaying] = useState(false);
	const [previewMs, setPreviewMs] = useState(0);
	const [processing, setProcessing] = useState(false);
	const [discardVisible, setDiscardVisible] = useState(false);
	const [saveSheetOpen, setSaveSheetOpen] = useState(false);
	const [defaultName, setDefaultName] = useState('');
	const playerRef = useRef(null);
	const startMsRef = useRef(0);
	const endMsRef = useRef(0);
	const dragStartMsRef = useRef({ start: 0, end: 0 });
	const previewMsRef = useRef(0);

	const startXAnim = useRef(new Animated.Value(0)).current;
	const endXAnim = useRef(new Animated.Value(0)).current;
	const previewXAnim = useRef(new Animated.Value(0)).current;
	const isScrubbing = useRef(false);
	const initialScrubX = useRef(0);

	// Update anims when state changes from external sources (reset, inputs)
	useEffect(() => {
		if (containerWidth > 0 && entry?.totalDurationMs) {
			startXAnim.setValue((startMs / entry.totalDurationMs) * containerWidth);
		}
	}, [startMs, containerWidth, entry]);

	useEffect(() => {
		if (containerWidth > 0 && entry?.totalDurationMs) {
			endXAnim.setValue((endMs / entry.totalDurationMs) * containerWidth);
		}
	}, [endMs, containerWidth, entry]);

	useEffect(() => {
		previewMsRef.current = previewMs;
		if (containerWidth > 0 && entry?.totalDurationMs && !isScrubbing.current) {
			const clampedMs = Math.max(startMs, Math.min(previewMs, endMs));
			previewXAnim.setValue(
				(clampedMs / entry.totalDurationMs) * containerWidth,
			);
		}
	}, [previewMs, startMs, endMs, containerWidth, entry]);

	// IMPORTANT: the handle PanResponders below are created exactly once via useRef. Their
	// closures can only see whatever `entry`/`containerWidth` were at that first creation - if
	// that happened before entry finished loading or before the layout measured containerWidth
	// (both true here, since this used to run before the early-return guard), the closures would
	// be permanently stuck seeing null/0 forever, silently no-op'ing every drag. Routing through
	// refs that get updated every render (via the effects below) fixes that: the PanResponder
	// object itself never changes, but reading ref.current always gets the latest value.
	const entryRef = useRef(null);
	const containerWidthRef = useRef(0);
	useEffect(() => {
		entryRef.current = entry;
	}, [entry]);
	useEffect(() => {
		containerWidthRef.current = containerWidth;
	}, [containerWidth]);

	// This screen's custom drag handles need full, uncontested touch control - the native-stack
	// swipe-back gesture recognizer (from react-native-screens) otherwise competes for the same
	// touches anywhere on screen, not just at the edges.
	useEffect(() => {
		navigation.setOptions({ gestureEnabled: false });
		return () => navigation.setOptions({ gestureEnabled: true });
	}, [navigation]);

	useFocusEffect(
		useCallback(() => {
			let cancelled = false;
			getEntry(entryId).then((e) => {
				if (cancelled || !e) return;
				setEntry(e);
				setStartMs(0);
				setEndMs(e.totalDurationMs);
				startMsRef.current = 0;
				endMsRef.current = e.totalDurationMs;
				playerRef.current = createPlayer({
					segments: e.segments,
					onStatus: (s) => {
						setPreviewMs(s.positionMs);
						if (s.finished || s.positionMs >= endMsRef.current) {
							playerRef.current?.pause();
							setIsPlaying(false);
						}
					},
				});
			});
			listCategories().then(setCategories);
			return () => {
				cancelled = true;
				playerRef.current?.unload();
				playerRef.current = null;
			};
		}, [entryId]),
	);

	useEffect(() => {
		setStartInput(formatCentis(startMs));
	}, [startMs]);
	useEffect(() => {
		setEndInput(formatCentis(endMs));
	}, [endMs]);

	const hasChanges = entry && (startMs > 0 || endMs < entry.totalDurationMs);

	useFocusEffect(
		useCallback(() => {
			const onBack = () => {
				if (hasChanges && !processing) {
					setDiscardVisible(true);
					return true;
				}
				return false;
			};
			const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
			return () => sub.remove();
		}, [hasChanges, processing]),
	);

	function makeHandlePanResponder(which) {
		return PanResponder.create({
			onStartShouldSetPanResponder: () => true,
			onMoveShouldSetPanResponder: () => true,
			onPanResponderGrant: () => {
				setActiveHandle(which);
				dragStartMsRef.current[which] =
					which === 'start' ? startMsRef.current : endMsRef.current;
			},
			onPanResponderMove: (evt, gesture) => {
				const currentEntry = entryRef.current;
				const width = containerWidthRef.current;
				if (!currentEntry || !width) return;
				const msPerPixel = currentEntry.totalDurationMs / width;
				const proposedMs =
					dragStartMsRef.current[which] + gesture.dx * msPerPixel;
				if (which === 'start') {
					const clamped = Math.max(
						0,
						Math.min(proposedMs, endMsRef.current - MIN_SELECTION_MS),
					);
					startMsRef.current = clamped;
					startXAnim.setValue((clamped / currentEntry.totalDurationMs) * width);
				} else {
					const clamped = Math.max(
						startMsRef.current + MIN_SELECTION_MS,
						Math.min(proposedMs, currentEntry.totalDurationMs),
					);
					endMsRef.current = clamped;
					endXAnim.setValue((clamped / currentEntry.totalDurationMs) * width);
				}
			},
			onPanResponderRelease: () => {
				if (which === 'start') setStartMs(startMsRef.current);
				else setEndMs(endMsRef.current);
			},
		});
	}

	const startHandlePan = useRef(makeHandlePanResponder('start')).current;
	const endHandlePan = useRef(makeHandlePanResponder('end')).current;

	const scrubHandlePan = useRef(
		PanResponder.create({
			onStartShouldSetPanResponder: () => true,
			onMoveShouldSetPanResponder: () => true,
			onPanResponderGrant: () => {
				isScrubbing.current = true;
				const width = containerWidthRef.current;
				const currentEntry = entryRef.current;
				if (!width || !currentEntry) return;
				initialScrubX.current =
					(previewMsRef.current / currentEntry.totalDurationMs) * width;
			},
			onPanResponderMove: (evt, gesture) => {
				const width = containerWidthRef.current;
				const currentEntry = entryRef.current;
				if (!width || !currentEntry) return;
				const startX =
					(startMsRef.current / currentEntry.totalDurationMs) * width;
				const endX = (endMsRef.current / currentEntry.totalDurationMs) * width;
				const newX = Math.max(
					startX,
					Math.min(initialScrubX.current + gesture.dx, endX),
				);
				previewXAnim.setValue(newX);
			},
			onPanResponderRelease: (evt, gesture) => {
				isScrubbing.current = false;
				const width = containerWidthRef.current;
				const currentEntry = entryRef.current;
				if (!width || !currentEntry) return;
				const startX =
					(startMsRef.current / currentEntry.totalDurationMs) * width;
				const endX = (endMsRef.current / currentEntry.totalDurationMs) * width;
				const newX = Math.max(
					startX,
					Math.min(initialScrubX.current + gesture.dx, endX),
				);
				const ms = (newX / width) * currentEntry.totalDurationMs;
				seekPreviewTo(ms);
			},
		}),
	).current;

	// Only used by inputs now since we removed the zoomed map
	function handleManualSeek(ms) {
		if (!entry) return;
		if (activeHandle === 'start') {
			const clamped = Math.max(
				0,
				Math.min(ms, endMsRef.current - MIN_SELECTION_MS),
			);
			startMsRef.current = clamped;
			setStartMs(clamped);
		} else {
			const clamped = Math.max(
				startMsRef.current + MIN_SELECTION_MS,
				Math.min(ms, entry.totalDurationMs),
			);
			endMsRef.current = clamped;
			setEndMs(clamped);
		}
	}

	function handleStartInputSubmit() {
		if (!entry) return;
		let ms = parseTimeString(startInput, startMs);
		ms = Math.max(0, Math.min(ms, endMsRef.current - MIN_SELECTION_MS));
		startMsRef.current = ms;
		setStartMs(ms);
		setStartInput(formatCentis(ms));
		setActiveHandle('start');
	}

	function handleEndInputSubmit() {
		if (!entry) return;
		let ms = parseTimeString(endInput, endMs);
		ms = Math.max(
			startMsRef.current + MIN_SELECTION_MS,
			Math.min(ms, entry.totalDurationMs),
		);
		endMsRef.current = ms;
		setEndMs(ms);
		setEndInput(formatCentis(ms));
		setActiveHandle('end');
	}

	async function togglePreview() {
		if (isPlaying) {
			await playerRef.current?.pause();
			setIsPlaying(false);
			return;
		}
		// If playhead is outside the trimmed bounds or has reached the end, loop back to start.
		// Otherwise, resume exactly from where the white thumb was dragged.
		if (previewMs < startMs || previewMs >= endMs) {
			await playerRef.current?.seek(startMs);
		} else {
			await playerRef.current?.seek(previewMs);
		}
		await playerRef.current?.play();
		setIsPlaying(true);
	}

	async function seekPreviewTo(ms) {
		await playerRef.current?.seek(ms);
		setPreviewMs(ms);
	}

	function handleReset() {
		if (!entry) return;
		setStartMs(0);
		setEndMs(entry.totalDurationMs);
		startMsRef.current = 0;
		endMsRef.current = entry.totalDurationMs;
	}

	function discardAndExit() {
		setDiscardVisible(false);
		navigation.goBack();
	}

	// Save no longer runs immediately - it opens a tag/name sheet first, so the user decides
	// whether and how to save before anything is written.
	async function openSaveSheet() {
		if (!entry || !hasChanges) return;
		await playerRef.current?.pause();
		setIsPlaying(false);
		const template = await getTrimTemplate();
		setDefaultName(renderTemplate(template, { name: entry.title }));
		setSaveSheetOpen(true);
	}

	async function confirmSave(categoryId, name) {
		setSaveSheetOpen(false);
		if (!entry) return;
		setProcessing(true);
		try {
			let sourceUri = entry.segments[0].uri;
			let intermediateUri = null;
			if (entry.segments.length > 1) {
				const merged = await concatFiles(entry.segments.map((s) => s.uri));
				sourceUri = merged.uri;
				intermediateUri = merged.uri;
			}
			const trimmed = await trimFile(sourceUri, startMs, endMs);

			const startIdx = Math.round(startMs / SAMPLE_INTERVAL_MS);
			const endIdx = Math.round(endMs / SAMPLE_INTERVAL_MS);
			const newWaveform = entry.waveform.slice(startIdx, endIdx);

			const newId = await createEntry({
				title: name || defaultName,
				categoryId,
				uri: trimmed.uri,
				durationMs: endMs - startMs,
				waveform: newWaveform,
				sourceType: 'trimmed',
			});

			// Only the intermediate concat file (if any) is temporary - the original entry's own
			// files are untouched since the original stays intact.
			if (intermediateUri) {
				await FileSystem.deleteAsync(intermediateUri, { idempotent: true });
			}
			navigation.replace('Playback', { entryId: newId });
		} catch (e) {
			alert('Trim failed', e.message);
		} finally {
			setProcessing(false);
		}
	}

	if (!entry) {
		return <View style={[styles.container, { backgroundColor: theme.bg }]} />;
	}

	const startRatio = entry.totalDurationMs
		? startMs / entry.totalDurationMs
		: 0;
	const endRatio = entry.totalDurationMs ? endMs / entry.totalDurationMs : 1;
	const accent = entry.categoryColor || theme.accent;
	const zoomedPositionMs = activeHandle === 'start' ? startMs : endMs;

	return (
		<View style={[styles.container, { backgroundColor: theme.bg }]}>
			<View style={[styles.topBar, { paddingTop: insets.top + 10 }]}>
				<TouchableOpacity
					onPress={() =>
						hasChanges ? setDiscardVisible(true) : navigation.goBack()
					}
				>
					<Text style={[styles.topBarAction, { color: '#E5605A' }]}>
						Cancel
					</Text>
				</TouchableOpacity>
				<Text style={[styles.title, { color: theme.text }]}>
					Trim recording
				</Text>
				<TouchableOpacity
					onPress={openSaveSheet}
					disabled={!hasChanges}
				>
					<Text
						style={[
							styles.topBarAction,
							{
								color: hasChanges ? accent : theme.textMuted,
								fontWeight: '700',
							},
						]}
					>
						Save
					</Text>
				</TouchableOpacity>
			</View>

			<View style={styles.zoomedSection}>
				<ScrollingPlaybackTrack
					waveform={entry.waveform}
					positionMs={zoomedPositionMs}
					totalDurationMs={entry.totalDurationMs}
					color={activeHandle === 'start' ? theme.waveformMuted : accent}
					mutedColor={activeHandle === 'start' ? accent : theme.waveformMuted}
					height={150}
					barWidth={3}
					onSeek={handleManualSeek}
				/>
			</View>

			<View style={styles.centerInfo}>
				<View style={styles.timeInputsRow}>
					<View style={styles.timeInputBox}>
						<Text style={[styles.timeLabel, { color: theme.textMuted }]}>
							From
						</Text>
						<TextInput
							style={[
								styles.bigTimeInput,
								{
									color:
										activeHandle === 'start' ? theme.text : theme.textMuted,
								},
							]}
							value={startInput}
							onChangeText={setStartInput}
							onBlur={handleStartInputSubmit}
							onSubmitEditing={handleStartInputSubmit}
							keyboardType='numeric'
							returnKeyType='done'
							onFocus={() => setActiveHandle('start')}
						/>
					</View>
					<View style={styles.timeInputBox}>
						<Text style={[styles.timeLabel, { color: theme.textMuted }]}>
							To
						</Text>
						<TextInput
							style={[
								styles.bigTimeInput,
								{
									color: activeHandle === 'end' ? theme.text : theme.textMuted,
								},
							]}
							value={endInput}
							onChangeText={setEndInput}
							onBlur={handleEndInputSubmit}
							onSubmitEditing={handleEndInputSubmit}
							keyboardType='numeric'
							returnKeyType='done'
							onFocus={() => setActiveHandle('end')}
						/>
					</View>
				</View>
				<Text
					style={[styles.entryName, { color: theme.textMuted }]}
					numberOfLines={1}
				>
					{entry.title}
				</Text>
			</View>

			<View style={styles.minimapSection}>
				<View
					style={styles.waveformBox}
					onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
				>
					{/* Sleek track line */}
					<View
						style={[styles.trackLine, { backgroundColor: theme.surfaceAlt }]}
					/>
					{/* Played progress highlight */}
					{containerWidth > 0 && entry.totalDurationMs > 0 && (
						<Animated.View
							style={[
								styles.trackProgress,
								{
									backgroundColor: accent,
									width: previewXAnim,
								},
							]}
						/>
					)}
					{containerWidth > 0 && (
						<>
							<Animated.View
								style={[
									styles.dimOverlay,
									{
										left: 0,
										width: startXAnim,
										backgroundColor: theme.bg,
										opacity: 0.6,
									},
								]}
							/>
							<Animated.View
								style={[
									styles.dimOverlay,
									{
										left: endXAnim,
										right: 0,
										backgroundColor: theme.bg,
										opacity: 0.6,
									},
								]}
							/>
							<Animated.View
								{...startHandlePan.panHandlers}
								style={[
									styles.handle,
									{ left: startXAnim, transform: [{ translateX: -16 }] },
								]}
							>
								<View
									style={[styles.handleStick, { backgroundColor: accent }]}
								/>
							</Animated.View>
							<Animated.View
								{...endHandlePan.panHandlers}
								style={[
									styles.handle,
									{ left: endXAnim, transform: [{ translateX: -16 }] },
								]}
							>
								<View
									style={[styles.handleStick, { backgroundColor: accent }]}
								/>
							</Animated.View>

							{/* Scrub Thumb */}
							<Animated.View
								{...scrubHandlePan.panHandlers}
								style={[
									styles.thumbHit,
									{ transform: [{ translateX: previewXAnim }] },
								]}
							>
								<View style={styles.thumb} />
							</Animated.View>
						</>
					)}
				</View>
				<View style={styles.labelsRow}>
					<Text style={[styles.labelSmall, { color: theme.textMuted }]}>
						{formatDuration(previewMs)} /{' '}
						{formatDuration(entry.totalDurationMs)}
					</Text>
					<Text style={[styles.labelSmall, { color: theme.accent }]}>
						{formatDuration(endMs - startMs)} selected
					</Text>
				</View>
			</View>

			<View style={[styles.bottomRow, { paddingBottom: insets.bottom + 20 }]}>
				<TouchableOpacity
					onPress={handleReset}
					style={styles.bottomIconBtn}
				>
					<Feather
						name='rotate-ccw'
						size={22}
						color={theme.textMuted}
					/>
					<Text style={[styles.bottomIconLabel, { color: theme.textMuted }]}>
						Reset
					</Text>
				</TouchableOpacity>
				<TouchableOpacity
					onPress={togglePreview}
					style={[styles.playBtn, { backgroundColor: accent }]}
				>
					<Feather
						name={isPlaying ? 'pause' : 'play'}
						size={26}
						color={theme.accentDeep}
						style={isPlaying ? undefined : { marginLeft: 3 }}
					/>
				</TouchableOpacity>
				<TouchableOpacity
					onPress={openSaveSheet}
					disabled={!hasChanges}
					style={styles.bottomIconBtn}
				>
					<Feather
						name='scissors'
						size={22}
						color={hasChanges ? accent : theme.textMuted}
					/>
					<Text
						style={[
							styles.bottomIconLabel,
							{ color: hasChanges ? accent : theme.textMuted },
						]}
					>
						Trim
					</Text>
				</TouchableOpacity>
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
							color={accent}
							size='large'
						/>
						<Text
							style={{ color: theme.text, marginTop: 12, fontWeight: '600' }}
						>
							Trimming…
						</Text>
					</View>
				</View>
			</Modal>

			<ConfirmModal
				visible={discardVisible}
				title='Discard trim?'
				message="Your selection hasn't been saved."
				confirmLabel='Discard'
				destructive
				onCancel={() => setDiscardVisible(false)}
				onConfirm={discardAndExit}
			/>

			<TagNameSheet
				visible={saveSheetOpen}
				title='Save trimmed recording'
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
	container: { flex: 1 },
	topBar: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		paddingHorizontal: 20,
		paddingBottom: 8,
	},
	topBarAction: { fontSize: 15, fontWeight: '600' },
	title: { fontSize: 16, fontWeight: '700' },
	zoomedSection: { marginTop: 20, marginBottom: 20 },
	centerInfo: { alignItems: 'center', marginTop: 12 },
	timeInputsRow: { flexDirection: 'row', gap: 24, justifyContent: 'center' },
	timeInputBox: { alignItems: 'center' },
	timeLabel: {
		fontSize: 11,
		fontWeight: '700',
		textTransform: 'uppercase',
		marginBottom: 4,
	},
	bigTimeInput: {
		fontSize: 32,
		fontWeight: '200',
		fontVariant: ['tabular-nums'],
		textAlign: 'center',
		minWidth: 120,
		padding: 0,
	},
	entryName: { fontSize: 13, marginTop: 12 },
	minimapSection: { marginTop: 'auto', paddingHorizontal: 36 },
	waveformBox: { position: 'relative', height: 60, justifyContent: 'center' },
	trackLine: {
		height: 4,
		borderRadius: 2,
		position: 'absolute',
		left: 0,
		right: 0,
	},
	trackProgress: { height: 4, borderRadius: 2, position: 'absolute', left: 0 },
	dimOverlay: {
		position: 'absolute',
		top: 0,
		bottom: 0,
	},
	handle: {
		position: 'absolute',
		top: 0,
		bottom: 0,
		width: 32,
		borderRadius: 0,
		alignItems: 'center',
		justifyContent: 'center',
		backgroundColor: 'transparent',
	},
	handleStick: {
		width: 4,
		height: 44,
		borderRadius: 2,
	},
	labelsRow: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		marginTop: 8,
	},
	labelSmall: { fontSize: 12, fontWeight: '600' },
	thumbHit: {
		position: 'absolute',
		left: -24, // HIT_SLOP / 2
		width: 48,
		height: 48,
		borderRadius: 24,
		alignItems: 'center',
		justifyContent: 'center',
		top: 6, // center vertically in the 60px box
		backgroundColor: 'transparent',
	},
	thumb: {
		width: 18,
		height: 18,
		borderRadius: 9,
		backgroundColor: '#FFFFFF',
		elevation: 4,
		shadowColor: '#000',
		shadowOpacity: 0.3,
		shadowRadius: 3,
		shadowOffset: { width: 0, height: 1 },
	},
	bottomRow: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-around',
		marginTop: 24,
		paddingHorizontal: 20,
	},
	bottomIconBtn: { alignItems: 'center' },
	bottomIconLabel: { fontSize: 12, marginTop: 4, fontWeight: '600' },
	playBtn: {
		width: 66,
		height: 66,
		borderRadius: 33,
		alignItems: 'center',
		justifyContent: 'center',
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
