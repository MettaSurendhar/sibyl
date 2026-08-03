import { getDb, newId } from './database';
import { getRecordingsFolderUri } from '../utils/settingsStore';
import {
	copyFileToFolder,
	isExternalFolderSupported,
	deleteFileByUri,
} from '../utils/externalFolder';

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
    SELECT s.id as id, s.uri as uri, e.title as title
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
			const externalUri = await copyFileToFolder(
				folderUri,
				seg.uri,
				`${safeTitle}.${ext}`,
				`audio/${ext}`,
			);
			if (externalUri) {
				await db.runAsync('UPDATE segments SET externalUri = ? WHERE id = ?', [
					externalUri,
					seg.id,
				]);
			}
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
		`SELECT e.*, c.name as categoryName, c.color as categoryColor
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
