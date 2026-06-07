import type { FastifyInstance } from 'fastify';
import type WebSocket from 'ws';
import {
  appendMessage,
  advanceRound,
  getMessages,
  getSession,
  toLlmContext,
} from '../services/session-manager';
import { AsrSession } from '../services/minimax-asr';
import { chatCompletion, buildConversationSystemPrompt } from '../services/minimax-llm';
import { textToAudio, TTS_DEFAULT_VOICE } from '../services/minimax-tts';
import { scoreWithLlm, scoreRepeat } from '../services/scoring';
import { getDialogForRound, getSystemPrompt } from '../services/content';
import { createLogger } from '../utils/logger';
import { config } from '../config';
import type {
  LlmChatMessage,
  ScoreFeedback,
  WsClientToServer,
  WsServerToClient,
} from '../types';

const log = createLogger('ws/session');

interface ActiveAsr {
  session: AsrSession;
  buffer: Buffer[];
  lastPartialSent: string;
  finalised: boolean;
}

interface WsState {
  sessionId: string;
  asr: ActiveAsr | null;
  closed: boolean;
}

/**
 * Real-time voice dialogue WebSocket.
 *
 * Browser -> server messages (JSON envelopes, type in `type`):
 *   - { type: "config", payload: { language?, sample_rate? } }  — set ASR options
 *   - { type: "audio_chunk", payload: { audio_base64: string } }  — push a recorded frame
 *   - { type: "audio_end" }                                 — flush, run ASR finish
 *   - { type: "text", payload: { content: string } }        — bypass ASR (typing fallback)
 *   - { type: "request_tts", payload: { text: string } }    — server returns audio url
 *   - { type: "ping" }
 *
 * Server -> browser messages:
 *   - { type: "ready", ts }                                 — on open
 *   - { type: "transcript_partial", payload: { text } }     — live partial transcript
 *   - { type: "transcript_final", payload: { text, ... } }  — committed transcript
 *   - { type: "ai_message", payload: { content, audio_url?, mocked? } }
 *   - { type: "ai_audio_url", payload: { url } }            — separate audio frame (TTS)
 *   - { type: "ai_audio_chunk", payload: { audio_base64, mime } }
 *   - { type: "score", payload: ScoreFeedback }
 *   - { type: "session_state", payload: { round_index, ... } }
 *   - { type: "error", payload: { code, message } }
 *   - { type: "pong" }
 */
export function registerSessionWs(app: FastifyInstance): void {
  app.get<{ Params: { id: string } }>('/ws/session/:id', { websocket: true }, (socket, req) => {
    const { id } = req.params;
    const rec = getSession(id);
    if (!rec) {
      try {
        socket.close(1008, 'session not found');
      } catch (err) {
        log.warn(`Failed to close WS for missing session: ${(err as Error).message}`);
      }
      return;
    }

    const state: WsState = { sessionId: id, asr: null, closed: false };

    send(socket, { type: 'ready', payload: { session_id: id, difficulty: rec.difficulty, mode: rec.mode }, ts: Date.now() });

    socket.on('message', (raw: WebSocket.RawData) => {
      if (state.closed) return;
      void handleMessage(socket, state, raw).catch((err) => {
        log.error(`WS handle error: ${(err as Error).message}`);
        send(socket, { type: 'error', payload: { code: 'WS_INTERNAL', message: (err as Error).message }, ts: Date.now() });
      });
    });

    socket.on('close', () => {
      state.closed = true;
      cleanup(state);
      log.info(`WS closed for session ${id}`);
    });
    socket.on('error', (err: Error) => {
      log.warn(`WS error for ${id}: ${err.message}`);
      state.closed = true;
      cleanup(state);
    });
  });
}

