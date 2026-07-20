import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { runAsync, getAsync, allAsync } from '../db';
import type { ApiErrorBody } from '../types';

/**
 * Wordbook routes — per-user vocabulary notebook (生词本).
 *
 * Each row belongs to exactly one `user_token`, which the front-end injects
 * as the `X-User-Id` request header (see `frontend/src/api/client.ts`). We
 * use it as the ownership boundary for every read/write — never trust a
 * client-supplied user id inside the body for ownership checks.
 *
 * Storage is dual-backend: SQLite (better-sqlite3) for local dev and
 * Turso (libSQL) for cloud deploys. We use the async facade exclusively
 * (`runAsync` / `getAsync` / `allAsync`) so the same code path works on
 * both.
 *
 * Response shape mirrors the existing vocabulary routes: list endpoints
 * return `{ items, total, limit, offset }`. Errors are uniformly wrapped
 * via `errBody(code, message)`.
 */

interface WordbookRow {
  id: number;
  user_token: string;
  term: string;
  meaning: string | null;
  difficulty: number;
  source: string;
  source_ref: string | null;
  notes: string | null;
  created_at: number;
  updated_at: number;
}

interface WordbookListQuery {
  difficulty?: string;
  search?: string;
  limit?: string;
  offset?: string;
}

interface WordbookParams {
  id: string;
}

interface WordbookCreateBody {
  term?: unknown;
  meaning?: unknown;
  source?: unknown;
  source_ref?: unknown;
  difficulty?: unknown;
  notes?: unknown;
}

interface WordbookPatchBody {
  difficulty?: unknown;
  notes?: unknown;
}

interface BatchDeleteBody {
  ids?: unknown;
}

interface BatchCheckBody {
  terms?: unknown;
}

const ALLOWED_DIFFICULTIES: ReadonlySet<number> = new Set([0, 1, 2, 3]);

function errBody(code: string, message: string, details?: unknown): ApiErrorBody {
  return { error: { code, message, details } };
}

function clampInt(raw: string | undefined, lo: number, hi: number, fallback: number): number {
  if (raw === undefined || raw === '') return fallback;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(lo, Math.min(hi, n));
}

function readUserToken(req: { headers: Record<string, unknown> }): string | null {
  const raw = req.headers['x-user-id'];
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  // Cap at a sane length to bound query cost; the front-end emits a UUID v4.
  if (trimmed.length > 128) return null;
  return trimmed;
}

function asTrimmedString(v: unknown, maxLen: number): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  if (t.length === 0) return null;
  return t.length > maxLen ? t.slice(0, maxLen) : t;
}

function asDifficulty(v: unknown): number | null {
  if (v === undefined || v === null) return 0;
  if (typeof v !== 'number' || !Number.isInteger(v)) return null;
  if (!ALLOWED_DIFFICULTIES.has(v)) return null;
  return v;
}

function nowMs(): number {
  return Date.now();
}

