import React, { useState } from 'react';
import { Modal, View, TouchableOpacity, StyleSheet } from 'react-native';
import Text from '../theme/Text';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';

// A small (i) icon that opens a dismissable popover with explanatory text, instead of showing
// a permanent paragraph inline. title/children are only rendered once tapped.
export default function InfoPopover({ title, children }) {
	const { theme } = useTheme();
	const [visible, setVisible] = useState(false);

	return (
		<>
			<TouchableOpacity
				onPress={() => setVisible(true)}
				hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
			>
				<Feather
					name='info'
					size={16}
					color={theme.textMuted}
				/>
			</TouchableOpacity>

			<Modal
				visible={visible}
				transparent
				animationType='fade'
				onRequestClose={() => setVisible(false)}
			>
				<TouchableOpacity
					style={styles.backdrop}
					activeOpacity={1}
					onPress={() => setVisible(false)}
				>
					<View style={[styles.card, { backgroundColor: theme.surface }]}>
						{title ? (
							<Text style={[styles.title, { color: theme.text }]}>{title}</Text>
						) : null}
						<Text style={[styles.body, { color: theme.textMuted }]}>
							{children}
						</Text>
						<TouchableOpacity
							onPress={() => setVisible(false)}
							style={[styles.closeBtn, { backgroundColor: theme.surfaceAlt }]}
						>
							<Text style={{ color: theme.text, fontWeight: '600' }}>
								Got it
							</Text>
						</TouchableOpacity>
					</View>
				</TouchableOpacity>
			</Modal>
		</>
	);
}

const styles = StyleSheet.create({
	backdrop: {
		flex: 1,
		backgroundColor: 'rgba(0,0,0,0.55)',
		alignItems: 'center',
		justifyContent: 'center',
		padding: 24,
	},
	card: { width: '100%', maxWidth: 380, borderRadius: 16, padding: 20 },
	title: { fontSize: 15, fontWeight: '700', marginBottom: 8 },
	body: { fontSize: 13.5, lineHeight: 20 },
	closeBtn: {
		marginTop: 16,
		paddingVertical: 10,
		borderRadius: 10,
		alignItems: 'center',
	},
});
