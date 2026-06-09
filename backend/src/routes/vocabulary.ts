import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { getVocabulary } from '../services/content';
import { getDb } from '../db';
import type { ApiErrorBody, VocabularyEntry } from '../types';

/**
 * Vocabulary routes.
 *
 * The vocabulary content itself is static, loaded by `services/content.ts` from
 * /workspace/content/vocabulary.json. Per-term learning progress (correct / wrong
 * counts, last-seen timestamp) is persisted in the SQLite `vocabulary_progress`
 * table managed by `db.ts`.
 */

interface VocabQuery {
  category?: string;
  limit?: string;
  offset?: string;
  search?: string;
}

interface VocabParams {
  word: string;
}

function errBody(code: string, message: string, details?: unknown): ApiErrorBody {
  return { error: { code, message, details } };
}

function clampInt(raw: string | undefined, lo: number, hi: number, fallback: number): number {
  if (raw === undefined || raw === '') return fallback;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(lo, Math.min(hi, n));
}

const vocabularyRoutes: FastifyPluginAsync = async (app: FastifyInstance): Promise<void> => {
  // GET /api/vocabulary — list vocabulary, with optional filters.
  app.get<{ Querystring: VocabQuery }>('/api/vocabulary', async (req, reply) => {
    try {
      const all: VocabularyEntry[] = getVocabulary();
      const category = (req.query?.category ?? '').trim();
      const search = (req.query?.search ?? '').trim().toLowerCase();
      const limit = clampInt(req.query?.limit, 1, 1000, 200);
      const offset = clampInt(req.query?.offset, 0, 1_000_000, 0);

      let filtered = all;
      if (category) {
        filtered = filtered.filter((v) => v.category === category);
      }
      if (search) {
        filtered = filtered.filter((v) => {
          const term = (v.term ?? '').toLowerCase();
          const full = (v.full_form ?? '').toLowerCase();
          const defEn = (v.definition_en ?? '').toLowerCase();
          const defZh = (v.definition_zh ?? '').toLowerCase();
          return (
            term.includes(search) ||
            full.includes(search) ||
            defEn.includes(search) ||
            defZh.includes(search)
          );
        });
      }

      const total = filtered.length;
      const items = filtered.slice(offset, offset + limit);

      // Also pull progress counters in one query for the returned items so the
      // front-end can render a list with "I know / needs review" badges without
      // a second round-trip per term.
      const progressMap = loadProgressForTerms(items.map((v) => v.term));

      const enriched = items.map((v) => ({
        ...v,
        progress: progressMap.get(v.term) ?? { correct_count: 0, wrong_count: 0, last_seen: null },
      }));

      return reply.send({
        items: enriched,
        total,
        limit,
        offset,
        count: enriched.length,
        category: category || null,
        search: search || null,
      });
    } catch (err) {
      return reply
        .code(500)
        .send(errBody('VOCABULARY_LIST_FAILED', (err as Error).message));
    }
  });

  // GET /api/vocabulary/categories — distinct list of categories.
  app.get('/api/vocabulary/categories', async (_req, reply) => {
    try {
      const all = getVocabulary();
      const counts = new Map<string, number>();
      for (const v of all) {
        if (!v.category) continue;
        counts.set(v.category, (counts.get(v.category) ?? 0) + 1);
      }
      const items = Array.from(counts.entries())
        .map(([category, count]) => ({ category, count }))
        .sort((a, b) => a.category.localeCompare(b.category));
      return reply.send({ items, total: items.length });
    } catch (err) {
      return reply
        .code(500)
        .send(errBody('VOCABULARY_CATEGORIES_FAILED', (err as Error).message));
    }
  });

  // GET /api/vocabulary/progress — aggregated progress across all tracked terms.
  // NOTE: registered BEFORE the `/:word` route so Fastify matches it literally.
  app.get('/api/vocabulary/progress', async (_req, reply) => {
    try {
      const rows = getDb()
        .prepare(
          `SELECT term, correct_count, wrong_count, last_seen
           FROM vocabulary_progress
           ORDER BY last_seen DESC`,
        )
        .all() as Array<{
        term: string;
        correct_count: number;
        wrong_count: number;
        last_seen: number;
      }>;

      const totals = rows.reduce(
        (acc, r) => {
          acc.tracked += 1;
          acc.correct += r.correct_count ?? 0;
          acc.wrong += r.wrong_count ?? 0;
          return acc;
        },
        { tracked: 0, correct: 0, wrong: 0 },
      );

      const totalAttempts = totals.correct + totals.wrong;
      const accuracy = totalAttempts > 0 ? Math.round((totals.correct / totalAttempts) * 100) : null;

      return reply.send({
        ...totals,
        accuracy_pct: accuracy,
        total_attempts: totalAttempts,
        items: rows,
        session_count: countDistinctSessionsFromVocab(),
      });
    } catch (err) {
      return reply
        .code(500)
        .send(errBody('VOCABULARY_PROGRESS_FAILED', (err as Error).message));
    }
  });

  // GET /api/vocabulary/:word — look up a single entry by term.
  app.get<{ Params: VocabParams }>('/api/vocabulary/:word', async (req, reply) => {
    const { word } = req.params;
    if (!word || word.trim().length === 0) {
      return reply.code(400).send(errBody('VALIDATION_ERROR', 'word is required'));
    }
    const key = decodeURIComponent(word).trim().toLowerCase();
    try {
      const all = getVocabulary();
      const entry =
        all.find((v) => (v.term ?? '').toLowerCase() === key) ??
        all.find((v) => (v.term ?? '').toLowerCase().includes(key)) ??
        null;
      if (!entry) {
        return reply
          .code(404)
          .send(errBody('VOCABULARY_NOT_FOUND', `vocabulary term '${word}' not found`));
      }
      const progressMap = loadProgressForTerms([entry.term]);
      return reply.send({
        ...entry,
        progress: progressMap.get(entry.term) ?? { correct_count: 0, wrong_count: 0, last_seen: null },
      });
    } catch (err) {
      return reply
        .code(500)
        .send(errBody('VOCABULARY_FETCH_FAILED', (err as Error).message));
    }
  });
};

interface VocabProgressRow {
  correct_count: number;
  wrong_count: number;
  last_seen: number | null;
}

function loadProgressForTerms(terms: string[]): Map<string, VocabProgressRow> {
  const map = new Map<string, VocabProgressRow>();
  if (terms.length === 0) return map;
  try {
    const placeholders = terms.map(() => '?').join(',');
    const rows = getDb()
      .prepare(
        `SELECT term, correct_count, wrong_count, last_seen
         FROM vocabulary_progress
         WHERE term IN (${placeholders})`,
      )
      .all(...terms) as Array<{
      term: string;
      correct_count: number;
      wrong_count: number;
      last_seen: number;
    }>;
    for (const r of rows) {
      map.set(r.term, {
        correct_count: r.correct_count ?? 0,
        wrong_count: r.wrong_count ?? 0,
        last_seen: r.last_seen ?? null,
      });
    }
  } catch {
    // If the table isn't there yet, fall back to empty progress.
  }
  return map;
}

function countDistinctSessionsFromVocab(): number {
  // vocabulary_progress stores per-term aggregates only; the best proxy for
  // "distinct sessions the user practised vocab in" is the count of message
  // rows that referenced any tracked term. Since we don't store that link
  // explicitly, fall back to total completed sessions as a reasonable signal.
  try {
    const row = getDb()
      .prepare(`SELECT COUNT(*) AS c FROM sessions WHERE status = 'completed'`)
      .get() as { c: number };
    return row.c;
  } catch {
    return 0;
  }
}

export default vocabularyRoutes;
