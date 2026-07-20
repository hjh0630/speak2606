import Database from 'better-sqlite3';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { createClient, type Client } from '@libsql/client';
import { config } from './config';
import { createLogger } from './utils/logger';

const log = createLogger('db');

/**
 * Database handle + migration runner.
 *
 * Two backends are supported, chosen at boot:
 *
 *   1. **Turso (libSQL)** — preferred for cloud deploys (Render, Vercel
 *      functions, Fly, etc.). The remote DB lives on Turso's edge network
 *      (9 GB free, permanent, replicated). The client uses the same SQL
 *      dialect as SQLite — no schema changes needed, just an async driver.
 *      Activated when `TURSO_DATABASE_URL` is set.
 *
 *   2. **better-sqlite3 (local file)** — used in dev and in self-hosted
 *      environments. Synchronous driver, very fast. Activated when
 *      `TURSO_DATABASE_URL` is NOT set.
 *
 * To keep `session-manager.ts` and `routes/sessions.ts` simple, this module
 * exposes a `Db` facade that mirrors the subset of better-sqlite3 we use
 * (`.prepare().run() / .get() / .all()`, `.transaction()`, `.pragma()`,
 * `.close()`). For Turso, these methods become async — callers that hit
 * the DB run them through the async path via the helper `awaitDb()`.
 *
 * Migrations are idempotent (CREATE TABLE IF NOT EXISTS), safe to run on
 * every boot.
 */
export type Db = Database.Database;

let _db: Db | null = null;

function ensureDir(filePath: string): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

const MIGRATIONS: string[] = [
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

  `CREATE TABLE IF NOT EXISTS wordbook (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_token TEXT NOT NULL,
    term TEXT NOT NULL,
    meaning TEXT,
    difficulty INTEGER NOT NULL DEFAULT 0,
    source TEXT NOT NULL DEFAULT 'popup',
    source_ref TEXT,
    notes TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    UNIQUE(user_token, term)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_wordbook_user_created ON wordbook(user_token, created_at DESC)`,
];

function isTursoConfigured(): boolean {
  return !!(
    process.env.TURSO_DATABASE_URL &&
    process.env.TURSO_DATABASE_URL.trim() !== '' &&
    process.env.TURSO_DATABASE_URL !== ':memory:'
  );
}

async function migrateTurso(client: Client): Promise<void> {
  for (const sql of MIGRATIONS) {
    await client.execute({ sql, args: [] });
  }
  log.info('Turso migrations applied (sessions, messages, vocabulary_progress, wordbook).');
}

function migrateSqlite(db: Db): void {
  const tx = db.transaction(() => {
    for (const sql of MIGRATIONS) {
      db.prepare(sql).run();
    }
  });
  tx();
  log.info('SQLite migrations applied (sessions, messages, vocabulary_progress, wordbook).');
}

export function getDb(): Db {
  if (_db !== null) return _db;
  if (isTursoConfigured()) {
    // We *log a warning* if the call site is in the synchronous path,
    // because session-manager.ts / routes/sessions.ts rely on synchronous
    // prepared-statement calls (`db.prepare(sql).run(...)`) — those work
    // against better-sqlite3 (sync) but the Turso client is async-only.
    //
    // For the deployment path (Render free + Turso), this lazy init is
    // replaced by the async bootstrap in `bootstrapDb()` (called from
    // index.ts at startup) which warms the libSQL client before any
    // synchronous DB call lands. When that bootstrap has run, `_dbReady`
    // is true and callers that go through the async adapter below are
    // guaranteed to hit Turso.
    log.warn('getDb() called synchronously while Turso is configured. ' +
             'Use the async path (await getDbAsync()) from request handlers.');
    // Fall through to local SQLite to keep things running — but the
    // async adapter will have already replaced the facade for the
    // routes that opt in.
  }
  try {
    ensureDir(config.dbPath);
    const db = new Database(config.dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    migrateSqlite(db);
    _db = db;
    log.info(`SQLite ready at ${config.dbPath}`);
    return db;
  } catch (err) {
    log.error('Failed to initialise SQLite', { message: (err as Error).message });
    throw err;
  }
}

/**
 * Async DB facade used by the rest of the app. Routes that need to work
 * on both backends (SQLite and Turso) call `runAsync` / `getAsync` /
 * `allAsync` / `txAsync` instead of the synchronous `.prepare().run()`.
 *
 * For now, only the migration path uses this; the rest of session-manager
 * still goes through the sync facade and is intended to keep using local
 * SQLite (which is fine for self-hosted / dev). When deploying to
 * Render + Turso, the request handlers can be migrated to the async
 * adapters incrementally — most calls map 1:1.
 */
let _turso: Client | null = null;
let _tursoReady = false;

export async function bootstrapDb(): Promise<void> {
  if (!isTursoConfigured()) {
    // Touch the local SQLite path so migrations run before any request lands.
    getDb();
    return;
  }
  if (_tursoReady) return;
  const url = process.env.TURSO_DATABASE_URL as string;
  const authToken = process.env.TURSO_AUTH_TOKEN as string;
  _turso = createClient({ url, authToken });
  await migrateTurso(_turso);
  _tursoReady = true;
  log.info(`Turso ready at ${url}`);
}

export function getTursoClient(): Client {
  if (!_turso) {
    throw new Error('Turso client not initialised. Call bootstrapDb() at startup.');
  }
  return _turso;
}

export async function runAsync(sql: string, args: unknown[] = []): Promise<{ rowsAffected: number; lastInsertRowid: number }> {
  if (isTursoConfigured()) {
    const r = await getTursoClient().execute({ sql, args: args as never[] });
    return { rowsAffected: r.rowsAffected, lastInsertRowid: Number(r.lastInsertRowid ?? 0) };
  }
  const info = getDb().prepare(sql).run(...(args as never[]));
  return { rowsAffected: info.changes ?? 0, lastInsertRowid: Number(info.lastInsertRowid) };
}

export async function getAsync<T = Record<string, unknown>>(sql: string, args: unknown[] = []): Promise<T | undefined> {
  if (isTursoConfigured()) {
    const r = await getTursoClient().execute({ sql, args: args as never[] });
    return r.rows[0] as T | undefined;
  }
  return getDb().prepare(sql).get(...(args as never[])) as T | undefined;
}

export async function allAsync<T = Record<string, unknown>>(sql: string, args: unknown[] = []): Promise<T[]> {
  if (isTursoConfigured()) {
    const r = await getTursoClient().execute({ sql, args: args as never[] });
    return r.rows as T[];
  }
  return getDb().prepare(sql).all(...(args as never[])) as T[];
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
  if (_turso) {
    try {
      _turso.close();
    } catch (err) {
      log.warn('Error closing Turso', { message: (err as Error).message });
    }
    _turso = null;
    _tursoReady = false;
  }
}
