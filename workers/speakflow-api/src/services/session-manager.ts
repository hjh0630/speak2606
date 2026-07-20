/**
 * Session + message persistence (D1 async version).
 *
 * Drops the in-memory cache that the backend had — Workers isolates don't
 * share state, so a session present in one isolate's cache looks "missing"
 * to another. Every read goes to D1 (single-row SELECT = ~5 ms, acceptable).
 *
 * If perf becomes an issue, the next step is Durable Objects (one DO per
 * session) with hibernation. Out of scope for V1.
 */
import type { D1Database } from '@cloudflare/workers-types';
import { runAsync, getAsync, allAsync } from '../db';
import { createLogger } from '../utils/logger';
import type {
  Difficulty,
  LlmChatMessage,
  MessageRecord,
  MessageRole,
  ScoreFeedback,
  SessionMode,
  SessionRecord,
} from '../types';

const log = createLogger('session-manager');

function now(): number {
  return Date.now();
}

function isValidDifficulty(d: unknown): d is Difficulty {
  return d === 'beginner' || d === 'intermediate' || d === 'advanced';
}
function isValidMode(m: unknown): m is SessionMode {
  return m === 'free' || m === 'repeat';
}
function isValidRole(r: unknown): r is MessageRole {
  return r === 'user' || r === 'assistant' || r === 'system';
}

