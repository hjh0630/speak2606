import Database from 'better-sqlite3';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { config } from './config';
import { createLogger } from './utils/logger';

const log = createLogger('db');

/**
 * SQLite handle + migration runner.
 * Migrations are idempotent (CREATE TABLE IF NOT EXISTS), so the function is safe to call on every boot.
 */
export type Db = Database.Database;

let _db: Db | null = null;

function ensureDir(filePath: string): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function migrate(db: Db): void {
  // Single-file migration. Each statement is idempotent. Add new schema blocks at the bottom.
  const statements: string[] = [
    `CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      scenario_id TEXT NOT NULL,
      difficulty TEXT NOT NULL,
      mode TEXT NOT NULL,
      started_at INTEGER NOT NULL,
      ended_at INTEGER,
      total_score REAL,
      status TEXT NOT NULL DEFAULT 'active',
      round_index INTEGER NOT NULL DEFAULT 0
    )`,
    `CREATE INDEX IF NOT EXISTS idx_sessions_started_at ON sessions(started_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status)`,

    `CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      audio_url TEXT,
      score REAL,
      fluency REAL,
      accuracy REAL,
      feedback_json TEXT,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
    )`,
    `CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id, created_at)`,

    `CREATE TABLE IF NOT EXISTS vocabulary_progress (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      term TEXT NOT NULL UNIQUE,
      correct_count INTEGER NOT NULL DEFAULT 0,
      wrong_count INTEGER NOT NULL DEFAULT 0,
      last_seen INTEGER NOT NULL
    )`,
  ];

  const tx = db.transaction(() => {
    for (const sql of statements) {
      db.prepare(sql).run();
    }
  });
  tx();

  log.info('SQLite migrations applied (sessions, messages, vocabulary_progress).');
}

export function getDb(): Db {
  if (_db !== null) return _db;
  try {
    ensureDir(config.dbPath);
    const db = new Database(config.dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    migrate(db);
    _db = db;
    log.info(`SQLite ready at ${config.dbPath}`);
    return db;
  } catch (err) {
    log.error('Failed to initialise SQLite', { message: (err as Error).message });
    throw err;
  }
}

export function closeDb(): void {
  if (_db !== null) {
    try {
      _db.close();
    } catch (err) {
      log.warn('Error closing SQLite', { message: (err as Error).message });
    }
    _db = null;
  }
}
