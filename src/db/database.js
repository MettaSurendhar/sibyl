import * as SQLite from 'expo-sqlite';
import { colorForIndex, DEFAULT_TAG_ICON } from '../utils/tagColors';

let dbInstance = null;

export async function getDb() {
	if (dbInstance) return dbInstance;
	dbInstance = await SQLite.openDatabaseAsync('voice_journal.db');
	await dbInstance.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      prefix TEXT NOT NULL,
      counter INTEGER NOT NULL DEFAULT 0,
      color TEXT NOT NULL DEFAULT '#6C8EF5',
      sortOrder INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS entries (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      categoryId TEXT,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL,
      totalDurationMs INTEGER NOT NULL DEFAULT 0,
      waveform TEXT NOT NULL DEFAULT '[]',
      transcript TEXT,
      transcriptStatus TEXT NOT NULL DEFAULT 'none',
      FOREIGN KEY (categoryId) REFERENCES categories(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS segments (
      id TEXT PRIMARY KEY NOT NULL,
      entryId TEXT NOT NULL,
      uri TEXT NOT NULL,
      durationMs INTEGER NOT NULL DEFAULT 0,
      orderIndex INTEGER NOT NULL DEFAULT 0,
      createdAt INTEGER NOT NULL,
      FOREIGN KEY (entryId) REFERENCES entries(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT
    );
  `);

	// migration: nameTemplate column (added after initial release) - ignore if it already exists
	try {
		await dbInstance.execAsync(
			'ALTER TABLE categories ADD COLUMN nameTemplate TEXT',
		);
	} catch (e) {
		// column already exists
	}

	// migration: transcriptLanguage column (added for the Transcribe page rebuild) - ignore if
	// it already exists
	try {
		await dbInstance.execAsync(
			'ALTER TABLE entries ADD COLUMN transcriptLanguage TEXT',
		);
	} catch (e) {
		// column already exists
	}

	// migration: externalUri column (added so deleting a recording can also offer to delete its
	// mirrored copy in the user's chosen Saving folder, if one was made) - ignore if it already
	// exists. NULL means "no mirrored copy exists for this segment" (folder wasn't connected yet,
	// mirroring failed, or it hasn't been backfilled).
	try {
		await dbInstance.execAsync(
			'ALTER TABLE segments ADD COLUMN externalUri TEXT',
		);
	} catch (e) {
		// column already exists
	}

	// migration: icon column on categories (emoji shown on Home tag boxes, Library rows, and
	// tag pickers) - ignore if it already exists. NULL is handled at render time by
	// utils/tagColors.iconForCategory, so no immediate backfill is required here beyond the
	// one below for categories that predate this migration.
	try {
		await dbInstance.execAsync('ALTER TABLE categories ADD COLUMN icon TEXT');
	} catch (e) {
		// column already exists
	}

	// migration: sourceType column on entries ('recorded' | 'trimmed' | 'merged' | 'appended')
	// - lets the Home pie chart split Trim/Merge/Append output into their own slices instead
	// of mixing them into ordinary tag slices, since each one is a derivative of an existing
	// recording rather than a fresh session. Ignore if it already exists.
	try {
		await dbInstance.execAsync(
			'ALTER TABLE entries ADD COLUMN sourceType TEXT',
		);
	} catch (e) {
		// column already exists
	}
	await dbInstance.runAsync(
		"UPDATE entries SET sourceType = 'recorded' WHERE sourceType IS NULL",
	);

	// indexes for the Home screen's per-tag streaks, line chart, and heatmap - these all
	// aggregate by createdAt/categoryId and should stay fast as entries grow into the
	// hundreds/thousands rather than degrading into full table scans.
	await dbInstance.execAsync(
		'CREATE INDEX IF NOT EXISTS idx_entries_createdAt ON entries(createdAt)',
	);
	await dbInstance.execAsync(
		'CREATE INDEX IF NOT EXISTS idx_entries_categoryId ON entries(categoryId)',
	);

	// backfill: any category created before the icon migration gets a stable default icon
	// (rather than staying NULL forever) so old tags don't look "unfinished" next to newly
	// created ones once Phase 3/4 start rendering icons everywhere.
	await dbInstance.runAsync(
		`UPDATE categories SET icon = ? WHERE icon IS NULL`,
		[DEFAULT_TAG_ICON],
	);

	// seed default categories on first run
	const row = await dbInstance.getFirstAsync(
		'SELECT COUNT(*) as c FROM categories',
	);
	if (row.c === 0) {
		const defaults = [
			{ name: 'Diary', prefix: 'Diary', icon: 'book' },
			{ name: 'Thoughts', prefix: 'Thought', icon: 'message-circle' },
			{ name: 'Rant', prefix: 'Rant', icon: 'activity' },
		];
		for (let i = 0; i < defaults.length; i++) {
			await dbInstance.runAsync(
				'INSERT INTO categories (id, name, prefix, counter, color, sortOrder, nameTemplate, icon) VALUES (?, ?, ?, 0, ?, ?, ?, ?)',
				[
					`cat_${Date.now()}_${i}`,
					defaults[i].name,
					defaults[i].prefix,
					colorForIndex(i),
					i,
					'{tag} <count>',
					defaults[i].icon,
				],
			);
		}
	} else {
		// backfill nameTemplate for any existing categories created before this migration
		await dbInstance.runAsync(
			"UPDATE categories SET nameTemplate = '{tag} <count>' WHERE nameTemplate IS NULL",
		);
	}

	// seed a couple of global settings rows used for untagged-recording naming
	const untaggedTemplate = await dbInstance.getFirstAsync(
		"SELECT value FROM settings WHERE key = 'untaggedTemplate'",
	);
	if (!untaggedTemplate) {
		await dbInstance.runAsync(
			"INSERT INTO settings (key, value) VALUES ('untaggedTemplate', 'Recording <count> <date>')",
		);
	}
	const untaggedCounter = await dbInstance.getFirstAsync(
		"SELECT value FROM settings WHERE key = 'untaggedCounter'",
	);
	if (!untaggedCounter) {
		await dbInstance.runAsync(
			"INSERT INTO settings (key, value) VALUES ('untaggedCounter', '0')",
		);
	}

	// seed default naming templates for derived recordings (Trim/Merge/Append each create a new
	// entry rather than overwriting the source, so each gets its own default naming template)
	const templateDefaults = [
		['trimTemplate', '{name} trimmed <date:DD-MM-YYYY> <time:hh:mm>'],
		['mergeTemplate', '{name} merged <date:DD-MM-YYYY> <time:hh:mm>'],
		['appendTemplate', '{name} append <date:DD-MM-YYYY> <time:hh:mm>'],
	];
	for (const [key, defaultValue] of templateDefaults) {
		const row = await dbInstance.getFirstAsync(
			'SELECT value FROM settings WHERE key = ?',
			[key],
		);
		if (!row) {
			await dbInstance.runAsync(
				'INSERT INTO settings (key, value) VALUES (?, ?)',
				[key, defaultValue],
			);
		}
	}

	return dbInstance;
}

export function newId(prefix = 'id') {
	return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
}
