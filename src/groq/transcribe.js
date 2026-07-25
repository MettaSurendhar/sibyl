import * as FileSystem from 'expo-file-system';

const GROQ_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';
// whisper-large-v3-turbo: fastest + cheapest on Groq's free tier, plenty accurate for journaling.
const MODEL = 'whisper-large-v3-turbo';

// Transcribes a single local audio file. Requires internet + a Groq API key (Settings screen).
// Throws with a readable message on failure (bad key, no internet, rate limit, file too large).
export async function transcribeFile(uri, apiKey) {
  if (!apiKey) throw new Error('No Groq API key set. Add one in Settings.');

  const info = await FileSystem.getInfoAsync(uri);
  if (!info.exists) throw new Error('Audio file not found.');
  // Groq's free tier caps uploads around 25MB per request.
  if (info.size > 24 * 1024 * 1024) {
    throw new Error('Recording is too large for one transcription request (25MB limit).');
  }

  const form = new FormData();
  form.append('file', {
    uri,
    name: 'audio.m4a',
    type: 'audio/m4a',
  });
  form.append('model', MODEL);
  form.append('response_format', 'json');

  const response = await fetch(GROQ_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    if (response.status === 401) throw new Error('Invalid Groq API key.');
    if (response.status === 429) throw new Error('Groq rate limit hit — try again shortly.');
    throw new Error(`Transcription failed (${response.status}): ${text.slice(0, 150)}`);
  }

  const data = await response.json();
  return data.text || '';
}

// For multi-segment entries: transcribes each segment separately (keeps requests small
// and within the free tier's per-file limits) and joins the text with paragraph breaks.
export async function transcribeSegments(segments, apiKey) {
  const parts = [];
  for (const seg of segments) {
    const text = await transcribeFile(seg.uri, apiKey);
    parts.push(text.trim());
  }
  return parts.filter(Boolean).join('\n\n');
}
