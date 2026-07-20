/**
 * MiniMax ASR client (Workers version).
 *
 * Same wire protocol as backend/src/services/minimax-asr.ts, but the WebSocket
 * is the global `WebSocket` (Workers-native) instead of the `ws` npm package.
 *
 * Key API differences from the `ws` library:
 *   - `new WebSocket(url)` — opens immediately (no Promise wrap needed)
 *   - Events via `addEventListener('open'|'message'|'close'|'error', ...)`
 *   - `ws.send(data)` accepts string | ArrayBuffer | Blob | ArrayBufferView
 *
 * URL: wss://{apiBase-host}/v1/asr?model=asr-01&language=en&format=mp3
 * Auth: first message after open: {type:'auth', api_key, group_id, model, language, sample_rate}
 */
import type { MiniMaxEnv } from '../env';
import { hasMiniMaxCredentials } from '../env';
import { createLogger } from '../utils/logger';
import type { AsrFinalResult } from '../types';

const log = createLogger('asr');

interface AsrEvent {
  type: string;
  text?: string;
  is_final?: boolean;
  confidence?: number;
  language?: string;
  error?: { code?: string; message?: string };
}

function asrWsUrl(mm: MiniMaxEnv): string {
  let wsBase: string;
  if (mm.apiBase.startsWith('https://')) wsBase = mm.apiBase.replace(/^https/, 'wss');
  else if (mm.apiBase.startsWith('http://')) wsBase = mm.apiBase.replace(/^http/, 'ws');
  else wsBase = mm.apiBase;
  return `${wsBase}/v1/asr?model=${encodeURIComponent(mm.asrModel)}&language=en&format=mp3`;
}

function transcribeBufferMock(): AsrFinalResult {
  // Do NOT fabricate transcripts — return empty with mocked flag so the caller
  // can ask the user to type instead.
  return { text: '', confidence: 0, language: 'en', mocked: true };
}

export interface AsrSessionOptions {
  language?: string;
  sampleRate?: number;
}

export class AsrSession {
  private readonly url: string;
  private readonly mm: MiniMaxEnv;
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

  constructor(mm: MiniMaxEnv, options: AsrSessionOptions = {}) {
    this.mm = mm;
    this.options = options;
    this.mockMode = !hasMiniMaxCredentials(mm);
    this.url = asrWsUrl(mm);
  }

  open(): Promise<void> {
    if (this.mockMode) return Promise.resolve();
    return new Promise<void>((resolve, reject) => {
      try {
        const ws = new WebSocket(this.url);
        // Some MiniMax endpoints require the auth header on the upgrade request.
        // Workers doesn't let us set custom headers on outbound WebSocket.
        // We send auth as the FIRST message instead.
        this.ws = ws;

        ws.addEventListener('open', () => {
          this.opened = true;
          try {
            ws.send(
              JSON.stringify({
                type: 'auth',
                api_key: this.mm.apiKey,
                group_id: this.mm.groupId,
                model: this.mm.asrModel,
                language: this.options.language ?? 'en',
                sample_rate: this.options.sampleRate ?? 16000,
              }),
            );
          } catch (err) {
            log.warn(`ASR auth send failed: ${(err as Error).message}`);
          }
          resolve();
        });

        ws.addEventListener('error', (evt: Event) => {
          const err = (evt as ErrorEvent).error ?? new Error('ASR socket error');
          if (!this.opened) reject(err);
          else this.fail(err);
        });

        ws.addEventListener('message', (evt: MessageEvent) => {
          let asrEvt: AsrEvent;
          try {
            const text = typeof evt.data === 'string' ? evt.data : new TextDecoder().decode(evt.data as ArrayBuffer);
            asrEvt = JSON.parse(text) as AsrEvent;
          } catch {
            log.warn('ASR non-JSON message received, ignoring');
            return;
          }
          this.handleEvent(asrEvt);
        });

        ws.addEventListener('close', () => {
          if (!this.finalReceived) this.fail(new Error('ASR socket closed before final transcript'));
        });
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

  sendAudio(chunk: Uint8Array | ArrayBuffer): void {
    if (this.mockMode) return;
    if (!this.ws || !this.opened) return;
    try {
      const data = chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk);
      this.ws.send(data);
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
  mm: MiniMaxEnv,
  audio: Uint8Array,
  options: AsrSessionOptions = {},
): Promise<AsrFinalResult> {
  if (!hasMiniMaxCredentials(mm)) {
    return transcribeBufferMock();
  }
  const session = new AsrSession(mm, options);
  try {
    await session.open();
    session.sendAudio(audio);
    const result = await session.finish();
    return result;
  } catch (err) {
    log.warn(`ASR failed, returning mock: ${(err as Error).message}`);
    return transcribeBufferMock();
  } finally {
    session.close();
  }
}
