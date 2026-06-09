// Type definitions mirroring the backend API contract.
// The backend actually returns snake_case-ish JSON; this file captures the
// real shapes we have observed.  Where the backend returns either a flat
// record or a wrapped envelope (e.g. /api/scenarios/:id returns
// { scenario, dialogs }), the API client normalizes it for views.

export type Difficulty = 'beginner' | 'intermediate' | 'advanced'
export type PracticeMode = 'free' | 'repeat'

export interface RepeatPrompt {
  id: string | number
  text: string
  translation?: string
  difficulty?: Difficulty
}

// ---------- Scenario ----------

export interface Scenario {
  id: string
  title: string
  subtitle?: string
  description: string
  difficulty: Difficulty
  /** All supported difficulties for this scenario. */
  difficulty_levels?: Difficulty[]
  category?: string
  subcategory?: string
  /** The visible role for the AI side (English). */
  roles: { ai: string; user: string }
  goals: string[]
  estimated_minutes?: number
  icon?: string
  tags?: string[]
  industry_terms_sample?: string[]
  key_skills?: string[]
  key_skills_zh?: string[]
}

export interface DialogRound {
  round: number
  ai_message: string
  ai_message_zh?: string
  expected_user_response_hint?: string
  key_phrases?: string[]
  common_mistakes?: string
  tips_zh?: string
  user_response_example?: string
}
export interface Dialog {
  scenario_id: string
  scenario_title_en?: string
  scenario_title_zh?: string
  difficulty: Difficulty
  rounds: DialogRound[]
}

export interface ScenarioListResponse {
  items: Scenario[]
  total?: number
  count?: number
}

// ---------- Session / message / score ----------

export interface ScoreFeedback {
  /** Backend's primary field. */
  overall_score: number
  /** Frontend-friendly alias used across the UI components. */
  overall: number
  fluency?: number
  accuracy?: number
  pronunciation?: number
  grammar?: number
  vocabulary?: number
  relevance?: number
  key_issues?: string[]
  /** Server sometimes uses "suggestion" (singular), we expose both. */
  suggestions?: string[]
  suggestion?: string
}

export interface SessionMessage {
  id: string | number
  role: 'user' | 'assistant' | 'system'
  /** Plain text content of the message. */
  content: string
  created_at: string | number
  score?: ScoreFeedback | null
  audio_url?: string | null
}

export interface PracticeSession {
  id: string
  scenario_id: string
  scenario_title?: string
  mode: PracticeMode
  difficulty: Difficulty
  started_at: string | number
  ended_at?: string | number | null
  status?: string
  round_index?: number
  message_count?: number
  user_turn_count?: number
  duration_sec?: number
  /** End-of-session score, if completed. */
  total_score?: number | null
  avg_score?: number | null
  messages?: SessionMessage[]
  summary?: string | null
}

export interface CreateSessionRequest {
  scenario_id: string
  mode: PracticeMode
  difficulty: Difficulty
}

/** Backend returns the new session with this shape on POST /api/sessions. */
export interface CreateSessionResponse {
  session_id: string
  scenario_id: string
  difficulty: Difficulty
  mode: PracticeMode
  status: string
  started_at: string | number
}

export interface SendMessageRequest {
  content: string
  duration_ms?: number
}

export interface SendMessageResponse {
  user_message: SessionMessage
  /** Backend returns this as a plain string.  We normalize to an object. */
  ai_message: SessionMessage
  score: ScoreFeedback
  round_index?: number
  ai_audio_url?: string | null
}

export interface HistoryListResponse {
  items: PracticeSession[]
  total?: number
}

export interface HistoryDetailResponse {
  session: PracticeSession
  scenario?: Scenario
  messages?: SessionMessage[]
}

// ---------- Stats ----------

export interface StatsByBucket<TKey extends string> {
  [k: string]: number | TKey
}
export interface StatsByScenarioRow {
  scenario_id: string
  scenario_title?: string
  sessions: number
  avg_score: number
  count?: number
}
export interface StatsByDifficultyRow {
  difficulty: Difficulty
  sessions: number
  count?: number
  avg_score: number
}
export interface StatsTrendPoint {
  date: string
  avg_score: number
  sessions: number
}
export interface StatsOverview {
  total_sessions: number
  total_messages?: number
  completed_sessions?: number
  active_sessions?: number
  total_practice_sec?: number
  practice_minutes?: number
  avg_session_sec?: number
  average_score: number
  best_score?: number
  by_scenario: StatsByScenarioRow[]
  by_difficulty: StatsByDifficultyRow[]
  trend: StatsTrendPoint[]
}

// ---------- Transcribe / TTS ----------

export interface TranscribeResponse {
  text: string
  language?: string
  duration_ms?: number
  confidence?: number
  mocked?: boolean
  note?: string
}

export interface TtsRequest {
  text: string
  voice?: string
  speed?: number
}
export interface TtsResponse {
  // The MiniMax TTS endpoint returns the synthesized audio as a base64-encoded
  // string plus a MIME type. The previous type assumed a `url` field but the
  // backend never wrote the audio to disk, so consumers must decode
  // `audio_base64` themselves (see composables/useTTS.ts → playText).
  audio_base64: string
  mime: string
  mocked: boolean
}

export interface ApiErrorBody {
  error?: { code?: string; message?: string; details?: unknown }
  message?: string
  code?: string
  details?: unknown
}
