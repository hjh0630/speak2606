/**
 * Root Hono router — mounts all route modules.
 *
 * Each module owns a Hono sub-app exported from `routes/*.ts` and is mounted
 * under the same `/api/*` prefix (it already includes the prefix in its own
 * paths, so we just `route('/', sub)`).
 *
 * Also handles the SPA-friendly CORS for cross-origin (Pages → Workers
 * same-origin means no CORS needed in prod; cross-origin preview deploys may
 * still hit it).
 */
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { scenariosRoutes } from './routes/scenarios';
import { sessionsRoutes } from './routes/sessions';
import { historyRoutes } from './routes/history';
import { statsRoutes } from './routes/stats';
import { vocabularyRoutes } from './routes/vocabulary';
import { statusRoutes } from './routes/status';
import { dictionaryRoutes } from './routes/dictionary';
import { customScenariosRoutes } from './routes/custom-scenarios';
import type { Bindings } from './env';

export const app = new Hono<{ Bindings: Bindings }>();

app.use('*', cors({ origin: '*', credentials: false }));

app.route('/', scenariosRoutes);
app.route('/', sessionsRoutes);
app.route('/', historyRoutes);
app.route('/', statsRoutes);
app.route('/', vocabularyRoutes);
app.route('/', statusRoutes);
app.route('/', dictionaryRoutes);
app.route('/', customScenariosRoutes);

app.get('/health', (c) =>
  c.json({ ok: true, ts: Date.now() }),
);

app.notFound((c) =>
  c.json({ error: { code: 'NOT_FOUND', message: 'route not found' } }, 404),
);

app.onError((err, c) => {
  console.error(JSON.stringify({ scope: 'router', msg: 'unhandled', err: err.message }));
  return c.json({ error: { code: 'INTERNAL_ERROR', message: err.message } }, 500);
});
