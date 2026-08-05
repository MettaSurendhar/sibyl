import React from 'react';
import { ScrollView, TouchableOpacity, StyleSheet, View, Modal } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Text from '../../theme/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';
import SettingsHeader from '../../components/SettingsHeader';
import { SettingsSection } from '../../components/SettingsNavRow';
import InfoPopover from '../../components/InfoPopover';

const PRIVACY_TEXT = `Your privacy is our absolute priority.\n\nSibyl is a local-first application. We do not collect, store, or share any of your personal data, recordings, or transcripts.\n\nAll data is kept strictly on your local device storage. If you choose to use the external folder saving feature, your recordings are saved to a public folder on your device that other apps may access.\n\nTranscription Feature:\nIf you configure a Groq API key, your audio data is sent directly from your device to Groq's servers solely for the purpose of generating a transcript, and is subject to Groq's privacy policy. We do not intermediate this connection.`;

const TERMS_TEXT = `By using Sibyl, you agree that the app is provided "as is" and "as available" without any warranties of any kind.\n\nWe are not responsible for any lost data, recordings, or transcripts. We recommend you regularly back up your recordings using the external folder feature.\n\nYou are solely responsible for the content of your recordings and for ensuring you have the right to record the audio you capture.`;

const OSS_TEXT = `Sibyl is built using incredible open-source software, including:\n\n• React Native\n• Expo\n• FFMpeg Kit\n• React Native Reanimated\n• React Native Gesture Handler\n• React Navigation\n\nFull license details for these and other dependencies can be found in the source code repository.`;

export default function AboutSettingsScreen({ navigation }) {
	const { theme } = useTheme();
	const insets = useSafeAreaInsets();
	const [legalModal, setLegalModal] = React.useState({ visible: false, title: '', text: '' });

	const openLegal = (title, text) => {
		setLegalModal({ visible: true, title, text });
	};

	return (
		<View style={{ flex: 1, backgroundColor: theme.bg }}>
			<ScrollView contentContainerStyle={{ padding: 20, paddingTop: insets.top + 16 }}>
				<SettingsHeader
					title='About'
					onBack={() => navigation.goBack()}
				/>

				<SettingsSection
					title='About'
					right={
						<InfoPopover title='Local-first architecture'>
							{`• All recordings and metadata stay strictly on your device\n• We do not sync, store, or have access to your data\n• Deleting the app deletes your data permanently (unless you use the external saving folder option)`}
						</InfoPopover>
					}
				>
					<Text style={{ color: theme.textMuted }}>Sibyl — v1.0.0</Text>
					<Text
						style={{ color: theme.textMuted, fontStyle: 'italic', marginTop: 2, marginBottom: 12 }}
					>
						speak, and be remembered
					</Text>
				</SettingsSection>

				<SettingsSection title='Audio Format'>
					<Text style={{ color: theme.text, fontWeight: '600', marginBottom: 6 }}>
						AAC / M4A (.m4a)
					</Text>
					<Text style={{ color: theme.textMuted, lineHeight: 22, marginBottom: 12 }}>
						Sibyl records all audio in AAC format, stored in an M4A container. This is the only format natively supported by Android's built-in recording hardware, so there is no format choice — it's what your device's microphone produces directly.
					</Text>
					<Text style={{ color: theme.accent, fontWeight: '600', marginBottom: 4 }}>
						✓ Advantages
					</Text>
					<Text style={{ color: theme.textMuted, lineHeight: 22, marginBottom: 12 }}>
						{`• Excellent audio quality at small file sizes (lossy but near-lossless at high bitrates)\n• Universally supported — plays natively on Android, iOS, Windows, macOS, and all major media apps\n• Fast to record and save — no post-processing needed\n• Ideal for voice: optimised for speech frequencies`}
					</Text>
					<Text style={{ color: theme.textMuted, fontWeight: '600', marginBottom: 4 }}>
						✗ Trade-offs
					</Text>
					<Text style={{ color: theme.textMuted, lineHeight: 22 }}>
						{`• Lossy compression — original audio waveform is not preserved bit-for-bit (imperceptible for voice journaling)\n• Not editable in some older audio workstations that only accept WAV/MP3`}
					</Text>
				</SettingsSection>

				<SettingsSection title='Legal'>
					<TouchableOpacity 
						style={[styles.optionRow, { borderColor: theme.border }]}
						onPress={() => openLegal('Privacy Policy', PRIVACY_TEXT)}
					>
						<Text style={{ color: theme.text, flex: 1 }}>Privacy Policy</Text>
						<Feather name="chevron-right" size={18} color={theme.textMuted} />
					</TouchableOpacity>
					<TouchableOpacity 
						style={[styles.optionRow, { borderColor: theme.border }]}
						onPress={() => openLegal('Terms of Service', TERMS_TEXT)}
					>
						<Text style={{ color: theme.text, flex: 1 }}>Terms of Service</Text>
						<Feather name="chevron-right" size={18} color={theme.textMuted} />
					</TouchableOpacity>
					<TouchableOpacity 
						style={[styles.optionRow, { borderColor: theme.border }]}
						onPress={() => openLegal('Open Source Licenses', OSS_TEXT)}
					>
						<Text style={{ color: theme.text, flex: 1 }}>Open Source Licenses</Text>
						<Feather name="chevron-right" size={18} color={theme.textMuted} />
					</TouchableOpacity>
				</SettingsSection>
			</ScrollView>

			<Modal
				visible={legalModal.visible}
				animationType="slide"
				transparent
				onRequestClose={() => setLegalModal({ ...legalModal, visible: false })}
			>
				<View style={styles.modalBackdrop}>
					<View style={[styles.modalSheet, { backgroundColor: theme.surface, paddingBottom: insets.bottom + 20 }]}>
						<View style={styles.modalHeader}>
							<Text style={[styles.modalTitle, { color: theme.text }]}>{legalModal.title}</Text>
							<TouchableOpacity onPress={() => setLegalModal({ ...legalModal, visible: false })}>
								<Feather name="x" size={24} color={theme.textMuted} />
							</TouchableOpacity>
						</View>
						<ScrollView style={{ maxHeight: 500 }} showsVerticalScrollIndicator={false}>
							<Text style={{ color: theme.text, fontSize: 15, lineHeight: 24 }}>
								{legalModal.text}
							</Text>
						</ScrollView>
					</View>
				</View>
			</Modal>
		</View>
	);
}

const styles = StyleSheet.create({
	optionRow: {
		flexDirection: 'row',
		alignItems: 'center',
		borderWidth: 1,
		borderRadius: 12,
		padding: 12,
		marginBottom: 8,
	},
	modalBackdrop: {
		flex: 1,
		backgroundColor: 'rgba(0,0,0,0.5)',
		justifyContent: 'flex-end',
	},
	modalSheet: {
		padding: 24,
		borderTopLeftRadius: 24,
		borderTopRightRadius: 24,
	},
	modalHeader: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		marginBottom: 20,
	},
	modalTitle: {
		fontSize: 18,
		fontWeight: '700',
	},
});
