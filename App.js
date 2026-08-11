import React, { useEffect, useState } from 'react';
import { View, Image, StyleSheet, ActivityIndicator } from 'react-native';
import { useFonts, PlayfairDisplay_400Regular, PlayfairDisplay_500Medium, PlayfairDisplay_600SemiBold, PlayfairDisplay_700Bold } from '@expo-google-fonts/playfair-display';
import { Lora_400Regular, Lora_500Medium, Lora_600SemiBold, Lora_700Bold } from '@expo-google-fonts/lora';
import { Outfit_400Regular, Outfit_500Medium, Outfit_600SemiBold, Outfit_700Bold } from '@expo-google-fonts/outfit';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { Nunito_400Regular, Nunito_500Medium, Nunito_600SemiBold, Nunito_700Bold } from '@expo-google-fonts/nunito';
import { DancingScript_400Regular, DancingScript_500Medium, DancingScript_600SemiBold, DancingScript_700Bold } from '@expo-google-fonts/dancing-script';

// Font loaded globally via src/theme/Text component
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { ThemeProvider, useTheme } from './src/theme/ThemeContext';
import { AlertProvider } from './src/theme/AlertContext';
import { getDb } from './src/db/database';
import HomeLibraryPager from './src/navigation/HomeLibraryPager';
import RecordScreen from './src/screens/RecordScreen';
import PlaybackScreen from './src/screens/PlaybackScreen';
import CategoriesScreen from './src/screens/CategoriesScreen';
import TrimScreen from './src/screens/TrimScreen';
import MergeScreen from './src/screens/MergeScreen';
import AppendScreen from './src/screens/AppendScreen';
import AnalyticsScreen from './src/screens/AnalyticsScreen';
import SettingsHomeScreen from './src/screens/settings/SettingsHomeScreen';
import RecordingSettingsScreen from './src/screens/settings/RecordingSettingsScreen';
import NamingTagsSettingsScreen from './src/screens/settings/NamingTagsSettingsScreen';
import AppearanceSettingsScreen from './src/screens/settings/AppearanceSettingsScreen';
import TranscriptionSettingsScreen from './src/screens/settings/TranscriptionSettingsScreen';
import AboutSettingsScreen from './src/screens/settings/AboutSettingsScreen';

const Stack = createNativeStackNavigator();

function Root() {
	const { theme } = useTheme();
	const [dbReady, setDbReady] = useState(false);

	useEffect(() => {
		getDb().then(() => setDbReady(true));
	}, []);

	if (!dbReady) {
		return (
			<View style={styles.splash}>
				<Image
					source={require('./assets/splash.png')}
					style={styles.splashImg}
					resizeMode="contain"
				/>
			</View>
		);
	}

	return (
		<NavigationContainer>
			<StatusBar style={theme.isDark ? 'light' : 'dark'} />
			<Stack.Navigator
				screenOptions={{
					headerShown: false,
					animation: 'slide_from_right',
					animationDuration: 280,
					contentStyle: { backgroundColor: theme.bg },
				}}
			>
				<Stack.Screen
					name='Main'
					component={HomeLibraryPager}
					options={{ animation: 'none' }}
				/>
				<Stack.Screen
					name='Record'
					component={RecordScreen}
					options={{ animation: 'slide_from_bottom', animationDuration: 320 }}
				/>
				<Stack.Screen
					name='Playback'
					component={PlaybackScreen}
				/>
				<Stack.Screen
					name='Settings'
					component={SettingsHomeScreen}
				/>
				<Stack.Screen
					name='RecordingSettings'
					component={RecordingSettingsScreen}
				/>
				<Stack.Screen
					name='NamingTagsSettings'
					component={NamingTagsSettingsScreen}
				/>
				<Stack.Screen
					name='AppearanceSettings'
					component={AppearanceSettingsScreen}
				/>
				<Stack.Screen
					name='TranscriptionSettings'
					component={TranscriptionSettingsScreen}
				/>
				<Stack.Screen
					name='AboutSettings'
					component={AboutSettingsScreen}
				/>
				<Stack.Screen
					name='Categories'
					component={CategoriesScreen}
				/>
				<Stack.Screen
					name='Trim'
					component={TrimScreen}
				/>
				<Stack.Screen
					name='Merge'
					component={MergeScreen}
				/>
				<Stack.Screen
					name='Append'
					component={AppendScreen}
				/>
				<Stack.Screen
					name='Analytics'
					component={AnalyticsScreen}
				/>
			</Stack.Navigator>
		</NavigationContainer>
	);
}

export default function App() {
	const [fontsLoaded] = useFonts({
		PlayfairDisplay_400Regular, PlayfairDisplay_500Medium, PlayfairDisplay_600SemiBold, PlayfairDisplay_700Bold,
		Lora_400Regular, Lora_500Medium, Lora_600SemiBold, Lora_700Bold,
		Outfit_400Regular, Outfit_500Medium, Outfit_600SemiBold, Outfit_700Bold,
		Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold,
		Nunito_400Regular, Nunito_500Medium, Nunito_600SemiBold, Nunito_700Bold,
		DancingScript_400Regular, DancingScript_500Medium, DancingScript_600SemiBold, DancingScript_700Bold
	});

	if (!fontsLoaded) return null;

	return (
		<GestureHandlerRootView style={{ flex: 1 }}>
			<ThemeProvider>
				<AlertProvider>
					<Root />
				</AlertProvider>
			</ThemeProvider>
		</GestureHandlerRootView>
	);
}

const styles = StyleSheet.create({
	splash: {
		flex: 1,
		backgroundColor: '#0E1926',
		alignItems: 'center',
		justifyContent: 'center',
	},
	splashImg: {
		width: '80%',
		height: '80%',
	},
});
