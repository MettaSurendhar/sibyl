import * as FileSystem from 'expo-file-system';
import { getGroqApiKey } from './settingsStore';

const GROQ_WHISPER_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';

/**
 * Transcribes an audio file using the Groq Whisper API.
 * @param {string} audioUri - Local file URI (expo file system)
 * @returns {{ text: string } | { error: string }}
 */
export async function transcribeAudio(audioUri) {
	try {
		const apiKey = await getGroqApiKey();
		if (!apiKey) {
			return { error: 'No Groq API key configured. Add it in Settings -> Recording.' };
		}

		// Determine extension
		const ext = (audioUri.split('.').pop() || 'm4a').split('?')[0].toLowerCase();
		const mimeType = ext === 'mp3' ? 'audio/mpeg'
			: ext === 'wav' ? 'audio/wav'
			: ext === 'ogg' ? 'audio/ogg'
			: 'audio/m4a';

		// Read file as base64
		const base64 = await FileSystem.readAsStringAsync(audioUri, {
			encoding: FileSystem.EncodingType.Base64,
		});

		// Build multipart/form-data manually
		const boundary = `----FormBoundary${Date.now()}`;
		const CRLF = '\r\n';

		// Groq accepts base64 in a data URI via FormData blob approach,
		// but React Native fetch doesn't support Blob natively.
		// Use expo-file-system uploadAsync for binary uploads.
		const response = await FileSystem.uploadAsync(GROQ_WHISPER_URL, audioUri, {
			httpMethod: 'POST',
			uploadType: FileSystem.FileSystemUploadType.MULTIPART,
			fieldName: 'file',
			mimeType,
			parameters: {
				model: 'whisper-large-v3-turbo',
				response_format: 'json',
				language: 'en',
			},
			headers: {
				Authorization: `Bearer ${apiKey}`,
			},
		});

		if (response.status !== 200) {
			let detail = response.body;
			try {
				const parsed = JSON.parse(response.body);
				detail = parsed?.error?.message || detail;
			} catch (_) {}
			return { error: `Groq API error ${response.status}: ${detail}` };
		}

		const result = JSON.parse(response.body);
		return { text: result.text?.trim() || '' };
	} catch (err) {
		return { error: err.message || 'Unknown transcription error' };
	}
}
