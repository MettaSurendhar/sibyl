import React from 'react';
import { ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';
import SettingsHeader from '../../components/SettingsHeader';
import { SettingsNavRow } from '../../components/SettingsNavRow';

export default function SettingsHomeScreen({ navigation }) {
	const { theme } = useTheme();
	const insets = useSafeAreaInsets();

	return (
		<ScrollView
			style={{ flex: 1, backgroundColor: theme.bg }}
			contentContainerStyle={{ padding: 20, paddingTop: insets.top + 16 }}
		>
			<SettingsHeader
				title='Settings'
				onBack={() => navigation.goBack()}
			/>

			<SettingsNavRow
				icon='mic'
				label='Recording'
				subtitle='Format, saving folder, transcript downloads'
				onPress={() => navigation.navigate('RecordingSettings')}
			/>
			<SettingsNavRow
				icon='tag'
				label='Naming & Tags'
				subtitle='Manage tags, naming templates'
				onPress={() => navigation.navigate('NamingTagsSettings')}
			/>
			<SettingsNavRow
				icon='droplet'
				label='Appearance'
				subtitle='Theme'
				onPress={() => navigation.navigate('AppearanceSettings')}
			/>
			<SettingsNavRow
				icon='cpu'
				label='Transcription'
				subtitle='Groq API key'
				onPress={() => navigation.navigate('TranscriptionSettings')}
			/>
			<SettingsNavRow
				icon='info'
				label='About'
				subtitle='Version, description'
				onPress={() => navigation.navigate('AboutSettings')}
			/>
		</ScrollView>
	);
}
