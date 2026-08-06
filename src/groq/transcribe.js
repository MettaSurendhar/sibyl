import * as FileSystem from 'expo-file-system';
import { compressAndSplitForTranscription } from '../audio/ffmpegModule';
import { getPrefs } from '../utils/settingsStore';

const GROQ_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';
// Default model — can be overridden per-transcription via user prefs (Settings → Transcription)
const DEFAULT_MODEL = 'whisper-large-v3-turbo';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Gap (in seconds) between one Whisper segment's end and the next one's start that counts as a
// natural pause worth breaking into a new paragraph. Long enough to skip normal mid-sentence
// breathing room, short enough to catch a real "ok, next thought" pause in spoken journaling.
const PARAGRAPH_GAP_SECONDS = 1.8;

// Whisper's own per-segment confidence signals, used to drop hallucinated segments instead of
// including them in the transcript. Whisper is known to "make things up" on silence, background
// noise, or short/low-signal audio - these are the same heuristics whisper.cpp/faster-whisper use
// under the hood to catch that:
//  - no_speech_prob: the model's own estimate that this segment is silence/non-speech
//  - avg_logprob: average token confidence - very negative means the model was largely guessing
//  - compression_ratio: how compressible the text is - a repetitive loop ("Tours of Tours of
//    Tours") compresses far better than real speech, so a high ratio flags that failure mode
const NO_SPEECH_PROB_THRESHOLD = 0.6;
// avg_logprob: English Whisper segments score around -0.3 to -0.8.
// Non-English / Indian languages (Tamil, Telugu, etc.) score lower by default (-0.8 to -1.4)
// because they're underrepresented in Whisper's training data — NOT because they're hallucinations.
// Using -1.0 for everything silently drops ALL real Tamil content. Use a more lenient threshold.
const AVG_LOGPROB_THRESHOLD = -1.5;
// compression_ratio: Tamil morphology (agglutinative, lots of shared syllables) compresses
// more aggressively than English even for normal speech. Raise threshold to avoid false positives.
const COMPRESSION_RATIO_THRESHOLD = 2.8;

// Whisper's ISO-639-1 language codes mapped to readable display names, for the Transcribe page's
// "Language: English" line. Not exhaustive of every code Whisper can return, but covers the
// common ones; unrecognized codes just fall back to showing the raw code.
const LANGUAGE_NAMES = {
	en: 'English',
	es: 'Spanish',
	fr: 'French',
	de: 'German',
	it: 'Italian',
	pt: 'Portuguese',
	nl: 'Dutch',
	ru: 'Russian',
	zh: 'Chinese',
	ja: 'Japanese',
	ko: 'Korean',
	ar: 'Arabic',
	hi: 'Hindi',
	ta: 'Tamil',
	te: 'Telugu',
	kn: 'Kannada',
	ml: 'Malayalam',
	mr: 'Marathi',
	gu: 'Gujarati',
	pa: 'Punjabi',
	bn: 'Bengali',
	ur: 'Urdu',
	tr: 'Turkish',
	vi: 'Vietnamese',
	th: 'Thai',
	id: 'Indonesian',
	ms: 'Malay',
	pl: 'Polish',
	uk: 'Ukrainian',
	sv: 'Swedish',
	fi: 'Finnish',
	no: 'Norwegian',
	da: 'Danish',
	el: 'Greek',
	he: 'Hebrew',
	cs: 'Czech',
	ro: 'Romanian',
	hu: 'Hungarian',
};

export function languageDisplayName(code) {
	if (!code) return 'Unknown';
	return LANGUAGE_NAMES[code.toLowerCase()] || code;
}

// True if Whisper's own confidence signals suggest this segment is silence, noise, or a
// repetition-loop hallucination rather than real transcribed speech.
function isHallucinatedSegment(seg) {
	if (
		typeof seg.no_speech_prob === 'number' &&
		seg.no_speech_prob > NO_SPEECH_PROB_THRESHOLD
	)
		return true;
	if (
		typeof seg.avg_logprob === 'number' &&
		seg.avg_logprob < AVG_LOGPROB_THRESHOLD
	)
		return true;
	if (
		typeof seg.compression_ratio === 'number' &&
		seg.compression_ratio > COMPRESSION_RATIO_THRESHOLD
	)
		return true;
	return false;
}

// Groups Whisper's timed segments into paragraphs, breaking wherever the silence gap between
// segments exceeds PARAGRAPH_GAP_SECONDS, and drops any segment flagged as likely hallucinated
// (see isHallucinatedSegment). This is what makes a transcript "read like how you talked" instead
// of one run-on block with made-up sentences mixed in.
function buildParagraphs(segments) {
	if (!Array.isArray(segments) || segments.length === 0) return '';
	const paragraphs = [];
	let current = [];
	let prevEnd = null;
	for (const seg of segments) {
		if (isHallucinatedSegment(seg)) continue;
		const text = (seg.text || '').trim();
		if (!text) continue;
		if (
			prevEnd !== null &&
			seg.start - prevEnd > PARAGRAPH_GAP_SECONDS &&
			current.length
		) {
			paragraphs.push(current.join(' '));
			current = [];
		}
		current.push(text);
		prevEnd = seg.end;
	}
	if (current.length) paragraphs.push(current.join(' '));
	return paragraphs.join('\n\n');
}

