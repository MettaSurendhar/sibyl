import React, { useCallback, useState, useEffect } from 'react';
import { View, Image, TouchableOpacity, ScrollView, StyleSheet, DeviceEventEmitter } from 'react-native';
import Text from '../theme/Text';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { getAllTagCounts, getPieBreakdown } from '../db/categories';
import { getPrefs } from '../utils/settingsStore';
import { getStreakCount, getDailyEntryCounts, getAnalyticsSummary } from '../db/entries';
import { DB_UPDATED_EVENT } from '../utils/events';
import TagCountBoxes from '../components/home/TagCountBoxes';
import Typewriter from '../components/home/Typewriter';

const COMPANION_PHRASES = [
	"How are you feeling today?",
	"Take a deep breath.",
	"Ready to record a thought?",
	"Your thoughts are safe here.",
	"What's on your mind?",
	"A penny for your thoughts?",
	"Clear your mind."
];

function generateSmartActivityText(streak, stats) {
	if (!stats || stats.totalEntries === 0) return "Welcome to Sibyl. Start by recording your first entry.";

	const options = [];

	if (streak > 2) {
		options.push(`You have a ${streak} day streak going. Keep it up!`);
		options.push(`Keep the momentum. Your ${streak} day streak is active.`);
	} else if (streak === 0 && stats.totalEntries > 0) {
		options.push("You took a break. Let's start fresh today.");
	}

	if (stats.avgEntryLength > 0) {
		const mins = Math.max(1, Math.round(stats.avgEntryLength / 60000));
		options.push(`Your average thought lasts about ${mins} minute${mins === 1 ? '' : 's'}.`);
	}

	if (stats.timeOfDay && stats.totalEntries > 5) {
		let max = 0, best = '';
		for (const [k, v] of Object.entries(stats.timeOfDay)) {
			if (v > max) { max = v; best = k; }
		}
		if (best) {
			options.push(`You record most of your thoughts in the ${best}.`);
		}
	}

	if (options.length === 0) {
		options.push(`You've recorded ${stats.totalEntries} thoughts so far.`);
	}

	const dayOfYear = Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 0)) / 1000 / 60 / 60 / 24);
	return options[dayOfYear % options.length];
}

function getGreeting(name) {
	const h = new Date().getHours();
	let timeStr = 'Good morning';
	if (h >= 12 && h < 17) timeStr = 'Good afternoon';
	else if (h >= 17 && h < 22) timeStr = 'Good evening';
	else if (h >= 22 || h < 5) timeStr = 'Welcome back';
	// Return as { base, name } so the name can be styled separately
	return { base: timeStr, name: name || '' };
}

export default function TodayScreen({ navigation, onTagPress }) {
	const { theme } = useTheme();
	const insets = useSafeAreaInsets();
	const [tagCounts, setTagCounts] = useState([]);
	const [userName, setUserName] = useState('');
	const [companionPhrase, setCompanionPhrase] = useState('');
	const [smartActivityText, setSmartActivityText] = useState('');

	const refresh = useCallback(() => {
		const now = Date.now();
		const fetchFrom = now - 365 * 24 * 60 * 60 * 1000;
		Promise.all([
			getAllTagCounts(),
			getPrefs(),
			getStreakCount(),
			getAnalyticsSummary()
		]).then(([tags, prefs, streak, stats]) => {
			setTagCounts(tags);
			if (prefs.userName) setUserName(prefs.userName);

			const dayOfYear = Math.floor((now - new Date(new Date().getFullYear(), 0, 0)) / 1000 / 60 / 60 / 24);
			setCompanionPhrase(COMPANION_PHRASES[dayOfYear % COMPANION_PHRASES.length]);
			setSmartActivityText(generateSmartActivityText(streak, stats));
		});
	}, []);

	useFocusEffect(
		useCallback(() => {
			refresh();
		}, [refresh]),
	);

	// Also refresh whenever any DB write happens (e.g. transcription completes, sync finishes)
	useEffect(() => {
		const sub = DeviceEventEmitter.addListener(DB_UPDATED_EVENT, refresh);
		return () => sub.remove();
	}, [refresh]);


	return (
		<ScrollView
			style={[styles.container, { backgroundColor: theme.bg }]}
			contentContainerStyle={{
				paddingTop: insets.top + 6,
				paddingBottom: insets.bottom + 16,
			}}
			showsVerticalScrollIndicator={false}
		>
			{/* Header: Logo + Settings */}
			<View style={styles.headerRow}>
				<Image
					source={require('../../assets/header-icon.png')}
					style={{ width: 180, height: 56, resizeMode: 'contain', marginLeft: -18 }}
				/>
				<View style={styles.headerRight}>
					<TouchableOpacity
						onPress={() => navigation.navigate('Analytics')}
						style={[styles.headerBtn, { backgroundColor: theme.surfaceAlt, marginRight: 8 }]}
						hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
					>
						<Feather name='pie-chart' size={18} color={theme.textMuted} />
					</TouchableOpacity>
					<TouchableOpacity
						onPress={() => navigation.navigate('Settings')}
						style={[styles.headerBtn, { backgroundColor: theme.surfaceAlt }]}
						hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
					>
						<Feather name='settings' size={18} color={theme.textMuted} />
					</TouchableOpacity>
				</View>
			</View>

			{/* Greeting */}
			<View style={{ paddingHorizontal: 20, marginBottom: 24 }}>
				<Text
					style={{
						fontFamily: 'DancingScript_700Bold',
						fontSize: 26,
						color: theme.text,
						lineHeight: 34
					}}
				>
					{(() => {
						const { base, name } = getGreeting(userName);
						return name ? (
							<>
								{base + ', '}
								<Text style={{ color: theme.accent, fontFamily: 'DancingScript_700Bold' }}>{name}</Text>
							</>
						) : base;
					})()}
				</Text>
				<Text
					style={{
						fontFamily: 'DancingScript_700Bold',
						fontSize: 17,
						color: theme.textMuted,
						marginTop: 2
					}}
				>
					{companionPhrase}
				</Text>
			</View>

			{/* Tag count boxes */}
			<TagCountBoxes tags={tagCounts} onTagPress={onTagPress} />

			{/* Smart Activity Engine */}
			{smartActivityText ? (
				<View style={[styles.activityBox, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}>
					<Feather name='activity' size={16} color={theme.accent} style={{ marginRight: 10, marginTop: 2 }} />
					<Typewriter
						text={smartActivityText}
						delay={40}
						style={{ flex: 1, fontSize: 13, lineHeight: 18, color: theme.text }}
					/>
				</View>
			) : null}
		</ScrollView>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1 },
	headerRow: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		paddingHorizontal: 20,
		marginBottom: 20,
	},
	headerTitle: { fontSize: 22, fontWeight: '700' },
	headerRight: { flexDirection: 'row', alignItems: 'center' },
	headerBtn: {
		width: 36,
		height: 36,
		borderRadius: 18,
		alignItems: 'center',
		justifyContent: 'center',
	},
	activityBox: {
		flexDirection: 'row',
		alignItems: 'flex-start',
		marginHorizontal: 16,
		marginTop: 16,
		padding: 16,
		borderRadius: 16,
		borderWidth: 1,
	}
});
