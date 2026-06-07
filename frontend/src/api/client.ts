import axios, { AxiosError, type AxiosInstance } from 'axios'
import type { ApiErrorBody } from '@/types/api'

// In dev, Vite proxies /api and /ws to http(s)://localhost:3001.
// In prod, the same paths are expected to be reverse-proxied.
const baseURL = '/api'

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
