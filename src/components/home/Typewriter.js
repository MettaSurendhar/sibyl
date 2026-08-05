import React, { useState, useEffect, useRef } from 'react';
import Text from '../../theme/Text';
import { useTheme } from '../../theme/ThemeContext';

export default function Typewriter({ text, delay = 50, style }) {
	const [displayedText, setDisplayedText] = useState('');
	const { theme } = useTheme();
	const textRef = useRef(text);
	
	useEffect(() => {
		textRef.current = text;
		setDisplayedText('');
		if (!text) return;

		let i = 0;
		const timer = setInterval(() => {
			setDisplayedText(textRef.current.substring(0, i + 1));
			i++;
			if (i >= textRef.current.length) {
				clearInterval(timer);
			}
		}, delay);

		return () => clearInterval(timer);
	}, [text, delay]);

	return <Text style={[{ color: theme.textMuted }, style]}>{displayedText}</Text>;
}
