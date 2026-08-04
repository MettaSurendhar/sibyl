import React, { useEffect, useState } from 'react';
import {
	Modal,
	View,
	TouchableOpacity,
	TextInput,
	StyleSheet,
} from 'react-native';
import Text from '../theme/Text';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import TagDropdown from './TagDropdown';
import { createCategory } from '../db/categories';

// visible, title, categories, initialCategory, initialName, onCancel, onConfirm(categoryId, name), onCategoriesChanged
export default function TagNameSheet({
	visible,
	title = 'Save as',
	categories,
	initialCategory,
	initialName,
	onCancel,
	onConfirm,
	onCategoriesChanged,
}) {
	const { theme } = useTheme();
	const [selectedCategory, setSelectedCategory] = useState(
		initialCategory || null,
	);
	const [name, setName] = useState(initialName || '');

	useEffect(() => {
		if (visible) {
			setSelectedCategory(initialCategory || null);
			setName(initialName || '');
		}
	}, [visible, initialCategory, initialName]);

	async function handleCreateNew(newName) {
		const id = await createCategory({ name: newName, prefix: newName });
		await onCategoriesChanged?.();
		setSelectedCategory({ id, name: newName, counter: 0, color: '#6C8EF5' });
	}

	return (
		<Modal
			visible={visible}
			transparent
			animationType='slide'
			onRequestClose={onCancel}
		>
			<View style={styles.backdrop}>
				<View style={[styles.sheet, { backgroundColor: theme.surface }]}>
					<View style={styles.headerRow}>
						<Text style={[styles.title, { color: theme.text }]}>{title}</Text>
						<TouchableOpacity
							onPress={onCancel}
							style={styles.closeBtn}
						>
							<Feather
								name='x'
								size={20}
								color={theme.textMuted}
							/>
						</TouchableOpacity>
					</View>

					<TagDropdown
						label='Tag'
						value={selectedCategory}
						categories={categories}
						onChange={setSelectedCategory}
						onCreateNew={handleCreateNew}
					/>

					<Text style={[styles.label, { color: theme.textMuted }]}>Name</Text>
					<TextInput
						value={name}
						onChangeText={setName}
						style={[
							styles.input,
							{ color: theme.text, borderColor: theme.border },
						]}
						placeholder='Entry name'
						placeholderTextColor={theme.textMuted}
					/>

					<TouchableOpacity
						style={[styles.confirmBtn, { backgroundColor: theme.accent }]}
						onPress={() => onConfirm(selectedCategory?.id || null, name)}
					>
						<Text style={{ color: '#fff', fontWeight: '700' }}>Save</Text>
					</TouchableOpacity>
				</View>
			</View>
		</Modal>
	);
}

const styles = StyleSheet.create({
	backdrop: {
		flex: 1,
		backgroundColor: 'rgba(0,0,0,0.5)',
		justifyContent: 'flex-end',
	},
	sheet: { padding: 20, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
	headerRow: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		marginBottom: 16,
	},
	title: { fontSize: 18, fontWeight: '700' },
	closeBtn: { padding: 4 },
	label: { fontSize: 13, fontWeight: '600', marginBottom: 6 },
	input: {
		borderWidth: 1,
		borderRadius: 12,
		padding: 12,
		fontSize: 16,
		marginBottom: 20,
	},
	confirmBtn: { padding: 14, borderRadius: 12, alignItems: 'center' },
});
