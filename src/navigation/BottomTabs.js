import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import TodayScreen from '../screens/TodayScreen';
import RecordScreen from '../screens/RecordScreen';
import LibraryScreen from '../screens/LibraryScreen';

const Tab = createBottomTabNavigator();

const TAB_ICONS = {
	Today: 'sun',
	Record: 'mic',
	Library: 'headphones',
};

export default function BottomTabs() {
	const { theme } = useTheme();

	return (
		<Tab.Navigator
			initialRouteName='Today'
			screenOptions={({ route }) => ({
				headerShown: false,
				tabBarActiveTintColor: theme.accent,
				tabBarInactiveTintColor: theme.textMuted,
				tabBarStyle: {
					backgroundColor: theme.surface,
					borderTopColor: theme.border,
				},
				tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
				tabBarIcon: ({ color, size }) => (
					<Feather
						name={TAB_ICONS[route.name] ?? 'circle'}
						size={size ?? 22}
						color={color}
					/>
				),
			})}
		>
			<Tab.Screen
				name='Today'
				component={TodayScreen}
			/>
			<Tab.Screen
				name='Record'
				component={RecordScreen}
			/>
			<Tab.Screen
				name='Library'
				component={LibraryScreen}
			/>
		</Tab.Navigator>
	);
}
