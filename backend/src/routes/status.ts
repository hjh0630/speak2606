import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { config } from '../config';
import { getDb } from '../db';
import { getScenarios, getVocabulary, getSystemPrompt } from '../services/content';

const PKG_VERSION = (() => {
  try {
    // Resolve relative to compiled location OR the running ts-node source.
    const candidates = [
      path.resolve(__dirname, '..', '..', 'package.json'),
      path.resolve(process.cwd(), 'package.json'),
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) {
        const raw = fs.readFileSync(p, 'utf-8');
        const j = JSON.parse(raw) as { version?: string };
        if (typeof j.version === 'string' && j.version.length > 0) return j.version;
      }
    }
  } catch {
    /* ignore */
  }
  return '0.0.0';
})();

const SERVICE_START_TS = Date.now();

function dbStatSafe(): { path: string; exists: boolean; size_kb: number } {
  const dbPath = config.dbPath;
  try {
    if (!fs.existsSync(dbPath)) {
      return { path: dbPath, exists: false, size_kb: 0 };
    }
    const stat = fs.statSync(dbPath);
    return { path: dbPath, exists: true, size_kb: Math.max(0, Math.round(stat.size / 1024)) };
  } catch {
    return { path: dbPath, exists: false, size_kb: 0 };
  }
}

function safeCount(fn: () => number): number {
  try {
    return fn();
  } catch {
    return 0;
  }
}

const statusRoutes: FastifyPluginAsync = async (app: FastifyInstance): Promise<void> => {
  // GET /api/status — detailed runtime + content health snapshot.
  app.get('/api/status', async (_req, reply) => {
    // Touch the DB so we get a fresh handle; never throw out of this endpoint.
    let sessionsTotal = 0;
    let recentSessions = 0;
    let completedSessions = 0;
    let activeSessions = 0;
    try {
      const db = getDb();
      sessionsTotal = (db.prepare(`SELECT COUNT(*) AS c FROM sessions`).get() as { c: number }).c;
      const cutoff = Date.now() - 24 * 60 * 60 * 1000;
      recentSessions = (
        db.prepare(`SELECT COUNT(*) AS c FROM sessions WHERE started_at >= ?`).get(cutoff) as { c: number }
      ).c;
      completedSessions = (
        db.prepare(`SELECT COUNT(*) AS c FROM sessions WHERE status = 'completed'`).get() as { c: number }
      ).c;
      activeSessions = Math.max(0, sessionsTotal - completedSessions);
    } catch {
      // leave as 0s
    }

    const scenarios = safeCount(() => getScenarios().length);
    const vocabulary = safeCount(() => getVocabulary().length);
    // System prompts count: keys in the loaded object. Force-load by reading each level.
    const sysKeys = new Set<string>();
    for (const d of ['beginner', 'intermediate', 'advanced'] as const) {
      try {
        const v = getSystemPrompt(d);
        if (v && v.length > 0) sysKeys.add(d);
      } catch {
        /* skip */
      }
    }

    return reply.send({
      ok: true,
      ts: Date.now(),
      version: PKG_VERSION,
      uptime_sec: Math.max(0, Math.floor((Date.now() - SERVICE_START_TS) / 1000)),
      minimax: {
        hasCredentials: config.minimax.hasCredentials,
        apiKeySet: config.minimax.apiKey.trim().length > 0,
        groupIdSet: config.minimax.groupId.trim().length > 0,
      },
      content: {
        scenarios_count: scenarios,
        vocabulary_count: vocabulary,
        system_prompts_count: sysKeys.size,
      },
      sessions: {
        total: sessionsTotal,
        completed: completedSessions,
        active: activeSessions,
        last_24h: recentSessions,
      },
      database: dbStatSafe(),
      server: {
        node: process.version,
        platform: process.platform,
        arch: process.arch,
        uptime: Math.floor(process.uptime()),
        pid: process.pid,
      },
      ws: {
        endpoint: '/ws/session/:id',
      },
    });
  });

  // GET /api/badge — shields.io-style SVG. Always 200 (the badge endpoint itself
  // is the proof-of-life). Colour reflects the `ok` field; users can hit this
  // from a static site monitor to see a green badge.
  app.get('/api/badge', async (_req, reply) => {
    const label = 'SpeakFlow';
    const message = 'OK';
    const color = '#22c55e'; // green-500
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
    reply.type('image/svg+xml; charset=utf-8').send(svg);
  });
};

export default statusRoutes;
