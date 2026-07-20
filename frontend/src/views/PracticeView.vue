<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import { useSessionStore } from '@/stores/session'
import { useUserStore } from '@/stores/user'
import { useWordbookStore } from '@/stores/wordbook'
import { useRecorder } from '@/composables/useRecorder'
import { useBrowserSTT } from '@/composables/useBrowserSTT'
import { useTts } from '@/composables/useTTS'
import MessageBubble from '@/components/MessageBubble.vue'
import RecorderButton from '@/components/RecorderButton.vue'
import ScoreCard from '@/components/ScoreCard.vue'

const route = useRoute()
const router = useRouter()
const sessionStore = useSessionStore()
const userStore = useUserStore()
const wordbookStore = useWordbookStore()

const recorder = useRecorder()
const stt = useBrowserSTT({ lang: 'en-US' })
const tts = useTts()

const sessionId = computed(() => route.params.id as string)
// TTS playback speed for the "听原音" button (repeat mode).  Default 0.8×
// — slower is friendlier for language learners who need a beat to parse
// each word.  User can switch to 1.0× / 0.6× via the inline pill toggle.
const ttsSpeed = ref<number>(0.8)
const messagesEl = ref<HTMLElement | null>(null)
// "Jump to latest" floating button — visible whenever the user has
// scrolled away from the bottom of the messages pane (e.g. to re-read
// an earlier AI reply on mobile where the pane is short). Clicking it
// pins the view to the latest message again. Without it, the auto-scroll
// only fires on `messages.length` changes, so a long AI reply that
// arrives while the user is reading history leaves them stranded.
const showScrollToBottom = ref(false)
function onMessagesScroll() {
  const el = messagesEl.value
  if (!el) return
  // 80 px cushion — small scrolls (like the auto-scroll landing the user
  // a few pixels off) shouldn't pop the button up unnecessarily.
  const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
  showScrollToBottom.value = distanceFromBottom > 80
}
// Sidebar default: hidden on mobile (≤ 640 px), shown on desktop.
// `isMobile` is reactive so the aside re-renders if the user resizes.
const isMobile = ref(false)
const showSidebar = ref(false)
const showPermissionHint = ref(false)
const finishing = ref(false)
const finished = ref(false)
const lastFinishedId = ref<string | null>(null)
// Toast shown after auto-adding low-score keywords to the wordbook.  Empty
// string means no banner.  We use a separate ref (instead of the session
// store's errorMessage) because the auto-add is a friendly confirmation,
// not an error.
const autoAddedHint = ref<string>('')

function scrollToBottom() {
  nextTick(() => {
    const el = messagesEl.value
    if (el) {
      el.scrollTop = el.scrollHeight
      showScrollToBottom.value = false
    }
  })
}

async function ensureSession() {
  if (sessionStore.session && sessionStore.session.id === sessionId.value) return
  try {
    await sessionStore.resumeSession(sessionId.value)
  } catch {
    // ignore — store has the error
  }
}

// (reloadPrompts now lives in sessionStore and is exposed as a store action)

onMounted(async () => {
  // Detect mobile viewport for sidebar default. We only initialize once;
  // user can still toggle the sidebar manually after that.
  isMobile.value = window.innerWidth < 640
  showSidebar.value = !isMobile.value
  await ensureSession()
  scrollToBottom()
  // Permission check is reactive: if getUserMedia fails on the first
  // recording attempt, the error handler sets showPermissionHint.
  // Pre-checking via navigator.permissions.query can return stale results
  // in some browsers (e.g. "denied" when user has actually granted access).
})

watch(() => sessionStore.session?.messages?.length, scrollToBottom)
watch(
  () => sessionStore.lastAssistantAudioUrl,
  (url) => {
    if (url && userStore.autoPlayTts) {
      tts.playUrl(url).catch(() => undefined)
    }
  },
)

onBeforeUnmount(() => {
  recorder.release()
  tts.stop()
})

const isFree = computed(() => sessionStore.session?.mode === 'free')
const isRepeat = computed(() => sessionStore.session?.mode === 'repeat')
const currentPrompt = computed(() => sessionStore.currentPrompt)
const progress = computed(() => {
  const total = sessionStore.repeatPrompts.length
  if (!total) return { current: 0, total: 0, percent: 0 }
  return {
    current: sessionStore.repeatIndex + 1,
    total,
    percent: Math.round(((sessionStore.repeatIndex + 1) / total) * 100),
  }
})

