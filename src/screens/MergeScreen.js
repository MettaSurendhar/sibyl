import React, { useCallback, useState } from 'react';
import {
	View,
	Text,
	TextInput,
	TouchableOpacity,
	FlatList,
	StyleSheet,
	Modal,
	ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { useAlert } from '../theme/AlertContext';
import TagNameSheet from '../components/TagNameSheet';
import { concatFiles } from '../audio/ffmpegModule';
import { listEntries, getEntry, createEntry } from '../db/entries';
import { listCategories, getMergeTemplate } from '../db/categories';
import { formatDuration } from '../utils/format';
import { renderTemplate } from '../utils/naming';

export default function MergeScreen({ route, navigation }) {
	const { theme } = useTheme();
	const alert = useAlert();
	const insets = useSafeAreaInsets();
	const { entryId } = route.params;
	const [currentEntry, setCurrentEntry] = useState(null);
	const [categories, setCategories] = useState([]);
	const [others, setOthers] = useState([]);
	const [search, setSearch] = useState('');
	const [selectedIds, setSelectedIds] = useState([]); // ordered - preserves merge sequence
	const [saveSheetOpen, setSaveSheetOpen] = useState(false);
	const [defaultName, setDefaultName] = useState('');
	const [processing, setProcessing] = useState(false);

	useFocusEffect(
		useCallback(() => {
			let cancelled = false;
			getEntry(entryId).then((e) => !cancelled && setCurrentEntry(e));
			listEntries().then(
				(all) => !cancelled && setOthers(all.filter((e) => e.id !== entryId)),
			);
			listCategories().then((cats) => !cancelled && setCategories(cats));
			return () => {
				cancelled = true;
			};
		}, [entryId]),
	);

	const filtered = others.filter((e) =>
		e.title.toLowerCase().includes(search.toLowerCase()),
	);

	function toggleSelect(id) {
		setSelectedIds((prev) =>
			prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
		);
	}

	const selectedEntries = selectedIds
		.map((id) => others.find((e) => e.id === id))
		.filter(Boolean);

	async function openSaveSheet() {
		if (!selectedIds.length) return;
		const template = await getMergeTemplate();
		setDefaultName(renderTemplate(template, { name: currentEntry.title }));
		setSaveSheetOpen(true);
	}

	async function performMerge(categoryId, name) {
		setSaveSheetOpen(false);
		setProcessing(true);
		try {
			const orderedEntries = [currentEntry, ...selectedEntries];
			const orderedUris = orderedEntries.flatMap((e) =>
				e.segments.map((s) => s.uri),
			);
			const orderedWaveform = orderedEntries.flatMap((e) => e.waveform);
			const combinedDurationMs = orderedEntries.reduce(
				(sum, e) => sum + e.totalDurationMs,
				0,
			);

			const merged = await concatFiles(orderedUris);

			// Merge always creates a NEW entry - none of the source recordings are modified or deleted.
			const newId = await createEntry({
				title: name || defaultName,
				categoryId,
				uri: merged.uri,
				durationMs: combinedDurationMs,
				waveform: orderedWaveform,
				sourceType: 'merged',
			});

			navigation.replace('Playback', { entryId: newId });
		} catch (e) {
			alert('Merge failed', e.message);
		} finally {
			setProcessing(false);
		}
	}

	if (!currentEntry) {
		return <View style={[styles.container, { backgroundColor: theme.bg }]} />;
	}

	return (
		<View style={[styles.container, { backgroundColor: theme.bg }]}>
			<View style={[styles.topBar, { paddingTop: insets.top + 10 }]}>
				<TouchableOpacity
					onPress={() => navigation.goBack()}
					style={styles.iconBtn}
				>
					<Feather
						name='arrow-left'
						size={22}
						color={theme.text}
					/>
				</TouchableOpacity>
				<Text style={[styles.title, { color: theme.text }]}>
					{selectedIds.length
						? `${selectedIds.length} selected`
						: 'Merge recording'}
				</Text>
				<View style={{ width: 22 }} />
			</View>

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
					placeholder='Search recordings to merge with...'
					placeholderTextColor={theme.textMuted}
					style={{ flex: 1, color: theme.text, fontSize: 15 }}
				/>
			</View>

			<Text style={[styles.hint, { color: theme.textMuted }]}>
				Merging into: {currentEntry.title} — pick one or more recordings to add
				after it
			</Text>

			<FlatList
				data={filtered}
				keyExtractor={(e) => e.id}
				contentContainerStyle={{ padding: 16, paddingTop: 8 }}
				renderItem={({ item }) => {
					const selected = selectedIds.includes(item.id);
					const order = selectedIds.indexOf(item.id);
					return (
						<TouchableOpacity
							onPress={() => toggleSelect(item.id)}
							style={[
								styles.row,
								{
									borderColor: selected ? theme.accent : theme.border,
									backgroundColor: theme.surface,
								},
							]}
						>
							<View style={{ flex: 1 }}>
								<Text
									style={{ color: theme.text, fontWeight: '600' }}
									numberOfLines={1}
								>
									{item.title}
								</Text>
								<Text style={{ color: theme.textMuted, fontSize: 12 }}>
									{item.categoryName || 'Untagged'}
								</Text>
							</View>
							<Text
								style={{
									color: theme.textMuted,
									fontSize: 13,
									marginRight: 12,
								}}
							>
								{formatDuration(item.totalDurationMs)}
							</Text>
							{selected && (
								<View
									style={[styles.orderBadge, { backgroundColor: theme.accent }]}
								>
									<Text style={styles.orderBadgeText}>{order + 2}</Text>
								</View>
							)}
							<Feather
								name={selected ? 'check-square' : 'square'}
								size={22}
								color={selected ? theme.accent : theme.textMuted}
								style={{ marginLeft: 12 }}
							/>
						</TouchableOpacity>
					);
				}}
				ListEmptyComponent={
					<Text
						style={{
							color: theme.textMuted,
							textAlign: 'center',
							marginTop: 40,
						}}
					>
						No other recordings to merge with.
					</Text>
				}
			/>

			<View style={[styles.bottomRow, { paddingBottom: insets.bottom + 20 }]}>
				<TouchableOpacity
					disabled={!selectedIds.length}
					onPress={openSaveSheet}
					style={[
						styles.mergeBtn,
						{
							backgroundColor: selectedIds.length
								? theme.accent
								: theme.surfaceAlt,
						},
					]}
				>
					<Text
						style={{
							color: selectedIds.length ? '#fff' : theme.textMuted,
							fontWeight: '700',
						}}
					>
						Merge{' '}
						{selectedIds.length > 0
							? `(${selectedIds.length + 1} recordings)`
							: ''}
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
							color={theme.accent}
							size='large'
						/>
						<Text
							style={{ color: theme.text, marginTop: 12, fontWeight: '600' }}
						>
							Merging…
						</Text>
					</View>
				</View>
			</Modal>

			<TagNameSheet
				visible={saveSheetOpen}
				title='Save merged recording'
				categories={categories}
				initialCategory={
					categories.find((c) => c.id === currentEntry.categoryId) || null
				}
				initialName={defaultName}
				onCancel={() => setSaveSheetOpen(false)}
				onConfirm={performMerge}
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
		paddingHorizontal: 8,
		paddingBottom: 8,
	},
	iconBtn: { padding: 8 },
	title: { fontSize: 16, fontWeight: '700' },
	searchWrap: {
		flexDirection: 'row',
		alignItems: 'center',
		marginHorizontal: 16,
		borderWidth: 1,
		borderRadius: 12,
		paddingHorizontal: 12,
		height: 42,
	},
	hint: { fontSize: 12, marginHorizontal: 16, marginTop: 10 },
	row: {
		flexDirection: 'row',
		alignItems: 'center',
		borderWidth: 1,
		borderRadius: 12,
		padding: 14,
		marginBottom: 10,
	},
	orderBadge: {
		width: 20,
		height: 20,
		borderRadius: 10,
		alignItems: 'center',
		justifyContent: 'center',
	},
	orderBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
	bottomRow: { paddingHorizontal: 20 },
	mergeBtn: { paddingVertical: 15, borderRadius: 12, alignItems: 'center' },
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
