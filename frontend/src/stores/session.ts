import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type {
  Difficulty,
  PracticeMode,
  PracticeSession,
  ScoreFeedback,
  SessionMessage,
  RepeatPrompt,
} from '@/types/api'
import {
  createSession as apiCreateSession,
  endSession as apiEndSession,
  getSession as apiGetSession,
  sendMessage as apiSendMessage,
  uploadAudio as apiUploadAudio,
  submitRepeat as apiSubmitRepeat,
  getRepeatPrompts as apiGetRepeatPrompts,
} from '@/api/sessions'

type ConnectionState = 'idle' | 'connecting' | 'recording' | 'uploading' | 'thinking' | 'error'

export const useSessionStore = defineStore('session', () => {
  const session = ref<PracticeSession | null>(null)
  const connection = ref<ConnectionState>('idle')
  const errorMessage = ref<string | null>(null)
  const lastScore = ref<ScoreFeedback | null>(null)
  const lastAssistantAudioUrl = ref<string | null>(null)
  const repeatPrompts = ref<RepeatPrompt[]>([])
  const repeatIndex = ref(0)
  const transientUserText = ref<string | null>(null) // optimistic echo

  const isActive = computed(() => session.value != null)
  const currentPrompt = computed<RepeatPrompt | null>(() => {
    if (!session.value || session.value.mode !== 'repeat') return null
    return repeatPrompts.value[repeatIndex.value] ?? null
  })

  async function startSession(opts: {
    scenarioId: string
    mode: PracticeMode
    difficulty: Difficulty
  }): Promise<PracticeSession> {
    connection.value = 'connecting'
    errorMessage.value = null
    try {
      const s = await apiCreateSession({
        scenario_id: opts.scenarioId,
        mode: opts.mode,
        difficulty: opts.difficulty,
      })
      session.value = s
      lastScore.value = null
      lastAssistantAudioUrl.value = null
      repeatIndex.value = 0
      repeatPrompts.value = []
      if (s.mode === 'repeat') {
        // Load follow-along prompts via the API client.  The helper itself
        // never throws — it returns [] on any failure — so we don't need a
        // try/catch here, but we log so a misconfigured backend is easy to
        // spot from the browser console.
        const prompts = await apiGetRepeatPrompts(s.id, s.scenario_id, s.difficulty)
        if (!prompts.length && typeof console !== 'undefined') {
          console.warn(
            `[sessionStore] repeat-mode session ${s.id} (scenario=${s.scenario_id}, ` +
              `difficulty=${s.difficulty}) loaded 0 follow-along prompts — ` +
              'check that the scenario dialog file exists and the /api/scenarios/:id ' +
              'endpoint returns rounds with ai_message.',
          )
        }
        repeatPrompts.value = prompts
      }
      connection.value = 'idle'
      return s
    } catch (e) {
      connection.value = 'error'
      errorMessage.value = e instanceof Error ? e.message : 'Failed to start session'
      throw e
    }
  }

  async function resumeSession(id: string): Promise<PracticeSession> {
    connection.value = 'connecting'
    try {
      const s = await apiGetSession(id)
      session.value = s
      if (s.mode === 'repeat' && repeatPrompts.value.length === 0) {
        // Same note as startSession: apiGetRepeatPrompts never throws.
        const prompts = await apiGetRepeatPrompts(s.id, s.scenario_id, s.difficulty)
        if (!prompts.length && typeof console !== 'undefined') {
          console.warn(
            `[sessionStore] resume session ${s.id} (scenario=${s.scenario_id}, ` +
              `difficulty=${s.difficulty}) loaded 0 follow-along prompts.`,
          )
        }
        repeatPrompts.value = prompts
      }
      connection.value = 'idle'
      return s
    } catch (e) {
      connection.value = 'error'
      errorMessage.value = e instanceof Error ? e.message : 'Failed to load session'
      throw e
    }
  }

  async function sendText(text: string, promptId?: string | number): Promise<void> {
    const cur = session.value
    if (!cur) throw new Error('No active session')
    if (!text.trim()) return
    connection.value = 'thinking'
    errorMessage.value = null
    const optimistic: SessionMessage = {
      id: `tmp-${Date.now()}`,
      role: 'user',
      content: text,
      created_at: new Date().toISOString(),
    }
    session.value = { ...cur, messages: [...(cur.messages ?? []), optimistic] }
    transientUserText.value = null
    try {
      let res
      if (cur.mode === 'repeat' && promptId != null) {
        res = await apiSubmitRepeat(cur.id, { prompt_id: String(promptId), content: text })
      } else {
        res = await apiSendMessage(cur.id, { content: text })
      }
      // replace optimistic message with server-authoritative one
      const next = session.value
      if (next) {
        session.value = {
          ...next,
          messages: (next.messages ?? [])
            .filter((m) => m.id !== optimistic.id)
            .concat(res.user_message, res.ai_message),
        }
      }
      lastScore.value = res.score
      if (res.ai_message.audio_url) lastAssistantAudioUrl.value = res.ai_message.audio_url
    } catch (e) {
      // remove the optimistic message on failure
      const next = session.value
      if (next) {
        session.value = {
          ...next,
          messages: (next.messages ?? []).filter((m) => m.id !== optimistic.id),
        }
      }
      connection.value = 'error'
      errorMessage.value = e instanceof Error ? e.message : 'Failed to send message'
      throw e
    } finally {
      if (connection.value !== 'error') connection.value = 'idle'
    }
  }

  async function sendAudio(blob: Blob, durationMs?: number, promptId?: string | number): Promise<void> {
    const cur = session.value
    if (!cur) throw new Error('No active session')
    connection.value = 'uploading'
    errorMessage.value = null
    try {
      const res = await apiUploadAudio(cur.id, blob, { durationMs, promptId: promptId != null ? String(promptId) : undefined })
      // The backend may either return just the transcript, or a full turn.
      if ('ai_message' in res) {
        session.value = {
          ...cur,
          messages: [...(cur.messages ?? []), res.user_message, res.ai_message],
        }
        lastScore.value = res.score
        if (res.ai_message.audio_url) lastAssistantAudioUrl.value = res.ai_message.audio_url
      } else {
        // transcript-only — push the recognized text as the user turn and
        // then run a text send to get the AI reply.
        const userMsg: SessionMessage = {
          id: `usr-${Date.now()}`,
          role: 'user',
          content: res.text,
          created_at: new Date().toISOString(),
        }
        session.value = { ...cur, messages: [...(cur.messages ?? []), userMsg] }
        connection.value = 'thinking'
        const followup = await apiSendMessage(cur.id, { content: res.text, duration_ms: durationMs })
        const next = session.value ?? cur
        session.value = {
          ...next,
          messages: [...(next.messages ?? []), followup.ai_message],
        }
        lastScore.value = followup.score
        if (followup.ai_message.audio_url) lastAssistantAudioUrl.value = followup.ai_message.audio_url
      }
    } catch (e) {
      connection.value = 'error'
      errorMessage.value = e instanceof Error ? e.message : 'Failed to upload audio'
      throw e
    } finally {
      if (connection.value !== 'error') connection.value = 'idle'
    }
  }

  function setConnection(state: ConnectionState) {
    connection.value = state
  }

  function advanceRepeat() {
    if (repeatIndex.value < repeatPrompts.value.length - 1) {
      repeatIndex.value += 1
      lastScore.value = null
    }
  }

  function previousRepeat() {
    if (repeatIndex.value > 0) {
      repeatIndex.value -= 1
      lastScore.value = null
    }
  }

  async function finish(): Promise<PracticeSession | null> {
    const cur = session.value
    if (!cur) return null
    try {
      const finished = await apiEndSession(cur.id)
      session.value = finished
      return finished
    } catch (e) {
      // Even if the backend fails to persist, we still consider it ended
      // locally.
      errorMessage.value = e instanceof Error ? e.message : 'Failed to end session'
      return cur
    }
  }

  function reset() {
    session.value = null
    connection.value = 'idle'
    errorMessage.value = null
    lastScore.value = null
    lastAssistantAudioUrl.value = null
    repeatPrompts.value = []
    repeatIndex.value = 0
    transientUserText.value = null
  }

  return {
    session,
    connection,
    errorMessage,
    lastScore,
    lastAssistantAudioUrl,
    repeatPrompts,
    repeatIndex,
    currentPrompt,
    isActive,
    transientUserText,
    startSession,
    resumeSession,
    sendText,
    sendAudio,
    finish,
    reset,
    setConnection,
    advanceRepeat,
    previousRepeat,
  }
})