const connectionLabel = computed(() => {
  switch (sessionStore.connection) {
    case 'recording': return '录音中…'
    case 'uploading': return '正在转写…'
    case 'thinking': return 'AI 正在回复…'
    case 'connecting': return '连接中…'
    case 'error': return '出错了'
    default: return ''
  }
})

async function onRecorderStart() {
  if (recorder.isRecording.value || stt.isListening.value) return
  showPermissionHint.value = false
  sessionStore.errorMessage = null
  console.log('[PracticeView] onRecorderStart')
  // Start the recorder (so we get the level meter / pulse animation)
  try {
    await recorder.start()
    console.log('[PracticeView] recorder started')
  } catch (e) {
    console.warn('[PracticeView] recorder.start() failed', e)
    showPermissionHint.value = true
    sessionStore.errorMessage = recorder.error.value || '无法启动录音,请检查麦克风权限。'
    return
  }
  // In parallel, start the browser STT (Chrome/Edge/Safari).
  // If the browser doesn't support it, fall back to text input and let the
  // user type — recorder audio stays available for replay only.
  try {
    await stt.start(async (finalText) => {
      const text = finalText.trim()
      console.log('[PracticeView] stt onFinal:', JSON.stringify(text))
      if (!text) return
      try {
        await sessionStore.sendText(text, currentPrompt.value?.id)
      } catch (err) {
        console.error('[PracticeView] sendText failed', err)
        // store has the error
      }
    })
    console.log('[PracticeView] stt started, isListening=', stt.isListening.value)
  } catch (e) {
    // browser doesn't support STT — surface the error and fall back to text input
    console.warn('[PracticeView] stt.start() failed', e)
    if (stt.error.value) {
      sessionStore.errorMessage = stt.error.value
    }
  }
}

async function onRecorderStop() {
  // Stop both the visual recorder and the STT session.  The STT stop()
  // awaits the recognizer's onend, so the final transcript is ready by the
  // time the onFinal callback fires (or after the internal safety timeout).
  console.log('[PracticeView] onRecorderStop')
  const blob = await recorder.stop()
  const finalTranscript = await stt.stop()
  console.log('[PracticeView] stop complete, blob.size=', blob?.size ?? 0, 'lastResult=', JSON.stringify(stt.lastResult.value), 'resolved=', JSON.stringify(finalTranscript))
  // Note: we do NOT upload raw audio to the server. The text path is
  // the single source of truth for content scoring. Audio is kept
  // locally only as a visual cue.
  // If the recognizer produced no transcript, surface a friendly hint so
  // the user knows the mic captured nothing usable.  Also surface any
  // STT error that might have fired asynchronously (no-speech, network…).
  if (!stt.lastResult.value) {
    sessionStore.errorMessage = stt.error.value
      || '没听清,请再试一次,或直接用下方文字输入。'
  }
}

async function playPrompt() {
  // Try to surface a useful message if the prompt list never loaded.
  // (Previously this function returned silently when `currentPrompt` was
  // null, which made the button look broken when the backend hadn't shipped
  // the follow-along prompts yet.)
  let prompt = currentPrompt.value
  if (!prompt && sessionStore.session?.mode === 'repeat' && sessionStore.repeatPrompts.length === 0) {
    // Best-effort late load — the session store helper is safe to call.
    try {
      await sessionStore.reloadPrompts?.()
      prompt = currentPrompt.value
    } catch { /* swallow — we'll surface a friendly error below */ }
  }
  if (!prompt) {
    sessionStore.errorMessage = '目标句还没加载好,稍等几秒再试'
    return
  }
  tts.stop()
  if (tts.isLoading.value) return
  // The backend /api/tts takes plain text; the response.url may be a server
  // route.  If TTS isn't available, we fall back to browser TTS.
  const res = await tts.playText(prompt.text, undefined, ttsSpeed.value)
  if (!res && 'speechSynthesis' in window) {
    try {
      const u = new SpeechSynthesisUtterance(prompt.text)
      u.lang = 'en-US'
      // Mirror the user's chosen speed (browser TTS rate: 1.0 = normal,
      // 0.5 = half speed, 2.0 = double).
      u.rate = ttsSpeed.value
      window.speechSynthesis.speak(u)
    } catch { /* noop */ }
  }
}

