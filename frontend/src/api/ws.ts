// Lightweight WebSocket wrapper used by the practice view when the backend
// exposes a real-time audio stream.  The connection is best-effort — if the
// socket fails, the view falls back to the REST path automatically.

import { wsBaseUrl } from './client'

export type WsMessage =
  | { type: 'ready' }
  | { type: 'transcript'; text: string; final: boolean }
  | { type: 'assistant'; content: string; audio_url?: string | null }
  | { type: 'score'; score: unknown }
  | { type: 'error'; message: string }
  | { type: 'pong' }

export interface WsClientHandlers {
  onMessage?: (msg: WsMessage) => void
  onOpen?: () => void
  onClose?: () => void
  onError?: (err: Event) => void
}

export class WsClient {
  private ws: WebSocket | null = null
  private url: string
  private handlers: WsClientHandlers
  private heartbeat: number | null = null

  constructor(path: string, handlers: WsClientHandlers = {}) {
    this.url = path
    this.handlers = handlers
  }

  connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return
    }
    const ws = new WebSocket(this.url)
    this.ws = ws
    ws.onopen = () => {
      this.handlers.onOpen?.()
      this.heartbeat = window.setInterval(() => {
        try { ws.send(JSON.stringify({ type: 'ping' })) } catch { /* noop */ }
      }, 25_000)
    }
    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data) as WsMessage
        this.handlers.onMessage?.(data)
      } catch {
        // ignore malformed
      }
    }
    ws.onerror = (e) => this.handlers.onError?.(e)
    ws.onclose = () => {
      if (this.heartbeat != null) {
        clearInterval(this.heartbeat)
        this.heartbeat = null
      }
      this.ws = null
      this.handlers.onClose?.()
    }
  }

  send(data: unknown) {
    const ws = this.ws
    if (!ws || ws.readyState !== WebSocket.OPEN) return false
    try {
      if (data instanceof Blob || data instanceof ArrayBuffer) {
        ws.send(data as ArrayBufferLike)
      } else {
        ws.send(JSON.stringify(data))
      }
      return true
    } catch {
      return false
    }
  }

  close() {
    if (this.heartbeat != null) {
      clearInterval(this.heartbeat)
      this.heartbeat = null
    }
    this.ws?.close()
    this.ws = null
  }
}

export function sessionWsUrl(sessionId: string): string {
  // Pick up the shared wsBaseUrl() from api/client.ts when the front-end
  // is built with VITE_API_BASE (i.e. when the SPA and the Fastify
  // backend live on different origins).
  return `${wsBaseUrl()}/ws/session/${encodeURIComponent(sessionId)}`
}
