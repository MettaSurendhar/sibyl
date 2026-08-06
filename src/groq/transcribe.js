import * as FileSystem from 'expo-file-system';
import { compressAndSplitForTranscription } from '../audio/ffmpegModule';

const GROQ_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';
// whisper-large-v3-turbo: fastest + cheapest on Groq's free tier, plenty accurate for journaling.
const MODEL = 'whisper-large-v3-turbo';

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
const AVG_LOGPROB_THRESHOLD = -1.0;
const COMPRESSION_RATIO_THRESHOLD = 2.4;

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
async function transcribeSingleChunk(uri, apiKey) {
	const form = new FormData();
	form.append('file', {
		uri,
		name: 'audio.m4a',
		type: 'audio/m4a',
	});
	form.append('model', MODEL);
	form.append('response_format', 'verbose_json');
	form.append('temperature', '0');
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
		if (response.status === 429)
			throw new Error('Groq rate limit hit — try again shortly.');
		throw new Error(
			`Transcription failed (${response.status}): ${text.slice(0, 150)}`,
		);
	}

	const data = await response.json();
	const text =
		Array.isArray(data.segments) && data.segments.length
			? buildParagraphs(data.segments)
			: (data.text || '').trim();
	return { text, language: data.language || '' };
}

// Transcribes a local audio file. Requires internet + a Groq API key (Settings screen).
// Automatically compresses and chunks large files to fit within Groq's 25MB limits.
// Returns { text, language }.
export async function transcribeFile(uri, apiKey) {
	if (!apiKey) throw new Error('No Groq API key set. Add one in Settings.');

	const info = await FileSystem.getInfoAsync(uri);
	if (!info.exists) throw new Error('Audio file not found.');

	// Compress to 16kHz 32kbps mono AAC and split into 1-hour chunks safely
	const { chunkUris, chunkDir } = await compressAndSplitForTranscription(uri);
	
	try {
		const parts = [];
		let language = '';
		
		for (const chunkUri of chunkUris) {
			const result = await transcribeSingleChunk(chunkUri, apiKey);
			if (result.text) parts.push(result.text);
			if (!language && result.language) language = result.language;
		}
		
		return { text: parts.join('\n\n'), language };
	} finally {
		// Always clean up the temporary chunks, even on error
		await FileSystem.deleteAsync(chunkDir, { idempotent: true });
	}
}

// For multi-segment entries (legacy append model — new Trim/Merge/Append operations always
// produce a single segment): transcribes each segment file separately (keeps requests small and
// within the free tier's per-file limits) and joins the paragraphed text from each file with a
// paragraph break — the boundary between files is itself a natural break.
// Returns { text, language } (language taken from the first file that reports one).
export async function transcribeSegments(segments, apiKey) {
	const parts = [];
	let language = '';
	for (const seg of segments) {
		const result = await transcribeFile(seg.uri, apiKey);
		if (result.text) parts.push(result.text);
		if (!language && result.language) language = result.language;
	}
	return { text: parts.join('\n\n'), language };
}
