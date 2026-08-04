import React, { useEffect, useState } from 'react';
import {
	View,
	Text,
	TouchableOpacity,
	ScrollView,
	StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';
import { themeList } from '../../theme/themes';
import SettingsHeader from '../../components/SettingsHeader';
import { SettingsSection } from '../../components/SettingsNavRow';
import { getPrefs, setPrefs } from '../../utils/settingsStore';

// Small 3-color swatch pill (background / surface / accent) pulled straight from each theme's
// existing palette - makes light themes (Paper/Slate/Sand) easier to tell apart at a glance
// than a single accent dot did.
function ThemeSwatch({ theme: t }) {
	return (
		<View style={styles.swatchPill}>
			<View style={[styles.swatchCell, { backgroundColor: t.bg }]} />
			<View style={[styles.swatchCell, { backgroundColor: t.surfaceAlt }]} />
			<View style={[styles.swatchCell, { backgroundColor: t.accent }]} />
		</View>
	);
}

export default function AppearanceSettingsScreen({ navigation }) {
	const { theme, themeKey, setThemeKey } = useTheme();
	const insets = useSafeAreaInsets();
	const [streakDays, setStreakDays] = useState(14);

	useEffect(() => {
		getPrefs().then((p) => {
			if (p.streakDays) setStreakDays(p.streakDays);
		});
	}, []);

	async function updateStreakDays(val) {
		setStreakDays(val);
		await setPrefs({ streakDays: val });
	}

	return (
		<ScrollView
			style={{ flex: 1, backgroundColor: theme.bg }}
			contentContainerStyle={{ padding: 20, paddingTop: insets.top + 16 }}
		>
			<SettingsHeader
				title='Appearance'
				onBack={() => navigation.goBack()}
			/>

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
	swatchPill: {
		flexDirection: 'row',
		borderRadius: 9,
		overflow: 'hidden',
		width: 42,
		height: 18,
	},
	swatchCell: { flex: 1, height: '100%' },
});
