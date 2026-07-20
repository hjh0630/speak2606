/**
 * /api/vocabulary routes — list, categories, progress, single lookup.
 */
import { Hono } from 'hono';
import { getVocabulary } from '../services/content';
import { allAsync, getAsync } from '../db';
import type { VocabularyEntry } from '../types';
import type { Bindings } from '../env';

export const vocabularyRoutes = new Hono<{ Bindings: Bindings }>();

interface VocabProgressRow {
  correct_count: number;
  wrong_count: number;
  last_seen: number | null;
}

async function loadProgressForTerms(
  db: D1Database,
  terms: string[],
): Promise<Map<string, VocabProgressRow>> {
  const map = new Map<string, VocabProgressRow>();
  if (terms.length === 0) return map;
  try {
    const placeholders = terms.map(() => '?').join(',');
    const rows = await allAsync<{
      term: string;
      correct_count: number;
      wrong_count: number;
      last_seen: number;
    }>(
      db,
      `SELECT term, correct_count, wrong_count, last_seen
       FROM vocabulary_progress
       WHERE term IN (${placeholders})`,
      terms,
    );
    for (const r of rows) {
      map.set(r.term, {
        correct_count: r.correct_count ?? 0,
        wrong_count: r.wrong_count ?? 0,
        last_seen: r.last_seen ?? null,
      });
    }
  } catch {
    // Table missing or empty — return empty progress.
  }
  return map;
}

function clampInt(raw: string | undefined, lo: number, hi: number, fallback: number): number {
  if (raw === undefined || raw === '') return fallback;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(lo, Math.min(hi, n));
}

vocabularyRoutes.get('/api/vocabulary', async (c) => {
  try {
    const all: VocabularyEntry[] = getVocabulary();
    const category = (c.req.query('category') ?? '').trim();
    const search = (c.req.query('search') ?? '').trim().toLowerCase();
    const limit = clampInt(c.req.query('limit'), 1, 1000, 200);
    const offset = clampInt(c.req.query('offset'), 0, 1_000_000, 0);

    let filtered = all;
    if (category) filtered = filtered.filter((v) => v.category === category);
    if (search) {
      filtered = filtered.filter((v) => {
        const term = (v.term ?? '').toLowerCase();
        const full = (v.full_form ?? '').toLowerCase();
        const defEn = (v.definition_en ?? '').toLowerCase();
        const defZh = (v.definition_zh ?? '').toLowerCase();
        return term.includes(search) || full.includes(search) || defEn.includes(search) || defZh.includes(search);
      });
    }

    const total = filtered.length;
    const items = filtered.slice(offset, offset + limit);

    const progressMap = await loadProgressForTerms(c.env.DB, items.map((v) => v.term));
    const enriched = items.map((v) => ({
      ...v,
      progress: progressMap.get(v.term) ?? { correct_count: 0, wrong_count: 0, last_seen: null },
    }));

    return c.json({
      items: enriched,
      total,
      limit,
      offset,
      count: enriched.length,
      category: category || null,
      search: search || null,
    });
  } catch (err) {
    return c.json(
      { error: { code: 'VOCABULARY_LIST_FAILED', message: (err as Error).message } },
      500,
    );
  }
});

vocabularyRoutes.get('/api/vocabulary/categories', (c) => {
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
    return c.json({ items, total: items.length });
  } catch (err) {
    return c.json(
      { error: { code: 'VOCABULARY_CATEGORIES_FAILED', message: (err as Error).message } },
      500,
    );
  }
});

vocabularyRoutes.get('/api/vocabulary/progress', async (c) => {
  try {
    const db = c.env.DB;
    const rows = await allAsync<{
      term: string;
      correct_count: number;
      wrong_count: number;
      last_seen: number;
    }>(
      db,
      `SELECT term, correct_count, wrong_count, last_seen
       FROM vocabulary_progress
       ORDER BY last_seen DESC`,
    );

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

    // Count distinct sessions the user practised vocab in (= count of completed sessions, a proxy).
    let sessionCount = 0;
    try {
      const row = await getAsync<{ c: number }>(
        db,
        `SELECT COUNT(*) AS c FROM sessions WHERE status = 'completed'`,
      );
      sessionCount = row?.c ?? 0;
    } catch {
      /* skip */
    }

    return c.json({
      ...totals,
      accuracy_pct: accuracy,
      total_attempts: totalAttempts,
      items: rows,
      session_count: sessionCount,
    });
  } catch (err) {
    return c.json(
      { error: { code: 'VOCABULARY_PROGRESS_FAILED', message: (err as Error).message } },
      500,
    );
  }
});

vocabularyRoutes.get('/api/vocabulary/:word', async (c) => {
  const word = c.req.param('word');
  if (!word || word.trim().length === 0) {
    return c.json({ error: { code: 'VALIDATION_ERROR', message: 'word is required' } }, 400);
  }
  const key = decodeURIComponent(word).trim().toLowerCase();
  try {
    const all = getVocabulary();
    const entry =
      all.find((v) => (v.term ?? '').toLowerCase() === key) ??
      all.find((v) => (v.term ?? '').toLowerCase().includes(key)) ??
      null;
    if (!entry) {
      return c.json(
        { error: { code: 'VOCABULARY_NOT_FOUND', message: `vocabulary term '${word}' not found` } },
        404,
      );
    }
    const progressMap = await loadProgressForTerms(c.env.DB, [entry.term]);
    return c.json({
      ...entry,
      progress: progressMap.get(entry.term) ?? { correct_count: 0, wrong_count: 0, last_seen: null },
    });
  } catch (err) {
    return c.json(
      { error: { code: 'VOCABULARY_FETCH_FAILED', message: (err as Error).message } },
      500,
    );
  }
});
