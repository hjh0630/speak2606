/**
 * Shared env helpers and types for Workers.
 *
 * In Workers, secrets/vars come from the `env` parameter of the fetch handler
 * (set in wrangler.toml / `wrangler secret put`). We do NOT use process.env.
 */
import type { D1Database, R2Bucket } from '@cloudflare/workers-types';

/**
 * Full Worker bindings (D1, R2, secrets, vars). Use as the generic param to
 * Hono so that `c.env` is typed instead of `unknown`.
 *
 *   import type { Bindings } from '../env';
 *   const app = new Hono<{ Bindings: Bindings }>();
 */
export interface Bindings {
  DB: D1Database;
  /**
   * R2 bucket for TTS audio. Optional — when absent (e.g. before R2 is enabled
   * on the account), TTS audio is delivered inline as base64 in WS frames
   * instead of being persisted. No historical audio playback, but live
   * conversation works.
   */
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

/**
 * Subset of process.env / wrangler bindings used by the MiniMax services.
 * Bound by index.ts from the Worker env.
 */
export interface MiniMaxEnv {
  apiKey: string;
  groupId: string;
  apiBase: string;
  ttsVoice: string;
  ttsModel: string;
  asrModel: string;
  llmModel: string;
  logLevel: string;
}

export function getMiniMaxEnv(env: {
  MINIMAX_API_KEY?: string;
  MINIMAX_GROUP_ID?: string;
  API_BASE?: string;
  MINIMAX_TTS_VOICE?: string;
  MINIMAX_TTS_MODEL?: string;
  MINIMAX_ASR_MODEL?: string;
  MINIMAX_LLM_MODEL?: string;
  LOG_LEVEL?: string;
}): MiniMaxEnv {
  const apiKey = (env.MINIMAX_API_KEY ?? '').trim();
  return {
    apiKey,
    groupId: (env.MINIMAX_GROUP_ID ?? '').trim(),
    apiBase: (env.API_BASE ?? 'https://api.minimax.chat').replace(/\/$/, ''),
    ttsVoice: env.MINIMAX_TTS_VOICE ?? 'male-qn-qingse',
    ttsModel: env.MINIMAX_TTS_MODEL ?? 'speech-2.8-turbo',
    asrModel: env.MINIMAX_ASR_MODEL ?? 'asr-01',
    llmModel: env.MINIMAX_LLM_MODEL ?? 'minimax-text-01',
    logLevel: env.LOG_LEVEL ?? 'info',
  };
}

export function hasMiniMaxCredentials(mm: MiniMaxEnv): boolean {
  return mm.apiKey.length > 0;
}

/**
 * R2 public URL builder.
 * Reads AUDIO_PUBLIC_BASE from env (defaults to empty = use /static/audio/... fallback).
 */
export function getAudioPublicBase(env: { AUDIO_PUBLIC_BASE?: string }): string {
  return (env.AUDIO_PUBLIC_BASE ?? '').replace(/\/$/, '');
}
