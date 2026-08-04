import React, { createContext, useCallback, useContext, useState } from 'react';
import { Modal, View, TouchableOpacity, StyleSheet } from 'react-native';
import Text from './Text';
import { useTheme } from './ThemeContext';

const AlertContext = createContext(() => {});

export function useAlert() {
	return useContext(AlertContext);
}

// Themed drop-in replacement for React Native's Alert.alert(title, message, buttons). Same call
// signature, so any `Alert.alert(...)` call site can switch to `alert(...)` (from useAlert())
// with no other changes - the only thing wrong with the native version was that it renders as
// the OS's unstyled system dialog instead of matching the app's theme. Mount <AlertProvider>
// once near the root (inside ThemeProvider), then call useAlert() from any screen.
export function AlertProvider({ children }) {
	const { theme } = useTheme();
	const [state, setState] = useState(null); // { title, message, buttons } | null

	const alert = useCallback((title, message, buttons) => {
		const finalButtons = buttons && buttons.length ? buttons : [{ text: 'OK' }];
		setState({ title, message, buttons: finalButtons });
	}, []);

	function press(btn) {
		setState(null);
		btn.onPress && btn.onPress();
	}

	// Mirrors native Alert's Android back-button/gesture behavior: trigger the cancel-styled
	// button if one exists, otherwise just dismiss.
	function handleRequestClose() {
		const cancelBtn = state?.buttons.find((b) => b.style === 'cancel');
		if (cancelBtn) press(cancelBtn);
		else setState(null);
	}

	return (
		<AlertContext.Provider value={alert}>
			{children}
			<Modal
				visible={!!state}
				transparent
				animationType='fade'
				onRequestClose={handleRequestClose}
			>
				<View style={styles.backdrop}>
					<View style={[styles.card, { backgroundColor: theme.surface }]}>
						{!!state?.title && (
							<Text style={[styles.title, { color: theme.text }]}>
								{state.title}
							</Text>
						)}
						{!!state?.message && (
							<Text style={[styles.message, { color: theme.textMuted }]}>
								{state.message}
							</Text>
						)}
						<View style={styles.row}>
							{(state?.buttons || []).map((b, i) => (
								<TouchableOpacity
									key={i}
									onPress={() => press(b)}
									style={[
										styles.btn,
										{
											backgroundColor:
												b.style === 'destructive'
													? '#E5605A'
													: b.style === 'cancel'
														? theme.surfaceAlt
														: theme.accent,
										},
									]}
								>
									<Text
										style={{
											color: b.style === 'cancel' ? theme.text : '#fff',
											fontWeight: b.style === 'cancel' ? '600' : '700',
										}}
									>
										{b.text}
									</Text>
								</TouchableOpacity>
							))}
						</View>
					</View>
				</View>
			</Modal>
		</AlertContext.Provider>
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
	card: { width: '100%', maxWidth: 380, borderRadius: 16, padding: 22 },
	title: { fontSize: 17, fontWeight: '700', marginBottom: 8 },
	message: { fontSize: 14, lineHeight: 20 },
	row: { flexDirection: 'row', gap: 12, marginTop: 20 },
	btn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
});
