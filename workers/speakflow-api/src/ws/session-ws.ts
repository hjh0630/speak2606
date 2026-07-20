/**
 * WebSocket handler for /ws/session/:id (Workers version).
 *
 * Same wire protocol and business logic as backend/src/ws/session-ws.ts, but
 * the transport is Workers-native (WebSocketPair + server.accept() +
 * addEventListener) instead of @fastify/websocket + ws library.
 *
 * Lifecycle:
 *   - The fetch handler in index.ts detects the WS upgrade request and calls
 *     handleSessionWebSocket(server, env, sessionId) to wire it up.
 *   - We accept the connection, validate the session exists in D1, then begin
 *     dispatching client messages the same way the backend did.
 */
import type { D1Database } from '@cloudflare/workers-types';
import {
  appendMessage,
  advanceRound,
  getMessages,
  getSession,
  toLlmContext,
} from '../services/session-manager';
import { AsrSession } from '../services/asr';
import { chatCompletion, buildConversationSystemPrompt } from '../services/llm';
import { textToAudio, TTS_DEFAULT_VOICE } from '../services/tts';
import { scoreWithLlm, scoreRepeat } from '../services/scoring';
import { getDialogForRound, getSystemPrompt } from '../services/content';
import { saveAudioForSession } from '../services/audio';
import { getMiniMaxEnv, type MiniMaxEnv } from '../env';
import { runAsync } from '../db';
import { createLogger } from '../utils/logger';
import type {
  LlmChatMessage,
  ScoreFeedback,
  WsClientToServer,
  WsServerToClient,
} from '../types';

const log = createLogger('ws/session');

interface ActiveAsr {
  session: AsrSession;
  lastPartialSent: string;
  finalised: boolean;
}

interface WsState {
  sessionId: string;
  asr: ActiveAsr | null;
  closed: boolean;
  mm: MiniMaxEnv;
  env: { DB: D1Database; AUDIO?: R2Bucket; AUDIO_PUBLIC_BASE?: string };
}