async function playMyRecording() {
  // Replay the user's most recent recording. The blob lives in the recorder
  // composable and is cleared at the start of each new recording.  When no
  // recording exists yet the button is disabled, so this guard is just a
  // safety net.
  const blob = recorder.audioBlob.value
  if (!blob) return
  tts.stop()
  await tts.playBlob(blob)
}

async function finish() {
  if (finishing.value) return
  finishing.value = true
  const result = await sessionStore.finish()
  lastFinishedId.value = result?.id ?? sessionId.value
  finished.value = true
  finishing.value = false
  // After the session has been persisted, check the score.  If the user
  // scored low (< 60), offer to lift the keywords from their last spoken
  // sentence into the wordbook so they can practice them next time.
  // `result` may be null if the network request failed; in that case we
  // fall back to whatever lastScore the store has (a single-turn score).
  const score =
    result?.total_score ??
    result?.avg_score ??
    sessionStore.lastScore?.overall ??
    0
  if (score > 0 && score < 60) {
    void autoAddLowScoreKeywords(result)
  }
}

/**
 * Best-effort helper: pull keywords from the user's most recent spoken turn,
 * dedupe against what's already in the wordbook, then save up to 5 new
 * entries.  We deliberately stay silent on failure (no toast / no alert) —
 * the user already saw their session end screen, and adding noise there
 * would be worse than missing an entry.
 */
async function autoAddLowScoreKeywords(session: {
  messages?: { role: string; content: string }[]
  total_score?: number | null
  avg_score?: number | null
} | null): Promise<void> {
  if (!session?.messages) return
  const userTurns = session.messages.filter((m) => m.role === 'user')
  if (userTurns.length === 0) return
  // Use the *most recent* user turn — that's the one that likely dragged
  // the score down.
  const lastUserText = userTurns[userTurns.length - 1].content ?? ''
  const candidates = extractKeywords(lastUserText)
  if (candidates.length === 0) return
  // Skip words already saved (case-insensitive).
  const existing = await wordbookStore.checkSaved(candidates)
  const toAdd = candidates.filter((w) => !existing.has(w.toLowerCase())).slice(0, 5)
  if (toAdd.length === 0) {
    autoAddedHint.value = '本次评分较低,但你已存过这些词啦 👏'
    return
  }
  const scoreLabel = session.total_score ?? session.avg_score ?? 0
  let added = 0
  for (const term of toAdd) {
    const r = await wordbookStore.addItem({
      term,
      difficulty: 3, // hard — these are the words the user tripped on
      source: 'practice',
      notes: `低分练习自动加入 (${scoreLabel})`,
    })
    if (r) added += 1
  }
  if (added > 0) {
    autoAddedHint.value = `已自动加入 ${added} 个生词,记得再练练 💪`
  }
}

// English stopwords — anything in here is skipped when auto-extracting
// keywords.  Kept short and intentional: we only want nouns/verbs/adjectives
// the user would actually study, not grammatical glue.
const STOPWORDS = new Set<string>([
  'the','a','an','and','or','but','if','then','than','so','as','is','are','was','were','be','been','being','am',
  'have','has','had','having','do','does','did','doing','done','will','would','should','can','could','may','might','must','shall',
  'i','you','he','she','it','we','they','me','him','her','us','them','my','your','his','its','our','their','mine','yours','hers','ours','theirs',
  'this','that','these','those','there','here','where','when','why','how','what','which','who','whom','whose',
  'to','of','in','on','at','by','for','with','about','against','between','into','through','during','before','after','above','below','from','up','down','out','off','over','under','again','further','once',
  'all','any','both','each','few','more','most','other','some','such','no','nor','not','only','own','same','too','very','just','don','now','yes','okay','ok','well','like','really','actually','think','know','mean','want','need','get','got','make','made','take','took','go','went','come','came','see','saw','say','said','tell','told','ask','asked','use','used','work','working','one','two','three',
])

