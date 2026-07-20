/**
 * /api/status route — runtime health snapshot.
 */
import { Hono } from 'hono';
import { getAsync } from '../db';
import { getScenarios, getVocabulary, getSystemPrompt } from '../services/content';
import { getMiniMaxEnv, hasMiniMaxCredentials, type Bindings } from '../env';

export const statusRoutes = new Hono<{ Bindings: Bindings }>();

const PKG_VERSION = '1.0.0'; // bundled at build time; bump when releasing
const SERVICE_START_TS = Date.now();

statusRoutes.get('/api/status', async (c) => {
  const db = c.env.DB;
  let sessionsTotal = 0;
  let recentSessions = 0;
  let completedSessions = 0;
  try {
    const r1 = await getAsync<{ c: number }>(db, `SELECT COUNT(*) AS c FROM sessions`);
    sessionsTotal = r1?.c ?? 0;
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    const r2 = await getAsync<{ c: number }>(
      db,
      `SELECT COUNT(*) AS c FROM sessions WHERE started_at >= ?`,
      [cutoff],
    );
    recentSessions = r2?.c ?? 0;
    const r3 = await getAsync<{ c: number }>(
      db,
      `SELECT COUNT(*) AS c FROM sessions WHERE status = 'completed'`,
    );
    completedSessions = r3?.c ?? 0;
  } catch {
    // leave as 0s
  }

  const scenarios = (() => {
    try {
      return getScenarios().length;
    } catch {
      return 0;
    }
  })();
  const vocabulary = (() => {
    try {
      return getVocabulary().length;
    } catch {
      return 0;
    }
  })();
  const sysKeys = new Set<string>();
  for (const d of ['beginner', 'intermediate', 'advanced'] as const) {
    try {
      const v = getSystemPrompt(d);
      if (v && v.length > 0) sysKeys.add(d);
    } catch {
      /* skip */
    }
  }

  const mm = getMiniMaxEnv(c.env);

  return c.json({
    ok: true,
    ts: Date.now(),
    version: PKG_VERSION,
    uptime_sec: Math.max(0, Math.floor((Date.now() - SERVICE_START_TS) / 1000)),
    minimax: {
      hasCredentials: hasMiniMaxCredentials(mm),
      apiKeySet: mm.apiKey.length > 0,
      groupIdSet: mm.groupId.length > 0,
    },
    content: {
      scenarios_count: scenarios,
      vocabulary_count: vocabulary,
      system_prompts_count: sysKeys.size,
    },
    sessions: {
      total: sessionsTotal,
      completed: completedSessions,
      active: Math.max(0, sessionsTotal - completedSessions),
      last_24h: recentSessions,
    },
    database: {
      binding: 'D1',
      platform: 'cloudflare-d1',
    },
    server: {
      runtime: 'cloudflare-workers',
    },
    ws: {
      endpoint: '/ws/session/:id',
    },
  });
});

statusRoutes.get('/api/badge', (c) => {
  const label = 'SpeakFlow';
  const message = 'OK';
  const color = '#22c55e';
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="128" height="20" role="img" aria-label="${label}: ${message}">
  <title>${label}: ${message}</title>
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <clipPath id="r"><rect width="128" height="20" rx="3" fill="#fff"/></clipPath>
  <g clip-path="url(#r)">
    <rect width="58" height="20" fill="#555"/>
    <rect x="58" width="70" height="20" fill="${color}"/>
    <rect width="128" height="20" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" text-rendering="geometricPrecision" font-size="110">
    <text aria-hidden="true" x="295" y="150" fill="#010101" fill-opacity=".3" transform="scale(.1)" textLength="480">${label}</text>
    <text x="295" y="140" transform="scale(.1)" fill="#fff" textLength="480">${label}</text>
    <text aria-hidden="true" x="925" y="150" fill="#010101" fill-opacity=".3" transform="scale(.1)" textLength="600">${message}</text>
    <text x="925" y="140" transform="scale(.1)" fill="#fff" textLength="600">${message}</text>
  </g>
</svg>`;
  return c.body(svg, 200, { 'Content-Type': 'image/svg+xml; charset=utf-8' });
});
