import React, { useCallback, useState } from 'react';
import { View, Image, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import Text from '../theme/Text';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import { getAllTagCounts, getPieBreakdown } from '../db/categories';
import { getPrefs } from '../utils/settingsStore';
import TagCountBoxes from '../components/home/TagCountBoxes';

export default function TodayScreen({ navigation, onTagPress }) {
	const { theme } = useTheme();
	const insets = useSafeAreaInsets();
	const [tagCounts, setTagCounts] = useState([]);

	const refresh = useCallback(() => {
		getAllTagCounts().then(setTagCounts);
	}, []);

	useFocusEffect(
		useCallback(() => {
			refresh();
		}, [refresh]),
	);

	return (
		<ScrollView
			style={[styles.container, { backgroundColor: theme.bg }]}
			contentContainerStyle={{
				paddingTop: insets.top + 20,
				paddingBottom: insets.bottom + 16,
			}}
			showsVerticalScrollIndicator={false}
		>
			{/* Header: Title + Settings icon */}
			<View style={styles.headerRow}>
				<Image
					source={require('../../assets/header-icon.png')}
					style={styles.headerIcon}
					resizeMode="contain"
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

			{/* Tag count boxes */}
			{/* Tag count boxes */}
			<TagCountBoxes tags={tagCounts} onTagPress={onTagPress} />
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
		marginBottom: 18,
	},
	headerIcon: { width: 180, height: 60, marginLeft: -16 },
	headerRight: { flexDirection: 'row', alignItems: 'center' },
	headerBtn: {
		width: 36,
		height: 36,
		borderRadius: 18,
		alignItems: 'center',
		justifyContent: 'center',
	},
});