function extractKeywords(text: string): string[] {
  if (!text) return []
  // Tokenize: lowercase, strip punctuation except apostrophes & hyphens
  // inside words (so "don't" / "well-known" survive), then split on
  // whitespace.
  const tokens = text
    .toLowerCase()
    .replace(/[^\w\s'-]/g, ' ')
    .split(/\s+/)
    .map((t) => t.replace(/^['-]+|['-]+$/g, ''))
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t) && !/^\d+$/.test(t))
  // Dedupe while preserving order.
  const seen = new Set<string>()
  const out: string[] = []
  for (const t of tokens) {
    if (!seen.has(t)) {
      seen.add(t)
      out.push(t)
    }
  }
  return out
}

function goToHistory() {
  const id = lastFinishedId.value ?? sessionId.value
  router.push({ name: 'history-detail', params: { id } })
}

// Auto-clear the toast after a few seconds so it doesn't linger across
// navigation back into a fresh practice session.
let hintTimer: number | null = null
watch(autoAddedHint, (val) => {
  if (hintTimer != null) window.clearTimeout(hintTimer)
  if (val) {
    hintTimer = window.setTimeout(() => {
      autoAddedHint.value = ''
      hintTimer = null
    }, 6000)
  }
})
onBeforeUnmount(() => {
  if (hintTimer != null) window.clearTimeout(hintTimer)
})
</script>

