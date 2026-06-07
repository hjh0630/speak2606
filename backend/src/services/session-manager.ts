import { randomUUID } from 'node:crypto';
import { getDb } from '../db';
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

/**
 * Session + message persistence layer.
 *
 * - sessions.id: UUID
 * - messages: append-only log of (user, assistant, system) turns
 * - The manager also keeps an in-memory cache of the recent message list per session,
 *   so we can build the LLM context window without a DB roundtrip on every call.
 *
 *   The cache is the source of truth for `getMessages`; the DB is the source of truth for
 *   history / stats. Both are kept in sync.
 */

interface SessionCache {
  record: SessionRecord;
  messages: MessageRecord[];
}

const cache = new Map<string, SessionCache>();

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

export interface CreateSessionInput {
  scenario_id: string;
  difficulty: Difficulty;
  mode: SessionMode;
}

export function createSession(input: CreateSessionInput): SessionRecord {
  if (!isValidDifficulty(input.difficulty)) {
    throw new ValidationError(`invalid difficulty: ${String(input.difficulty)}`);
  }
  if (!isValidMode(input.mode)) {
    throw new ValidationError(`invalid mode: ${String(input.mode)}`);
  }
  if (!input.scenario_id || typeof input.scenario_id !== 'string') {
    throw new ValidationError('scenario_id is required');
  }
  const id = randomUUID();
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
    getDb()
      .prepare(
        `INSERT INTO sessions (id, scenario_id, difficulty, mode, started_at, status, round_index)
         VALUES (?, ?, ?, ?, ?, ?, 0)`,
      )
      .run(record.id, record.scenario_id, record.difficulty, record.mode, record.started_at, record.status);
  } catch (err) {
    log.error(`Failed to insert session: ${(err as Error).message}`);
    throw err;
  }
  cache.set(id, { record, messages: [] });
  return record;
}

export function getSession(id: string): SessionRecord | null {
  if (!id) return null;
  const cached = cache.get(id);
  if (cached) return cached.record;
  try {
    const row = getDb()
      .prepare(
        `SELECT id, scenario_id, difficulty, mode, started_at, ended_at, total_score, status, round_index
         FROM sessions WHERE id = ?`,
      )
      .get(id) as
      | {
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
      | undefined;
    if (!row) return null;
    if (!isValidDifficulty(row.difficulty) || !isValidMode(row.mode)) return null;
    const record: SessionRecord = {
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
    return record;
  } catch (err) {
    log.warn(`getSession failed for ${id}: ${(err as Error).message}`);
    return null;
  }
}

function loadMessagesFromDb(sessionId: string): MessageRecord[] {
  try {
    const rows = getDb()
      .prepare(
        `SELECT id, session_id, role, content, audio_url, score, fluency, accuracy, feedback_json, created_at
         FROM messages WHERE session_id = ? ORDER BY created_at ASC, id ASC`,
      )
      .all(sessionId) as Array<{
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
    }>;
    return rows
      .filter((r) => isValidRole(r.role))
      .map((r) => ({
        id: r.id,
        session_id: r.session_id,
        role: r.role as MessageRole,
        content: r.content,
        audio_url: r.audio_url,
        score: r.score,
        fluency: r.fluency,
        accuracy: r.accuracy,
        feedback_json: r.feedback_json,
        created_at: r.created_at,
      }));
  } catch (err) {
    log.warn(`loadMessagesFromDb failed for ${sessionId}: ${(err as Error).message}`);
    return [];
  }
}

export function getMessages(sessionId: string): MessageRecord[] {
  const cached = cache.get(sessionId);
  if (cached) return cached.messages;
  const rec = getSession(sessionId);
  if (!rec) return [];
  const messages = loadMessagesFromDb(sessionId);
  cache.set(sessionId, { record: rec, messages });
  return messages;
}

export interface AppendMessageInput {
  role: MessageRole;
  content: string;
  audioUrl?: string | null;
  score?: ScoreFeedback | null;
}

export function appendMessage(sessionId: string, input: AppendMessageInput): MessageRecord {
  if (!isValidRole(input.role)) {
    throw new ValidationError(`invalid role: ${String(input.role)}`);
  }
  const createdAt = now();
  const feedbackJson = input.score ? JSON.stringify(input.score) : null;
  let id: number = 0;
  try {
    const stmt = getDb().prepare(
      `INSERT INTO messages (session_id, role, content, audio_url, score, fluency, accuracy, feedback_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const info = stmt.run(
      sessionId,
      input.role,
      input.content,
      input.audioUrl ?? null,
      input.score?.overall_score ?? null,
      input.score?.fluency ?? null,
      input.score?.accuracy ?? null,
      feedbackJson,
      createdAt,
    );
    id = Number(info.lastInsertRowid);
  } catch (err) {
    log.error(`Failed to insert message: ${(err as Error).message}`);
    throw err;
  }
  const record: MessageRecord = {
    id,
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
  const cached = cache.get(sessionId);
  if (cached) {
    cached.messages.push(record);
  }
  return record;
}

export function advanceRound(sessionId: string): number {
  const rec = getSession(sessionId);
  if (!rec) return 0;
  const next = rec.round_index + 1;
  try {
    getDb().prepare(`UPDATE sessions SET round_index = ? WHERE id = ?`).run(next, sessionId);
    rec.round_index = next;
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

export function completeSession(sessionId: string, totalScore: number | null): CompleteSessionResult | null {
  const rec = getSession(sessionId);
  if (!rec) return null;
  const endedAt = now();
  try {
    getDb()
      .prepare(`UPDATE sessions SET ended_at = ?, total_score = ?, status = 'completed' WHERE id = ?`)
      .run(endedAt, totalScore, sessionId);
  } catch (err) {
    log.error(`Failed to complete session: ${(err as Error).message}`);
    throw err;
  }
  rec.ended_at = endedAt;
  rec.total_score = totalScore;
  rec.status = 'completed';
  const messages = getMessages(sessionId);
  const messageCount = messages.length;
  const durationSec = Math.max(0, Math.round((endedAt - rec.started_at) / 1000));
  return { totalScore: totalScore ?? 0, messageCount, durationSec };
}

export function toLlmContext(messages: MessageRecord[]): LlmChatMessage[] {
  return messages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({ role: m.role, content: m.content }));
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
