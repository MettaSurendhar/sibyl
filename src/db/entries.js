import { getDb, newId } from './database';

// Returns entries with their segments and category joined, grouped-ready (sorted newest first)
export async function listEntries() {
  const db = await getDb();
  const entries = await db.getAllAsync(`
    SELECT e.*, c.name as categoryName, c.color as categoryColor
    FROM entries e
    LEFT JOIN categories c ON c.id = e.categoryId
    ORDER BY e.updatedAt DESC
  `);
  const segments = await db.getAllAsync('SELECT * FROM segments ORDER BY orderIndex ASC');
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
    [id]
  );
  if (!e) return null;
  const segments = await db.getAllAsync(
    'SELECT * FROM segments WHERE entryId = ? ORDER BY orderIndex ASC',
    [id]
  );
  return { ...e, waveform: JSON.parse(e.waveform || '[]'), segments };
}

// Creates a brand-new entry with its first audio segment
export async function createEntry({ title, categoryId, uri, durationMs, waveform }) {
  const db = await getDb();
  const id = newId('entry');
  const now = Date.now();
  await db.runAsync(
    `INSERT INTO entries (id, title, categoryId, createdAt, updatedAt, totalDurationMs, waveform, transcript, transcriptStatus)
     VALUES (?, ?, ?, ?, ?, ?, ?, NULL, 'none')`,
    [id, title, categoryId || null, now, now, durationMs, JSON.stringify(waveform || [])]
  );
  await db.runAsync(
    'INSERT INTO segments (id, entryId, uri, durationMs, orderIndex, createdAt) VALUES (?, ?, ?, ?, 0, ?)',
    [newId('seg'), id, uri, durationMs, now]
  );
  return id;
}

// Appends a new segment to an existing entry ("continue recording")
export async function appendSegment(entryId, { uri, durationMs, waveform }) {
  const db = await getDb();
  const existing = await db.getAllAsync('SELECT * FROM segments WHERE entryId = ?', [entryId]);
  const nextOrder = existing.length;
  await db.runAsync(
    'INSERT INTO segments (id, entryId, uri, durationMs, orderIndex, createdAt) VALUES (?, ?, ?, ?, ?, ?)',
    [newId('seg'), entryId, uri, durationMs, nextOrder, Date.now()]
  );
  const entry = await db.getFirstAsync('SELECT * FROM entries WHERE id = ?', [entryId]);
  const mergedWaveform = [...JSON.parse(entry.waveform || '[]'), ...(waveform || [])];
  await db.runAsync(
    'UPDATE entries SET totalDurationMs = totalDurationMs + ?, waveform = ?, updatedAt = ?, transcript = NULL, transcriptStatus = ? WHERE id = ?',
    [durationMs, JSON.stringify(mergedWaveform), Date.now(), 'stale', entryId]
  );
}

// Used after a trim/merge/append operation produces one real consolidated audio file:
// wipes the old segment rows and replaces them with a single new one, updating duration/waveform.
export async function replaceSegments(entryId, { uri, durationMs, waveform }) {
  const db = await getDb();
  await db.runAsync('DELETE FROM segments WHERE entryId = ?', [entryId]);
  await db.runAsync(
    'INSERT INTO segments (id, entryId, uri, durationMs, orderIndex, createdAt) VALUES (?, ?, ?, ?, 0, ?)',
    [newId('seg'), entryId, uri, durationMs, Date.now()]
  );
  await db.runAsync(
    'UPDATE entries SET totalDurationMs = ?, waveform = ?, updatedAt = ? WHERE id = ?',
    [durationMs, JSON.stringify(waveform || []), Date.now(), entryId]
  );
}

export async function renameEntry(id, title) {
  const db = await getDb();
  await db.runAsync('UPDATE entries SET title = ?, updatedAt = ? WHERE id = ?', [
    title,
    Date.now(),
    id,
  ]);
}

export async function setEntryCategory(id, categoryId, newTitle) {
  const db = await getDb();
  await db.runAsync('UPDATE entries SET categoryId = ?, title = ?, updatedAt = ? WHERE id = ?', [
    categoryId,
    newTitle,
    Date.now(),
    id,
  ]);
}

export async function setTranscript(id, transcript) {
  const db = await getDb();
  await db.runAsync('UPDATE entries SET transcript = ?, transcriptStatus = ? WHERE id = ?', [
    transcript,
    'done',
    id,
  ]);
}

export async function setTranscriptStatus(id, status) {
  const db = await getDb();
  await db.runAsync('UPDATE entries SET transcriptStatus = ? WHERE id = ?', [status, id]);
}

export async function deleteEntries(ids) {
  const db = await getDb();
  for (const id of ids) {
    await db.runAsync('DELETE FROM entries WHERE id = ?', [id]);
    await db.runAsync('DELETE FROM segments WHERE entryId = ?', [id]);
  }
}
