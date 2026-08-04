import React, { useEffect } from 'react';
import { StyleSheet, Dimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
	useSharedValue,
	useAnimatedStyle,
	withSpring,
	runOnJS,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import { getPrefs, setPrefs } from '../utils/settingsStore';

const BUTTON_SIZE = 60;
const MARGIN = 16;

// Persistent record button rendered once above the Home<->Library pager (see
// HomeLibraryPager.js) so it survives swiping between the two pages instead of being
// per-screen, per the "record only reachable via floating icon" spec.
//
// Gesture behavior: a quick tap opens Record. A press held past ~350ms arms dragging
// (with a haptic tick to confirm), after which moving your finger repositions the button;
// releasing snaps it fully on-screen and remembers the new spot for next launch. Tap and
// long-press-drag are composed as a Race so a normal tap can never accidentally trigger a
// drag, and a drag can never accidentally fire onPress.
export default function FloatingRecordButton({ onPress, bottomOffset = 24 }) {
	const { theme } = useTheme();
	const insets = useSafeAreaInsets();
	const { width: screenW, height: screenH } = Dimensions.get('window');

	const defaultX = screenW - BUTTON_SIZE - MARGIN;
	const defaultY = screenH - BUTTON_SIZE - MARGIN - bottomOffset;

	const translateX = useSharedValue(defaultX);
	const translateY = useSharedValue(defaultY);
	const startX = useSharedValue(defaultX);
	const startY = useSharedValue(defaultY);
	const isDragging = useSharedValue(false);

	// Restore any remembered position once on mount.
	useEffect(() => {
		getPrefs().then((prefs) => {
			if (prefs.fabPosition) {
				translateX.value = prefs.fabPosition.x;
				translateY.value = prefs.fabPosition.y;
			}
		});
	}, []);

	function persistPosition(x, y) {
		setPrefs({ fabPosition: { x, y } });
	}

	function hapticStart() {
		Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
	}

	const clampX = (x) => {
		'worklet';
		return Math.max(MARGIN, Math.min(screenW - BUTTON_SIZE - MARGIN, x));
	};
	const clampY = (y) => {
		'worklet';
		return Math.max(
			insets.top + MARGIN,
			Math.min(screenH - BUTTON_SIZE - MARGIN - bottomOffset, y),
		);
	};

	const longPress = Gesture.LongPress()
		.minDuration(350)
		.onStart(() => {
			isDragging.value = true;
			startX.value = translateX.value;
			startY.value = translateY.value;
			runOnJS(hapticStart)();
		});

	const pan = Gesture.Pan()
		.onUpdate((e) => {
			if (!isDragging.value) return;
			translateX.value = startX.value + e.translationX;
			translateY.value = startY.value + e.translationY;
		})
		.onEnd(() => {
			if (!isDragging.value) return;
			const clampedX = clampX(translateX.value);
			const clampedY = clampY(translateY.value);
			translateX.value = withSpring(clampedX);
			translateY.value = withSpring(clampedY);
			isDragging.value = false;
			runOnJS(persistPosition)(clampedX, clampedY);
		});

	// maxDuration keeps a held-down finger from also being read as a tap once the long
	// press has had time to arm dragging - the two gestures should never both fire.
	const tap = Gesture.Tap()
		.maxDuration(250)
		.onEnd((_, success) => {
			if (success) runOnJS(onPress)();
		});

	const composed = Gesture.Race(tap, Gesture.Simultaneous(longPress, pan));

	const animatedStyle = useAnimatedStyle(() => ({
		transform: [
			{ translateX: translateX.value },
			{ translateY: translateY.value },
		],
	}));

	return (
		<GestureDetector gesture={composed}>
			<Animated.View
				style={[styles.fab, { backgroundColor: theme.accent }, animatedStyle]}
			>
				<Feather
					name='mic'
					size={26}
					color='#fff'
				/>
			</Animated.View>
		</GestureDetector>
	);
}

const styles = StyleSheet.create({
	fab: {
		position: 'absolute',
		width: BUTTON_SIZE,
		height: BUTTON_SIZE,
		borderRadius: BUTTON_SIZE / 2,
		alignItems: 'center',
		justifyContent: 'center',
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 4 },
		shadowOpacity: 0.3,
		shadowRadius: 6,
		elevation: 6,
		zIndex: 20,
	},
});