export class ValidationError extends Error {
  readonly code = 'VALIDATION_ERROR';
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends Error {
  readonly code = 'NOT_FOUND';
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

export interface CreateSessionInput {
  scenario_id: string;
  difficulty: Difficulty;
  mode: SessionMode;
}

export async function createSession(
  db: D1Database,
  input: CreateSessionInput,
): Promise<SessionRecord> {
  if (!isValidDifficulty(input.difficulty)) {
    throw new ValidationError(`invalid difficulty: ${String(input.difficulty)}`);
  }
  if (!isValidMode(input.mode)) {
    throw new ValidationError(`invalid mode: ${String(input.mode)}`);
  }
  if (!input.scenario_id || typeof input.scenario_id !== 'string') {
    throw new ValidationError('scenario_id is required');
  }
  const id = crypto.randomUUID();
  const record: SessionRecord = {
    id,
    scenario_id: input.scenario_id,
    difficulty: input.difficulty,
    mode: input.mode,
    started_at: now(),
    ended_at: null,
    total_score: null,
    status: 'active',
    round_index: 0,
  };
  try {
    await runAsync(
      db,
      `INSERT INTO sessions (id, scenario_id, difficulty, mode, started_at, status, round_index)
       VALUES (?, ?, ?, ?, ?, ?, 0)`,
      [record.id, record.scenario_id, record.difficulty, record.mode, record.started_at, record.status],
    );
  } catch (err) {
    log.error(`Failed to insert session: ${(err as Error).message}`);
    throw err;
  }
  return record;
}

interface SessionRow {
  id: string;
  scenario_id: string;
  difficulty: string;
  mode: string;
  started_at: number;
  ended_at: number | null;
  total_score: number | null;
  status: string;
  round_index: number;
}

function rowToSession(row: SessionRow): SessionRecord | null {
  if (!isValidDifficulty(row.difficulty) || !isValidMode(row.mode)) return null;
  return {
    id: row.id,
    scenario_id: row.scenario_id,
    difficulty: row.difficulty,
    mode: row.mode,
    started_at: row.started_at,
    ended_at: row.ended_at,
    total_score: row.total_score,
    status: row.status === 'completed' ? 'completed' : 'active',
    round_index: row.round_index ?? 0,
  };
}

export async function getSession(db: D1Database, id: string): Promise<SessionRecord | null> {
  if (!id) return null;
  try {
    const row = await getAsync<SessionRow>(
      db,
      `SELECT id, scenario_id, difficulty, mode, started_at, ended_at, total_score, status, round_index
       FROM sessions WHERE id = ?`,
      [id],
    );
    if (!row) return null;
    return rowToSession(row);
  } catch (err) {
    log.warn(`getSession failed for ${id}: ${(err as Error).message}`);
    return null;
  }
}

interface MessageRow {
  id: number;
  session_id: string;
  role: string;
  content: string;
  audio_url: string | null;
  score: number | null;
  fluency: number | null;
  accuracy: number | null;
  feedback_json: string | null;
  created_at: number;
}

function rowToMessage(r: MessageRow): MessageRecord | null {
  if (!isValidRole(r.role)) return null;
  return {
    id: r.id,
    session_id: r.session_id,
    role: r.role,
    content: r.content,
    audio_url: r.audio_url,
    score: r.score,
    fluency: r.fluency,
    accuracy: r.accuracy,
    feedback_json: r.feedback_json,
    created_at: r.created_at,
  };
}

export async function getMessages(db: D1Database, sessionId: string): Promise<MessageRecord[]> {
  try {
    const rows = await allAsync<MessageRow>(
      db,
      `SELECT id, session_id, role, content, audio_url, score, fluency, accuracy, feedback_json, created_at
       FROM messages WHERE session_id = ? ORDER BY created_at ASC, id ASC`,
      [sessionId],
    );
    return rows.map(rowToMessage).filter((m): m is MessageRecord => m !== null);
  } catch (err) {
    log.warn(`getMessages failed for ${sessionId}: ${(err as Error).message}`);
    return [];
  }
}

export interface AppendMessageInput {
  role: MessageRole;
  content: string;
  audioUrl?: string | null;
  score?: ScoreFeedback | null;
}

export async function appendMessage(
  db: D1Database,
  sessionId: string,
  input: AppendMessageInput,
): Promise<MessageRecord> {
  if (!isValidRole(input.role)) {
    throw new ValidationError(`invalid role: ${String(input.role)}`);
  }
  const createdAt = now();
  const feedbackJson = input.score ? JSON.stringify(input.score) : null;
  const { lastInsertRowid } = await runAsync(
    db,
    `INSERT INTO messages (session_id, role, content, audio_url, score, fluency, accuracy, feedback_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      sessionId,
      input.role,
      input.content,
      input.audioUrl ?? null,
      input.score?.overall_score ?? null,
      input.score?.fluency ?? null,
      input.score?.accuracy ?? null,
      feedbackJson,
      createdAt,
    ],
  );
  return {
    id: lastInsertRowid,
    session_id: sessionId,
    role: input.role,
    content: input.content,
    audio_url: input.audioUrl ?? null,
    score: input.score?.overall_score ?? null,
    fluency: input.score?.fluency ?? null,
    accuracy: input.score?.accuracy ?? null,
    feedback_json: feedbackJson,
    created_at: createdAt,
  };
}

export async function advanceRound(db: D1Database, sessionId: string): Promise<number> {
  const rec = await getSession(db, sessionId);
  if (!rec) return 0;
  const next = rec.round_index + 1;
  try {
    await runAsync(db, `UPDATE sessions SET round_index = ? WHERE id = ?`, [next, sessionId]);
  } catch (err) {
    log.warn(`Failed to advance round: ${(err as Error).message}`);
  }
  return next;
}

export interface CompleteSessionResult {
  totalScore: number;
  messageCount: number;
  durationSec: number;
}

export async function completeSession(
  db: D1Database,
  sessionId: string,
  totalScore: number | null,
): Promise<CompleteSessionResult | null> {
  const rec = await getSession(db, sessionId);
  if (!rec) return null;
  const endedAt = now();
  try {
    await runAsync(
      db,
      `UPDATE sessions SET ended_at = ?, total_score = ?, status = 'completed' WHERE id = ?`,
      [endedAt, totalScore, sessionId],
    );
  } catch (err) {
    log.error(`Failed to complete session: ${(err as Error).message}`);
    throw err;
  }
  const messages = await getMessages(db, sessionId);
  return {
    totalScore: totalScore ?? 0,
    messageCount: messages.length,
    durationSec: Math.max(0, Math.round((endedAt - rec.started_at) / 1000)),
  };
}

export function toLlmContext(messages: MessageRecord[]): LlmChatMessage[] {
  return messages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({ role: m.role, content: m.content }));
}
