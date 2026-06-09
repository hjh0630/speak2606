<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import { useSessionStore } from '@/stores/session'
import { useUserStore } from '@/stores/user'
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

const recorder = useRecorder()
const stt = useBrowserSTT({ lang: 'en-US' })
const tts = useTts()

const sessionId = computed(() => route.params.id as string)
const textInput = ref('')
const messagesEl = ref<HTMLElement | null>(null)
// Sidebar default: hidden on mobile (≤ 640 px), shown on desktop.
// `isMobile` is reactive so the aside re-renders if the user resizes.
const isMobile = ref(false)
const showSidebar = ref(false)
const showPermissionHint = ref(false)
const finishing = ref(false)
const finished = ref(false)
const lastFinishedId = ref<string | null>(null)

function scrollToBottom() {
  nextTick(() => {
    const el = messagesEl.value
    if (el) el.scrollTop = el.scrollHeight
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
  if (typeof navigator !== 'undefined' && navigator.permissions) {
    try {
      const status = await navigator.permissions.query({ name: 'microphone' as PermissionName })
      if (status.state === 'denied') showPermissionHint.value = true
    } catch { /* not all browsers support permissions.query */ }
  }
  if (recorder.permissionDenied.value) showPermissionHint.value = true
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

async function sendText() {
  const text = textInput.value.trim()
  if (!text) return
  textInput.value = ''
  try {
    await sessionStore.sendText(text, currentPrompt.value?.id)
  } catch {
    // store has the error
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
  const res = await tts.playText(prompt.text)
  if (!res && 'speechSynthesis' in window) {
    try {
      const u = new SpeechSynthesisUtterance(prompt.text)
      u.lang = 'en-US'
      u.rate = 0.95
      window.speechSynthesis.speak(u)
    } catch { /* noop */ }
  }
}

async function playAssistant() {
  const url = sessionStore.lastAssistantAudioUrl
  if (url) {
    await tts.playUrl(url)
    return
  }
  const last = [...(sessionStore.session?.messages ?? [])].reverse().find((m) => m.role === 'assistant')
  if (last && 'speechSynthesis' in window) {
    try {
      const u = new SpeechSynthesisUtterance(last.content)
      u.lang = 'en-US'
      u.rate = 0.95
      window.speechSynthesis.speak(u)
    } catch { /* noop */ }
  }
}

async function finish() {
  if (finishing.value) return
  finishing.value = true
  const result = await sessionStore.finish()
  lastFinishedId.value = result?.id ?? sessionId.value
  finished.value = true
  finishing.value = false
}

function goToHistory() {
  const id = lastFinishedId.value ?? sessionId.value
  router.push({ name: 'history-detail', params: { id } })
}
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
          <div class="flex items-start gap-3">
            <p class="text-lg sm:text-2xl font-semibold text-ink-800 leading-snug flex-1">
              {{ currentPrompt.text }}
            </p>
            <button
              type="button"
              class="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-ink-200 px-2.5 py-1.5 text-xs font-medium text-ink-600 hover:bg-ink-50"
              :disabled="tts.isLoading.value"
              @click="playPrompt"
            >
              <svg viewBox="0 0 24 24" class="h-3.5 w-3.5" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
              再听一遍
            </button>
          </div>
          <p v-if="currentPrompt.translation" class="text-sm text-ink-500 mt-2">
            {{ currentPrompt.translation }}
          </p>
        </div>

        <!-- Messages -->
        <div
          ref="messagesEl"
          class="flex-1 overflow-y-auto scrollbar-thin px-4 sm:px-6 py-4 space-y-3"
        >
          <div
            v-if="!sessionStore.session || (sessionStore.session.messages?.length ?? 0) === 0"
            class="h-full flex flex-col items-center justify-center text-center text-ink-500"
          >
            <div class="text-4xl mb-2">🎤</div>
            <p class="text-sm">按下录音按钮开始第一句</p>
            <p class="text-xs text-ink-400 mt-1">说英文,AI 会即时回复并给你评分</p>
          </div>
          <MessageBubble
            v-for="m in sessionStore.session?.messages ?? []"
            :key="m.id"
            :message="m"
          />
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

          <!-- Text fallback / always-available text input -->
          <div class="flex items-end gap-2 mb-3">
            <textarea
              v-model="textInput"
              class="input min-h-[44px] max-h-32 resize-y scrollbar-thin"
              rows="1"
              :placeholder="isRepeat ? '输入你的跟读,Enter 发送' : '输入英文,Enter 发送'"
              @keydown.enter.exact.prevent="sendText"
            />
            <button
              type="button"
              class="btn-primary"
              :disabled="!textInput.trim() || sessionStore.connection !== 'idle'"
              @click="sendText"
            >
              发送
            </button>
          </div>

          <!-- Repeat-mode hint (just text, no big button) -->
          <p v-if="isRepeat" class="mb-2 text-center text-xs text-ink-500">
            💡 建议先听原音,再点击录音按钮(3秒倒计时)
          </p>

          <!-- Recorder — stacks vertically on mobile, horizontal on sm+ -->
          <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <!-- Center: [Play Original (repeat only)] [Recorder].
                 Both buttons are wrapped in a flex-col-with-label so the
                 two circles end up at the same vertical center when the
                 outer `items-center` aligns them. -->
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
            </div>
            <!-- Left: replay AI + desktop-only hint -->
            <div class="order-2 sm:order-1 flex items-center gap-2 text-xs text-ink-500 justify-center sm:justify-start">
              <button
                type="button"
                class="rounded-lg border border-ink-200 px-2 py-1 hover:bg-ink-50"
                :disabled="!sessionStore.lastAssistantAudioUrl && !sessionStore.session"
                @click="playAssistant"
              >
                🔊 复听 AI
              </button>
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
            <li>不擅长录音?直接用文字输入,效果一样。</li>
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
