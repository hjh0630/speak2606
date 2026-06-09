import { http } from './client'
import { getScenarioDialogs } from './scenarios'
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

/**
 * Adapter: normalize a raw dialog entry (whatever shape the backend serves)
 * into a flat list of RepeatPrompt objects the UI can iterate over.
 *
 * The backend today returns `{ scenario, dialogs: [{ difficulty, rounds: [{ round,
 * ai_message, ai_message_zh, ... }] }] }`.  This helper is intentionally
 * tolerant: it tries several common field names (`rounds` / `turns` / `lines`)
 * and several common text fields (`ai_message` / `text` / `en`), so that if
 * the backend ever renames a field we degrade to the next best alternative
 * rather than silently showing an empty prompt list.
 */
function dialogEntryToPrompts(entry: Record<string, unknown> | null | undefined): RepeatPrompt[] {
  if (!entry || typeof entry !== 'object') return []
  const diff = (entry.difficulty as Difficulty | undefined) ?? 'beginner'
  // Accept any of the common round container names.
  const roundsRaw = entry.rounds ?? entry.turns ?? entry.lines ?? entry.dialog
  if (!Array.isArray(roundsRaw)) return []
  return roundsRaw
    .map((r, idx): RepeatPrompt | null => {
      if (!r || typeof r !== 'object') return null
      const rr = r as Record<string, unknown>
      // The English target line is the AI's utterance.  Accept a few common
      // aliases so a backend rename doesn't break the UI silently.
      const textRaw =
        (typeof rr.ai_message === 'string' && rr.ai_message) ||
        (typeof rr.text === 'string' && rr.text) ||
        (typeof rr.en === 'string' && rr.en) ||
        (typeof rr.content === 'string' && rr.content) ||
        ''
      const translation =
        (typeof rr.ai_message_zh === 'string' && rr.ai_message_zh) ||
        (typeof rr.translation === 'string' && rr.translation) ||
        (typeof rr.zh === 'string' && rr.zh) ||
        undefined
      if (!textRaw) return null
      const idRaw = rr.round ?? rr.id ?? rr.index ?? idx + 1
      const id = String(idRaw)
      return { id, text: textRaw, translation, difficulty: diff }
    })
    .filter((p): p is RepeatPrompt => p !== null)
}

export async function getRepeatPrompts(
  sessionId: string,
  scenarioId?: string,
  difficulty?: Difficulty,
): Promise<RepeatPrompt[]> {
  // 1) Try the (currently unimplemented) session-level endpoint first so we
  //    stay forward-compatible if/when the backend adds it.
  try {
    const res = await http.get<RepeatPrompt[] | { items: RepeatPrompt[] }>(
      `/sessions/${encodeURIComponent(sessionId)}/prompts`,
    )
    if (Array.isArray(res.data) && res.data.length) return res.data
    if (res.data && Array.isArray((res.data as { items?: RepeatPrompt[] }).items)) {
      const items = (res.data as { items: RepeatPrompt[] }).items
      if (items.length) return items
    }
  } catch (err) {
    // Expected: the backend doesn't implement this endpoint yet.  Fall through.
    if (typeof console !== 'undefined') {
      console.debug('[getRepeatPrompts] /prompts endpoint not available, falling back', err)
    }
  }

  // 2) Fall back to /api/scenarios/:id dialogs (the real source of truth on
  //    the backend today).  Pick the dialog entry matching the session's
  //    difficulty and convert it into RepeatPrompts through the adapter.
  if (scenarioId) {
    try {
      const dialogs = await getScenarioDialogs(scenarioId)
      if (Array.isArray(dialogs) && dialogs.length) {
        // Pick the entry for the chosen difficulty, fall back to beginner,
        // then to whatever is first.  All three guards are kept in case the
        // backend later returns multiple difficulty variants in one call.
        const pool = dialogs as unknown as Record<string, unknown>[]
        const entry =
          pool.find((d) => d.difficulty === difficulty) ??
          pool.find((d) => d.difficulty === 'beginner') ??
          pool[0]
        const prompts = dialogEntryToPrompts(entry)
        if (prompts.length) return prompts
      }
    } catch (err) {
      if (typeof console !== 'undefined') {
        console.warn('[getRepeatPrompts] failed to load scenario dialogs', err)
      }
    }
  }
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
