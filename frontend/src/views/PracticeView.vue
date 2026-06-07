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
const showSidebar = ref(true)
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

onMounted(async () => {
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
  // Start the recorder (so we get the level meter / pulse animation)
  try {
    await recorder.start()
  } catch {
    showPermissionHint.value = true
    return
  }
  // In parallel, start the browser STT (Chrome/Edge/Safari).
  // If the browser doesn't support it, fall back to text input and let the
  // user type — recorder audio stays available for replay only.
  try {
    await stt.start(async (finalText) => {
      const text = finalText.trim()
      if (!text) return
      try {
        await sessionStore.sendText(text, currentPrompt.value?.id)
      } catch {
        // store has the error
      }
    })
  } catch {
    // browser doesn't support STT — text input remains the fallback
  }
}

async function onRecorderStop() {
  // Stop both the visual recorder and the STT session.
  const blob = await recorder.stop()
  stt.stop()
  // If the browser STT already produced a final transcript, it has been
  // forwarded. Nothing else to do here.
  if (!blob || blob.size === 0) return
  // Note: we do NOT upload raw audio to the server. The text path is
  // the single source of truth for content scoring. Audio is kept
  // locally only as a visual cue.
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
  const prompt = currentPrompt.value
  if (!prompt) return
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
              class="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-ink-200 px-2.5 py-1.5 text-xs font-medium text-ink-700 hover:bg-ink-50"
              :disabled="tts.isLoading.value"
              @click="playPrompt"
            >
              <svg viewBox="0 0 24 24" class="h-3.5 w-3.5" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
              播放
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
          <div v-if="sessionStore.errorMessage" class="mb-2 text-center text-xs text-rose-600">
            {{ sessionStore.errorMessage }}
          </div>
          <div
            v-if="stt.isListening.value && (stt.interimText.value || stt.finalText.value)"
            class="mb-2 rounded-lg bg-brand-50 border border-brand-200 px-3 py-2 text-sm text-brand-800"
          >
            <span class="text-xs text-brand-600 font-semibold uppercase tracking-wider mr-1">识别中</span>
            <span>{{ stt.finalText.value }}<span class="opacity-60">{{ stt.interimText.value }}</span></span>
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

          <!-- Recorder -->
          <div class="flex items-center justify-between gap-3">
            <div class="flex items-center gap-2 text-xs text-ink-500">
              <button
                type="button"
                class="rounded-lg border border-ink-200 px-2 py-1 hover:bg-ink-50"
                :disabled="!sessionStore.lastAssistantAudioUrl && !sessionStore.session"
                @click="playAssistant"
              >
                🔊 复听 AI
              </button>
              <span v-if="isRepeat" class="text-ink-400">
                完成后点"下一句"
              </span>
            </div>
            <RecorderButton
              :is-recording="recorder.isRecording.value"
              :is-preparing="recorder.isPreparing.value"
              :level="recorder.level.value"
              :disabled="sessionStore.connection !== 'idle'"
              @start="onRecorderStart"
              @stop="onRecorderStop"
            />
            <div v-if="isRepeat" class="flex gap-2">
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

      <!-- Sidebar: scoring -->
      <aside v-if="showSidebar" class="space-y-4">
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
