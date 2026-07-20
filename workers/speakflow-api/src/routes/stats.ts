/**
 * /api/stats route — aggregated practice statistics.
 */
import { Hono } from 'hono';
import { allAsync, getAsync } from '../db';
import type { Bindings } from '../env';

export const statsRoutes = new Hono<{ Bindings: Bindings }>();

statsRoutes.get('/api/stats', async (c) => {
  try {
    const db = c.env.DB;

    const totalSessions = (await getAsync<{ c: number }>(db, `SELECT COUNT(*) AS c FROM sessions`))?.c ?? 0;
    const completedSessions =
      (await getAsync<{ c: number }>(
        db,
        `SELECT COUNT(*) AS c FROM sessions WHERE status = 'completed'`,
      ))?.c ?? 0;

    const durationRow = await getAsync<{ total_sec: number; avg_sec: number }>(
      db,
      `SELECT
         COALESCE(SUM(CASE WHEN ended_at IS NOT NULL THEN (ended_at - started_at) / 1000.0 ELSE 0 END), 0) AS total_sec,
         COALESCE(AVG(CASE WHEN ended_at IS NOT NULL THEN (ended_at - started_at) / 1000.0 END), 0) AS avg_sec
       FROM sessions`,
    );

    const scoreRow = await getAsync<{ avg_score: number; best_score: number }>(
      db,
      `SELECT
         COALESCE(AVG(total_score), 0) AS avg_score,
         COALESCE(MAX(total_score), 0) AS best_score
       FROM sessions
       WHERE total_score IS NOT NULL`,
    );

    const scenarioRows = await allAsync<{ scenario_id: string; sessions: number; avg_score: number | null }>(
      db,
      `SELECT scenario_id, COUNT(*) AS sessions, AVG(total_score) AS avg_score
       FROM sessions
       GROUP BY scenario_id
       ORDER BY sessions DESC`,
    );

    const difficultyRows = await allAsync<{ difficulty: string; sessions: number; avg_score: number | null }>(
      db,
      `SELECT difficulty, COUNT(*) AS sessions, AVG(total_score) AS avg_score
       FROM sessions
       GROUP BY difficulty
       ORDER BY difficulty`,
    );

    const recentRows = await allAsync<{
      id: string;
      scenario_id: string;
      difficulty: string;
      total_score: number | null;
      started_at: number;
      ended_at: number;
    }>(
      db,
      `SELECT id, scenario_id, difficulty, total_score, started_at, ended_at
       FROM sessions
       WHERE ended_at IS NOT NULL
       ORDER BY ended_at DESC
       LIMIT 10`,
    );

    const vocabularyRows = (await getAsync<{ correct: number; wrong: number; tracked: number }>(
      db,
      `SELECT
         COALESCE(SUM(correct_count), 0) AS correct,
         COALESCE(SUM(wrong_count), 0) AS wrong,
         COUNT(*) AS tracked
       FROM vocabulary_progress`,
    )) ?? { correct: 0, wrong: 0, tracked: 0 };

    return c.json({
      total_sessions: totalSessions,
      completed_sessions: completedSessions,
      active_sessions: totalSessions - completedSessions,
      total_practice_sec: Math.round(durationRow?.total_sec ?? 0),
      avg_session_sec: Math.round(durationRow?.avg_sec ?? 0),
      avg_score: Math.round(scoreRow?.avg_score ?? 0),
      best_score: Math.round(scoreRow?.best_score ?? 0),
      by_scenario: scenarioRows.map((r) => ({
        scenario_id: r.scenario_id,
        sessions: r.sessions,
        avg_score: r.avg_score === null ? null : Math.round(r.avg_score),
      })),
      by_difficulty: difficultyRows.map((r) => ({
        difficulty: r.difficulty,
        sessions: r.sessions,
        avg_score: r.avg_score === null ? null : Math.round(r.avg_score),
      })),
      recent_sessions: recentRows.map((r) => ({
        id: r.id,
        scenario_id: r.scenario_id,
        difficulty: r.difficulty,
        total_score: r.total_score,
        started_at: r.started_at,
        ended_at: r.ended_at,
        duration_sec: Math.max(0, Math.round((r.ended_at - r.started_at) / 1000)),
      })),
      vocabulary: {
        tracked_terms: vocabularyRows.tracked,
        correct: vocabularyRows.correct,
        wrong: vocabularyRows.wrong,
      },
    });
  } catch (err) {
    return c.json(
      { error: { code: 'STATS_FAILED', message: (err as Error).message } },
      500,
    );
  }
});
