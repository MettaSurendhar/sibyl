import { getDb, newId } from './database';
import { getRecordingsFolderUri } from '../utils/settingsStore';
import {
	copyFileToFolder,
	isExternalFolderSupported,
} from '../utils/externalFolder';

// Best-effort mirror of a finished recording into the user's chosen external folder (Settings ->
// Saving folder), if one is configured. The app's own internal copy (in FileSystem storage) stays
// the one actually used for playback/trim/merge - this is purely an extra, user-visible copy, so
// any failure here (folder deleted, permission revoked, iOS, no folder configured) must never
// surface as an error or block the recording save that already succeeded.
async function mirrorToExternalFolder(uri, title) {
	if (!isExternalFolderSupported()) return;
	try {
		const folderUri = await getRecordingsFolderUri();
		if (!folderUri) return;
		const ext = (uri.split('.').pop() || 'm4a').split('?')[0];
		const safeTitle =
			(title || 'recording').replace(/[\\/:*?"<>|]/g, '_').trim() ||
			'recording';
		await copyFileToFolder(
			folderUri,
			uri,
			`${safeTitle}.${ext}`,
			`audio/${ext}`,
		);
	} catch (e) {
		// silently skip - see comment above
	}
}

// Copies every recording currently in the app's local storage into a chosen external folder.
// Used from Settings both right after picking a new Saving folder (offered immediately) and
// on-demand later via the same button, e.g. if the user skipped it the first time or reconnected
// a folder. Each segment across every entry is copied individually - same per-file approach
// mirrorToExternalFolder already uses for new recordings going forward. Best-effort per file: one
// failure doesn't stop the rest. onProgress (optional) fires after each attempt with
// { done, total } for a live "Copying x/y" indicator; the final { copied, failed, total } lets
// the caller show a summary.
export async function backfillRecordingsToFolder(folderUri, onProgress) {
	const db = await getDb();
	const segments = await db.getAllAsync(`
    SELECT s.uri as uri, e.title as title
    FROM segments s
    JOIN entries e ON e.id = s.entryId
    ORDER BY s.createdAt ASC
  `);
	let copied = 0;
	let failed = 0;
	const total = segments.length;
	for (const seg of segments) {
		try {
			const ext = (seg.uri.split('.').pop() || 'm4a').split('?')[0];
			const safeTitle =
				(seg.title || 'recording').replace(/[\\/:*?"<>|]/g, '_').trim() ||
				'recording';
			await copyFileToFolder(
				folderUri,
				seg.uri,
				`${safeTitle}.${ext}`,
				`audio/${ext}`,
			);
			copied++;
		} catch (e) {
			failed++;
		}
		if (onProgress) onProgress({ done: copied + failed, total });
	}
	return { copied, failed, total };
}

// Returns entries with their segments and category joined, grouped-ready (sorted newest first)
export async function listEntries() {
	const db = await getDb();
	const entries = await db.getAllAsync(`
    SELECT e.*, c.name as categoryName, c.color as categoryColor
    FROM entries e
    LEFT JOIN categories c ON c.id = e.categoryId
    ORDER BY e.updatedAt DESC
  `);
	const segments = await db.getAllAsync(
		'SELECT * FROM segments ORDER BY orderIndex ASC',
	);
	const segByEntry = {};
	for (const s of segments) {
		if (!segByEntry[s.entryId]) segByEntry[s.entryId] = [];
		segByEntry[s.entryId].push(s);
	}
	return entries.map((e) => ({
		...e,
		waveform: JSON.parse(e.waveform || '[]'),
		segments: segByEntry[e.id] || [],
	}));
}

export async function getEntry(id) {
	const db = await getDb();
	const e = await db.getFirstAsync(
		`SELECT e.*, c.name as categoryName, c.color as categoryColor FROM entries e
     LEFT JOIN categories c ON c.id = e.categoryId WHERE e.id = ?`,
		[id],
	);
	if (!e) return null;
	const segments = await db.getAllAsync(
		'SELECT * FROM segments WHERE entryId = ? ORDER BY orderIndex ASC',
		[id],
	);
	return { ...e, waveform: JSON.parse(e.waveform || '[]'), segments };
}

// Creates a brand-new entry with its first audio segment
export async function createEntry({
	title,
	categoryId,
	uri,
	durationMs,
	waveform,
}) {
	const db = await getDb();
	const id = newId('entry');
	const now = Date.now();
	await db.runAsync(
		`INSERT INTO entries (id, title, categoryId, createdAt, updatedAt, totalDurationMs, waveform, transcript, transcriptStatus)
     VALUES (?, ?, ?, ?, ?, ?, ?, NULL, 'none')`,
		[
			id,
			title,
			categoryId || null,
			now,
			now,
			durationMs,
			JSON.stringify(sanitizeWaveform(waveform)),
		],
	);
	await db.runAsync(
		'INSERT INTO segments (id, entryId, uri, durationMs, orderIndex, createdAt) VALUES (?, ?, ?, ?, 0, ?)',
		[newId('seg'), id, uri, durationMs, now],
	);
	mirrorToExternalFolder(uri, title);
	return id;
}

// Appends a new segment to an existing entry ("continue recording")
export async function appendSegment(entryId, { uri, durationMs, waveform }) {
	const db = await getDb();
	const existing = await db.getAllAsync(
		'SELECT * FROM segments WHERE entryId = ?',
		[entryId],
	);
	const nextOrder = existing.length;
	await db.runAsync(
		'INSERT INTO segments (id, entryId, uri, durationMs, orderIndex, createdAt) VALUES (?, ?, ?, ?, ?, ?)',
		[newId('seg'), entryId, uri, durationMs, nextOrder, Date.now()],
	);
	const entry = await db.getFirstAsync('SELECT * FROM entries WHERE id = ?', [
		entryId,
	]);
	const mergedWaveform = [
		...JSON.parse(entry.waveform || '[]'),
		...(waveform || []),
	];
	await db.runAsync(
		'UPDATE entries SET totalDurationMs = totalDurationMs + ?, waveform = ?, updatedAt = ?, transcript = NULL, transcriptStatus = ? WHERE id = ?',
		[durationMs, JSON.stringify(mergedWaveform), Date.now(), 'stale', entryId],
	);
	mirrorToExternalFolder(uri, entry.title);
}

// Used after a trim/merge/append operation produces one real consolidated audio file:
// wipes the old segment rows and replaces them with a single new one, updating duration/waveform.
// Guards against any invalid entries (NaN, null, non-numbers) reaching storage - a defensive
// measure so that if any source waveform is malformed (e.g. carried over from an entry edited
// by an earlier, buggier build), it can't silently produce a broken/blank-looking track. Every
// value is coerced into the valid dB-ish range the waveform renderers expect.
function sanitizeWaveform(waveform) {
	if (!Array.isArray(waveform)) return [];
	return waveform.map((v) =>
		typeof v === 'number' && Number.isFinite(v) ? v : -60,
	);
}

export async function replaceSegments(entryId, { uri, durationMs, waveform }) {
	const db = await getDb();
	await db.runAsync('DELETE FROM segments WHERE entryId = ?', [entryId]);
	await db.runAsync(
		'INSERT INTO segments (id, entryId, uri, durationMs, orderIndex, createdAt) VALUES (?, ?, ?, ?, 0, ?)',
		[newId('seg'), entryId, uri, durationMs, Date.now()],
	);
	await db.runAsync(
		'UPDATE entries SET totalDurationMs = ?, waveform = ?, updatedAt = ? WHERE id = ?',
		[
			durationMs,
			JSON.stringify(sanitizeWaveform(waveform)),
			Date.now(),
			entryId,
		],
	);
}

export async function renameEntry(id, title) {
	const db = await getDb();
	await db.runAsync(
		'UPDATE entries SET title = ?, updatedAt = ? WHERE id = ?',
		[title, Date.now(), id],
	);
}

export async function setEntryCategory(id, categoryId, newTitle) {
	const db = await getDb();
	await db.runAsync(
		'UPDATE entries SET categoryId = ?, title = ?, updatedAt = ? WHERE id = ?',
		[categoryId, newTitle, Date.now(), id],
	);
}

export async function setTranscript(id, transcript, language) {
	const db = await getDb();
	await db.runAsync(
		'UPDATE entries SET transcript = ?, transcriptStatus = ?, transcriptLanguage = ? WHERE id = ?',
		[transcript, 'done', language || null, id],
	);
}

export async function setTranscriptStatus(id, status) {
	const db = await getDb();
	await db.runAsync('UPDATE entries SET transcriptStatus = ? WHERE id = ?', [
		status,
		id,
	]);
}

export async function deleteEntries(ids) {
	const db = await getDb();
	for (const id of ids) {
		await db.runAsync('DELETE FROM entries WHERE id = ?', [id]);
		await db.runAsync('DELETE FROM segments WHERE entryId = ?', [id]);
	}
}
