import axios, { AxiosError, type AxiosInstance } from 'axios'
import type { ApiErrorBody } from '@/types/api'

// In dev, Vite proxies /api and /ws to http(s)://localhost:3001.
// In prod, the same paths are expected to be reverse-proxied — OR we
// point at an absolute URL via VITE_API_BASE (set in the Vercel env).
//
// VITE_API_BASE is the **origin** of the backend; we always append `/api`
// so the rest of the code can keep using relative paths like '/scenarios'.
//
// Dev:    VITE_API_BASE unset    → '/api'  (Vite dev-server proxy)
// Prod:   VITE_API_BASE=https://x  → 'https://x/api'
const rawBase = (import.meta.env.VITE_API_BASE as string | undefined)?.trim() ?? ''
const baseURL = rawBase
  ? `${rawBase.replace(/\/$/, '')}/api`
  : '/api'

export const http: AxiosInstance = axios.create({
  baseURL,
  timeout: 60_000,
  headers: { 'Content-Type': 'application/json' },
})

http.interceptors.request.use((config) => {
  // attach a stable per-browser user id so the backend can group history
  if (typeof window !== 'undefined') {
    let uid = window.localStorage.getItem('sf_uid')
    if (!uid) {
      uid = crypto.randomUUID()
      window.localStorage.setItem('sf_uid', uid)
    }
    config.headers.set('X-User-Id', uid)
  }
  return config
})

http.interceptors.response.use(
  (r) => r,
  (err: AxiosError<ApiErrorBody>) => {
    // Normalize error so views always receive a string message
    const data = err.response?.data
    const apiMessage = data?.error?.message || data?.message
    const message =
      apiMessage ||
      (err.response?.status ? `Request failed (${err.response.status})` : err.message) ||
      'Network error'
    return Promise.reject(new Error(message))
  },
)

export function apiBaseUrl(): string {
  return baseURL
}

export const wsBaseUrl = (): string => {
  // WebSocket origin: prefer the VITE_API_BASE (stripping trailing slash and
  // upgrading https→wss, http→ws), fall back to the current page origin.
  if (rawBase) {
    return rawBase
      .replace(/^http/, 'ws')
      .replace(/\/$/, '')
  }
  if (typeof window !== 'undefined') {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    return `${proto}//${window.location.host}`
  }
  return ''
}
