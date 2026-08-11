import React, { useCallback, useRef, useState, useEffect } from 'react';
import {
	View,
	ScrollView,
	TouchableOpacity,
	Dimensions,
	StyleSheet,
	BackHandler,
	Animated,
} from 'react-native';
import Text from '../theme/Text';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import TodayScreen from '../screens/TodayScreen';
import LibraryScreen from '../screens/LibraryScreen';
import FloatingRecordButton from '../components/FloatingRecordButton';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const TAB_WIDTH = SCREEN_WIDTH / 2;

const TABS = [
	{ key: 'home', label: 'Home', icon: 'home' },
	{ key: 'library', label: 'Library', icon: 'headphones' },
];

// Home<->Library shell: swiping (right-to-left reveals Library) AND the bottom nav bar both
// work and stay in sync with each other. The tab bar has an animated sliding pill indicator
// that follows the user's finger in real time (native thread via Animated.event) and a
// spring-bounce scale on the active icon when the page changes.
export default function HomeLibraryPager({ navigation, route }) {
	const { theme } = useTheme();
	const insets = useSafeAreaInsets();
	const scrollRef = useRef(null);
	const [activeIndex, setActiveIndex] = useState(0);
	const [libraryEditMode, setLibraryEditMode] = useState(false);
	const [libraryInitialFilter, setLibraryInitialFilter] = useState(null);

	// Drives tab-bar slide animation from actual scroll position (native thread)
	const scrollX = useRef(new Animated.Value(0)).current;

	// Per-tab icon scale springs
	const tabScales = useRef(TABS.map((_, i) => new Animated.Value(i === 0 ? 1 : 0.85))).current;

	const slideAnim = useRef(new Animated.Value(0)).current;

	useEffect(() => {
		Animated.timing(slideAnim, {
			toValue: libraryEditMode ? 1 : 0,
			duration: 250,
			useNativeDriver: false,
		}).start();
	}, [libraryEditMode]);

	// Spring-bounce the active tab icon whenever activeIndex changes
	useEffect(() => {
		TABS.forEach((_, i) => {
			Animated.spring(tabScales[i], {
				toValue: activeIndex === i ? 1 : 0.85,
				useNativeDriver: true,
				tension: 120,
				friction: 7,
			}).start();
		});
	}, [activeIndex]);

	const goToPage = useCallback((index) => {
		scrollRef.current?.scrollTo({ x: index * SCREEN_WIDTH, animated: true });
		setActiveIndex(index);
	}, []);

	const goToLibraryWithFilter = useCallback((categoryId) => {
		setLibraryInitialFilter({ tagIds: [categoryId], datePreset: null, customRange: null });
		goToPage(1);
	}, [goToPage]);

	// RecordScreen can ask to land on a specific page after navigating back here.
	useFocusEffect(
		useCallback(() => {
			if (route.params?.initialPage != null) {
				goToPage(route.params.initialPage);
				navigation.setParams({ initialPage: undefined });
			}
		}, [route.params?.initialPage, goToPage, navigation]),
	);

	// Handle back press to exit library edit mode
	useFocusEffect(
		useCallback(() => {
			const sub = BackHandler.addEventListener('hardwareBackPress', () => {
				if (libraryEditMode) {
					setLibraryEditMode(false);
					return true;
				}
				return false;
			});
			return () => sub.remove();
		}, [libraryEditMode]),
	);

	const onMomentumScrollEnd = useCallback((e) => {
		const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
		setActiveIndex(index);
	}, []);

	const tabBarHeight = 56 + insets.bottom;

	// Indicator slides from left tab to right tab following the scroll in real time
	const indicatorTranslateX = scrollX.interpolate({
		inputRange: [0, SCREEN_WIDTH],
		outputRange: [TAB_WIDTH * 0.15, TAB_WIDTH + TAB_WIDTH * 0.15],
		extrapolate: 'clamp',
	});

	return (
		<View style={styles.container}>
			<Animated.ScrollView
				ref={scrollRef}
				horizontal
				pagingEnabled
				showsHorizontalScrollIndicator={false}
				bounces={false}
				decelerationRate='fast'
				onMomentumScrollEnd={onMomentumScrollEnd}
				scrollEventThrottle={16}
				onScroll={Animated.event(
					[{ nativeEvent: { contentOffset: { x: scrollX } } }],
					{ useNativeDriver: true },
				)}
			>
				<View style={{ width: SCREEN_WIDTH }}>
					<TodayScreen navigation={navigation} onTagPress={goToLibraryWithFilter} />
				</View>
				<View style={{ width: SCREEN_WIDTH }}>
					<LibraryScreen
						navigation={navigation}
						isEditMode={libraryEditMode}
						onEditModeChange={setLibraryEditMode}
						initialFilter={libraryInitialFilter}
						onFilterConsumed={() => setLibraryInitialFilter(null)}
					/>
				</View>
			</Animated.ScrollView>

			<Animated.View
				style={[
					styles.tabBar,
					{
						height: tabBarHeight,
						paddingBottom: insets.bottom,
						backgroundColor: theme.surface,
						borderTopColor: theme.border,
						marginBottom: slideAnim.interpolate({
							inputRange: [0, 1],
							outputRange: [0, -tabBarHeight],
						}),
					},
				]}
				pointerEvents={libraryEditMode ? 'none' : 'auto'}
			>
				{/* Sliding accent indicator pill at the top of the tab bar */}
				<Animated.View
					style={[
						styles.tabIndicator,
						{
							backgroundColor: theme.accent,
							transform: [{ translateX: indicatorTranslateX }],
						},
					]}
					pointerEvents="none"
				/>

				{TABS.map((tab, index) => {
					const active = activeIndex === index;
					const color = active ? theme.accent : theme.textMuted;
					return (
						<TouchableOpacity
							key={tab.key}
							style={styles.tabItem}
							onPress={() => goToPage(index)}
						>
							<Animated.View style={{ transform: [{ scale: tabScales[index] }] }}>
								<Feather name={tab.icon} size={22} color={color} />
							</Animated.View>
							<Text style={[styles.tabLabel, { color }]}>{tab.label}</Text>
						</TouchableOpacity>
					);
				})}
			</Animated.View>

			<FloatingRecordButton
				onPress={() => navigation.navigate('Record')}
				bottomOffset={tabBarHeight + 16}
				visible={!libraryEditMode}
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
	tabIndicator: {
		position: 'absolute',
		top: 0,
		width: TAB_WIDTH * 0.7,
		height: 2.5,
		borderRadius: 2,
	},
});