function send(socket: WebSocket, env: WsServerToClient): void {
  try {
    socket.send(JSON.stringify(env));
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

async function handleMessage(socket: WebSocket, state: WsState, raw: WebSocket.RawData): Promise<void> {
  let msg: WsClientToServer;
  try {
    const text = raw.toString('utf-8');
    msg = JSON.parse(text) as WsClientToServer;
  } catch {
    send(socket, { type: 'error', payload: { code: 'BAD_JSON', message: 'invalid JSON' }, ts: Date.now() });
    return;
  }

  switch (msg.type) {
    case 'ping':
      send(socket, { type: 'pong', ts: Date.now() });
      return;
    case 'config':
      // We do not currently persist this; ASR uses defaults unless overridden per session via env.
      return;
    case 'audio_chunk': {
      const payload = (msg.payload ?? {}) as { audio_base64?: string };
      const b64 = payload.audio_base64;
      if (!b64) {
        send(socket, { type: 'error', payload: { code: 'AUDIO_MISSING', message: 'audio_base64 required' }, ts: Date.now() });
        return;
      }
      await ingestAudioChunk(socket, state, b64);
      return;
    }
    case 'audio_end': {
      await finaliseAudio(socket, state);
      return;
    }
    case 'text': {
      const payload = (msg.payload ?? {}) as { content?: string };
      const content = (payload.content ?? '').trim();
      if (!content) {
        send(socket, { type: 'error', payload: { code: 'TEXT_EMPTY', message: 'content required' }, ts: Date.now() });
        return;
      }
      await runTurn(socket, state, content);
      return;
    }
    case 'request_tts': {
      const payload = (msg.payload ?? {}) as { text?: string; voice_id?: string };
      const text = (payload.text ?? '').trim();
      if (!text) return;
      try {
        const tts = await textToAudio({ text, voiceId: payload.voice_id ?? TTS_DEFAULT_VOICE });
        send(socket, {
          type: 'ai_audio_chunk',
          payload: { audio_base64: tts.audio.toString('base64'), mime: tts.mime, mocked: tts.mocked },
          ts: Date.now(),
        });
      } catch (err) {
        send(socket, { type: 'error', payload: { code: 'TTS_FAILED', message: (err as Error).message }, ts: Date.now() });
      }
      return;
    }
    default:
      send(socket, { type: 'error', payload: { code: 'UNKNOWN_TYPE', message: `unknown type: ${String(msg.type)}` }, ts: Date.now() });
  }
}

async function ingestAudioChunk(socket: WebSocket, state: WsState, b64: string): Promise<void> {
  if (!state.asr) {
    const session = new AsrSession({ language: 'en' });
    state.asr = { session, buffer: [], lastPartialSent: '', finalised: false };
    try {
      await session.open();
    } catch (err) {
      log.warn(`ASR open failed, mock mode: ${(err as Error).message}`);
      // Keep going — mock session will accept sends but return empty final.
    }
  }
  const chunk = Buffer.from(b64, 'base64');
  state.asr.buffer.push(chunk);
  if (state.asr.session) {
    try {
      state.asr.session.sendAudio(chunk);
    } catch (err) {
      log.warn(`ASR send failed: ${(err as Error).message}`);
    }
  }
  const partial = state.asr.session.getLastPartial();
  if (partial && partial !== state.asr.lastPartialSent) {
    state.asr.lastPartialSent = partial;
    send(socket, { type: 'transcript_partial', payload: { text: partial }, ts: Date.now() });
  }
}

async function finaliseAudio(socket: WebSocket, state: WsState): Promise<void> {
  if (!state.asr) {
    send(socket, { type: 'error', payload: { code: 'NO_AUDIO', message: 'no audio chunks to finalise' }, ts: Date.now() });
    return;
  }
  let finalText = '';
  try {
    if (!config.minimax.hasCredentials) {
      // Mock mode: we don't fabricate text. Tell the client to fall back to typing.
      send(socket, { type: 'transcript_final', payload: { text: '', mocked: true, note: 'ASR in mock mode; type your reply instead.' }, ts: Date.now() });
      cleanup(state);
      return;
    }
    const result = await state.asr.session.finish();
    finalText = result.text;
    send(socket, {
      type: 'transcript_final',
      payload: { text: result.text, confidence: result.confidence, mocked: result.mocked, language: result.language },
      ts: Date.now(),
    });
  } catch (err) {
    log.warn(`ASR finalise failed: ${(err as Error).message}`);
    send(socket, { type: 'error', payload: { code: 'ASR_FAILED', message: (err as Error).message }, ts: Date.now() });
  } finally {
    cleanup(state);
  }
  if (finalText.trim().length > 0) {
    await runTurn(socket, state, finalText);
  }
}

async function runTurn(socket: WebSocket, state: WsState, userText: string): Promise<void> {
  const rec = getSession(state.sessionId);
  if (!rec) {
    send(socket, { type: 'error', payload: { code: 'SESSION_NOT_FOUND', message: 'session gone' }, ts: Date.now() });
    return;
  }
  if (rec.status === 'completed') {
    send(socket, { type: 'error', payload: { code: 'SESSION_COMPLETED', message: 'session is completed' }, ts: Date.now() });
    return;
  }

  try {
    // 1) Persist user message
    const userMsg = appendMessage(state.sessionId, { role: 'user', content: userText });

    // 2) Score
    const llmContext = toLlmContext(getMessages(state.sessionId).filter((m) => m.id !== userMsg.id));
    let score: ScoreFeedback;
    if (rec.mode === 'repeat') {
      const target = getDialogForRound(rec.scenario_id, rec.difficulty, rec.round_index)?.ai_message ?? '';
      score = scoreRepeat(target, userText);
    } else {
      score = await scoreWithLlm(userText, llmContext);
    }
    try {
      getDb()
        .prepare(`UPDATE messages SET score = ?, fluency = ?, accuracy = ?, feedback_json = ? WHERE id = ?`)
        .run(score.overall_score, score.fluency, score.accuracy, JSON.stringify(score), userMsg.id);
    } catch (err) {
      log.warn(`Persist score failed: ${(err as Error).message}`);
    }
    send(socket, { type: 'score', payload: score, ts: Date.now() });

    // 3) AI reply
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
        const resp = await chatCompletion({
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

    // 4) Persist + advance
    const aiMsg = appendMessage(state.sessionId, { role: 'assistant', content: aiMessage });
    advanceRound(state.sessionId);

    // 5) TTS
    let audioUrl: string | null = null;
    let audioBase64: string | null = null;
    let audioMime: string | null = null;
    let mocked = false;
    try {
      const tts = await textToAudio({ text: aiMessage, voiceId: TTS_DEFAULT_VOICE });
      mocked = tts.mocked;
      audioMime = tts.mime;
      if (!mocked) {
        audioUrl = await saveAudioForSession(state.sessionId, tts.audio, tts.mime);
      } else {
        audioBase64 = tts.audio.toString('base64');
      }
    } catch (err) {
      log.warn(`TTS failed: ${(err as Error).message}`);
    }

    send(socket, {
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
      send(socket, { type: 'ai_audio_url', payload: { url: audioUrl }, ts: Date.now() });
    }
    send(socket, {
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
    send(socket, { type: 'error', payload: { code: 'TURN_FAILED', message: (err as Error).message }, ts: Date.now() });
  }
}

// local require to break circular dep with sessions route file.
function getDb(): import('better-sqlite3').Database {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('../db').getDb();
}

async function saveAudioForSession(
  sessionId: string,
  audio: Buffer,
  mime: string,
): Promise<string> {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const dir = path.resolve(config.dbPath, '..', 'audio', sessionId);
  await fs.promises.mkdir(dir, { recursive: true });
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.mp3`;
  await fs.promises.writeFile(path.join(dir, filename), audio);
  void mime;
  return `/static/audio/${sessionId}/${filename}`;
}
