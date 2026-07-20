/**
 * Worker entry point.
 *
 * - HTTP traffic: routed through Hono (router.ts)
 * - WebSocket upgrade on /ws/session/:id: handled inline with WebSocketPair
 * - DB migrations run on cold start (idempotent)
 */
import type { D1Database, R2Bucket } from '@cloudflare/workers-types';
import { app } from './router';
import { bootstrapDb } from './db';
import { handleSessionWebSocket, type WsHandlerDeps } from './ws/session-ws';
import { createLogger } from './utils/logger';

const log = createLogger('worker');

export interface Env {
  DB: D1Database;
  AUDIO?: R2Bucket;
  AUDIO_PUBLIC_BASE?: string;
  MINIMAX_API_KEY?: string;
  MINIMAX_GROUP_ID?: string;
  API_BASE?: string;
  MINIMAX_TTS_VOICE?: string;
  MINIMAX_TTS_MODEL?: string;
  MINIMAX_ASR_MODEL?: string;
  MINIMAX_LLM_MODEL?: string;
  LOG_LEVEL?: string;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // WebSocket upgrade path: /ws/session/:id
    if (url.pathname.startsWith('/ws/session/')) {
      // Confirm upgrade.
      if (request.headers.get('Upgrade') !== 'websocket') {
        return new Response('expected websocket upgrade', { status: 426 });
      }
      const sessionId = decodeURIComponent(url.pathname.substring('/ws/session/'.length));
      if (!sessionId) {
        return new Response('session id required', { status: 400 });
      }
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair) as [WebSocket, WebSocket];
      // Bootstrap D1 lazily here too — session lookup will create tables if absent.
      try {
        await bootstrapDb(env.DB);
      } catch (err) {
        log.error(`bootstrapDb failed: ${(err as Error).message}`);
        return new Response('db unavailable', { status: 503 });
      }
      const deps: WsHandlerDeps = {
        DB: env.DB,
        AUDIO: env.AUDIO,
        AUDIO_PUBLIC_BASE: env.AUDIO_PUBLIC_BASE,
        MINIMAX_API_KEY: env.MINIMAX_API_KEY,
        MINIMAX_GROUP_ID: env.MINIMAX_GROUP_ID,
        API_BASE: env.API_BASE,
        MINIMAX_TTS_VOICE: env.MINIMAX_TTS_VOICE,
        MINIMAX_TTS_MODEL: env.MINIMAX_TTS_MODEL,
        MINIMAX_ASR_MODEL: env.MINIMAX_ASR_MODEL,
        MINIMAX_LLM_MODEL: env.MINIMAX_LLM_MODEL,
        LOG_LEVEL: env.LOG_LEVEL,
      };
      // Run handler without blocking the response.
      ctx.waitUntil(handleSessionWebSocket(server, deps, sessionId));
      return new Response(null, { status: 101, webSocket: client });
    }

    // Run D1 migrations on first request (idempotent, fast on warm isolates).
    try {
      await bootstrapDb(env.DB);
    } catch (err) {
      log.warn(`bootstrapDb on cold path failed: ${(err as Error).message}`);
      // Continue — many endpoints don't need the DB.
    }

    return app.fetch(request, env, ctx);
  },
};
