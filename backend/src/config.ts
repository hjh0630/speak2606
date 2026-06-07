import * as path from 'node:path';
import * as fs from 'node:fs';
import { createLogger } from './utils/logger';

const log = createLogger('config');

/**
 * Load .env from /workspace/backend/.env if it exists.
 * We intentionally do NOT crash if .env is missing — env vars may also be passed via the shell.
 */
function loadDotEnv(): void {
  const candidates = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(__dirname, '..', '.env'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      // Lazy-require dotenv; if it's not installed we still won't crash.
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const dotenv = require('dotenv') as { config: (opts: { path: string }) => void };
        dotenv.config({ path: p });
        log.info(`Loaded .env from ${p}`);
      } catch (err) {
        log.warn(`dotenv not available, falling back to process.env: ${(err as Error).message}`);
      }
      return;
    }
  }
  log.warn('No .env file found. Relying on process.env. Copy .env.example to .env to configure MiniMax API keys.');
}

loadDotEnv();

function envStr(key: string, fallback: string): string {
  const v = process.env[key];
  if (v === undefined || v === '') return fallback;
  return v;
}

function envInt(key: string, fallback: number): number {
  const v = process.env[key];
  if (v === undefined || v === '') return fallback;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

function envBool(key: string, fallback: boolean): boolean {
  const v = process.env[key];
  if (v === undefined || v === '') return fallback;
  return v === '1' || v.toLowerCase() === 'true';
}

export interface AppConfig {
  port: number;
  host: string;
  logLevel: string;
  corsOrigins: string[];
  minimax: {
    apiKey: string;
    groupId: string;
    apiBase: string;
    hasCredentials: boolean;
  };
  contentDir: string;
  dbPath: string;
}

const contentDirRaw = envStr('CONTENT_DIR', '/workspace/content');
const dbPathRaw = envStr('DB_PATH', path.resolve(__dirname, '..', 'data', 'app.db'));

export const config: AppConfig = {
  port: envInt('PORT', 3001),
  host: envStr('HOST', '0.0.0.0'),
  logLevel: envStr('LOG_LEVEL', 'info'),
  corsOrigins: envStr('CORS_ORIGINS', 'http://localhost:5173,http://127.0.0.1:5173')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0),
  minimax: {
    apiKey: envStr('MINIMAX_API_KEY', ''),
    groupId: envStr('MINIMAX_GROUP_ID', ''),
    apiBase: envStr('API_BASE', 'https://api.minimax.chat'),
    hasCredentials: envBool('MINIMAX_HAS_CREDENTIALS', false),
  },
  contentDir: contentDirRaw,
  dbPath: dbPathRaw,
};

// Recompute hasCredentials based on actual env (in case user only filled one field).
config.minimax.hasCredentials = config.minimax.apiKey.trim().length > 0;

if (!config.minimax.hasCredentials) {
  log.warn(
    'MINIMAX_API_KEY is not set. The service will start, but conversation, scoring, TTS, and ASR will return MOCK data (no external calls will be made).',
  );
} else {
  log.info('MiniMax credentials detected. Real LLM / TTS / ASR calls will be attempted.');
}

if (config.minimax.apiKey.trim().length > 0 && config.minimax.groupId.trim().length === 0) {
  log.warn('MINIMAX_API_KEY is set but MINIMAX_GROUP_ID is empty. Some MiniMax endpoints require a group id.');
}
