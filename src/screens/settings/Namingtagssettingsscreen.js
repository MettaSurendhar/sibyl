import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';
import SettingsHeader from '../../components/SettingsHeader';
import {
	SettingsSection,
	SettingsNavRow,
} from '../../components/SettingsNavRow';
import InfoPopover from '../../components/InfoPopover';
import TemplateChipEditor from '../../components/TemplateChipEditor';
import {
	getUntaggedTemplate,
	setUntaggedTemplate,
	getTrimTemplate,
	setTrimTemplate,
	getMergeTemplate,
	setMergeTemplate,
	getAppendTemplate,
	setAppendTemplate,
} from '../../db/categories';
import { renderTemplate } from '../../utils/naming';

const UNTAGGED_TOKENS = [
	{ token: '<count>', label: 'Count' },
	{ token: '<date>', label: 'Date' },
];
const DERIVED_TOKENS = [
	{ token: '{name}', label: 'Name' },
	{ token: '<date:DD-MM-YYYY>', label: 'Date' },
	{ token: '<time:hh:mm>', label: 'Time' },
];

export default function NamingTagsSettingsScreen({ navigation }) {
	const { theme } = useTheme();
	const insets = useSafeAreaInsets();
	const [untaggedTemplate, setUntaggedTemplateState] = useState('');
	const [trimTemplate, setTrimTemplateState] = useState('');
	const [mergeTemplate, setMergeTemplateState] = useState('');
	const [appendTemplate, setAppendTemplateState] = useState('');

	useEffect(() => {
		getUntaggedTemplate().then(setUntaggedTemplateState);
		getTrimTemplate().then(setTrimTemplateState);
		getMergeTemplate().then(setMergeTemplateState);
		getAppendTemplate().then(setAppendTemplateState);
	}, []);

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

	return (
		<ScrollView
			style={{ flex: 1, backgroundColor: theme.bg }}
			contentContainerStyle={{ padding: 20, paddingTop: insets.top + 16 }}
		>
			<SettingsHeader
				title='Naming & Tags'
				onBack={() => navigation.goBack()}
			/>

			<SettingsSection title='Tags'>
				<SettingsNavRow
					icon='tag'
					label='Manage tags'
					onPress={() => navigation.navigate('Categories')}
				/>
			</SettingsSection>

			<SettingsSection
				title='Untagged recording naming'
				right={
					<InfoPopover title='Untagged recording naming'>
						Controls the suggested name shown when you save a recording without
						picking a tag. Add Count to number recordings in order, or Date to
						include today's date - tap "Or type directly" to write a template
						yourself using {'{tag}'}, {'<count>'}, {'<date>'},{' '}
						{'<date:PATTERN>'} or {'<time:PATTERN>'}.
					</InfoPopover>
				}
			>
				<TemplateChipEditor
					value={untaggedTemplate}
					onChange={saveUntaggedTemplate}
					availableTokens={UNTAGGED_TOKENS}
				/>
				<Text style={{ color: theme.textMuted, fontSize: 12, marginTop: 6 }}>
					Preview: {renderTemplate(untaggedTemplate, { count: 1 })}
				</Text>
			</SettingsSection>

			<SettingsSection
				title='Derived recording naming'
				right={
					<InfoPopover title='Derived recording naming'>
						Trim, Merge, and Append each create a new recording rather than
						changing the original - these control the suggested name shown when
						saving one. Use Name for the source recording's name, plus Date and
						Time to timestamp it.
					</InfoPopover>
				}
			>
				<Text style={[styles.subLabel, { color: theme.text }]}>Trim</Text>
				<TemplateChipEditor
					value={trimTemplate}
					onChange={saveTrimTemplate}
					availableTokens={DERIVED_TOKENS}
				/>
				<Text
					style={{ color: theme.textMuted, fontSize: 12, marginBottom: 18 }}
				>
					Preview: {renderTemplate(trimTemplate, { name: 'Diary 3' })}
				</Text>

				<Text style={[styles.subLabel, { color: theme.text }]}>Merge</Text>
				<TemplateChipEditor
					value={mergeTemplate}
					onChange={saveMergeTemplate}
					availableTokens={DERIVED_TOKENS}
				/>
				<Text
					style={{ color: theme.textMuted, fontSize: 12, marginBottom: 18 }}
				>
					Preview: {renderTemplate(mergeTemplate, { name: 'Diary 3' })}
				</Text>

				<Text style={[styles.subLabel, { color: theme.text }]}>Append</Text>
				<TemplateChipEditor
					value={appendTemplate}
					onChange={saveAppendTemplate}
					availableTokens={DERIVED_TOKENS}
				/>
				<Text style={{ color: theme.textMuted, fontSize: 12 }}>
					Preview: {renderTemplate(appendTemplate, { name: 'Diary 3' })}
				</Text>
			</SettingsSection>
		</ScrollView>
	);
}

const styles = StyleSheet.create({
	subLabel: { fontSize: 13, fontWeight: '700', marginBottom: 6 },
});