const wordbookRoutes: FastifyPluginAsync = async (app: FastifyInstance): Promise<void> => {
  // ─── GET /api/wordbook ────────────────────────────────────────────────
  app.get<{ Querystring: WordbookListQuery }>('/api/wordbook', async (req, reply) => {
    const userToken = readUserToken(req);
    if (!userToken) {
      return reply.code(401).send(errBody('UNAUTHORIZED', 'missing X-User-Id header'));
    }
    try {
      const difficultyRaw = req.query?.difficulty;
      const search = (req.query?.search ?? '').trim();
      const limit = clampInt(req.query?.limit, 1, 500, 200);
      const offset = clampInt(req.query?.offset, 0, 1_000_000, 0);

      // Build WHERE clause dynamically. We only push args that are actually
      // filtered, so the same SQL string works for the "all entries" case.
      const where: string[] = ['user_token = ?'];
      const args: unknown[] = [userToken];

      if (difficultyRaw !== undefined && difficultyRaw !== '') {
        const d = Number.parseInt(difficultyRaw, 10);
        if (!Number.isFinite(d) || !ALLOWED_DIFFICULTIES.has(d)) {
          return reply
            .code(400)
            .send(errBody('VALIDATION_ERROR', 'difficulty must be one of 0,1,2,3'));
        }
        where.push('difficulty = ?');
        args.push(d);
      }

      if (search.length > 0) {
        if (search.length > 50) {
          return reply
            .code(400)
            .send(errBody('VALIDATION_ERROR', 'search must be at most 50 chars'));
        }
        where.push('(term LIKE ? OR meaning LIKE ? OR notes LIKE ?)');
        const like = `%${search}%`;
        args.push(like, like, like);
      }

      const whereSql = `WHERE ${where.join(' AND ')}`;

      const totalRow = await getAsync<{ c: number }>(
        `SELECT COUNT(*) AS c FROM wordbook ${whereSql}`,
        args,
      );
      const total = totalRow?.c ?? 0;

      const rows = await allAsync<WordbookRow>(
        `SELECT id, user_token, term, meaning, difficulty, source, source_ref,
                notes, created_at, updated_at
         FROM wordbook
         ${whereSql}
         ORDER BY created_at DESC, id DESC
         LIMIT ? OFFSET ?`,
        [...args, limit, offset],
      );

      return reply.send({
        items: rows,
        total,
        limit,
        offset,
        count: rows.length,
        difficulty: difficultyRaw ?? null,
        search: search || null,
      });
    } catch (err) {
      return reply
        .code(500)
        .send(errBody('WORDBOOK_LIST_FAILED', (err as Error).message));
    }
  });

  // ─── POST /api/wordbook ───────────────────────────────────────────────
  app.post<{ Body: WordbookCreateBody }>('/api/wordbook', async (req, reply) => {
    const userToken = readUserToken(req);
    if (!userToken) {
      return reply.code(401).send(errBody('UNAUTHORIZED', 'missing X-User-Id header'));
    }
    const body = (req.body ?? {}) as WordbookCreateBody;
    const term = asTrimmedString(body.term, 50);
    if (!term) {
      return reply
        .code(400)
        .send(errBody('VALIDATION_ERROR', 'term is required (1-50 chars)'));
    }
    if (term.length > 50) {
      return reply
        .code(400)
        .send(errBody('VALIDATION_ERROR', 'term must be at most 50 chars'));
    }
    const difficulty = asDifficulty(body.difficulty);
    if (difficulty === null) {
      return reply
        .code(400)
        .send(errBody('VALIDATION_ERROR', 'difficulty must be one of 0,1,2,3'));
    }
    const meaning = asTrimmedString(body.meaning, 500);
    const source = asTrimmedString(body.source, 32) ?? 'popup';
    const sourceRef = asTrimmedString(body.source_ref, 200);
    const notes = asTrimmedString(body.notes, 2000);
    const ts = nowMs();

    try {
      // INSERT OR IGNORE so re-adding the same term is idempotent — we then
      // SELECT the row back (whether just-inserted or pre-existing) and
      // return it. This makes the front-end's "save again" click safe.
      await runAsync(
        `INSERT OR IGNORE INTO wordbook
           (user_token, term, meaning, difficulty, source, source_ref, notes,
            created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [userToken, term, meaning, difficulty, source, sourceRef, notes, ts, ts],
      );
      const row = await getAsync<WordbookRow>(
        `SELECT id, user_token, term, meaning, difficulty, source, source_ref,
                notes, created_at, updated_at
         FROM wordbook
         WHERE user_token = ? AND term = ?`,
        [userToken, term],
      );
      if (!row) {
        return reply
          .code(500)
          .send(errBody('WORDBOOK_INSERT_FAILED', 'failed to load inserted row'));
      }
      return reply.code(201).send({ item: row });
    } catch (err) {
      return reply
        .code(500)
        .send(errBody('WORDBOOK_INSERT_FAILED', (err as Error).message));
    }
  });

  // ─── PATCH /api/wordbook/:id ──────────────────────────────────────────
  app.patch<{ Params: WordbookParams; Body: WordbookPatchBody }>(
    '/api/wordbook/:id',
    async (req, reply) => {
      const userToken = readUserToken(req);
      if (!userToken) {
        return reply.code(401).send(errBody('UNAUTHORIZED', 'missing X-User-Id header'));
      }
      const idNum = Number.parseInt(req.params.id, 10);
      if (!Number.isFinite(idNum) || idNum <= 0) {
        return reply.code(400).send(errBody('VALIDATION_ERROR', 'id must be a positive integer'));
      }
      const body = (req.body ?? {}) as WordbookPatchBody;
      const sets: string[] = [];
      const args: unknown[] = [];
      let touched = false;

      if (body.difficulty !== undefined) {
        const d = asDifficulty(body.difficulty);
        if (d === null) {
          return reply
            .code(400)
            .send(errBody('VALIDATION_ERROR', 'difficulty must be one of 0,1,2,3'));
        }
        sets.push('difficulty = ?');
        args.push(d);
        touched = true;
      }
      if (body.notes !== undefined) {
        // Allow clearing notes by passing an empty string; null body field
        // means "leave untouched".
        const trimmed = typeof body.notes === 'string' ? body.notes.trim() : null;
        if (trimmed !== null && trimmed.length > 2000) {
          return reply
            .code(400)
            .send(errBody('VALIDATION_ERROR', 'notes must be at most 2000 chars'));
        }
        sets.push('notes = ?');
        args.push(trimmed);
        touched = true;
      }

      if (!touched) {
        return reply
          .code(400)
          .send(errBody('VALIDATION_ERROR', 'no updatable fields supplied'));
      }

      sets.push('updated_at = ?');
      args.push(nowMs());
      args.push(idNum);
      args.push(userToken);

      try {
        const result = await runAsync(
          `UPDATE wordbook SET ${sets.join(', ')}
           WHERE id = ? AND user_token = ?`,
          args,
        );
        if (result.rowsAffected === 0) {
          return reply
            .code(404)
            .send(errBody('WORDBOOK_NOT_FOUND', `wordbook entry ${idNum} not found`));
        }
        const row = await getAsync<WordbookRow>(
          `SELECT id, user_token, term, meaning, difficulty, source, source_ref,
                  notes, created_at, updated_at
           FROM wordbook
           WHERE id = ? AND user_token = ?`,
          [idNum, userToken],
        );
        return reply.send({ item: row });
      } catch (err) {
        return reply
          .code(500)
          .send(errBody('WORDBOOK_UPDATE_FAILED', (err as Error).message));
      }
    },
  );

  // ─── DELETE /api/wordbook/:id ─────────────────────────────────────────
  app.delete<{ Params: WordbookParams }>('/api/wordbook/:id', async (req, reply) => {
    const userToken = readUserToken(req);
    if (!userToken) {
      return reply.code(401).send(errBody('UNAUTHORIZED', 'missing X-User-Id header'));
    }
    const idNum = Number.parseInt(req.params.id, 10);
    if (!Number.isFinite(idNum) || idNum <= 0) {
      return reply.code(400).send(errBody('VALIDATION_ERROR', 'id must be a positive integer'));
    }
    try {
      const result = await runAsync(
        `DELETE FROM wordbook WHERE id = ? AND user_token = ?`,
        [idNum, userToken],
      );
      if (result.rowsAffected === 0) {
        return reply
          .code(404)
          .send(errBody('WORDBOOK_NOT_FOUND', `wordbook entry ${idNum} not found`));
      }
      return reply.send({ deleted: idNum });
    } catch (err) {
      return reply
        .code(500)
        .send(errBody('WORDBOOK_DELETE_FAILED', (err as Error).message));
    }
  });

  // ─── POST /api/wordbook/batch-delete ──────────────────────────────────
  app.post<{ Body: BatchDeleteBody }>('/api/wordbook/batch-delete', async (req, reply) => {
    const userToken = readUserToken(req);
    if (!userToken) {
      return reply.code(401).send(errBody('UNAUTHORIZED', 'missing X-User-Id header'));
    }
    const body = (req.body ?? {}) as BatchDeleteBody;
    if (!Array.isArray(body.ids)) {
      return reply.code(400).send(errBody('VALIDATION_ERROR', 'ids must be an array of integers'));
    }
    if (body.ids.length === 0) {
      return reply.send({ deleted: 0, requested: 0 });
    }
    if (body.ids.length > 500) {
      return reply
        .code(400)
        .send(errBody('VALIDATION_ERROR', 'ids must contain at most 500 entries'));
    }
    const ids: number[] = [];
    for (const raw of body.ids) {
      const n = typeof raw === 'number' ? raw : Number.parseInt(String(raw), 10);
      if (!Number.isFinite(n) || n <= 0 || !Number.isInteger(n)) {
        return reply
          .code(400)
          .send(errBody('VALIDATION_ERROR', 'ids must be positive integers'));
      }
      ids.push(n);
    }
    const placeholders = ids.map(() => '?').join(',');
    try {
      const result = await runAsync(
        `DELETE FROM wordbook WHERE user_token = ? AND id IN (${placeholders})`,
        [userToken, ...ids],
      );
      return reply.send({ deleted: result.rowsAffected, requested: ids.length });
    } catch (err) {
      return reply
        .code(500)
        .send(errBody('WORDBOOK_BATCH_DELETE_FAILED', (err as Error).message));
    }
  });

  // ─── POST /api/wordbook/batch-check ───────────────────────────────────
  // Returns the subset of input terms that already exist in this user's
  // wordbook. Front-end uses this to render "已加入" badges without
  // issuing N GETs.
  app.post<{ Body: BatchCheckBody }>('/api/wordbook/batch-check', async (req, reply) => {
    const userToken = readUserToken(req);
    if (!userToken) {
      return reply.code(401).send(errBody('UNAUTHORIZED', 'missing X-User-Id header'));
    }
    const body = (req.body ?? {}) as BatchCheckBody;
    if (!Array.isArray(body.terms)) {
      return reply
        .code(400)
        .send(errBody('VALIDATION_ERROR', 'terms must be an array of strings'));
    }
    if (body.terms.length === 0) {
      return reply.send({ saved: [] });
    }
    if (body.terms.length > 500) {
      return reply
        .code(400)
        .send(errBody('VALIDATION_ERROR', 'terms must contain at most 500 entries'));
    }
    const terms: string[] = [];
    for (const raw of body.terms) {
      if (typeof raw !== 'string') {
        return reply
          .code(400)
          .send(errBody('VALIDATION_ERROR', 'terms must be strings'));
      }
      const t = raw.trim();
      if (t.length === 0 || t.length > 50) continue;
      // De-dupe while preserving first-seen order.
      if (!terms.includes(t)) terms.push(t);
    }
    if (terms.length === 0) {
      return reply.send({ saved: [] });
    }
    const placeholders = terms.map(() => '?').join(',');
    try {
      const rows = await allAsync<{ term: string }>(
        `SELECT term FROM wordbook
         WHERE user_token = ? AND term IN (${placeholders})`,
        [userToken, ...terms],
      );
      return reply.send({ saved: rows.map((r) => r.term) });
    } catch (err) {
      return reply
        .code(500)
        .send(errBody('WORDBOOK_BATCH_CHECK_FAILED', (err as Error).message));
    }
  });

  // ─── GET /api/wordbook/stats ───────────────────────────────────────────
  app.get('/api/wordbook/stats', async (req, reply) => {
    const userToken = readUserToken(req);
    if (!userToken) {
      return reply.code(401).send(errBody('UNAUTHORIZED', 'missing X-User-Id header'));
    }
    try {
      const totalRow = await getAsync<{ c: number }>(
        `SELECT COUNT(*) AS c FROM wordbook WHERE user_token = ?`,
        [userToken],
      );
      const diffRows = await allAsync<{ difficulty: number; c: number }>(
        `SELECT difficulty, COUNT(*) AS c FROM wordbook
         WHERE user_token = ?
         GROUP BY difficulty`,
        [userToken],
      );
      const weekAgo = nowMs() - 7 * 24 * 60 * 60 * 1000;
      const recentRow = await getAsync<{ c: number }>(
        `SELECT COUNT(*) AS c FROM wordbook
         WHERE user_token = ? AND created_at >= ?`,
        [userToken, weekAgo],
      );
      const byDifficulty: Record<0 | 1 | 2 | 3, number> = { 0: 0, 1: 0, 2: 0, 3: 0 };
      for (const r of diffRows) {
        if (ALLOWED_DIFFICULTIES.has(r.difficulty)) {
          byDifficulty[r.difficulty as 0 | 1 | 2 | 3] = r.c;
        }
      }
      return reply.send({
        total: totalRow?.c ?? 0,
        by_difficulty: byDifficulty,
        recent_week: recentRow?.c ?? 0,
      });
    } catch (err) {
      return reply
        .code(500)
        .send(errBody('WORDBOOK_STATS_FAILED', (err as Error).message));
    }
  });
};

export default wordbookRoutes;
