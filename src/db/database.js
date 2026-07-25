import * as SQLite from 'expo-sqlite';

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
    await dbInstance.execAsync('ALTER TABLE categories ADD COLUMN nameTemplate TEXT');
  } catch (e) {
    // column already exists
  }

  // seed default categories on first run
  const row = await dbInstance.getFirstAsync('SELECT COUNT(*) as c FROM categories');
  if (row.c === 0) {
    const defaults = [
      { name: 'Diary', prefix: 'Diary' },
      { name: 'Thoughts', prefix: 'Thought' },
      { name: 'Rant', prefix: 'Rant' },
    ];
    for (let i = 0; i < defaults.length; i++) {
      await dbInstance.runAsync(
        'INSERT INTO categories (id, name, prefix, counter, color, sortOrder, nameTemplate) VALUES (?, ?, ?, 0, ?, ?, ?)',
        [`cat_${Date.now()}_${i}`, defaults[i].name, defaults[i].prefix, ['#6C8EF5', '#F5A65C', '#E56C6C'][i], i, '{tag} <count>']
      );
    }
  } else {
    // backfill nameTemplate for any existing categories created before this migration
    await dbInstance.runAsync(
      "UPDATE categories SET nameTemplate = '{tag} <count>' WHERE nameTemplate IS NULL"
    );
  }

  // seed a couple of global settings rows used for untagged-recording naming
  const untaggedTemplate = await dbInstance.getFirstAsync("SELECT value FROM settings WHERE key = 'untaggedTemplate'");
  if (!untaggedTemplate) {
    await dbInstance.runAsync("INSERT INTO settings (key, value) VALUES ('untaggedTemplate', 'Recording <count> <date>')");
  }
  const untaggedCounter = await dbInstance.getFirstAsync("SELECT value FROM settings WHERE key = 'untaggedCounter'");
  if (!untaggedCounter) {
    await dbInstance.runAsync("INSERT INTO settings (key, value) VALUES ('untaggedCounter', '0')");
  }

  return dbInstance;
}

export function newId(prefix = 'id') {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
}