<template>
  <section class="space-y-4">
    <!-- Top bar -->
    <div class="card p-3 sm:p-4 flex flex-wrap items-center gap-3">
      <RouterLink
        :to="{ name: 'scenario-preview', params: { id: sessionStore.session?.scenario_id } }"
        class="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-800"
      >
        <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M15 6l-6 6 6 6"/></svg>
        <span class="truncate max-w-[120px] sm:max-w-[200px]">{{ sessionStore.session?.scenario_title || '场景' }}</span>
      </RouterLink>
      <div class="ml-auto flex items-center gap-2 text-xs">
        <span class="chip bg-brand-50 text-brand-700">
          {{ sessionStore.session?.mode === 'repeat' ? '跟读模式' : '自由对话' }}
        </span>
        <span class="chip bg-ink-100 text-ink-700">
          {{ sessionStore.session?.difficulty === 'beginner' ? '入门' : sessionStore.session?.difficulty === 'intermediate' ? '进阶' : '高阶' }}
        </span>
        <button
          type="button"
          class="btn-outline !py-1.5 !px-3"
          @click="showSidebar = !showSidebar"
        >
          {{ showSidebar ? '隐藏评分' : '显示评分' }}
        </button>
        <button
          type="button"
          class="btn-primary !py-1.5 !px-3"
          :disabled="finishing"
          @click="finish"
        >
          {{ finishing ? '保存中…' : '结束本次' }}
        </button>
      </div>
    </div>

    <!-- Repeat-mode progress -->
    <div v-if="isRepeat && progress.total > 0" class="px-1">
      <div class="flex items-center justify-between text-xs text-ink-500 mb-1">
        <span>第 {{ progress.current }} / {{ progress.total }} 句</span>
        <span>{{ progress.percent }}%</span>
      </div>
      <div class="h-1.5 rounded-full bg-ink-100 overflow-hidden">
        <div
          class="h-full bg-gradient-to-r from-brand-500 to-accent-500 transition-all"
          :style="{ width: progress.percent + '%' }"
        />
      </div>
    </div>

    <!-- Repeat-mode: no prompts loaded fallback -->
    <div
      v-if="isRepeat && progress.total === 0"
      class="card p-4 sm:p-5 text-sm text-ink-500 border-amber-200 bg-amber-50/60"
    >
      <div class="font-semibold text-amber-800 mb-1">还没加载到跟读句</div>
      <p>
        正在从场景库同步跟读内容…
        <span v-if="!sessionStore.session">请先选择一个场景开始练习。</span>
        <span v-else>如果一直停留在此,刷新页面或换一个场景重试。</span>
      </p>
      <button
        v-if="sessionStore.session"
        type="button"
        class="btn-outline !py-1.5 !px-3 mt-2"
        @click="sessionStore.reloadPrompts"
      >
        重试加载跟读句
      </button>
    </div>

    <!-- Finished modal-like card -->
    <div v-if="finished" class="card p-5 sm:p-6 animate-slide-up">
      <div class="flex items-center gap-3">
        <div class="h-10 w-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
          <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M5 12l5 5 9-11"/></svg>
        </div>
        <div class="flex-1">
          <h3 class="text-base font-semibold text-ink-800">本次练习已结束</h3>
          <p class="text-sm text-ink-500">系统已为你保存本次对话与评分。</p>
          <p
            v-if="autoAddedHint"
            class="mt-1 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1 inline-block"
          >
            {{ autoAddedHint }}
          </p>
        </div>
        <div class="flex gap-2">
          <button class="btn-outline" @click="router.push({ name: 'scenarios' })">返回场景</button>
          <button class="btn-primary" @click="goToHistory">查看详情</button>
        </div>
      </div>
    </div>

    <!-- Main grid -->
    <div class="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
      <!-- Conversation area -->
      <div class="card flex flex-col h-[70vh] min-h-[480px]">
        <!-- Repeat prompt banner -->
        <div
          v-if="isRepeat && currentPrompt"
          class="px-4 sm:px-6 pt-5 pb-3 border-b border-ink-100"
        >
          <div class="text-xs font-semibold text-ink-500 uppercase tracking-wider mb-1">目标句</div>
          <p class="text-lg sm:text-2xl font-semibold text-ink-800 leading-snug">
            {{ currentPrompt.text }}
          </p>
          <p v-if="currentPrompt.translation" class="text-sm text-ink-500 mt-2">
            {{ currentPrompt.translation }}
          </p>
        </div>

        <!-- Messages -->
        <div
          ref="messagesEl"
          class="flex-1 overflow-y-auto scrollbar-thin px-4 sm:px-6 py-4 space-y-3 relative"
          @scroll="onMessagesScroll"
        >
          <MessageBubble
            v-for="m in sessionStore.session?.messages ?? []"
            :key="m.id"
            :message="m"
          />

          <!-- "Jump to latest" floating button — only visible when the user
               has scrolled away from the bottom of the messages pane. -->
          <button
            v-if="showScrollToBottom && (sessionStore.session?.messages?.length ?? 0) > 0"
            type="button"
            class="sticky bottom-2 ml-auto mr-2 h-9 w-9 rounded-full bg-brand-500 hover:bg-brand-600
                   text-white shadow-card flex items-center justify-center transition-all
                   active:scale-95 z-10"
            aria-label="跳到最新消息"
            title="跳到最新消息"
            @click="scrollToBottom"
          >
            <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 5v14M5 12l7 7 7-7" />
            </svg>
          </button>
        </div>

        <!-- Composer / recorder -->
        <div class="border-t border-ink-100 px-4 sm:px-6 py-4 bg-white/80">
          <div
            v-if="showPermissionHint"
            class="mb-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs px-3 py-2"
          >
            浏览器未授权麦克风。你仍可使用下方的文字输入继续练习。
          </div>
          <div
            v-if="connectionLabel"
            class="mb-2 text-center text-xs text-brand-700"
          >
            {{ connectionLabel }}
          </div>
          <div
            v-if="recorder.isRecording.value && stt.isListening.value && !stt.interimText.value && !stt.finalText.value"
            class="mb-2 text-center text-xs text-brand-700 animate-pulse"
          >
            🎙️ 正在听… 请说英文
          </div>
          <div v-if="sessionStore.errorMessage" class="mb-2 text-center text-xs text-rose-600">
            {{ sessionStore.errorMessage }}
          </div>
          <div
            v-if="(stt.isListening.value && (stt.interimText.value || stt.finalText.value)) || (!stt.isListening.value && stt.lastResult.value)"
            class="mb-2 rounded-lg bg-brand-50 border border-brand-200 px-3 py-2 text-sm text-brand-800"
          >
            <span class="text-xs text-brand-600 font-semibold uppercase tracking-wider mr-1">
              {{ stt.isListening.value ? '识别中' : '你说' }}
            </span>
            <span v-if="stt.isListening.value">
              {{ stt.finalText.value }}<span class="opacity-60">{{ stt.interimText.value }}</span>
            </span>
            <span v-else>{{ stt.lastResult.value }}</span>
          </div>


          <!-- Repeat-mode hint (just text, no big button) -->
          <p v-if="isRepeat" class="mb-2 text-center text-xs text-ink-500">
            💡 建议先听原音,再点击录音按钮(3秒倒计时)
          </p>

          <!-- TTS speed selector (repeat mode only) — controls "听原音" playback rate -->
          <div
            v-if="isRepeat"
            class="mb-2 flex items-center justify-center gap-1.5 text-xs"
          >
            <span class="text-ink-500">语速</span>
            <button
              v-for="s in [1.0, 0.8, 0.6]"
              :key="s"
              type="button"
              class="rounded-full px-2.5 py-0.5 border transition-colors"
              :class="ttsSpeed === s
                ? 'bg-brand-500 text-white border-brand-500'
                : 'bg-white text-ink-600 border-ink-200 hover:bg-ink-50'"
              :aria-pressed="ttsSpeed === s"
              @click="ttsSpeed = s"
            >
              {{ s }}x
            </button>
          </div>

          <!-- Recorder — stacks vertically on mobile, horizontal on sm+ -->
          <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <!-- Center: [Play Original (repeat)] [Recorder] [Replay Me (always)].
                 All three buttons are wrapped in a flex-col-with-label so the
                 circles end up at the same vertical center when the outer
                 `items-start` aligns them. -->
            <div class="order-1 sm:order-2 flex justify-center items-start gap-3">
              <!-- Play Original (repeat mode only) -->
              <div
                v-if="isRepeat"
                class="flex flex-col items-center gap-2 select-none"
              >
                <div class="relative">
                  <span
                    v-if="tts.isPlaying.value"
                    class="absolute inset-0 rounded-full animate-pulse-ring pointer-events-none"
                    aria-hidden="true"
                  />
                  <button
                    type="button"
                    class="relative z-10 rounded-full text-white font-semibold flex items-center justify-center
                           shadow-card transition-all duration-150 active:scale-95
                           h-20 w-20 sm:h-24 sm:w-24 text-xl
                           disabled:opacity-50 disabled:cursor-not-allowed
                           bg-brand-500 hover:bg-brand-600
                           [&.is-playing]:bg-accent-500 [&.is-playing]:hover:bg-accent-600"
                    :class="{ 'is-playing': tts.isPlaying.value }"
                    :disabled="!currentPrompt || tts.isLoading.value"
                    :title="!currentPrompt ? '目标句还没加载好' : (tts.isPlaying.value ? '点击停止' : '听原音')"
                    :aria-label="tts.isPlaying.value ? '点击停止播放' : '听原音'"
                    @click="tts.isPlaying.value ? tts.stop() : playPrompt()"
                  >
                    <svg
                      v-if="tts.isLoading.value"
                      viewBox="0 0 24 24"
                      class="h-6 w-6 animate-spin"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <circle cx="12" cy="12" r="9" stroke-opacity="0.25" />
                      <path d="M21 12a9 9 0 0 0-9-9" stroke-linecap="round" />
                    </svg>
                    <svg
                      v-else-if="tts.isPlaying.value"
                      viewBox="0 0 24 24"
                      class="h-7 w-7 sm:h-9 sm:w-9"
                      fill="currentColor"
                    >
                      <rect x="6" y="6" width="12" height="12" rx="2" />
                    </svg>
                    <svg
                      v-else
                      viewBox="0 0 24 24"
                      class="h-8 w-8 sm:h-10 sm:w-10"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <path d="M11 5L6 9H2v6h4l5 4V5z" fill="currentColor" />
                      <path d="M15.5 8.5a5 5 0 0 1 0 7" />
                      <path d="M19 5a10 10 0 0 1 0 14" />
                    </svg>
                  </button>
                </div>
                <p class="text-xs text-ink-500 h-4">
                  <span v-if="tts.isLoading.value">加载中…</span>
                  <span v-else-if="tts.isPlaying.value">点击停止</span>
                  <span v-else>听原音</span>
                </p>
              </div>

              <!-- Recorder (always) -->
              <RecorderButton
                :is-recording="recorder.isRecording.value"
                :is-preparing="recorder.isPreparing.value"
                :level="recorder.level.value"
                :mode="isRepeat ? 'countdown' : 'toggle'"
                :countdown-ms="isRepeat ? 3000 : 0"
                :disabled="sessionStore.connection !== 'idle'"
                @start="onRecorderStart"
                @stop="onRecorderStop"
                @countdown-cancel="() => undefined"
              />

              <!-- Replay My Recording (always). Disabled until the user has
                   recorded at least once. -->
              <div class="flex flex-col items-center gap-2 select-none">
                <div class="relative">
                  <span
                    v-if="tts.isPlaying.value"
                    class="absolute inset-0 rounded-full animate-pulse-ring pointer-events-none"
                    aria-hidden="true"
                  />
                  <button
                    type="button"
                    class="relative z-10 rounded-full text-white font-semibold flex items-center justify-center
                           shadow-card transition-all duration-150 active:scale-95
                           h-20 w-20 sm:h-24 sm:w-24 text-xl
                           disabled:opacity-40 disabled:cursor-not-allowed
                           bg-brand-500 hover:bg-brand-600
                           [&.is-playing]:bg-accent-500 [&.is-playing]:hover:bg-accent-600"
                    :class="{ 'is-playing': tts.isPlaying.value }"
                    :disabled="!recorder.audioBlob.value"
                    :title="!recorder.audioBlob.value
                      ? '先录一次才能回放'
                      : (tts.isPlaying.value ? '点击停止' : '听我的')"
                    :aria-label="tts.isPlaying.value ? '点击停止回放' : '听我的录音'"
                    @click="tts.isPlaying.value ? tts.stop() : playMyRecording()"
                  >
                    <svg
                      v-if="tts.isPlaying.value"
                      viewBox="0 0 24 24"
                      class="h-7 w-7 sm:h-9 sm:w-9"
                      fill="currentColor"
                    >
                      <rect x="6" y="6" width="12" height="12" rx="2" />
                    </svg>
                    <svg
                      v-else
                      viewBox="0 0 24 24"
                      class="h-8 w-8 sm:h-10 sm:w-10"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <!-- User head -->
                      <circle cx="12" cy="9" r="3.5" fill="currentColor" stroke="none" />
                      <!-- User shoulders / body curve -->
                      <path d="M5 20c0-3 3-5 7-5s7 2 7 5" />
                      <!-- Small play triangle overlay (bottom-right) -->
                      <path d="M16 16l4 2.4-4 2.4z" fill="currentColor" stroke="none" />
                    </svg>
                  </button>
                </div>
                <p class="text-xs text-ink-500 h-4">
                  <span v-if="tts.isPlaying.value">点击停止</span>
                  <span v-else>听我的</span>
                </p>
              </div>
            </div>

            <!-- Left: desktop-only hint -->
            <div class="order-2 sm:order-1 flex items-center gap-2 text-xs text-ink-500 justify-center sm:justify-start">
              <span v-if="isRepeat" class="hidden sm:inline text-ink-400">
                完成后点"下一句"
              </span>
            </div>
            <!-- Right: prev/next -->
            <div v-if="isRepeat" class="order-3 flex gap-2 justify-center sm:justify-end">
              <button
                type="button"
                class="btn-outline"
                :disabled="sessionStore.repeatIndex <= 0"
                @click="sessionStore.previousRepeat"
              >
                上一句
              </button>
              <button
                type="button"
                class="btn-primary"
                :disabled="sessionStore.repeatIndex >= sessionStore.repeatPrompts.length - 1"
                @click="sessionStore.advanceRepeat"
              >
                下一句 →
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Sidebar: scoring. On mobile (≤ 640 px), default-collapsed; user can
           toggle with the "显示评分/隐藏评分" button in the top bar. -->
      <aside v-if="!isMobile || showSidebar" class="space-y-4">
        <ScoreCard :score="sessionStore.lastScore" />
        <div class="card p-4 sm:p-5 text-sm text-ink-500">
          <h3 class="text-sm font-semibold text-ink-800 mb-2">小贴士</h3>
          <ul class="space-y-1.5 list-disc pl-5">
            <li v-if="isFree">一次只说 1–2 句,对话更自然。</li>
            <li v-else>模仿语调和停顿,不必逐字对应。</li>
            <li>录音时观察右上角,声波越稳,识别越准。</li>
            <li>遇到识别错误?缩短句子,或换个说法再试。</li>
          </ul>
        </div>
        <div v-if="isFree" class="card p-4 sm:p-5">
          <h3 class="text-sm font-semibold text-ink-800 mb-2">本轮摘要</h3>
          <p class="text-xs text-ink-500">
            对话 {{ sessionStore.session?.messages?.length ?? 0 }} 条消息。
          </p>
        </div>
      </aside>
    </div>
  </section>
</template>
