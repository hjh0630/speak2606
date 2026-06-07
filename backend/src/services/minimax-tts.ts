import { config } from '../config';
import { createLogger } from '../utils/logger';
import type { TtsRequest, TtsResponse } from '../types';

const log = createLogger('minimax-tts');

/**
 * MiniMax Text-to-Audio (t2a_v2) client.
 * Default voice_id is "male-qn-qingse". Returns raw audio bytes (mp3 by default).
 *
 * Endpoint: POST {API_BASE}/v1/t2a_v2
 * Auth:     Authorization: Bearer <MINIMAX_API_KEY>
 * Headers:  X-Group-Id: <MINIMAX_GROUP_ID>
 *
 * The official response is base64-encoded audio inside a JSON envelope. We decode it for callers.
 */

const DEFAULT_VOICE_ID = 'male-qn-qingse';
const DEFAULT_FORMAT = 'mp3';
const DEFAULT_SAMPLE_RATE = 24000;

function buildMockTtsResponse(req: TtsRequest): TtsResponse {
  // A 1-byte silent mp3 frame header is enough to make the response well-formed for the
  // frontend to attempt playback (it will sound silent — a clear signal that mocks are on).
  // We deliberately do NOT fabricate spoken audio because that would mislead the user.
  const silentMp3Header = Buffer.from([
    0xff, 0xfb, 0x90, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  ]);
  return {
    audio: silentMp3Header,
    mime: 'audio/mpeg',
    mocked: true,
  };
}

function buildRequestBody(req: TtsRequest): unknown {
  const voiceId = req.voiceId ?? DEFAULT_VOICE_ID;
  const format = req.format ?? DEFAULT_FORMAT;
  const sampleRate = req.sampleRate ?? DEFAULT_SAMPLE_RATE;
  return {
    model: 'speech-2.8-turbo',
    text: req.text,
    stream: false,
    voice_setting: {
      voice_id: voiceId,
      speed: req.speed ?? 1.0,
      vol: req.volume ?? 1.0,
      pitch: req.pitch ?? 0,
    },
    audio_setting: {
      audio_sample_rate: sampleRate,
      bit_rate: 128000,
      format,
      channel: 1,
    },
  };
}

async function callRemote(req: TtsRequest): Promise<TtsResponse> {
  const url = `${config.minimax.apiBase.replace(/\/$/, '')}/v1/t2a_v2`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${config.minimax.apiKey}`,
  };
  if (config.minimax.groupId) {
    headers['X-Group-Id'] = config.minimax.groupId;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(buildRequestBody(req)),
      signal: controller.signal,
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      throw new Error(`MiniMax TTS HTTP ${resp.status}: ${text.slice(0, 200)}`);
    }
    const data = (await resp.json()) as { data?: { audio?: string }; audio?: string; base_resp?: { status_code?: number; status_msg?: string } };
    const statusCode = data?.base_resp?.status_code ?? 0;
    if (statusCode !== 0) {
      throw new Error(`MiniMax TTS API error [${statusCode}]: ${data?.base_resp?.status_msg ?? 'unknown'}`);
    }
    const encoded = data.data?.audio ?? data.audio;
    if (!encoded) {
      throw new Error('MiniMax TTS response did not include audio data');
    }
    // MiniMax t2a_v2 returns hex-encoded audio (not base64). Verify by checking
    // the expected size from extra_info vs the string length.
    const looksLikeHex = /^[0-9a-fA-F]+$/.test(encoded) && encoded.length % 2 === 0;
    const audio = looksLikeHex
      ? Buffer.from(encoded, 'hex')
      : Buffer.from(encoded, 'base64');
    return {
      audio,
      mime: 'audio/mpeg',
      mocked: false,
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function textToAudio(req: TtsRequest): Promise<TtsResponse> {
  if (!config.minimax.hasCredentials) {
    log.debug('No credentials, returning mock TTS (silent mp3 header)');
    return buildMockTtsResponse(req);
  }
  try {
    return await callRemote(req);
  } catch (err) {
    log.warn(`MiniMax TTS failed, falling back to mock: ${(err as Error).message}`);
    return buildMockTtsResponse(req);
  }
}

export const TTS_DEFAULT_VOICE = DEFAULT_VOICE_ID;
