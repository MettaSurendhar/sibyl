import React from 'react';
import { Text as RNText, StyleSheet } from 'react-native';
import { useTheme } from './ThemeContext';

const FONT_MAP = {
	playfair: {
		normal: 'PlayfairDisplay_500Medium',
		bold: 'PlayfairDisplay_700Bold',
	},
	lora: {
		normal: 'Lora_500Medium',
		bold: 'Lora_700Bold',
	},
	outfit: {
		normal: 'Outfit_500Medium',
		bold: 'Outfit_700Bold',
	},
	inter: {
		normal: 'Inter_500Medium',
		bold: 'Inter_700Bold',
	},
	nunito: {
		normal: 'Nunito_500Medium',
		bold: 'Nunito_700Bold',
	},
};

function getFontFamily(appFont, weight) {
	if (appFont === 'system') return null;
	const map = FONT_MAP[appFont] || FONT_MAP.lora;
	const isBold = weight === 'bold' || weight === '700' || weight === '800' || weight === '900' || weight === '600';
	return isBold ? map.bold : map.normal;
}

export default function Text(props) {
	const { theme, appFont } = useTheme();
	
	let passedWeight = 'normal';
	let cleanedStyle = {};
	
	if (props.style) {
		const flattened = StyleSheet.flatten(props.style) || {};
		if (flattened.fontWeight) {
			passedWeight = String(flattened.fontWeight);
			const { fontWeight, ...rest } = flattened;
			cleanedStyle = rest;
		} else {
			cleanedStyle = flattened;
		}
	}

	const family = getFontFamily(appFont, passedWeight);

	return (
		<RNText 
			{...props} 
			style={[
				{ color: theme.text },
				family ? { fontFamily: family } : { fontWeight: passedWeight !== 'normal' ? passedWeight : undefined },
				cleanedStyle,
			]}
		/>
	);
}
