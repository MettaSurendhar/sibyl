import React, { useState } from 'react';
import {
	View,
	Text,
	TextInput,
	TouchableOpacity,
	StyleSheet,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';

// Recognizes every token shape the naming templates already support (see utils/naming.js):
// {tag}, {name}, <count>, <date>, <date:PATTERN>, <time:PATTERN>. Matching + splitting use the
// same pattern so segment boundaries always line up.
const TOKEN_SPLIT =
	/(\{tag\}|\{name\}|<count>|<date(?::[^>]+)?>|<time:[^>]+>)/g;
const TOKEN_MATCH =
	/^(\{tag\}|\{name\}|<count>|<date(?::[^>]+)?>|<time:[^>]+>)$/;

function parseSegments(template) {
	return (template || '')
		.split(TOKEN_SPLIT)
		.filter((part) => part !== '')
		.map((part, i) => ({
			key: `${i}-${part}`,
			text: part,
			isToken: TOKEN_MATCH.test(part),
		}));
}

function labelForToken(token) {
	if (token === '{tag}') return 'Tag';
	if (token === '{name}') return 'Name';
	if (token === '<count>') return 'Count';
	if (token.startsWith('<date')) return 'Date';
	if (token.startsWith('<time')) return 'Time';
	return token;
}

// value/onChange: the raw template string, still stored/serialized exactly as before - only the
// editing UI changes. availableTokens: [{ token: '<count>', label: 'Count' }, ...] shown as
// tappable "+ Token" buttons appropriate to this template (untagged vs derived-recording naming
// use different token sets).
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

	const segments = parseSegments(value);

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
	}

	function removeSegmentAt(index) {
		const next = segments
			.filter((_, i) => i !== index)
			.map((s) => s.text)
			.join('');
		onChange(next);
	}

	return (
		<View>
			<View
				style={[
					styles.chipField,
					{ borderColor: theme.border, backgroundColor: theme.surfaceAlt },
				]}
			>
				{segments.length === 0 ? (
					<Text style={{ color: theme.textMuted, fontSize: 13 }}>
						Empty — add tokens below or type your own
					</Text>
				) : (
					segments.map((seg, i) =>
						seg.isToken ? (
							<View
								key={seg.key}
								style={[
									styles.chip,
									{
										backgroundColor: `${theme.accent}22`,
										borderColor: theme.accent,
									},
								]}
							>
								<Text style={[styles.chipText, { color: theme.accent }]}>
									{labelForToken(seg.text)}
								</Text>
								<TouchableOpacity
									onPress={() => removeSegmentAt(i)}
									hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
								>
									<Feather
										name='x'
										size={12}
										color={theme.accent}
										style={{ marginLeft: 4 }}
									/>
								</TouchableOpacity>
							</View>
						) : (
							<Text
								key={seg.key}
								style={[styles.literalText, { color: theme.text }]}
							>
								{seg.text}
							</Text>
						),
					)
				)}
			</View>

			<View style={styles.tokenRow}>
				{availableTokens.map((t) => (
					<TouchableOpacity
						key={t.token}
						onPress={() => insertToken(t.token)}
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

			<TextInput
				value={value}
				onChangeText={onChange}
				onSelectionChange={(e) => setSelection(e.nativeEvent.selection)}
				style={[
					styles.rawInput,
					{
						color: theme.text,
						borderColor: theme.border,
						backgroundColor: theme.surfaceAlt,
					},
				]}
				placeholder='Or type directly…'
				placeholderTextColor={theme.textMuted}
			/>
		</View>
	);
}

const styles = StyleSheet.create({
	chipField: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		alignItems: 'center',
		borderWidth: 1,
		borderRadius: 12,
		padding: 10,
		minHeight: 44,
		marginBottom: 8,
	},
	chip: {
		flexDirection: 'row',
		alignItems: 'center',
		borderWidth: 1,
		borderRadius: 8,
		paddingVertical: 4,
		paddingHorizontal: 8,
		marginRight: 6,
		marginBottom: 4,
	},
	chipText: { fontSize: 12, fontWeight: '700' },
	literalText: { fontSize: 13, marginRight: 2, marginBottom: 4 },
	tokenRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8, gap: 8 },
	tokenBtn: {
		flexDirection: 'row',
		alignItems: 'center',
		borderWidth: 1,
		borderRadius: 20,
		paddingVertical: 6,
		paddingHorizontal: 10,
	},
	rawInput: { borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 14 },
});
