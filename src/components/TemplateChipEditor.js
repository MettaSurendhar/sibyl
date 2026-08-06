import React, { useState } from 'react';
import {
	View,
	TouchableOpacity,
	StyleSheet,
	TextInput,
} from 'react-native';
import Text from '../theme/Text';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { DATE_FORMAT_PRESETS, TIME_FORMAT_PRESETS } from '../utils/naming';

export default function TemplateChipEditor({
	value,
	onChange,
	availableTokens,
}) {
	const { theme } = useTheme();
	const [selection, setSelection] = useState({
		start: (value || '').length,
		end: (value || '').length,
	});
	const [pickerType, setPickerType] = useState(null);

	function getBaseToken(str) {
		if (str.startsWith('<date')) return '<date>';
		if (str.startsWith('<time')) return '<time>';
		return str;
	}

	const usedBaseTokens = new Set(
		(value || '').match(/(\{tag\}|\{name\}|<count>|<date(?::[^>]+)?>|<time:[^>]+>)/g)?.map(getBaseToken) || []
	);

	const visibleTokens = availableTokens.filter(
		(t) => !usedBaseTokens.has(getBaseToken(t.token))
	);

	function insertToken(token) {
		const text = value || '';
		const start = selection.start ?? text.length;
		const end = selection.end ?? text.length;
		const before = text.slice(0, start);
		const after = text.slice(end);
		const needsSpaceBefore = before.length > 0 && !before.endsWith(' ');
		const needsSpaceAfter = after.length > 0 && !after.startsWith(' ');
		const insertion = `${needsSpaceBefore ? ' ' : ''}${token}${needsSpaceAfter ? ' ' : ''}`;
		const next = `${before}${insertion}${after}`;
		onChange(next);
		const cursor = (before + insertion).length;
		setSelection({ start: cursor, end: cursor });
		setPickerType(null);
	}

	function handleTokenPress(token) {
		if (token.startsWith('<date')) {
			setPickerType('date');
		} else if (token.startsWith('<time')) {
			setPickerType('time');
		} else {
			insertToken(token);
		}
	}

	function renderHighlightedText(text) {
		if (!text) return null;
		const parts = text.split(/(\{tag\}|\{name\}|<count>|<date(?::[^>]+)?>|<time:[^>]+>)/g);
		return parts.map((part, i) => {
			if (/^(\{tag\}|\{name\}|<count>|<date(?::[^>]+)?>|<time:[^>]+>)$/.test(part)) {
				return <Text key={i} style={{ color: theme.accent, fontWeight: '700' }}>{part}</Text>;
			}
			return <Text key={i} style={{ color: theme.text }}>{part}</Text>;
		});
	}

	return (
		<View>
			<View style={{ marginBottom: 12 }}>
				<TextInput
					style={[
						styles.rawInput,
						{
							borderColor: theme.border,
							backgroundColor: theme.surfaceAlt,
						},
					]}
					onChangeText={onChange}
					onSelectionChange={(e) => setSelection(e.nativeEvent.selection)}
					placeholder="Type naming format here..."
					placeholderTextColor={theme.textMuted}
					multiline
				>
					{renderHighlightedText(value)}
				</TextInput>
			</View>

			<View style={styles.tokenRow}>
				{visibleTokens.map((t) => (
					<TouchableOpacity
						key={t.token}
						onPress={() => handleTokenPress(t.token)}
						style={[styles.tokenBtn, { borderColor: theme.border }]}
					>
						<Feather
							name='plus'
							size={12}
							color={theme.accent}
							style={{ marginRight: 3 }}
						/>
						<Text
							style={{ color: theme.accent, fontSize: 12, fontWeight: '600' }}
						>
							{t.label}
						</Text>
					</TouchableOpacity>
				))}
			</View>

			{pickerType && (
				<View style={[styles.inlinePicker, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}>
					<View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
						<Text style={[styles.pickerTitle, { color: theme.text, marginBottom: 0 }]}>
							{pickerType === 'date' ? 'Date Format' : 'Time Format'}
						</Text>
						<TouchableOpacity onPress={() => setPickerType(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
							<Feather name="x" size={18} color={theme.textMuted} />
						</TouchableOpacity>
					</View>
					<View style={styles.presetWrap}>
						{(pickerType === 'date'
							? DATE_FORMAT_PRESETS
							: TIME_FORMAT_PRESETS
						).map((p) => (
							<TouchableOpacity
								key={p.key}
								onPress={() => insertToken(`<${pickerType}:${p.pattern}>`)}
								style={[styles.presetChip, { borderColor: theme.border }]}
							>
								<Text style={{ color: theme.text, fontSize: 13 }}>
									{p.key}
								</Text>
							</TouchableOpacity>
						))}
					</View>
				</View>
			)}
		</View>
	);
}

const styles = StyleSheet.create({
	tokenRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8, gap: 8 },
	tokenBtn: {
		flexDirection: 'row',
		alignItems: 'center',
		borderWidth: 1,
		borderRadius: 20,
		paddingVertical: 6,
		paddingHorizontal: 10,
	},
	rawInput: { borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 14, minHeight: 44 },
	inlinePicker: {
		borderWidth: 1,
		borderRadius: 12,
		padding: 16,
		marginTop: 8,
	},
	pickerTitle: {
		fontSize: 14,
		fontWeight: '700',
	},
	presetWrap: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: 8,
	},
	presetChip: {
		borderWidth: 1,
		borderRadius: 8,
		paddingVertical: 8,
		paddingHorizontal: 12,
	},
});
