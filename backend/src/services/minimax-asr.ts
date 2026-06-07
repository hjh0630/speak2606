import WS = require('ws');
import type { RawData } from 'ws';
import { config } from '../config';
// Re-bind the constructor for the rest of the file.
import { createLogger } from '../utils/logger';
import type { AsrFinalResult } from '../types';

const log = createLogger('minimax-asr');

/**
 * MiniMax ASR (Automatic Speech Recognition) client.
 *
 * The real-time ASR endpoint is a WebSocket stream: clients push binary audio frames and
 * receive JSON transcript events. We expose a higher-level async iterator + a convenience
 * `transcribeBuffer` that collects audio chunks and returns the final transcript.
 *
 * WebSocket URL: wss://{API_BASE_HOST}/v1/asr?model=...
 * Auth is sent in the first message as JSON: { "type": "auth", "api_key": "...", "group_id": "..." }
 *
 * For mock mode (no credentials), `transcribeBuffer` returns a placeholder transcript
 * so the rest of the pipeline (scoring, conversation) still works.
 */

const ASR_MODEL = 'asr-01';

type WebSocket = WS;

interface AsrEvent {
  type: string;
  text?: string;
  is_final?: boolean;
  confidence?: number;
  language?: string;
  error?: { code?: string; message?: string };
}

function asrWsUrl(): string {
  const base = config.minimax.apiBase.replace(/\/$/, '');
  const wsBase = base.startsWith('https://')
    ? base.replace(/^https/, 'wss')
    : base.startsWith('http://')
      ? base.replace(/^http/, 'ws')
      : base;
  return `${wsBase}/v1/asr?model=${encodeURIComponent(ASR_MODEL)}&language=en&format=mp3`;
}

async function transcribeBufferMock(audio: Buffer): Promise<AsrFinalResult> {
  // We DO NOT pretend to actually transcribe — that would fabricate data and mislead the user.
  // Instead, return an empty transcript with a flag. The caller can decide how to handle it
  // (e.g. ask the user to type instead).
  log.debug(`Mock ASR for ${audio.byteLength} bytes — returning empty transcript`);
  return {
    text: '',
    confidence: 0,
    language: 'en',
    mocked: true,
  };
}

interface AsrSessionOptions {
  language?: string;
  sampleRate?: number;
}

export class AsrSession {
  private readonly url: string;
  private ws: WebSocket | null = null;
  private opened = false;
  private closed = false;
  private lastPartial = '';
  private finalText = '';
  private resolveFinal: ((r: AsrFinalResult) => void) | null = null;
  private rejectFinal: ((e: Error) => void) | null = null;
  private finalReceived = false;
  private readonly options: AsrSessionOptions;
  private mockMode: boolean;

  constructor(options: AsrSessionOptions = {}) {
    this.options = options;
    this.mockMode = !config.minimax.hasCredentials;
    this.url = asrWsUrl();
  }

  async open(): Promise<void> {
    if (this.mockMode) return;
    return new Promise<void>((resolve, reject) => {
      try {
        const ws = new WS(this.url, {
          headers: {
            Authorization: `Bearer ${config.minimax.apiKey}`,
          },
        });
        this.ws = ws;

        const onOpen = (): void => {
          this.opened = true;
          try {
            ws.send(
              JSON.stringify({
                type: 'auth',
                api_key: config.minimax.apiKey,
                group_id: config.minimax.groupId,
                model: ASR_MODEL,
                language: this.options.language ?? 'en',
                sample_rate: this.options.sampleRate ?? 16000,
              }),
            );
          } catch (err) {
            log.warn(`ASR auth send failed: ${(err as Error).message}`);
          }
          resolve();
        };

        const onError = (err: Error): void => {
          if (!this.opened) reject(err);
          else this.fail(err);
        };

        const onMessage = (raw: RawData): void => {
          let evt: AsrEvent;
          try {
            const text = raw.toString('utf-8');
            evt = JSON.parse(text) as AsrEvent;
          } catch {
            log.warn('ASR non-JSON message received, ignoring');
            return;
          }
          this.handleEvent(evt);
        };

        const onClose = (): void => {
          if (!this.finalReceived) this.fail(new Error('ASR socket closed before final transcript'));
        };

        ws.once('open', onOpen);
        ws.once('error', onError);
        ws.on('message', onMessage);
        ws.on('close', onClose);
      } catch (err) {
        reject(err as Error);
      }
    });
  }

  private handleEvent(evt: AsrEvent): void {
    if (evt.error) {
      this.fail(new Error(`ASR error ${evt.error.code ?? ''}: ${evt.error.message ?? ''}`));
      return;
    }
    if (evt.type === 'transcript_partial' && typeof evt.text === 'string') {
      this.lastPartial = evt.text;
      return;
    }
    if (evt.type === 'transcript_final' && typeof evt.text === 'string') {
      this.finalReceived = true;
      this.finalText = evt.text;
      const result: AsrFinalResult = {
        text: evt.text,
        confidence: evt.confidence,
        language: evt.language,
        mocked: false,
      };
      if (this.resolveFinal) this.resolveFinal(result);
      this.close();
      return;
    }
  }

  sendAudio(chunk: Buffer | Uint8Array): void {
    if (this.mockMode) return;
    if (!this.ws || !this.opened) return;
    try {
      this.ws.send(chunk instanceof Buffer ? chunk : Buffer.from(chunk));
    } catch (err) {
      log.warn(`ASR send failed: ${(err as Error).message}`);
    }
  }

  finish(): Promise<AsrFinalResult> {
    if (this.closed) {
      return Promise.resolve({ text: this.finalText, mocked: false });
    }
    if (this.mockMode) {
      this.closed = true;
      return Promise.resolve({ text: '', mocked: true, confidence: 0, language: 'en' });
    }
    return new Promise<AsrFinalResult>((resolve, reject) => {
      this.resolveFinal = resolve;
      this.rejectFinal = reject;
      try {
        if (this.ws && this.opened) {
          this.ws.send(JSON.stringify({ type: 'finish' }));
        } else {
          reject(new Error('ASR session not open'));
        }
      } catch (err) {
        reject(err as Error);
      }
    });
  }

  getLastPartial(): string {
    return this.lastPartial;
  }

  getFinalText(): string {
    return this.finalText;
  }

  close(): void {
    this.closed = true;
    if (this.ws) {
      try {
        this.ws.close();
      } catch (err) {
        log.warn(`ASR close failed: ${(err as Error).message}`);
      }
      this.ws = null;
    }
  }

  private fail(err: Error): void {
    if (this.rejectFinal) {
      this.rejectFinal(err);
      this.rejectFinal = null;
      this.resolveFinal = null;
    }
    this.close();
  }
}

export async function transcribeBuffer(
  audio: Buffer,
  options: AsrSessionOptions = {},
): Promise<AsrFinalResult> {
  if (!config.minimax.hasCredentials) {
    return transcribeBufferMock(audio);
  }
  const session = new AsrSession(options);
  try {
    await session.open();
    // Send the whole buffer as one chunk — the real-time stream can also accept bursts.
    session.sendAudio(audio);
    const result = await session.finish();
    return result;
  } catch (err) {
    log.warn(`ASR failed, returning mock: ${(err as Error).message}`);
    return transcribeBufferMock(audio);
  } finally {
    session.close();
  }
}
