import { http } from './client'
import type {
  CreateSessionRequest,
  CreateSessionResponse,
  Difficulty,
  PracticeMode,
  PracticeSession,
  RepeatPrompt,
  SendMessageRequest,
  SendMessageResponse,
  SessionMessage,
  TtsRequest,
  TtsResponse,
  TranscribeResponse,
} from '@/types/api'

// Helpers ----------------------------------------------------------------

function normalizePracticeSession(
  raw: Record<string, unknown> | null | undefined,
  fallback?: { scenario_id?: string; mode?: PracticeMode; difficulty?: Difficulty },
): PracticeSession {
  const r = (raw ?? {}) as Record<string, unknown> & {
    id?: string
    session_id?: string
    scenario_id?: string
    scenario_title?: string
    mode?: PracticeMode
    difficulty?: Difficulty
    started_at?: string | number
    ended_at?: string | number | null
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
    scenario_id: (r.scenario_id || fallback?.scenario_id) as string,
    scenario_title: r.scenario_title,
    mode: (r.mode || fallback?.mode || 'free') as PracticeMode,
    difficulty: (r.difficulty || fallback?.difficulty || 'beginner') as Difficulty,
    started_at: (r.started_at as string | number) ?? Date.now(),
    ended_at: (r.ended_at as string | number | null) ?? null,
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

function normalizeSendMessageResponse(raw: Record<string, unknown>): SendMessageResponse {
  const r = raw as {
    user_message?: SessionMessage
    ai_message?: SessionMessage | string
    ai_audio_url?: string | null
    score?: Record<string, unknown>
    round_index?: number
  }
  const score = (r.score ?? {}) as {
    overall_score?: number
    overall?: number
    suggestion?: string
    suggestions?: string[]
    key_issues?: string[]
  }
  const normalizedScore = {
    overall: score.overall ?? score.overall_score ?? 0,
    overall_score: score.overall_score ?? score.overall ?? 0,
    pronunciation: (score as { pronunciation?: number }).pronunciation,
    fluency: (score as { fluency?: number }).fluency,
    grammar: (score as { grammar?: number }).grammar,
    vocabulary: (score as { vocabulary?: number }).vocabulary,
    relevance: (score as { relevance?: number }).relevance,
    key_issues: score.key_issues,
    suggestions: score.suggestions ?? (score.suggestion ? [score.suggestion] : undefined),
  }
  // Backend sometimes returns `ai_message` as a plain string.
  const ai = r.ai_message
  let aiMessage: SessionMessage
  if (typeof ai === 'string') {
    aiMessage = {
      id: `ai-${Date.now()}`,
      role: 'assistant',
      content: ai,
      created_at: Date.now(),
      audio_url: r.ai_audio_url ?? null,
    }
  } else if (ai && typeof ai === 'object') {
    aiMessage = {
      ...(ai as SessionMessage),
      audio_url: (ai as SessionMessage).audio_url ?? r.ai_audio_url ?? null,
    }
  } else {
    aiMessage = {
      id: `ai-${Date.now()}`,
      role: 'assistant',
      content: '',
      created_at: Date.now(),
    }
  }
  return {
    user_message: r.user_message as SessionMessage,
    ai_message: aiMessage,
    score: normalizedScore,
    round_index: r.round_index,
    ai_audio_url: r.ai_audio_url ?? null,
  }
}

// Sessions ---------------------------------------------------------------

export async function createSession(payload: CreateSessionRequest): Promise<PracticeSession> {
  const res = await http.post<CreateSessionResponse>('/sessions', payload)
  return normalizePracticeSession(res.data as unknown as Record<string, unknown>, {
    scenario_id: payload.scenario_id,
    mode: payload.mode,
    difficulty: payload.difficulty,
  })
}

export async function getSession(id: string): Promise<PracticeSession> {
  const res = await http.get<Record<string, unknown> | PracticeSession>(
    `/sessions/${encodeURIComponent(id)}`,
  )
  return normalizePracticeSession(res.data as Record<string, unknown>)
}

export async function endSession(id: string): Promise<PracticeSession> {
  const res = await http.post<Record<string, unknown> | PracticeSession>(
    `/sessions/${encodeURIComponent(id)}/complete`,
  )
  return normalizePracticeSession(res.data as Record<string, unknown>)
}

// The original spec called this "feedback" — backend exposes it too.
export async function requestFeedback(id: string): Promise<PracticeSession> {
  const res = await http.post<Record<string, unknown> | PracticeSession>(
    `/sessions/${encodeURIComponent(id)}/feedback`,
  )
  return normalizePracticeSession(res.data as Record<string, unknown>)
}

export async function sendMessage(
  sessionId: string,
  payload: SendMessageRequest,
): Promise<SendMessageResponse> {
  const res = await http.post<SendMessageResponse | Record<string, unknown>>(
    `/sessions/${encodeURIComponent(sessionId)}/messages`,
    payload,
  )
  return normalizeSendMessageResponse(res.data as Record<string, unknown>)
}

export async function getRepeatPrompts(sessionId: string): Promise<RepeatPrompt[]> {
  // Backend exposes repeat-mode prompts as part of /api/scenarios/:id dialogs.
  // The session-level /prompts endpoint is optional; we try it and fall back.
  try {
    const res = await http.get<RepeatPrompt[] | { items: RepeatPrompt[] }>(
      `/sessions/${encodeURIComponent(sessionId)}/prompts`,
    )
    if (Array.isArray(res.data)) return res.data
    if (res.data && Array.isArray(res.data.items)) return res.data.items
  } catch { /* fallthrough */ }
  return []
}

export async function submitRepeat(
  sessionId: string,
  payload: { prompt_id: string; content: string },
): Promise<SendMessageResponse> {
  // Backend uses the same /messages endpoint for repeat turns.
  const res = await http.post<SendMessageResponse | Record<string, unknown>>(
    `/sessions/${encodeURIComponent(sessionId)}/messages`,
    { ...payload, mode: 'repeat' },
  )
  return normalizeSendMessageResponse(res.data as Record<string, unknown>)
}

// Audio upload: the user blob is sent as multipart/form-data.  The backend
// can either echo back the transcription only, or it can run the full turn
// (transcribe + reply + score) — both shapes are accepted.
export async function uploadAudio(
  sessionId: string,
  blob: Blob,
  opts: { durationMs?: number; promptId?: string } = {},
): Promise<TranscribeResponse | SendMessageResponse> {
  const form = new FormData()
  const ext = blob.type.includes('ogg')
    ? 'ogg'
    : blob.type.includes('mp4')
      ? 'mp4'
      : blob.type.includes('wav')
        ? 'wav'
        : 'webm'
  form.append('audio', blob, `recording.${ext}`)
  if (opts.durationMs != null) form.append('duration_ms', String(opts.durationMs))
  if (opts.promptId) form.append('prompt_id', opts.promptId)
  const res = await http.post<TranscribeResponse | SendMessageResponse | Record<string, unknown>>(
    `/sessions/${encodeURIComponent(sessionId)}/audio`,
    form,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  )
  // If the response has `ai_message`, treat it as a full turn.
  if (res.data && typeof res.data === 'object' && 'ai_message' in (res.data as Record<string, unknown>)) {
    return normalizeSendMessageResponse(res.data as Record<string, unknown>)
  }
  return res.data as TranscribeResponse
}

export async function tts(payload: TtsRequest): Promise<TtsResponse> {
  const res = await http.post<TtsResponse | { url?: string; audio_url?: string; mocked?: boolean }>(
    '/tts',
    payload,
  )
  const d = res.data as TtsResponse | { url?: string; audio_url?: string; mocked?: boolean }
  if (d && 'audio_url' in d && d.audio_url && !('url' in d)) {
    return { url: d.audio_url, mocked: d.mocked }
  }
  return d as TtsResponse
}
