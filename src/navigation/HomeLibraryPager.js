import React, { useCallback, useRef, useState } from 'react';
import {
	View,
	Text,
	ScrollView,
	TouchableOpacity,
	Dimensions,
	StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import TodayScreen from '../screens/TodayScreen';
import LibraryScreen from '../screens/LibraryScreen';
import FloatingRecordButton from '../components/FloatingRecordButton';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const TABS = [
	{ key: 'home', label: 'Today', icon: 'sun' },
	{ key: 'library', label: 'Library', icon: 'headphones' },
];

// Home<->Library shell: swiping (right-to-left reveals Library) AND the bottom nav bar both
// work and stay in sync with each other, per the "swipe or use bottom nav" spec. This is
// the single 'Main' stack screen registered in App.js - TodayScreen/LibraryScreen are
// rendered as plain children here (not their own routes) and share this screen's
// `navigation` object, since both already only call navigation.navigate(...) for sibling
// stack screens (Playback, Settings, Record, etc.).
//
// Record is deliberately NOT a page or a nav-bar tab - it's only reachable through the
// floating record button, which lives at this level so it stays fixed on screen (above the
// nav bar) while swiping between Home and Library instead of belonging to either page.
export default function HomeLibraryPager({ navigation }) {
	const { theme } = useTheme();
	const insets = useSafeAreaInsets();
	const scrollRef = useRef(null);
	const [activeIndex, setActiveIndex] = useState(0);

	const goToPage = useCallback((index) => {
		scrollRef.current?.scrollTo({ x: index * SCREEN_WIDTH, animated: true });
		setActiveIndex(index);
	}, []);

	const onMomentumScrollEnd = useCallback((e) => {
		const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
		setActiveIndex(index);
	}, []);

	const tabBarHeight = 56 + insets.bottom;

	return (
		<View style={styles.container}>
			<ScrollView
				ref={scrollRef}
				horizontal
				pagingEnabled
				showsHorizontalScrollIndicator={false}
				bounces={false}
				decelerationRate='fast'
				onMomentumScrollEnd={onMomentumScrollEnd}
			>
				<View style={{ width: SCREEN_WIDTH }}>
					<TodayScreen navigation={navigation} />
				</View>
				<View style={{ width: SCREEN_WIDTH }}>
					<LibraryScreen navigation={navigation} />
				</View>
			</ScrollView>

			<View
				style={[
					styles.tabBar,
					{
						height: tabBarHeight,
						paddingBottom: insets.bottom,
						backgroundColor: theme.surface,
						borderTopColor: theme.border,
					},
				]}
			>
				{TABS.map((tab, index) => {
					const active = activeIndex === index;
					const color = active ? theme.accent : theme.textMuted;
					return (
						<TouchableOpacity
							key={tab.key}
							style={styles.tabItem}
							onPress={() => goToPage(index)}
						>
							<Feather
								name={tab.icon}
								size={22}
								color={color}
							/>
							<Text style={[styles.tabLabel, { color }]}>{tab.label}</Text>
						</TouchableOpacity>
					);
				})}
			</View>

			<FloatingRecordButton
				onPress={() => navigation.navigate('Record')}
				bottomOffset={tabBarHeight + 16}
			/>
		</View>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1 },
	tabBar: {
		flexDirection: 'row',
		borderTopWidth: StyleSheet.hairlineWidth,
	},
	tabItem: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
		paddingTop: 8,
	},
	tabLabel: { fontSize: 11, fontWeight: '600', marginTop: 2 },
});
