import { getDb, newId } from './database';
import { getRecordingsFolderUri } from '../utils/settingsStore';
import {
	copyFileToFolder,
	isExternalFolderSupported,
	deleteFileByUri,
} from '../utils/externalFolder';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';

// Best-effort mirror of a finished recording into the user's chosen external folder (Settings ->
// Saving folder), if one is configured. The app's own internal copy (in FileSystem storage) stays
// the one actually used for playback/trim/merge - this is purely an extra, user-visible copy, so
// any failure here (folder deleted, permission revoked, iOS, no folder configured) must never
// surface as an error or block the recording save that already succeeded. Returns the mirrored
// file's own content:// URI on success (so the caller can remember it against the segment, for
// precise deletion later), or null if no copy was made.
async function mirrorToExternalFolder(uri, title) {
	if (!isExternalFolderSupported()) return null;
	try {
		const folderUri = await getRecordingsFolderUri();
		if (!folderUri) return null;
		const ext = (uri.split('.').pop() || 'm4a').split('?')[0];
		const safeTitle =
			(title || 'recording').replace(/[\\/:*?"<>|]/g, '_').trim() ||
			'recording';
		return await copyFileToFolder(
			folderUri,
			uri,
			`${safeTitle}.${ext}`,
			`audio/${ext}`,
		);
	} catch (e) {
		// silently skip - see comment above
		return null;
	}
}

function generateDummyWaveform() {
	const waveform = [];
	for (let i = 0; i < 200; i++) {
		// A gentle varying pattern between -30dB and -10dB
		const val = -20 + Math.sin(i * 0.2) * 10;
		waveform.push(val);
	}
	return waveform;
}

export async function syncWithFolder(folderUri, onProgress) {
	if (!isExternalFolderSupported() || !folderUri) {
		return { pushed: 0, pulled: 0, failed: 0, total: 0 };
	}
	const db = await getDb();
	const SAF = FileSystem.StorageAccessFramework;
	
	let pushed = 0;
	let pulled = 0;
	let failed = 0;
	let totalSteps = 0;
	let currentStep = 0;

	try {
		const filesInFolder = await SAF.readDirectoryAsync(folderUri);
		const existingSegments = await db.getAllAsync(`
			SELECT s.id, s.uri, s.externalUri, s.entryId, e.title 
			FROM segments s
			JOIN entries e ON e.id = s.entryId
		`);
		
		// 1. PUSH: Find segments that have no externalUri, or whose externalUri is not in the folder
		const toPush = existingSegments.filter(s => !s.externalUri || !filesInFolder.includes(s.externalUri));
		
		// 2. PULL: Find files in the folder that aren't in any segment's externalUri
		const knownExternalUris = new Set(existingSegments.map(s => s.externalUri).filter(Boolean));
		const toPull = filesInFolder.filter(uri => {
			const ext = uri.split('.').pop()?.toLowerCase();
			const isAudio = ['mp3', 'm4a', 'wav', 'aac', 'ogg'].includes(ext);
			return isAudio && !knownExternalUris.has(uri);
		});

		totalSteps = toPush.length + toPull.length;
		if (totalSteps === 0) return { pushed: 0, pulled: 0, failed: 0, total: 0 };

		// --- Execute PUSH ---
		for (const seg of toPush) {
			try {
				const ext = (seg.uri.split('.').pop() || 'm4a').split('?')[0];
				const safeTitle = (seg.title || 'recording').replace(/[\\/:*?"<>|]/g, '_').trim() || 'recording';
				
				const newExternalUri = await copyFileToFolder(
					folderUri,
					seg.uri,
					`${safeTitle}.${ext}`,
					`audio/${ext}`
				);
				if (newExternalUri) {
					await db.runAsync('UPDATE segments SET externalUri = ? WHERE id = ?', [newExternalUri, seg.id]);
				}
				pushed++;
			} catch (e) {
				failed++;
			}
			currentStep++;
			if (onProgress) onProgress({ done: currentStep, total: totalSteps, phase: 'exporting' });
		}

		// --- Execute PULL ---
		const internalDir = FileSystem.documentDirectory + 'recordings/';
		await FileSystem.makeDirectoryAsync(internalDir, { intermediates: true }).catch(() => {});

		for (const safUri of toPull) {
			try {
				const decoded = decodeURIComponent(safUri);
				const filename = decoded.split('/').pop() || `imported_${Date.now()}.mp3`;
				// Ensure safe internal filename
				const safeFilename = filename.replace(/[^a-zA-Z0-9.\-_]/g, '_');
				const internalUri = internalDir + Date.now() + '_' + safeFilename;
				
				try {
					await FileSystem.copyAsync({ from: safUri, to: internalUri });
				} catch {
					const b64 = await FileSystem.readAsStringAsync(safUri, { encoding: 'base64' });
					await FileSystem.writeAsStringAsync(internalUri, b64, { encoding: 'base64' });
				}

				const { sound, status } = await Audio.Sound.createAsync({ uri: internalUri });
				const durationMs = status.durationMillis || 0;
				await sound.unloadAsync();

				const entryId = newId('ent');
				const title = filename.replace(/\.[^/.]+$/, ""); // strip extension for the title
				const now = Date.now();
				const waveform = JSON.stringify(generateDummyWaveform());

				await db.runAsync(
					'INSERT INTO entries (id, title, createdAt, updatedAt, totalDurationMs, waveform) VALUES (?, ?, ?, ?, ?, ?)',
					[entryId, title, now, now, durationMs, waveform]
				);

				const segId = newId('seg');
				await db.runAsync(
					'INSERT INTO segments (id, entryId, uri, externalUri, durationMs, orderIndex, createdAt) VALUES (?, ?, ?, ?, ?, 0, ?)',
					[segId, entryId, internalUri, safUri, durationMs, now]
				);
				
				pulled++;
			} catch (e) {
				console.error("Failed to pull", safUri, e);
				failed++;
			}
			currentStep++;
			if (onProgress) onProgress({ done: currentStep, total: totalSteps, phase: 'importing' });
		}
		
	} catch (e) {
		console.error("Sync error:", e);
	}
	
	return { pushed, pulled, failed, total: totalSteps };
}

// Returns entries with their segments and category joined, grouped-ready (sorted newest first)
export async function searchEntries(query) {
	const db = await getDb();
	const q = `%${query}%`;
	const entries = await db.getAllAsync(
		`
    SELECT e.*, c.name as categoryName, c.color as categoryColor, c.icon as categoryIcon
    FROM entries e
    LEFT JOIN categories c ON c.id = e.categoryId
    WHERE e.title LIKE ? OR e.transcript LIKE ?
    ORDER BY e.updatedAt DESC
  `,
		[q, q]
	);
	const segments = await db.getAllAsync('SELECT * FROM segments ORDER BY orderIndex ASC');
	const segByEntry = {};
	for (const s of segments) {
		if (!segByEntry[s.entryId]) segByEntry[s.entryId] = [];
		segByEntry[s.entryId].push(s);
	}
	return entries.map((e) => ({
		...e,
		segments: segByEntry[e.id] || [],
	}));
}

export async function getAnalyticsSummary() {
	const db = await getDb();
	
	// Total duration and entry count
	const summaryRow = await db.getFirstAsync(
		'SELECT SUM(totalDurationMs) as totalTime, COUNT(*) as totalEntries FROM entries'
	);
	
	const totalTime = summaryRow?.totalTime || 0;
	const totalEntries = summaryRow?.totalEntries || 0;
	const avgEntryLength = totalEntries > 0 ? Math.round(totalTime / totalEntries) : 0;

	// Time of day (Morning 5-12, Afternoon 12-17, Evening 17-21, Night 21-5)
	const timeOfDay = { morning: 0, afternoon: 0, evening: 0, night: 0 };
	
	const rows = await db.getAllAsync(`
		SELECT strftime('%H', datetime(createdAt / 1000, 'unixepoch', 'localtime')) as hour 
		FROM entries
	`);
	
	for (const r of rows) {
		const h = parseInt(r.hour, 10);
		if (h >= 5 && h < 12) timeOfDay.morning++;
		else if (h >= 12 && h < 17) timeOfDay.afternoon++;
		else if (h >= 17 && h < 21) timeOfDay.evening++;
		else timeOfDay.night++;
	}

	return { totalTime, totalEntries, avgEntryLength, timeOfDay };
}

/**
 * Saves the transcription text and status for an entry.
 * @param {string} entryId
 * @param {string} text - the transcribed text
 * @param {'done'|'error'|'none'} status
 */
export async function saveTranscript(entryId, text, status = 'done') {
	const db = await getDb();
	await db.runAsync(
		`UPDATE entries SET transcript = ?, transcriptStatus = ?, updatedAt = ? WHERE id = ?`,
		[text, status, Date.now(), entryId]
	);
}

export async function listEntries() {
	const db = await getDb();
	const entries = await db.getAllAsync(`
    SELECT e.*, c.name as categoryName, c.color as categoryColor, c.icon as categoryIcon
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
		`SELECT e.*, c.name as categoryName, c.color as categoryColor, c.icon as categoryIcon FROM entries e
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

// Creates a brand-new entry with its first audio segment. sourceType distinguishes a fresh
// recording ('recorded', the default) from a derivative produced by Trim/Merge/Append -
// see the migration comment in database.js for why this exists.
export async function createEntry({
	title,
	categoryId,
	uri,
	durationMs,
	waveform,
	sourceType = 'recorded',
}) {
	const db = await getDb();
	const id = newId('entry');
	const now = Date.now();
	await db.runAsync(
		`INSERT INTO entries (id, title, categoryId, createdAt, updatedAt, totalDurationMs, waveform, transcript, transcriptStatus, sourceType)
     VALUES (?, ?, ?, ?, ?, ?, ?, NULL, 'none', ?)`,
		[
			id,
			title,
			categoryId || null,
			now,
			now,
			durationMs,
			JSON.stringify(sanitizeWaveform(waveform)),
			sourceType,
		],
	);
	const segId = newId('seg');
	await db.runAsync(
		'INSERT INTO segments (id, entryId, uri, durationMs, orderIndex, createdAt) VALUES (?, ?, ?, ?, 0, ?)',
		[segId, id, uri, durationMs, now],
	);
	mirrorToExternalFolder(uri, title).then((externalUri) => {
		if (externalUri) {
			db.runAsync('UPDATE segments SET externalUri = ? WHERE id = ?', [
				externalUri,
				segId,
			]);
		}
	});
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
	const segId = newId('seg');
	await db.runAsync(
		'INSERT INTO segments (id, entryId, uri, durationMs, orderIndex, createdAt) VALUES (?, ?, ?, ?, ?, ?)',
		[segId, entryId, uri, durationMs, nextOrder, Date.now()],
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
	mirrorToExternalFolder(uri, entry.title).then((externalUri) => {
		if (externalUri) {
			db.runAsync('UPDATE segments SET externalUri = ? WHERE id = ?', [
				externalUri,
				segId,
			]);
		}
	});
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

// Returns the mirrored-copy URIs (skipping segments that were never mirrored) for the given
// entry ids. Used by the delete flow to decide whether it's worth asking "also delete the
// copies in <folder>?" - if this comes back empty, none of the entries have an external copy to
// worry about, so the extra prompt is skipped entirely.
export async function getExternalUrisForEntries(ids) {
	if (!ids.length) return [];
	const db = await getDb();
	const placeholders = ids.map(() => '?').join(',');
	const rows = await db.getAllAsync(
		`SELECT externalUri FROM segments WHERE entryId IN (${placeholders}) AND externalUri IS NOT NULL`,
		ids,
	);
	return rows.map((r) => r.externalUri);
}

// Returns the N most recently-updated entries (category joined), newest first. Used by the
// Record screen's context header (last-recording preview) and the Today tab (recent list).
export async function getRecentEntries(limit = 5) {
	const db = await getDb();
	const rows = await db.getAllAsync(
		`SELECT e.*, c.name as categoryName, c.color as categoryColor, c.icon as categoryIcon
     FROM entries e
     LEFT JOIN categories c ON c.id = e.categoryId
     ORDER BY e.updatedAt DESC
     LIMIT ?`,
		[limit],
	);
	return rows.map((e) => ({ ...e, waveform: JSON.parse(e.waveform || '[]') }));
}

const dayKey = (ms) => {
	const d = new Date(ms);
	return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};

// Shared by getStreakCount and getStreakByCategory: counts consecutive calendar days
// (ending today) present in a list of { createdAt } rows. Grace period: if nothing has
// been recorded yet today, the streak isn't zeroed out until the day actually passes
// without an entry - it keeps counting from yesterday backwards instead, so opening the
// app in the morning doesn't show "0" before you've had a chance to record today.
function streakFromRows(rows) {
	if (!rows.length) return 0;
	const days = new Set(rows.map((r) => dayKey(r.createdAt)));

	const cursor = new Date();
	if (!days.has(dayKey(cursor.getTime()))) {
		cursor.setDate(cursor.getDate() - 1);
		if (!days.has(dayKey(cursor.getTime()))) return 0;
	}

	let streak = 0;
	while (days.has(dayKey(cursor.getTime()))) {
		streak++;
		cursor.setDate(cursor.getDate() - 1);
	}
	return streak;
}

// Overall streak across every tag - unchanged behavior from before, now backed by the
// shared helper above.
export async function getStreakCount() {
	const db = await getDb();
	const rows = await db.getAllAsync(
		'SELECT createdAt FROM entries ORDER BY createdAt DESC',
	);
	return streakFromRows(rows);
}

// Same "consecutive days" streak, scoped to a single tag (or Untagged when categoryId is
// null). Used by the Home screen's per-tag line in the streak chart, drawn alongside the
// overall line from getStreakCount.
export async function getStreakByCategory(categoryId) {
	const db = await getDb();
	const rows = categoryId
		? await db.getAllAsync(
				'SELECT createdAt FROM entries WHERE categoryId = ? ORDER BY createdAt DESC',
				[categoryId],
			)
		: await db.getAllAsync(
				'SELECT createdAt FROM entries WHERE categoryId IS NULL ORDER BY createdAt DESC',
			);
	return streakFromRows(rows);
}

// Per-day, per-tag entry counts between two timestamps (ms, inclusive). Shape:
// [{ dateKey: 'YYYY-MM-DD', categoryId: <id|null>, count }]. Feeds both the Home streak
// line chart (grouped per tag) and the GitHub-style heatmap (summed across tags for that
// day). Aggregated in SQL via date() on createdAt so this stays one query rather than
// looping over every entry in JS as the dataset grows into the hundreds/thousands.
export async function getDailyEntryCounts({ from, to } = {}) {
	const db = await getDb();
	const where = [];
	const params = [];
	if (from != null) {
		where.push('createdAt >= ?');
		params.push(from);
	}
	if (to != null) {
		where.push('createdAt <= ?');
		params.push(to);
	}
	const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
	return db.getAllAsync(
		`SELECT date(createdAt / 1000, 'unixepoch', 'localtime') as dateKey,
            categoryId,
            COUNT(*) as count
     FROM entries
     ${whereClause}
     GROUP BY dateKey, categoryId
     ORDER BY dateKey ASC`,
		params,
	);
}

// alsoDeleteExternal: when true, also deletes each segment's mirrored copy (if any) from the
// user's Saving folder - best-effort per file, same as mirroring itself. The app's own copy is
// always removed either way; this only controls the extra, user-visible copy outside the app.
export async function deleteEntries(ids, { alsoDeleteExternal = false } = {}) {
	const db = await getDb();
	if (alsoDeleteExternal) {
		const externalUris = await getExternalUrisForEntries(ids);
		for (const uri of externalUris) {
			await deleteFileByUri(uri);
		}
	}
	for (const id of ids) {
		await db.runAsync('DELETE FROM entries WHERE id = ?', [id]);
		await db.runAsync('DELETE FROM segments WHERE entryId = ?', [id]);
	}
}
