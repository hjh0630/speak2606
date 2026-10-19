/**
 * MiniMax TTS client (Workers version).
 *
 * Endpoint: POST {apiBase}/v1/t2a_v2
 * Auth: Bearer <MINIMAX_API_KEY>
 * Returns: hex-encoded audio (verified by content shape), decoded to ArrayBuffer.
 *
 * Workers doesn't have Node's Buffer — we use Uint8Array + atob/btoa or
 * TextEncoder for hex decode. (nodejs_compat is enabled in wrangler.toml, so
 * Buffer IS available — we still prefer the universal API for portability.)
 */
import type { TtsRequest, TtsResponse } from '../types';
import type { MiniMaxEnv } from '../env';
import { hasMiniMaxCredentials } from '../env';
import { createLogger } from '../utils/logger';

const log = createLogger('tts');

function buildMockTtsResponse(): TtsResponse {
  const silentMp3 = new Uint8Array([
    0xff, 0xfb, 0x90, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  ]);
  return {
    audio: silentMp3.buffer,
    mime: 'audio/mpeg',
    mocked: true,
  };
}

function hexToUint8Array(hex: string): Uint8Array {
  const out = new Uint8Array(Math.floor(hex.length / 2));
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function buildRequestBody(req: TtsRequest, mm: MiniMaxEnv): unknown {
  const voiceId = req.voiceId ?? mm.ttsVoice;
  const format = req.format ?? 'mp3';
  const sampleRate = req.sampleRate ?? 24000;
  return {
    model: mm.ttsModel,
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

async function callRemote(mm: MiniMaxEnv, req: TtsRequest): Promise<TtsResponse> {
  const url = `${mm.apiBase}/v1/t2a_v2`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${mm.apiKey}`,
  };
  if (mm.groupId) headers['X-Group-Id'] = mm.groupId;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(buildRequestBody(req, mm)),
      signal: controller.signal,
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      throw new Error(`MiniMax TTS HTTP ${resp.status}: ${text.slice(0, 200)}`);
    }
    const data = (await resp.json()) as {
      data?: { audio?: string };
      audio?: string;
      base_resp?: { status_code?: number; status_msg?: string };
    };
    const statusCode = data?.base_resp?.status_code ?? 0;
    if (statusCode !== 0) {
      throw new Error(`MiniMax TTS API error [${statusCode}]: ${data?.base_resp?.status_msg ?? 'unknown'}`);
    }
    const encoded = data.data?.audio ?? data.audio;
    if (!encoded) {
      throw new Error('MiniMax TTS response did not include audio data');
    }
    const looksLikeHex = /^[0-9a-fA-F]+$/.test(encoded) && encoded.length % 2 === 0;
    const audio = looksLikeHex
      ? hexToUint8Array(encoded)
      : Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0));
    return {
      audio: audio.buffer as ArrayBuffer,
      mime: 'audio/mpeg',
      mocked: false,
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function textToAudio(
  mm: MiniMaxEnv,
  req: TtsRequest,
): Promise<TtsResponse> {
  if (!hasMiniMaxCredentials(mm)) {
    log.debug('No credentials, returning mock TTS (silent mp3 header)');
    return buildMockTtsResponse();
  }
  try {
    return await callRemote(mm, req);
  } catch (err) {
    log.warn(`MiniMax TTS failed, falling back to mock: ${(err as Error).message}`);
    return buildMockTtsResponse();
  }
}

export const TTS_DEFAULT_VOICE = 'male-qn-qingse';

export interface VoiceInfo {
  id: string;
  name: string;
  gender: 'male' | 'female';
}

export const TTS_VOICES: VoiceInfo[] = [
  { id: 'male-qn-qingse', name: '男生 · 清澈', gender: 'male' },
  { id: 'male-qn-badao', name: '男生 · 霸道', gender: 'male' },
  { id: 'male-qn-daxuesheng', name: '男生 · 年轻', gender: 'male' },
  { id: 'female-shaonv', name: '女生 · 少女', gender: 'female' },
  { id: 'female-yujie', name: '女生 · 成熟', gender: 'female' },
  { id: 'female-chengshu', name: '女生 · 知性', gender: 'female' },
  { id: 'female-tianmei', name: '女生 · 甜美', gender: 'female' },
];
