import React from 'react';
import { View, ScrollView, Dimensions, StyleSheet } from 'react-native';
import TodayScreen from '../screens/TodayScreen';
import LibraryScreen from '../screens/LibraryScreen';
import FloatingRecordButton from '../components/FloatingRecordButton';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Replaces the old bottom-tab shell (previously BottomTabs.js) with a two-page horizontal
// swipe: Home on the left, Library on the right - swiping right-to-left reveals Library,
// matching the spec. This is the single 'Main' stack screen registered in App.js, so
// TodayScreen/LibraryScreen are rendered as plain children here (not their own routes) and
// simply share this screen's `navigation` object - both already only call
// navigation.navigate(...) for sibling stack screens (Playback, Settings, Record, etc.),
// so nothing about their own navigation calls needed to change.
//
// Record is deliberately NOT a page in this pager - it's only reachable through the
// floating record button below, which lives at this level (outside the ScrollView) so it
// stays fixed on screen while swiping between Home and Library instead of belonging to
// either page.
export default function HomeLibraryPager({ navigation }) {
	return (
		<View style={styles.container}>
			<ScrollView
				horizontal
				pagingEnabled
				showsHorizontalScrollIndicator={false}
				bounces={false}
				decelerationRate='fast'
			>
				<View style={{ width: SCREEN_WIDTH }}>
					<TodayScreen navigation={navigation} />
				</View>
				<View style={{ width: SCREEN_WIDTH }}>
					<LibraryScreen navigation={navigation} />
				</View>
			</ScrollView>

			<FloatingRecordButton onPress={() => navigation.navigate('Record')} />
		</View>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1 },
});
