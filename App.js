import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
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
			<View
				style={{
					flex: 1,
					alignItems: 'center',
					justifyContent: 'center',
					backgroundColor: theme.bg,
				}}
			>
				<ActivityIndicator color={theme.accent} />
			</View>
		);
	}

	return (
		<NavigationContainer>
			<StatusBar style={theme.isDark ? 'light' : 'dark'} />
			<Stack.Navigator screenOptions={{ headerShown: false }}>
				<Stack.Screen
					name='Main'
					component={HomeLibraryPager}
				/>
				<Stack.Screen
					name='Record'
					component={RecordScreen}
					options={{ presentation: 'modal' }}
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
			</Stack.Navigator>
		</NavigationContainer>
	);
}

export default function App() {
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
