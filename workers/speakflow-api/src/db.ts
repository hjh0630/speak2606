/**
 * D1-backed async DB facade.
 *
 * Mirrors the subset of better-sqlite3 we use (.prepare().run/.get/.all),
 * but always async because D1 is HTTP-bound.
 *
 * D1 specifics:
 *  - `.prepare(sql).bind(...).run()` returns `{ success, meta: { changes, last_row_id, duration } }`
 *  - `.prepare(sql).bind(...).first<T>()` returns the first row or null
 *  - `.prepare(sql).bind(...).all<T>()` returns `{ results: T[], success, meta }`
 *  - `db.batch([stmt1, stmt2])` is the transaction primitive (no .transaction())
 *
 * Replaces backend/src/db.ts which had a sync better-sqlite3 path AND a Turso
 * async path. Workers only needs the async path.
 */
import type { D1Database } from '@cloudflare/workers-types';

export interface QueryResult {
  rowsAffected: number;
  lastInsertRowid: number;
}

export async function runAsync(
  db: D1Database,
  sql: string,
  args: unknown[] = [],
): Promise<QueryResult> {
  const stmt = db.prepare(sql).bind(...(args as never[]));
  const r = await stmt.run();
  return {
    rowsAffected: r.meta.changes ?? 0,
    lastInsertRowid: Number(r.meta.last_row_id ?? 0),
  };
}

export async function getAsync<T = Record<string, unknown>>(
  db: D1Database,
  sql: string,
  args: unknown[] = [],
): Promise<T | undefined> {
  const stmt = db.prepare(sql).bind(...(args as never[]));
  const row = await stmt.first<T>();
  return row ?? undefined;
}

export async function allAsync<T = Record<string, unknown>>(
  db: D1Database,
  sql: string,
  args: unknown[] = [],
): Promise<T[]> {
  const stmt = db.prepare(sql).bind(...(args as never[]));
  const r = await stmt.all<T>();
  return r.results ?? [];
}

/**
 * Run multiple statements atomically. D1's batch() is the transaction primitive.
 */
export async function batchAsync(
  db: D1Database,
  stmts: Array<{ sql: string; args?: unknown[] }>,
): Promise<void> {
  const prepared = stmts.map((s) =>
    db.prepare(s.sql).bind(...((s.args ?? []) as never[])),
  );
  await db.batch(prepared);
}

/**
 * Run all CREATE TABLE / CREATE INDEX migrations in schema.sql on cold start.
 * Idempotent (all use IF NOT EXISTS).
 */
export async function bootstrapDb(db: D1Database): Promise<void> {
  const migrations: string[] = [
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
  for (const sql of migrations) {
    await db.prepare(sql).run();
  }
}
