/**
 * /api/history routes — list and detail.
 */
import { Hono } from 'hono';
import { allAsync, getAsync } from '../db';
import { getMessages } from '../services/session-manager';
import { getScenarios } from '../services/content';
import type { Difficulty, MessageRecord, SessionMode, SessionRecord } from '../types';
import type { Bindings } from '../env';

export const historyRoutes = new Hono<{ Bindings: Bindings }>();

function clampInt(raw: string | undefined, lo: number, hi: number, fallback: number): number {
  if (raw === undefined || raw === '') return fallback;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(lo, Math.min(hi, n));
}

historyRoutes.get('/api/history', async (c) => {
  try {
    const db = c.env.DB;
    const limit = clampInt(c.req.query('limit'), 1, 200, 50);
    const offset = clampInt(c.req.query('offset'), 0, 1_000_000, 0);
    const rows = await allAsync<{
      id: string;
      scenario_id: string;
      difficulty: string;
      mode: string;
      started_at: number;
      ended_at: number | null;
      total_score: number | null;
      status: string;
      round_index: number;
    }>(
      db,
      `SELECT id, scenario_id, difficulty, mode, started_at, ended_at, total_score, status, round_index
       FROM sessions
       ORDER BY started_at DESC
       LIMIT ? OFFSET ?`,
      [limit, offset],
    );

    // Count messages per session in a single query to avoid N+1.
    const ids = rows.map((r) => r.id);
    const messageCounts = new Map<string, number>();
    if (ids.length > 0) {
      const placeholders = ids.map(() => '?').join(',');
      const cntRows = await allAsync<{ session_id: string; c: number }>(
        db,
        `SELECT session_id, COUNT(*) AS c FROM messages WHERE session_id IN (${placeholders}) GROUP BY session_id`,
        ids,
      );
      for (const r of cntRows) messageCounts.set(r.session_id, r.c);
    }

    const items: Array<SessionRecord & { message_count: number; duration_sec: number }> = rows.map((r) => ({
      id: r.id,
      scenario_id: r.scenario_id,
      difficulty: r.difficulty as Difficulty,
      mode: r.mode as SessionMode,
      started_at: r.started_at,
      ended_at: r.ended_at,
      total_score: r.total_score,
      status: r.status === 'completed' ? 'completed' : 'active',
      round_index: r.round_index ?? 0,
      message_count: messageCounts.get(r.id) ?? 0,
      duration_sec:
        r.ended_at !== null
          ? Math.max(0, Math.round((r.ended_at - r.started_at) / 1000))
          : Math.max(0, Math.round((Date.now() - r.started_at) / 1000)),
    }));

    const total =
      (await getAsync<{ c: number }>(db, `SELECT COUNT(*) AS c FROM sessions`))?.c ?? 0;

    return c.json({ items, total, limit, offset });
  } catch (err) {
    return c.json(
      { error: { code: 'HISTORY_LIST_FAILED', message: (err as Error).message } },
      500,
    );
  }
});

historyRoutes.get('/api/history/:id', async (c) => {
  const id = c.req.param('id');
  try {
    const db = c.env.DB;
    const row = await getAsync<{
      id: string;
      scenario_id: string;
      difficulty: string;
      mode: string;
      started_at: number;
      ended_at: number | null;
      total_score: number | null;
      status: string;
      round_index: number;
    }>(
      db,
      `SELECT id, scenario_id, difficulty, mode, started_at, ended_at, total_score, status, round_index
       FROM sessions WHERE id = ?`,
      [id],
    );
    if (!row) {
      return c.json(
        { error: { code: 'HISTORY_NOT_FOUND', message: `history '${id}' not found` } },
        404,
      );
    }
    const messages: MessageRecord[] = await getMessages(db, id);
    const userTurns = messages.filter((m) => m.role === 'user');
    const scores = userTurns
      .map((m) => (typeof m.score === 'number' ? m.score : null))
      .filter((s): s is number => s !== null);
    const avg = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
    const scenarios = getScenarios();
    const scenario = scenarios.find((s) => s.id === row.scenario_id) ?? null;
    return c.json({
      session: {
        id: row.id,
        scenario_id: row.scenario_id,
        difficulty: row.difficulty,
        mode: row.mode,
        started_at: row.started_at,
        ended_at: row.ended_at,
        total_score: row.total_score,
        status: row.status,
        round_index: row.round_index ?? 0,
      },
      scenario,
      messages,
      user_turn_count: userTurns.length,
      avg_score: avg,
      duration_sec:
        row.ended_at !== null
          ? Math.max(0, Math.round((row.ended_at - row.started_at) / 1000))
          : Math.max(0, Math.round((Date.now() - row.started_at) / 1000)),
    });
  } catch (err) {
    return c.json(
      { error: { code: 'HISTORY_FETCH_FAILED', message: (err as Error).message } },
      500,
    );
  }
});
