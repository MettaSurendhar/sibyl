import React, {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from 'react';
import {
	View,
	Text,
	TextInput,
	TouchableOpacity,
	Pressable,
	SectionList,
	StyleSheet,
	Alert,
	BackHandler,
	LayoutAnimation,
	Platform,
	UIManager,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Sharing from 'expo-sharing';
import { useTheme } from '../theme/ThemeContext';
import { listEntries, deleteEntries, renameEntry } from '../db/entries';
import { listCategories } from '../db/categories';
import { groupByDate, dateRangeForPreset } from '../utils/format';
import EntryRow from '../components/EntryRow';
import PromptModal from '../components/PromptModal';
import ConfirmModal from '../components/ConfirmModal';
import FilterSheet from '../components/FilterSheet';
import { createPlayer } from '../audio/player';

if (
	Platform.OS === 'android' &&
	UIManager.setLayoutAnimationEnabledExperimentalAndroid
) {
	UIManager.setLayoutAnimationEnabledExperimentalAndroid(true);
}

const EMPTY_FILTER = { tagIds: [], datePreset: null, customRange: null };

export default function LibraryScreen({ navigation }) {
	const { theme } = useTheme();
	const insets = useSafeAreaInsets();
	const [entries, setEntries] = useState([]);
	const [categories, setCategories] = useState([]);
	const [searchOpen, setSearchOpen] = useState(false);
	const [search, setSearch] = useState('');
	const [filterOpen, setFilterOpen] = useState(false);
	const [filter, setFilter] = useState(EMPTY_FILTER);
	const [menuOpen, setMenuOpen] = useState(false);
	const [editMode, setEditMode] = useState(false);
	const [selectedIds, setSelectedIds] = useState([]);
	const [activeEntryId, setActiveEntryId] = useState(null);
	const [isPlaying, setIsPlaying] = useState(false);
	const [playbackPos, setPlaybackPos] = useState(0);
	const [renamePromptVisible, setRenamePromptVisible] = useState(false);
	const [deleteModalVisible, setDeleteModalVisible] = useState(false);
	const playerRef = useRef(null);

	const refresh = useCallback(() => {
		listEntries().then(setEntries);
		listCategories().then(setCategories);
	}, []);

	useFocusEffect(
		useCallback(() => {
			refresh();
			return () => {
				playerRef.current?.unload();
				playerRef.current = null;
				setActiveEntryId(null);
				setIsPlaying(false);
			};
		}, [refresh]),
	);

	// Close any open overlay on back button/gesture before letting default back navigation happen.
	useFocusEffect(
		useCallback(() => {
			const onBack = () => {
				if (menuOpen) {
					setMenuOpen(false);
					return true;
				}
				if (searchOpen) {
					setSearchOpen(false);
					return true;
				}
				if (editMode) {
					setEditMode(false);
					setSelectedIds([]);
					return true;
				}
				return false;
			};
			const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
			return () => sub.remove();
		}, [menuOpen, searchOpen, editMode]),
	);

	// Hide the bottom tab bar while in edit/selection mode.
	useEffect(() => {
		navigation.setOptions({
			tabBarStyle: editMode
				? { display: 'none' }
				: { backgroundColor: theme.surface, borderTopColor: theme.border },
		});
	}, [editMode, navigation, theme]);

	const filtered = useMemo(() => {
		let list = entries;
		if (search.trim()) {
			const q = search.toLowerCase();
			list = list.filter((e) => e.title.toLowerCase().includes(q));
		}
		if (filter.tagIds.length) {
			list = list.filter(
				(e) => e.categoryId && filter.tagIds.includes(e.categoryId),
			);
		}
		if (filter.datePreset) {
			const range =
				filter.datePreset === 'custom'
					? filter.customRange
					: dateRangeForPreset(filter.datePreset);
			if (range) {
				const [start, end] = range;
				list = list.filter((e) => e.updatedAt >= start && e.updatedAt <= end);
			}
		}
		return list;
	}, [entries, search, filter]);

	const sections = useMemo(
		() => groupByDate(filtered, !editMode),
		[filtered, editMode],
	);
	const activeFilterCount = filter.tagIds.length + (filter.datePreset ? 1 : 0);

	async function togglePlay(entry) {
		LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
		if (activeEntryId === entry.id) {
			// same entry: toggle play/pause, keep the mini-player visible either way
			if (isPlaying) {
				await playerRef.current?.pause();
				setIsPlaying(false);
			} else {
				await playerRef.current?.play();
				setIsPlaying(true);
			}
			return;
		}
		// different entry: swap the active player
		await playerRef.current?.unload();
		const player = createPlayer({
			segments: entry.segments,
			onStatus: (s) => {
				setPlaybackPos(s.positionMs);
				if (s.finished) setIsPlaying(false);
			},
		});
		playerRef.current = player;
		setActiveEntryId(entry.id);
		setPlaybackPos(0);
		setIsPlaying(true);
		await player.play();
	}

	async function seekEntry(entry, ms) {
		if (activeEntryId !== entry.id) return;
		await playerRef.current?.seek(ms);
		setPlaybackPos(ms);
	}

	function toggleSelect(id) {
		setSelectedIds((prev) =>
			prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
		);
	}

	function selectAll() {
		setSelectedIds(
			selectedIds.length === filtered.length ? [] : filtered.map((e) => e.id),
		);
	}

	function handleDelete() {
		setDeleteModalVisible(true);
	}

	async function confirmDelete() {
		setDeleteModalVisible(false);
		await deleteEntries(selectedIds);
		setSelectedIds([]);
		setEditMode(false);
		refresh();
	}

	async function handleShare() {
		const targets = entries.filter((e) => selectedIds.includes(e.id));
		for (const t of targets) {
			const lastSegUri = t.segments[t.segments.length - 1]?.uri;
			if (lastSegUri && (await Sharing.isAvailableAsync())) {
				await Sharing.shareAsync(lastSegUri);
			}
		}
	}

	function handleRename() {
		setRenamePromptVisible(true);
	}

	async function submitRename(text) {
		const entry = entries.find((e) => e.id === selectedIds[0]);
		setRenamePromptVisible(false);
		if (entry && text) {
			await renameEntry(entry.id, text);
			refresh();
		}
	}

	async function handleSetRingtone() {
		const entry = entries.find((e) => e.id === selectedIds[0]);
		const uri = entry?.segments[entry.segments.length - 1]?.uri;
		if (uri && (await Sharing.isAvailableAsync())) {
			Alert.alert(
				'Set as ringtone',
				'Choose "Set as ringtone" from the share sheet, or save and set it from Sound settings.',
			);
			await Sharing.shareAsync(uri);
		}
	}

	return (
		<View style={[styles.container, { backgroundColor: theme.bg }]}>
			<View style={[styles.header, { paddingTop: insets.top + 10 }]}>
				{editMode ? (
					<TouchableOpacity
						onPress={() => {
							setEditMode(false);
							setSelectedIds([]);
						}}
						style={styles.headerBtn}
					>
						<Feather
							name='x'
							size={22}
							color={theme.text}
						/>
					</TouchableOpacity>
				) : (
					<View>
						<Text style={[styles.headerTitle, { color: theme.text }]}>
							Library
						</Text>
						<Text style={[styles.headerCount, { color: theme.textMuted }]}>
							{entries.length} recording{entries.length === 1 ? '' : 's'}
						</Text>
					</View>
				)}

				<View style={styles.headerActions}>
					{editMode ? (
						<TouchableOpacity
							onPress={selectAll}
							style={styles.selectAllRow}
						>
							<Text style={{ color: theme.text, marginRight: 8 }}>
								{selectedIds.length} selected
							</Text>
							<Feather
								name={
									selectedIds.length === filtered.length && filtered.length > 0
										? 'check-square'
										: 'square'
								}
								size={20}
								color={theme.accent}
							/>
						</TouchableOpacity>
					) : (
						<>
							<TouchableOpacity
								onPress={() => setSearchOpen((v) => !v)}
								style={styles.headerBtn}
							>
								<Feather
									name='search'
									size={20}
									color={searchOpen ? theme.accent : theme.text}
								/>
							</TouchableOpacity>
							<TouchableOpacity
								onPress={() => setFilterOpen(true)}
								style={styles.headerBtn}
							>
								<Feather
									name='filter'
									size={20}
									color={activeFilterCount ? theme.accent : theme.text}
								/>
								{activeFilterCount > 0 && (
									<View
										style={[
											styles.filterBadge,
											{ backgroundColor: theme.accent },
										]}
									>
										<Text style={styles.filterBadgeText}>
											{activeFilterCount}
										</Text>
									</View>
								)}
							</TouchableOpacity>
							<TouchableOpacity
								onPress={() => setMenuOpen((v) => !v)}
								style={styles.headerBtn}
							>
								<Feather
									name='more-vertical'
									size={20}
									color={theme.text}
								/>
							</TouchableOpacity>
						</>
					)}
				</View>
			</View>

			{menuOpen && !editMode && (
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
							onPress={() => {
								setEditMode(true);
								setMenuOpen(false);
							}}
						>
							<Feather
								name='edit-3'
								size={17}
								color={theme.text}
								style={{ marginRight: 10 }}
							/>
							<Text style={{ color: theme.text }}>Edit</Text>
						</TouchableOpacity>
						<TouchableOpacity
							style={styles.dropdownItem}
							onPress={() => {
								setMenuOpen(false);
								navigation.navigate('Settings');
							}}
						>
							<Feather
								name='settings'
								size={17}
								color={theme.text}
								style={{ marginRight: 10 }}
							/>
							<Text style={{ color: theme.text }}>Settings</Text>
						</TouchableOpacity>
					</View>
				</>
			)}

			{!editMode && searchOpen && (
				<View
					style={[
						styles.searchWrap,
						{ backgroundColor: theme.surface, borderColor: theme.border },
					]}
				>
					<Feather
						name='search'
						size={16}
						color={theme.textMuted}
						style={{ marginRight: 8 }}
					/>
					<TextInput
						value={search}
						onChangeText={setSearch}
						autoFocus
						placeholder='Search by name...'
						placeholderTextColor={theme.textMuted}
						style={[styles.searchInput, { color: theme.text }]}
					/>
					{search.length > 0 && (
						<TouchableOpacity onPress={() => setSearch('')}>
							<Feather
								name='x-circle'
								size={16}
								color={theme.textMuted}
							/>
						</TouchableOpacity>
					)}
				</View>
			)}

			<SectionList
				sections={sections}
				keyExtractor={(item) => item.id}
				stickySectionHeadersEnabled={false}
				contentContainerStyle={{
					padding: 16,
					paddingBottom: editMode ? 120 : 16,
				}}
				renderSectionHeader={({ section }) => (
					<Text style={[styles.sectionLabel, { color: theme.textMuted }]}>
						{section.label}
					</Text>
				)}
				renderItem={({ item }) => (
					<EntryRow
						entry={item}
						isActiveHere={activeEntryId === item.id}
						isPlayingHere={activeEntryId === item.id && isPlaying}
						playbackPositionMs={playbackPos}
						editMode={editMode}
						selected={selectedIds.includes(item.id)}
						onToggleSelect={toggleSelect}
						onPressPlay={togglePlay}
						onPressOpen={(e) =>
							navigation.navigate('Playback', { entryId: e.id })
						}
						onSeek={seekEntry}
						showAbsoluteDate={editMode}
						onLongPress={(e) => {
							setEditMode(true);
							setSelectedIds([e.id]);
						}}
					/>
				)}
				ListEmptyComponent={
					<Text
						style={{
							color: theme.textMuted,
							textAlign: 'center',
							marginTop: 40,
						}}
					>
						No recordings yet — tap Record to make your first entry.
					</Text>
				}
			/>

			{editMode && (
				<View
					style={[
						styles.actionBar,
						{
							backgroundColor: theme.surface,
							borderColor: theme.border,
							paddingBottom: insets.bottom + 14,
							opacity: selectedIds.length ? 1 : 0.4,
						},
					]}
					pointerEvents={selectedIds.length ? 'auto' : 'none'}
				>
					<TouchableOpacity
						disabled={!selectedIds.length}
						onPress={handleShare}
						style={styles.actionBtn}
					>
						<Feather
							name='share-2'
							size={20}
							color={selectedIds.length ? theme.text : theme.textMuted}
						/>
						<Text
							style={{
								color: selectedIds.length ? theme.text : theme.textMuted,
								fontSize: 12,
								marginTop: 4,
							}}
						>
							Share
						</Text>
					</TouchableOpacity>
					<TouchableOpacity
						disabled={selectedIds.length !== 1}
						onPress={handleRename}
						style={styles.actionBtn}
					>
						<Feather
							name='edit-2'
							size={20}
							color={selectedIds.length === 1 ? theme.text : theme.textMuted}
						/>
						<Text
							style={{
								color: selectedIds.length === 1 ? theme.text : theme.textMuted,
								fontSize: 12,
								marginTop: 4,
							}}
						>
							Rename
						</Text>
					</TouchableOpacity>
					<TouchableOpacity
						disabled={selectedIds.length !== 1}
						onPress={handleSetRingtone}
						style={styles.actionBtn}
					>
						<Feather
							name='bell'
							size={20}
							color={selectedIds.length === 1 ? theme.text : theme.textMuted}
						/>
						<Text
							style={{
								color: selectedIds.length === 1 ? theme.text : theme.textMuted,
								fontSize: 12,
								marginTop: 4,
							}}
						>
							Ringtone
						</Text>
					</TouchableOpacity>
					<TouchableOpacity
						disabled={!selectedIds.length}
						onPress={handleDelete}
						style={styles.actionBtn}
					>
						<Feather
							name='trash-2'
							size={20}
							color={selectedIds.length ? '#E5605A' : theme.textMuted}
						/>
						<Text
							style={{
								color: selectedIds.length ? '#E5605A' : theme.textMuted,
								fontSize: 12,
								marginTop: 4,
							}}
						>
							Delete
						</Text>
					</TouchableOpacity>
				</View>
			)}

			<FilterSheet
				visible={filterOpen}
				categories={categories}
				value={filter}
				onChange={setFilter}
				onClose={() => setFilterOpen(false)}
			/>

			<PromptModal
				visible={renamePromptVisible}
				title='Rename entry'
				initialValue={entries.find((e) => e.id === selectedIds[0])?.title}
				onCancel={() => setRenamePromptVisible(false)}
				onSubmit={submitRename}
			/>

			<ConfirmModal
				visible={deleteModalVisible}
				title='Delete recordings?'
				message={`${selectedIds.length} entr${selectedIds.length === 1 ? 'y' : 'ies'} will be permanently deleted.`}
				confirmLabel='Delete'
				destructive
				onCancel={() => setDeleteModalVisible(false)}
				onConfirm={confirmDelete}
			/>
		</View>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1 },
	header: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		paddingHorizontal: 16,
		paddingBottom: 10,
	},
	headerTitle: { fontSize: 20, fontWeight: '700' },
	headerCount: { fontSize: 12, marginTop: 1 },
	headerActions: { flexDirection: 'row', alignItems: 'center', gap: 16 },
	headerBtn: { padding: 4 },
	selectAllRow: { flexDirection: 'row', alignItems: 'center' },
	filterBadge: {
		position: 'absolute',
		top: -4,
		right: -4,
		minWidth: 14,
		height: 14,
		borderRadius: 7,
		alignItems: 'center',
		justifyContent: 'center',
		paddingHorizontal: 2,
	},
	filterBadgeText: { color: '#fff', fontSize: 9, fontWeight: '700' },
	dropdown: {
		position: 'absolute',
		right: 16,
		borderWidth: 1,
		borderRadius: 12,
		zIndex: 10,
		overflow: 'hidden',
	},
	dropdownItem: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingVertical: 12,
		paddingHorizontal: 16,
	},
	searchWrap: {
		flexDirection: 'row',
		alignItems: 'center',
		marginHorizontal: 16,
		marginTop: 4,
		marginBottom: 4,
		borderWidth: 1,
		borderRadius: 12,
		paddingHorizontal: 12,
		height: 42,
	},
	searchInput: { flex: 1, fontSize: 15, height: '100%' },
	sectionLabel: {
		fontSize: 12,
		fontWeight: '700',
		marginBottom: 8,
		marginTop: 12,
		textTransform: 'uppercase',
		letterSpacing: 0.5,
	},
	actionBar: {
		position: 'absolute',
		bottom: 0,
		left: 0,
		right: 0,
		flexDirection: 'row',
		justifyContent: 'space-around',
		borderTopWidth: 1,
		paddingVertical: 16,
	},
	actionBtn: { alignItems: 'center' },
});
