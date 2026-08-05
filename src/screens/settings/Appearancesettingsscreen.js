import React, { useEffect, useState } from 'react';
import {
	View,
	TouchableOpacity,
	ScrollView,
	StyleSheet,
	TextInput,
} from 'react-native';
import Text from '../../theme/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';
import { themeList } from '../../theme/themes';
import SettingsHeader from '../../components/SettingsHeader';
import { SettingsSection } from '../../components/SettingsNavRow';
import { getPrefs, setPrefs } from '../../utils/settingsStore';

function ThemeSwatch({ theme: t }) {
	return (
		<View style={styles.swatchPill}>
			<View style={[styles.swatchCell, { backgroundColor: t.bg }]} />
			<View style={[styles.swatchCell, { backgroundColor: t.surfaceAlt }]} />
			<View style={[styles.swatchCell, { backgroundColor: t.accent }]} />
		</View>
	);
}

const FONTS = [
	{ key: 'system', label: 'System Default', desc: 'Device Default Font' },
	{ key: 'lora', label: 'Lora', desc: 'Classic Serif' },
	{ key: 'playfair', label: 'Playfair Display', desc: 'Elegant Serif' },
	{ key: 'outfit', label: 'Outfit', desc: 'Modern Sans' },
	{ key: 'inter', label: 'Inter', desc: 'Clean Sans' },
	{ key: 'nunito', label: 'Nunito', desc: 'Friendly Rounded' },
];

export default function AppearanceSettingsScreen({ navigation }) {
	const { theme, themeKey, setThemeKey, appFont, setAppFont } = useTheme();
	const insets = useSafeAreaInsets();
	const [streakDays, setStreakDays] = useState(14);
	const [userName, setUserName] = useState('');

	useEffect(() => {
		getPrefs().then((p) => {
			if (p.streakDays) setStreakDays(p.streakDays);
			if (p.userName) setUserName(p.userName);
		});
	}, []);

	async function updateStreakDays(val) {
		setStreakDays(val);
		await setPrefs({ streakDays: val });
	}

	async function updateUserName(val) {
		setUserName(val);
		await setPrefs({ userName: val });
	}

	return (
		<ScrollView
			style={{ flex: 1, backgroundColor: theme.bg }}
			contentContainerStyle={{ padding: 20, paddingTop: insets.top + 16 }}
		>
			<SettingsHeader
				title='Appearance & Personal'
				onBack={() => navigation.goBack()}
			/>

			<SettingsSection title='Personalization'>
				<View style={{ marginBottom: 12 }}>
					<Text style={{ color: theme.textMuted, fontSize: 14, marginBottom: 8 }}>
						What should Sibyl call you?
					</Text>
					<TextInput
						style={[
							styles.input,
							{
								backgroundColor: theme.surfaceAlt,
								borderColor: theme.border,
								color: theme.text,
							},
						]}
						value={userName}
						onChangeText={updateUserName}
						placeholder="e.g. Alex"
						placeholderTextColor={theme.textMuted}
					/>
				</View>
			</SettingsSection>

			<SettingsSection title='Theme'>
				{themeList.map((t) => (
					<TouchableOpacity
						key={t.key}
						style={[
							styles.optionRow,
							{
								borderColor: theme.border,
								backgroundColor:
									themeKey === t.key ? theme.surfaceAlt : 'transparent',
							},
						]}
						onPress={() => setThemeKey(t.key)}
					>
						<ThemeSwatch theme={t} />
						<Text style={{ color: theme.text, flex: 1, marginLeft: 12 }}>
							{t.label}
						</Text>
					</TouchableOpacity>
				))}
			</SettingsSection>

			<SettingsSection title='Typography'>
				{FONTS.map((f) => (
					<TouchableOpacity
						key={f.key}
						style={[
							styles.optionRow,
							{
								borderColor: theme.border,
								backgroundColor: appFont === f.key ? theme.surfaceAlt : 'transparent',
							},
						]}
						onPress={() => setAppFont(f.key)}
					>
						<View style={{ flex: 1 }}>
							<Text style={{ color: theme.text, fontSize: 16 }}>{f.label}</Text>
							<Text style={{ color: theme.textMuted, fontSize: 12 }}>{f.desc}</Text>
						</View>
					</TouchableOpacity>
				))}
			</SettingsSection>

			<SettingsSection title='Dashboard Streak Tracker'>
				{[7, 14, 30].map((days) => (
					<TouchableOpacity
						key={days}
						style={[
							styles.optionRow,
							{
								borderColor: theme.border,
								backgroundColor:
									streakDays === days ? theme.surfaceAlt : 'transparent',
							},
						]}
						onPress={() => updateStreakDays(days)}
					>
						<Text style={{ color: theme.text, flex: 1 }}>{days} days</Text>
					</TouchableOpacity>
				))}
			</SettingsSection>
		</ScrollView>
	);
}

const styles = StyleSheet.create({
	optionRow: {
		flexDirection: 'row',
		alignItems: 'center',
		borderWidth: 1,
		borderRadius: 12,
		padding: 12,
		marginBottom: 8,
	},
	input: {
		borderWidth: 1,
		borderRadius: 12,
		paddingHorizontal: 16,
		paddingVertical: 12,
		fontSize: 16,
	},
	swatchPill: {
		flexDirection: 'row',
		borderRadius: 9,
		overflow: 'hidden',
		width: 42,
		height: 18,
	},
	swatchCell: { flex: 1, height: '100%' },
});