// Transcribes a single chunk of audio (already guaranteed to be <25MB by ffmpeg chunking).
async function transcribeSingleChunk(uri, apiKey, languageCode, model) {
	// Groq rate limits can be strict on the free tier (e.g. 20 requests per minute).
	// With 5-minute chunks, we are well below RPM, but they may throttle fast sequential requests.
	let attempt = 0;
	const maxAttempts = 3;

	while (attempt < maxAttempts) {
		attempt++;

		// FormData MUST be rebuilt inside the loop — React Native's fetch consumes the body
		// stream on the first attempt. Reusing the same form on retry sends an empty body,
		// which causes Groq to return a confusing non-429 error.
		const form = new FormData();
		form.append('file', { uri, name: 'audio.m4a', type: 'audio/m4a' });
		form.append('model', model || DEFAULT_MODEL);
		form.append('response_format', 'verbose_json');
		form.append('temperature', '0');
		if (languageCode && languageCode !== 'auto') {
			form.append('language', languageCode);
		}
		// Deliberately no `prompt` field here. Whisper's prompt isn't an instruction the model follows -
		// it's treated as preceding transcript text the model continues from. An earlier version sent a
		// descriptive prompt ("This is a personal voice journal entry...") and on quiet/low-signal audio
		// Whisper echoed that prompt text back as invented speech instead of transcribing real audio.
		// Do not reintroduce a descriptive/instructional prompt here for that reason.

		const response = await fetch(GROQ_URL, {
			method: 'POST',
			headers: { Authorization: `Bearer ${apiKey}` },
			body: form,
		});

		if (!response.ok) {
			const text = await response.text().catch(() => '');
			if (response.status === 401) throw new Error('Invalid Groq API key.');

			if (response.status === 429 && attempt < maxAttempts) {
				// Read the Retry-After header Groq sends — it tells us exactly how long to wait.
				// If absent, default to 15 seconds. Cap at 120s so we never block forever.
				const retryAfter = parseInt(response.headers.get('Retry-After') || '15', 10);
				const waitMs = Math.min(retryAfter, 120) * 1000;
				await delay(waitMs);
				continue;
			}

			if (response.status === 429) {
				throw new Error('Groq rate limit hit — you may have exceeded your free tier\'s hourly audio quota. Try again in an hour.');
			}

			throw new Error(`Transcription failed (${response.status}): ${text.slice(0, 150)}`);
		}

		const data = await response.json();
		const text =
			Array.isArray(data.segments) && data.segments.length
				? buildParagraphs(data.segments)
				: (data.text || '').trim();
		return { text, language: data.language || '' };
	}
}

// Transcribes a local audio file. Requires internet + a Groq API key (Settings screen).
// Automatically compresses and chunks large files to fit within Groq's 25MB limits.
// Returns { text, language }.
export async function transcribeFile(uri, apiKey, { onProgress } = {}) {
	if (!apiKey) throw new Error('No Groq API key set. Add one in Settings.');

	const info = await FileSystem.getInfoAsync(uri);
	if (!info.exists) throw new Error('Audio file not found.');

	// Compress to 16kHz 32kbps mono AAC and split into 5-min chunks
	const { chunkUris, chunkDir } = await compressAndSplitForTranscription(uri);
	
	const prefs = await getPrefs();
	const targetLanguage = prefs.transcriptionLanguage || 'auto';
	const targetModel = prefs.transcriptionModel || DEFAULT_MODEL;
	
	try {
		const parts = [];
		let language = '';
		const total = chunkUris.length;
		
		for (let i = 0; i < chunkUris.length; i++) {
			onProgress && onProgress({ done: i, total });
			// Small pause between chunks to avoid hitting Groq's requests-per-minute limit
			if (i > 0) await delay(2000);
			const result = await transcribeSingleChunk(chunkUris[i], apiKey, targetLanguage, targetModel);
			if (result.text) parts.push(result.text);
			if (!language && result.language) language = result.language;
			onProgress && onProgress({ done: i + 1, total });
		}
		
		return { text: parts.join('\n\n'), language };
	} finally {
		// Always clean up the temporary chunks, even on error
		await FileSystem.deleteAsync(chunkDir, { idempotent: true });
	}
}

// For multi-segment entries: transcribes each segment file separately and joins the results.
// Returns { text, language } (language taken from the first file that reports one).
export async function transcribeSegments(segments, apiKey, { onProgress } = {}) {
	const parts = [];
	let language = '';
	for (const seg of segments) {
		const result = await transcribeFile(seg.uri, apiKey, { onProgress });
		if (result.text) parts.push(result.text);
		if (!language && result.language) language = result.language;
	}
	return { text: parts.join('\n\n'), language };
}
