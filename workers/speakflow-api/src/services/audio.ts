/**
 * R2-backed audio storage.
 *
 * Replaces backend's local-fs saveAudioForSession. The TTS response audio bytes
 * are uploaded to R2 under `audio/{sessionId}/{timestamp}-{rand}.mp3`, and the
 * public URL is returned to clients for direct playback.
 *
 * Requires:
 *   - AUDIO R2 binding (set in wrangler.toml)
 *   - AUDIO_PUBLIC_BASE env var (e.g. https://audio.speakflow.pages.dev or
 *     a custom R2 public domain)
 */
import type { R2Bucket } from '@cloudflare/workers-types';
import { createLogger } from '../utils/logger';
import { getAudioPublicBase } from '../env';

const log = createLogger('audio');

export interface AudioEnv {
  AUDIO?: R2Bucket;
  AUDIO_PUBLIC_BASE?: string;
}

/**
 * Save audio bytes to R2 and return the public URL.
 *
 * Degraded mode: when AUDIO binding is absent (R2 not enabled on the account)
 * OR AUDIO_PUBLIC_BASE is unset, returns ''. Callers (routes/sessions,
 * ws/session-ws) detect empty URL and fall back to delivering audio inline as
 * base64 in the response / WS frame.
 *
 * @param env        Worker env (optional AUDIO binding + optional AUDIO_PUBLIC_BASE)
 * @param sessionId  Used as a logical namespace in the R2 key path
 * @param audio      Raw audio bytes (ArrayBuffer)
 * @param mime       Content-Type (e.g. "audio/mpeg")
 * @returns Public URL where the audio can be fetched, or '' in degraded mode
 */
export async function saveAudioForSession(
  env: AudioEnv,
  sessionId: string,
  audio: ArrayBuffer,
  mime: string,
): Promise<string> {
  if (!env.AUDIO) {
    log.debug('AUDIO binding absent — skipping R2 upload (degraded: base64 inline mode)');
    return '';
  }
  const publicBase = getAudioPublicBase(env);
  if (!publicBase) {
    log.warn('AUDIO_PUBLIC_BASE not set — skipping R2 upload');
    return '';
  }
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.mp3`;
  const key = `audio/${sessionId}/${filename}`;
  try {
    await env.AUDIO.put(key, audio, {
      httpMetadata: { contentType: mime || 'audio/mpeg' },
    });
    return `${publicBase}/${key}`;
  } catch (err) {
    log.warn(`R2 put failed for ${key}: ${(err as Error).message}`);
    return '';
  }
}

/**
 * Fetch audio bytes from R2. Used by the /static/audio/:key proxy route.
 * Returns null if R2 binding is absent.
 */
export async function getAudio(env: AudioEnv, key: string): Promise<R2ObjectBody | null> {
  if (!env.AUDIO) return null;
  return env.AUDIO.get(key);
}
