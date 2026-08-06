import React, { useRef, useEffect, useState } from 'react';
import { View, TouchableWithoutFeedback, Animated, StyleSheet } from 'react-native';
import Text from '../../theme/Text';
import { useTheme } from '../../theme/ThemeContext';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { iconForCategory } from '../../utils/tagColors';

function AnimatedTagBox({ tag, onTagPress }) {
	const { theme } = useTheme();
	const scale = useRef(new Animated.Value(1)).current;
	const [displayCount, setDisplayCount] = useState(0);

	useEffect(() => {
		if (tag.count === 0) {
			setDisplayCount(0);
			return;
		}
		
		let current = 0;
		const target = tag.count;
		const duration = 600;
		const stepTime = Math.max(20, Math.floor(duration / target));
		
		const timer = setInterval(() => {
			current += Math.max(1, Math.floor(target / 15));
			if (current >= target) {
				setDisplayCount(target);
				clearInterval(timer);
			} else {
				setDisplayCount(current);
			}
		}, stepTime);
		
		return () => clearInterval(timer);
	}, [tag.count]);

	const handlePressIn = () => {
		Animated.spring(scale, {
			toValue: 0.95,
			useNativeDriver: true,
		}).start();
	};

	const handlePressOut = () => {
		Animated.spring(scale, {
			toValue: 1,
			useNativeDriver: true,
		}).start();
	};

	return (
		<TouchableWithoutFeedback
			onPress={() => onTagPress && onTagPress(tag.id)}
			onPressIn={handlePressIn}
			onPressOut={handlePressOut}
		>
			<Animated.View
				style={[
					styles.box,
					{
						transform: [{ scale }],
						backgroundColor: theme.surface,
						borderColor: theme.border,
						borderTopColor: tag.color,
					},
				]}
			>
				<MaterialCommunityIcons
					name={iconForCategory(tag)}
					size={18}
					color={theme.accent}
					style={{ position: 'absolute', top: 12, left: 12 }}
				/>
				{tag.count === 0 ? (
					<Text style={[styles.emptyText, { color: theme.textMuted, marginTop: 16 }]} numberOfLines={2}>
						Start your first {tag.name.toLowerCase()}
					</Text>
				) : (
					<View style={{ alignItems: 'center', marginTop: 10 }}>
						<Text style={[styles.count, { color: theme.text }]}>{displayCount}</Text>
						<Text
							style={[styles.name, { color: theme.textMuted, marginTop: 4 }]}
							numberOfLines={1}
						>
							{tag.name}
						</Text>
					</View>
				)}
			</Animated.View>
		</TouchableWithoutFeedback>
	);
}

export default function TagCountBoxes({ tags, onTagPress }) {
	const { theme } = useTheme();
	if (!tags.length) return null;

	return (
		<View style={styles.grid}>
			{tags.map((tag) => (
				<AnimatedTagBox key={tag.id ?? 'untagged'} tag={tag} onTagPress={onTagPress} />
			))}
		</View>
	);
}

const styles = StyleSheet.create({
	grid: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		paddingHorizontal: 16,
		marginBottom: 8,
	},
	box: {
		width: '46%',
		margin: '2%',
		borderRadius: 16,
		borderWidth: 1,
		borderTopWidth: 6,
		padding: 16,
		alignItems: 'center',
		justifyContent: 'center',
	},
	count: { fontSize: 34, fontWeight: '800' },
	name: { fontSize: 12, fontWeight: '600' },
	emptyText: {
		fontSize: 11,
		fontWeight: '500',
		textAlign: 'center',
		marginTop: 6,
		fontStyle: 'italic',
		paddingHorizontal: 4,
	}
});
