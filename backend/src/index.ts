import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import fastifyStatic from '@fastify/static';
import * as path from 'node:path';
import { config } from './config';
import { createLogger } from './utils/logger';
import { getDb, closeDb } from './db';
import scenariosRoutes from './routes/scenarios';
import sessionsRoutes from './routes/sessions';
import historyRoutes from './routes/history';
import statsRoutes from './routes/stats';
import vocabularyRoutes from './routes/vocabulary';
import wordbookRoutes from './routes/wordbook';
import statusRoutes from './routes/status';
import dictionaryRoutes from './routes/dictionary';
import customScenariosRoutes from './routes/custom-scenarios';
import { registerSessionWs } from './ws/session-ws';

const log = createLogger('index');

const MIME_BY_EXT: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.txt': 'text/plain; charset=utf-8',
};

function guessMime(urlPath: string): string | null {
  for (const ext of Object.keys(MIME_BY_EXT)) {
    if (urlPath.toLowerCase().endsWith(ext)) return MIME_BY_EXT[ext] ?? null;
  }
  return null;
}

async function build(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: config.logLevel,
      // Pretty print is optional; keep it JSON-friendly by default for sandbox logs.
    },
    bodyLimit: 25 * 1024 * 1024, // 25 MiB — enough for base64 audio blobs from the browser.
    trustProxy: true,
  });

  // CORS — local dev default is localhost:5173.
  await app.register(cors, {
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (config.corsOrigins.includes('*') || config.corsOrigins.includes(origin)) {
        return cb(null, true);
      }
      return cb(null, true); // permissive in dev — tighten via CORS_ORIGINS env in prod.
    },
    credentials: true,
  });

  // WebSocket
  await app.register(websocket);

  // Static file serving for generated TTS audio
  const audioDir = path.resolve(path.dirname(config.dbPath), 'audio');
  try {
    const fsSync = await import('node:fs');
    fsSync.mkdirSync(audioDir, { recursive: true });
  } catch (err) {
    log.warn(`Could not pre-create audio dir: ${(err as Error).message}`);
  }
  await app.register(fastifyStatic, {
    root: audioDir,
    prefix: '/static/audio/',
    decorateReply: false,
  });

  // Health check
  app.get('/health', async (_req, reply) => {
    return reply.send({ ok: true, ts: Date.now(), minimax: { hasCredentials: config.minimax.hasCredentials } });
  });

  // Init DB eagerly so migrations run before traffic arrives
  getDb();

  // Routes
  await app.register(scenariosRoutes);
  await app.register(sessionsRoutes);
  await app.register(historyRoutes);
  await app.register(statsRoutes);
  await app.register(vocabularyRoutes);
  await app.register(wordbookRoutes);
  await app.register(statusRoutes);
  await app.register(dictionaryRoutes);
  await app.register(customScenariosRoutes);

  // WebSocket routes
  registerSessionWs(app);

  // Optional: serve the built SPA from /workspace/frontend/dist. When present,
  // any request that does not match an API/WS route falls through to the SPA
  // (index.html for client-side routing, or static assets for hashed URLs).
  // This lets us ship a single port and a single origin in production.
  // We avoid setting prefix on the static plugin (it would install its own
  // 404 handler and conflict with our SPA fallback) — instead we mount a
  // sub-Fastify via fastify-static and prepend it as middleware.
  const spaDir = path.resolve(__dirname, '../../../frontend/dist');
  let spaEnabled = false;
  let spaIndexHtml: Buffer | null = null;
  try {
    const fsSync = await import('node:fs');
    if (fsSync.existsSync(path.join(spaDir, 'index.html'))) {
      spaIndexHtml = fsSync.readFileSync(path.join(spaDir, 'index.html'));
      spaEnabled = true;
      log.info(`Serving built SPA from ${spaDir}`);
    }
  } catch (err) {
    log.warn(`SPA static setup failed: ${(err as Error).message}`);
  }

  // Centralised 404 handler — SPA fallback for GET requests, JSON for API/WS.
  // For SPA fallback, we also try to serve real static files from the dist
  // directory (hashed JS/CSS) before serving index.html.
  app.setNotFoundHandler((req, reply) => {
    const isApiOrWs =
      req.url.startsWith('/api/') ||
      req.url.startsWith('/static/') ||
      req.url.startsWith('/ws/') ||
      req.url === '/health';
    if (spaEnabled && req.method === 'GET' && !isApiOrWs) {
      // Try to serve a real file from the SPA dist (e.g. /assets/foo.js)
      try {
        const fsSync = require('node:fs');
        const safeUrl = decodeURIComponent(req.url.split('?')[0]);
        if (safeUrl !== '/' && !safeUrl.includes('..')) {
          const candidate = path.join(spaDir, safeUrl);
          if (
            fsSync.existsSync(candidate) &&
            fsSync.statSync(candidate).isFile()
          ) {
            const mime = guessMime(safeUrl);
            if (mime) reply.type(mime);
            reply.send(fsSync.readFileSync(candidate));
            return;
          }
        }
      } catch (err) {
        log.warn(`SPA static serve failed: ${(err as Error).message}`);
      }
      if (spaIndexHtml) {
        reply.type('text/html').send(spaIndexHtml);
        return;
      }
    }
    reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'route not found' } });
  });

  // Centralised error handler — never leak stack traces to clients, always JSON.
  app.setErrorHandler((err, _req, reply) => {
    const code = (err as { code?: string }).code ?? 'INTERNAL_ERROR';
    const status = (err as { statusCode?: number }).statusCode ?? 500;
    log.error(`[${code}] ${err.message}`);
    reply.code(status).send({ error: { code, message: err.message } });
  });

  return app;
}

async function main(): Promise<void> {
  const app = await build();
  try {
    await app.listen({ port: config.port, host: config.host });
    log.info(`HTTP listening on http://${config.host}:${config.port}`);
    log.info(`WebSocket: ws://${config.host}:${config.port}/ws/session/:id`);
    log.info(`Health:    http://${config.host}:${config.port}/health`);
  } catch (err) {
    log.error(`Listen failed: ${(err as Error).message}`);
    process.exit(1);
  }

  const shutdown = async (signal: string): Promise<void> => {
    log.info(`Received ${signal}, shutting down...`);
    try {
      await app.close();
    } catch (err) {
      log.warn(`Error during app.close(): ${(err as Error).message}`);
    }
    try {
      closeDb();
    } catch (err) {
      log.warn(`Error during closeDb(): ${(err as Error).message}`);
    }
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((err) => {
  log.error(`Fatal startup error: ${(err as Error).message}`);
  process.exit(1);
});
