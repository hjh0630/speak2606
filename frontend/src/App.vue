<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import NavBar from '@/components/NavBar.vue'
import WordPopup from '@/components/WordPopup.vue'
import { useWordLookup } from '@/composables/useWordLookup'
import { useSessionStore } from '@/stores/session'

const {
  popup,
  isPlaying,
  isCurrentSaved,
  isSaving,
  playWord,
  close,
  saveCurrent,
  refreshSavedTerms,
} = useWordLookup()
const sessionStore = useSessionStore()
const route = useRoute()

// Toast for "已加入生词本" — short, non-blocking.
const toast = ref<string | null>(null)
let toastTimer: number | null = null
function showToast(msg: string): void {
  toast.value = msg
  if (toastTimer) window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => { toast.value = null }, 1800)
}

// Wire the popup's save button → saveCurrent + toast.
async function onSaveFromPopup(): Promise<void> {
  const res = await saveCurrent()
  if (res.ok && res.term) {
    showToast(`已加入生词本 · ${res.term}`)
  } else if (res.reason === 'already-saved') {
    showToast('这个词已经在生词本里啦')
  } else if (res.reason && res.reason !== 'in-flight' && res.reason !== 'stale' && res.reason !== 'no-popup') {
    showToast(`加入失败: ${res.reason}`)
  }
}

// One-time onboarding hint that teaches the user about the word-lookup
// feature. Persists a "dismissed" flag in localStorage so the hint only
// shows once per browser. The banner auto-dismisses after 15s OR when the
// current session completes (so it doesn't sit on top of the
// "本次练习已结束" card).
const showHint = ref(false)
let autoDismissTimer: number | null = null

function dismissHint(persistent = true) {
  showHint.value = false
  if (autoDismissTimer) {
    window.clearTimeout(autoDismissTimer)
    autoDismissTimer = null
  }
  if (persistent) {
    try { localStorage.setItem('sf_hint_wordlookup_v1', '1') } catch { /* ignore */ }
  }
}

onMounted(() => {
  try {
    if (typeof localStorage !== 'undefined' && !localStorage.getItem('sf_hint_wordlookup_v1')) {
      showHint.value = true
      // Force-dismiss after 15s — by then the user has either used the
      // feature or scrolled past; either way, the hint is no longer useful.
      autoDismissTimer = window.setTimeout(() => dismissHint(true), 15000)
    }
  } catch { /* private mode / disabled storage — show every time */
    showHint.value = true
    autoDismissTimer = window.setTimeout(() => dismissHint(false), 15000)
  }
  // Pull the user's saved terms so the popup's ☆/★ state is correct from
  // the first selection.  Best-effort — if the store is empty / network
  // fails the popup still works, just without the ★ state.
  void refreshSavedTerms()
})

// Auto-dismiss the moment the user finishes a practice session — the hint
// is meant to introduce the feature, not to keep nagging after the user
// has already done a full practice round.
watch(
  () => sessionStore.session?.status,
  (status) => {
    if (status === 'completed' && showHint.value) dismissHint(true)
  },
)

// Whenever the user returns from the wordbook page (or any route that may
// have mutated their saved set), re-sync the lookup cache so the popup
// reflects the new state.
watch(
  () => route.fullPath,
  () => { void refreshSavedTerms() },
)

onBeforeUnmount(() => {
  if (autoDismissTimer) {
    window.clearTimeout(autoDismissTimer)
    autoDismissTimer = null
  }
  if (toastTimer) {
    window.clearTimeout(toastTimer)
    toastTimer = null
  }
})
</script>

<template>
  <div class="min-h-full flex flex-col bg-ink-50">
    <NavBar />
    <main class="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 pb-24 pt-4 sm:pt-8">
      <router-view v-slot="{ Component, route }">
        <transition name="page" mode="out-in">
          <component :is="Component" :key="route.fullPath" />
        </transition>
      </router-view>
    </main>
    <footer class="hidden sm:block text-center text-xs text-ink-400 py-4">
      SpeakFlow · 用对话的方式练习英语
    </footer>

    <!-- One-time onboarding hint for the word-lookup feature. Bottom-center,
         doesn't collide with the WordPopup (which is z-100, this is z-50).
         On mobile it spans the bottom safe area; on desktop it stays
         bottom-center, narrower. -->
    <transition name="hint">
      <div
        v-if="showHint"
        class="fixed left-1/2 -translate-x-1/2 bottom-4 sm:bottom-6 z-50 max-w-[92vw] sm:max-w-md"
        role="status"
        aria-live="polite"
      >
        <div class="card p-3 sm:p-3.5 flex items-center gap-3 shadow-card border-brand-200 bg-white">
          <div class="h-8 w-8 shrink-0 rounded-full bg-brand-50 text-brand-700 flex items-center justify-center text-base">
            💡
          </div>
          <p class="text-xs sm:text-sm text-ink-700 leading-snug flex-1">
            <span class="font-semibold text-ink-800">试试选中英文单词</span> —
            弹中文释义,点喇叭听发音。点 ☆ 加入生词本。整页通用。
          </p>
          <button
            type="button"
            class="shrink-0 inline-flex items-center justify-center h-7 w-7 rounded-full
                   text-ink-400 hover:text-ink-700 hover:bg-ink-100 transition-all"
            aria-label="关闭提示"
            title="知道了"
            @click="dismissHint(true)"
          >
            <svg viewBox="0 0 24 24" class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
      </div>
    </transition>

    <!-- Toast for save feedback. -->
    <transition name="toast">
      <div
        v-if="toast"
        class="fixed left-1/2 -translate-x-1/2 top-16 sm:top-20 z-[110] pointer-events-none"
        role="status"
        aria-live="polite"
      >
        <div class="rounded-full bg-ink-900 text-white text-xs sm:text-sm px-4 py-2 shadow-card border border-ink-700/40">
          {{ toast }}
        </div>
      </div>
    </transition>

    <!-- Global word-lookup popup: any text on the page, double-click or
         drag-select to look up + hear a garment / textile term. -->
    <WordPopup
      :popup="popup"
      :is-playing="isPlaying"
      :is-saved="isCurrentSaved"
      :is-saving="isSaving"
      @play="playWord"
      @close="close"
      @save="onSaveFromPopup"
    />
  </div>
</template>

<style scoped>
.page-enter-active,
.page-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}
.page-enter-from {
  opacity: 0;
  transform: translateY(4px);
}
.page-leave-to {
  opacity: 0;
  transform: translateY(-2px);
}
.hint-enter-active,
.hint-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}
.hint-enter-from,
.hint-leave-to {
  opacity: 0;
  transform: translate(-50%, 12px);
}
.toast-enter-active,
.toast-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}
.toast-enter-from {
  opacity: 0;
  transform: translate(-50%, -8px);
}
.toast-leave-to {
  opacity: 0;
  transform: translate(-50%, -8px);
}
</style>

<style scoped>
.page-enter-active,
.page-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}
.page-enter-from {
  opacity: 0;
  transform: translateY(4px);
}
.page-leave-to {
  opacity: 0;
  transform: translateY(-2px);
}
</style>
