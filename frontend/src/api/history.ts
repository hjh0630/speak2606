import { http } from './client'
import type { HistoryDetailResponse, HistoryListResponse, PracticeSession, SessionMessage } from '@/types/api'

// Convert epoch-ms or ISO string to a friendlier created_at string.
function toIso(value: unknown): string {
  if (value == null) return new Date().toISOString()
  if (typeof value === 'number') {
    // epoch ms or s
    const ms = value < 1e12 ? value * 1000 : value
    return new Date(ms).toISOString()
  }
  if (typeof value === 'string') return value
  return new Date().toISOString()
}

function normalizeSession(
  raw: Record<string, unknown> | null | undefined,
): PracticeSession {
  const r = (raw ?? {}) as Record<string, unknown> & {
    id?: string
    session_id?: string
    scenario_id?: string
    scenario_title?: string
    mode?: PracticeSession['mode']
    difficulty?: PracticeSession['difficulty']
    started_at?: number | string
    ended_at?: number | string | null
    status?: string
    round_index?: number
    message_count?: number
    user_turn_count?: number
    duration_sec?: number
    total_score?: number | null
    avg_score?: number | null
    messages?: SessionMessage[]
    summary?: string | null
  }
  return {
    id: (r.id || r.session_id) as string,
    scenario_id: (r.scenario_id ?? '') as string,
    scenario_title: r.scenario_title,
    mode: (r.mode ?? 'free') as PracticeSession['mode'],
    difficulty: (r.difficulty ?? 'beginner') as PracticeSession['difficulty'],
    started_at: toIso(r.started_at),
    ended_at: r.ended_at == null ? null : toIso(r.ended_at),
    status: r.status,
    round_index: r.round_index ?? 0,
    message_count: r.message_count,
    user_turn_count: r.user_turn_count,
    duration_sec: r.duration_sec,
    total_score: r.total_score ?? null,
    avg_score: r.avg_score ?? null,
    messages: r.messages ?? [],
    summary: r.summary ?? null,
  }
}

export async function listHistory(
  params: { limit?: number; offset?: number } = {},
): Promise<{ items: PracticeSession[]; total: number }> {
  const res = await http.get<HistoryListResponse | PracticeSession[] | { items: unknown[] }>(
    '/history',
    { params },
  )
  let items: unknown[] = []
  if (Array.isArray(res.data)) items = res.data
  else if (res.data && Array.isArray((res.data as { items?: unknown[] }).items)) {
    items = (res.data as { items: unknown[] }).items
  }
  const normalized = items.map((it) => normalizeSession(it as Record<string, unknown>))
  return { items: normalized, total: normalized.length }
}

export async function getHistoryDetail(id: string): Promise<PracticeSession> {
  // Backend returns { session, scenario, messages? }
  const res = await http.get<HistoryDetailResponse | PracticeSession | Record<string, unknown>>(
    `/history/${encodeURIComponent(id)}`,
  )
  const data = res.data
  if (data && typeof data === 'object' && 'session' in (data as Record<string, unknown>)) {
    const det = data as HistoryDetailResponse
    const sess = normalizeSession(det.session as unknown as Record<string, unknown>)
    // If the detail response embeds the messages array, attach it.
    if (Array.isArray(det.messages) && (!sess.messages || sess.messages.length === 0)) {
      sess.messages = det.messages
    }
    // Use the embedded scenario title if available.
    if (!sess.scenario_title && det.scenario) {
      const s = det.scenario as unknown as Record<string, unknown>
      sess.scenario_title =
        (s.title as string) ||
        (s.title_zh as string) ||
        (s.title_en as string) ||
        sess.scenario_id
    }
    return sess
  }
  return normalizeSession(data as Record<string, unknown>)
}