export interface WsHandlerDeps {
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

export async function handleSessionWebSocket(
  server: WebSocket,
  deps: WsHandlerDeps,
  sessionId: string,
): Promise<void> {
  const mm = getMiniMaxEnv(deps);
  const env = { DB: deps.DB, AUDIO: deps.AUDIO, AUDIO_PUBLIC_BASE: deps.AUDIO_PUBLIC_BASE };
  const rec = await getSession(env.DB, sessionId);
  if (!rec) {
    try {
      server.close(1008, 'session not found');
    } catch (err) {
      log.warn(`Failed to close WS for missing session: ${(err as Error).message}`);
    }
    return;
  }

  server.accept();
  const state: WsState = { sessionId, asr: null, closed: false, mm, env };
  send(server, {
    type: 'ready',
    payload: { session_id: sessionId, difficulty: rec.difficulty, mode: rec.mode },
    ts: Date.now(),
  });

  server.addEventListener('message', (evt) => {
    if (state.closed) return;
    void handleMessage(server, state, evt.data).catch((err) => {
      log.error(`WS handle error: ${(err as Error).message}`);
      send(server, {
        type: 'error',
        payload: { code: 'WS_INTERNAL', message: (err as Error).message },
        ts: Date.now(),
      });
    });
  });

  server.addEventListener('close', () => {
    state.closed = true;
    cleanup(state);
    log.info(`WS closed for session ${sessionId}`);
  });
  server.addEventListener('error', (evt: Event) => {
    log.warn(`WS error for ${sessionId}: ${(evt as ErrorEvent).message ?? 'unknown'}`);
    state.closed = true;
    cleanup(state);
  });
}

function send(server: WebSocket, env: WsServerToClient): void {
  try {
    server.send(JSON.stringify(env));
  } catch (err) {
    log.warn(`WS send failed: ${(err as Error).message}`);
  }
}

function cleanup(state: WsState): void {
  if (state.asr) {
    try {
      state.asr.session.close();
    } catch (err) {
      log.warn(`ASR cleanup failed: ${(err as Error).message}`);
    }
    state.asr = null;
  }
}

async function handleMessage(server: WebSocket, state: WsState, raw: unknown): Promise<void> {
  let msg: WsClientToServer;
  try {
    const text = typeof raw === 'string' ? raw : new TextDecoder().decode(raw as ArrayBuffer);
    msg = JSON.parse(text) as WsClientToServer;
  } catch {
    send(server, { type: 'error', payload: { code: 'BAD_JSON', message: 'invalid JSON' }, ts: Date.now() });
    return;
  }

  switch (msg.type) {
    case 'ping':
      send(server, { type: 'pong', ts: Date.now() });
      return;
    case 'config':
      return; // currently no-op; defaults to en / 16 kHz
    case 'audio_chunk': {
      const payload = (msg.payload ?? {}) as { audio_base64?: string };
      const b64 = payload.audio_base64;
      if (!b64) {
        send(server, {
          type: 'error',
          payload: { code: 'AUDIO_MISSING', message: 'audio_base64 required' },
          ts: Date.now(),
        });
        return;
      }
      await ingestAudioChunk(server, state, b64);
      return;
    }
    case 'audio_end':
      await finaliseAudio(server, state);
      return;
    case 'text': {
      const payload = (msg.payload ?? {}) as { content?: string };
      const content = (payload.content ?? '').trim();
      if (!content) {
        send(server, {
          type: 'error',
          payload: { code: 'TEXT_EMPTY', message: 'content required' },
          ts: Date.now(),
        });
        return;
      }
      await runTurn(server, state, content);
      return;
    }
    case 'request_tts': {
      const payload = (msg.payload ?? {}) as { text?: string; voice_id?: string };
      const text = (payload.text ?? '').trim();
      if (!text) return;
      try {
        const tts = await textToAudio(state.mm, { text, voiceId: payload.voice_id ?? TTS_DEFAULT_VOICE });
        const bytes = new Uint8Array(tts.audio);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        send(server, {
          type: 'ai_audio_chunk',
          payload: {
            audio_base64: btoa(binary),
            mime: tts.mime,
            mocked: tts.mocked,
          },
          ts: Date.now(),
        });
      } catch (err) {
        send(server, {
          type: 'error',
          payload: { code: 'TTS_FAILED', message: (err as Error).message },
          ts: Date.now(),
        });
      }
      return;
    }
    default:
      send(server, {
        type: 'error',
        payload: { code: 'UNKNOWN_TYPE', message: `unknown type: ${String(msg.type)}` },
        ts: Date.now(),
      });
  }
}

async function ingestAudioChunk(server: WebSocket, state: WsState, b64: string): Promise<void> {
  if (!state.asr) {
    const session = new AsrSession(state.mm, { language: 'en' });
    state.asr = { session, lastPartialSent: '', finalised: false };
    try {
      await session.open();
    } catch (err) {
      log.warn(`ASR open failed, mock mode: ${(err as Error).message}`);
    }
  }
  const bin = atob(b64);
  const chunk = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) chunk[i] = bin.charCodeAt(i);
  try {
    state.asr.session.sendAudio(chunk);
  } catch (err) {
    log.warn(`ASR send failed: ${(err as Error).message}`);
  }
  const partial = state.asr.session.getLastPartial();
  if (partial && partial !== state.asr.lastPartialSent) {
    state.asr.lastPartialSent = partial;
    send(server, { type: 'transcript_partial', payload: { text: partial }, ts: Date.now() });
  }
}

async function finaliseAudio(server: WebSocket, state: WsState): Promise<void> {
  if (!state.asr) {
    send(server, {
      type: 'error',
      payload: { code: 'NO_AUDIO', message: 'no audio chunks to finalise' },
      ts: Date.now(),
    });
    return;
  }
  let finalText = '';
  try {
    if (!state.mm.apiKey) {
      send(server, {
        type: 'transcript_final',
        payload: { text: '', mocked: true, note: 'ASR in mock mode; type your reply instead.' },
        ts: Date.now(),
      });
      cleanup(state);
      return;
    }
    const result = await state.asr.session.finish();
    finalText = result.text;
    send(server, {
      type: 'transcript_final',
      payload: {
        text: result.text,
        confidence: result.confidence,
        mocked: result.mocked,
        language: result.language,
      },
      ts: Date.now(),
    });
  } catch (err) {
    log.warn(`ASR finalise failed: ${(err as Error).message}`);
    send(server, {
      type: 'error',
      payload: { code: 'ASR_FAILED', message: (err as Error).message },
      ts: Date.now(),
    });
  } finally {
    cleanup(state);
  }
  if (finalText.trim().length > 0) {
    await runTurn(server, state, finalText);
  }
}

