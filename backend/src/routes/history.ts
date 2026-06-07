import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { getDb } from '../db';
import { getMessages } from '../services/session-manager';
import { getScenarios } from '../services/content';
import type { ApiErrorBody, Difficulty, MessageRecord, SessionMode, SessionRecord } from '../types';

const historyRoutes: FastifyPluginAsync = async (app: FastifyInstance): Promise<void> => {
  // GET /api/history
  app.get<{ Querystring: { limit?: string; offset?: string } }>('/api/history', async (req, reply) => {
    try {
      const limit = clampInt(req.query?.limit, 1, 200, 50);
      const offset = clampInt(req.query?.offset, 0, 1_000_000, 0);
      const rows = getDb()
        .prepare(
          `SELECT id, scenario_id, difficulty, mode, started_at, ended_at, total_score, status, round_index
           FROM sessions
           ORDER BY started_at DESC
           LIMIT ? OFFSET ?`,
        )
        .all(limit, offset) as Array<{
        id: string;
        scenario_id: string;
        difficulty: string;
        mode: string;
        started_at: number;
        ended_at: number | null;
        total_score: number | null;
        status: string;
        round_index: number;
      }>;
      const items: Array<SessionRecord & { message_count: number; duration_sec: number }> = rows.map(
        (r) => ({
          id: r.id,
          scenario_id: r.scenario_id,
          difficulty: r.difficulty as Difficulty,
          mode: r.mode as SessionMode,
          started_at: r.started_at,
          ended_at: r.ended_at,
          total_score: r.total_score,
          status: r.status === 'completed' ? 'completed' : 'active',
          round_index: r.round_index ?? 0,
          message_count: countMessages(r.id),
          duration_sec:
            r.ended_at !== null
              ? Math.max(0, Math.round((r.ended_at - r.started_at) / 1000))
              : Math.max(0, Math.round((Date.now() - r.started_at) / 1000)),
        }),
      );
      const total = (getDb().prepare(`SELECT COUNT(*) AS c FROM sessions`).get() as { c: number }).c;
      return reply.send({ items, total, limit, offset });
    } catch (err) {
      const body: ApiErrorBody = {
        error: { code: 'HISTORY_LIST_FAILED', message: (err as Error).message },
      };
      return reply.code(500).send(body);
    }
  });

  // GET /api/history/:id
  app.get<{ Params: { id: string } }>('/api/history/:id', async (req, reply) => {
    const { id } = req.params;
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
      if (!row) {
        return reply.code(404).send({ error: { code: 'HISTORY_NOT_FOUND', message: `history '${id}' not found` } });
      }
      const messages: MessageRecord[] = getMessages(id);
      const userTurns = messages.filter((m) => m.role === 'user');
      const scores = userTurns
        .map((m) => (typeof m.score === 'number' ? m.score : null))
        .filter((s): s is number => s !== null);
      const avg =
        scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
      const scenarios = getScenarios();
      const scenario = scenarios.find((s) => s.id === row.scenario_id) ?? null;
      return reply.send({
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
      return reply.code(500).send({ error: { code: 'HISTORY_FETCH_FAILED', message: (err as Error).message } });
    }
  });
};

function countMessages(sessionId: string): number {
  try {
    const row = getDb()
      .prepare(`SELECT COUNT(*) AS c FROM messages WHERE session_id = ?`)
      .get(sessionId) as { c: number };
    return row.c;
  } catch {
    return 0;
  }
}

function clampInt(raw: string | undefined, lo: number, hi: number, fallback: number): number {
  if (raw === undefined || raw === '') return fallback;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(lo, Math.min(hi, n));
}

export default historyRoutes;