async function runTurn(server: WebSocket, state: WsState, userText: string): Promise<void> {
  const rec = await getSession(state.env.DB, state.sessionId);
  if (!rec) {
    send(server, { type: 'error', payload: { code: 'SESSION_NOT_FOUND', message: 'session gone' }, ts: Date.now() });
    return;
  }
  if (rec.status === 'completed') {
    send(server, { type: 'error', payload: { code: 'SESSION_COMPLETED', message: 'session is completed' }, ts: Date.now() });
    return;
  }

  try {
    const userMsg = await appendMessage(state.env.DB, state.sessionId, { role: 'user', content: userText });
    const prior = (await getMessages(state.env.DB, state.sessionId)).filter((m) => m.id !== userMsg.id);
    const llmContext = toLlmContext(prior);

    let score: ScoreFeedback;
    if (rec.mode === 'repeat') {
      const target = getDialogForRound(rec.scenario_id, rec.difficulty, rec.round_index)?.ai_message ?? '';
      score = scoreRepeat(target, userText);
    } else {
      score = await scoreWithLlm(state.mm, userText, llmContext);
    }

    try {
      await runAsync(
        state.env.DB,
        `UPDATE messages SET score = ?, fluency = ?, accuracy = ?, feedback_json = ? WHERE id = ?`,
        [score.overall_score, score.fluency, score.accuracy, JSON.stringify(score), userMsg.id],
      );
    } catch {
      /* best-effort */
    }
    send(server, { type: 'score', payload: score, ts: Date.now() });

    let aiMessage = '';
    if (rec.mode === 'repeat') {
      const target = getDialogForRound(rec.scenario_id, rec.difficulty, rec.round_index)?.ai_message ?? '';
      aiMessage =
        score.overall_score >= 80
          ? `Great! You said "${userText}". Let's go to the next sentence.`
          : `Good try. The target was: "${target}". Please listen and try again.`;
    } else {
      const systemPrompt = buildConversationSystemPrompt(getSystemPrompt(rec.difficulty));
      const messages: LlmChatMessage[] = [
        ...llmContext,
        { role: 'user', content: userText },
      ];
      try {
        const resp = await chatCompletion(state.mm, {
          system: systemPrompt,
          messages,
          temperature: 0.7,
          maxTokens: 350,
        });
        aiMessage = (resp.content ?? '').trim() || '(empty AI reply)';
      } catch (err) {
        aiMessage = `(AI unavailable: ${(err as Error).message})`;
      }
    }

    const aiMsg = await appendMessage(state.env.DB, state.sessionId, {
      role: 'assistant',
      content: aiMessage,
    });
    await advanceRound(state.env.DB, state.sessionId);

    let audioUrl: string | null = null;
    let audioBase64: string | null = null;
    let audioMime: string | null = null;
    let mocked = false;
    try {
      const tts = await textToAudio(state.mm, { text: aiMessage, voiceId: TTS_DEFAULT_VOICE });
      mocked = tts.mocked;
      audioMime = tts.mime;
      if (!mocked) {
        audioUrl = await saveAudioForSession(state.env, state.sessionId, tts.audio, tts.mime) || null;
      } else {
        const bytes = new Uint8Array(tts.audio);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        audioBase64 = btoa(binary);
      }
    } catch {
      /* best-effort */
    }

    send(server, {
      type: 'ai_message',
      payload: {
        content: aiMessage,
        audio_url: audioUrl,
        audio_base64: audioBase64,
        audio_mime: audioMime,
        mocked,
        round_index: rec.round_index,
      },
      ts: Date.now(),
    });
    if (audioUrl) {
      send(server, { type: 'ai_audio_url', payload: { url: audioUrl }, ts: Date.now() });
    }
    send(server, {
      type: 'session_state',
      payload: {
        session_id: state.sessionId,
        round_index: rec.round_index,
        last_user_message_id: userMsg.id,
        last_ai_message_id: aiMsg.id,
      },
      ts: Date.now(),
    });
  } catch (err) {
    log.error(`runTurn failed: ${(err as Error).message}`);
    send(server, {
      type: 'error',
      payload: { code: 'TURN_FAILED', message: (err as Error).message },
      ts: Date.now(),
    });
  }
}
