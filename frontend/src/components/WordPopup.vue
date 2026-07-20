<script setup lang="ts">
import { computed } from 'vue'

interface Popup {
  word: string
  meaning: string
  x: number
  y: number
  below: boolean
  loading?: boolean
  source?: 'local' | 'llm' | 'mock'
}

const props = defineProps<{
  popup: Popup | null
  isPlaying: boolean
  /** Has this exact term already been saved into the user's wordbook? */
  isSaved?: boolean
  /** True while a save request is in flight. */
  isSaving?: boolean
}>()

const emit = defineEmits<{
  (e: 'play'): void
  (e: 'close'): void
  (e: 'save'): void
}>()

const style = computed(() => {
  const p = props.popup
  if (!p) return { display: 'none' }
  return {
    left: `${p.x}px`,
    top: p.below ? `${p.y}px` : 'auto',
    bottom: p.below ? 'auto' : `${window.innerHeight - p.y}px`,
    transform: 'translate(-50%, 0)',
  }
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="popup"
      data-word-popup
      :style="style"
      class="fixed z-[100] pointer-events-auto"
      role="tooltip"
      @mousedown.stop
    >
      <div
        class="rounded-xl bg-ink-800 text-white shadow-card border border-ink-700/40
               px-3 py-2.5 min-w-[200px] max-w-[320px] animate-fade-in"
      >
        <div class="flex items-center gap-2">
          <div class="flex-1 min-w-0">
            <div class="text-base font-semibold tracking-wide truncate">
              {{ popup.word }}
            </div>
            <div class="text-xs text-white/80 mt-1 leading-snug flex items-center gap-1.5">
              <svg
                v-if="popup.loading"
                viewBox="0 0 24 24"
                class="h-3 w-3 animate-spin shrink-0"
                fill="none"
                stroke="currentColor"
                stroke-width="2.4"
              >
                <circle cx="12" cy="12" r="9" stroke-opacity="0.25" />
                <path d="M21 12a9 9 0 0 0-9-9" stroke-linecap="round" />
              </svg>
              <span class="truncate">{{ popup.meaning }}</span>
            </div>
          </div>
          <button
            type="button"
            class="shrink-0 inline-flex items-center justify-center h-8 w-8 rounded-full
                   bg-accent-500 hover:bg-accent-600 text-white shadow-soft
                   transition-all active:scale-95 disabled:opacity-50"
            :disabled="isPlaying"
            :aria-label="`播放 ${popup.word} 的读音`"
            :title="`播放 ${popup.word} 的读音`"
            @click="emit('play')"
          >
            <svg
              v-if="isPlaying"
              viewBox="0 0 24 24"
              class="h-4 w-4 animate-spin"
              fill="none"
              stroke="currentColor"
              stroke-width="2.4"
            >
              <circle cx="12" cy="12" r="9" stroke-opacity="0.25" />
              <path d="M21 12a9 9 0 0 0-9-9" stroke-linecap="round" />
            </svg>
            <svg
              v-else
              viewBox="0 0 24 24"
              class="h-4 w-4"
              fill="currentColor"
            >
              <path d="M8 5v14l11-7z" />
            </svg>
          </button>
          <!-- Add-to-wordbook button. Toggles between "☆" (unsaved) and
               "★" (saved). When saved we still emit `save` so the caller
               can decide to no-op or undo; the visible state is what
               the user sees first. -->
          <button
            type="button"
            class="shrink-0 inline-flex items-center justify-center h-8 w-8 rounded-full
                   transition-all active:scale-95 disabled:opacity-60"
            :class="
              isSaved
                ? 'bg-amber-400/95 hover:bg-amber-400 text-amber-950'
                : 'bg-white/10 hover:bg-white/20 text-white border border-white/15'
            "
            :disabled="isSaving || popup.loading || isSaved"
            :aria-label="isSaved ? `已加入生词本` : `加入生词本 ${popup.word}`"
            :title="isSaved ? '已在生词本' : '加入生词本'"
            data-wordbook-save
            @click="emit('save')"
          >
            <svg
              v-if="isSaving"
              viewBox="0 0 24 24"
              class="h-4 w-4 animate-spin"
              fill="none"
              stroke="currentColor"
              stroke-width="2.4"
            >
              <circle cx="12" cy="12" r="9" stroke-opacity="0.25" />
              <path d="M21 12a9 9 0 0 0-9-9" stroke-linecap="round" />
            </svg>
            <svg v-else viewBox="0 0 24 24" class="h-4 w-4" fill="currentColor">
              <path
                d="M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"
              />
            </svg>
          </button>
          <button
            type="button"
            class="shrink-0 inline-flex items-center justify-center h-8 w-8 rounded-full
                   text-white/70 hover:text-white hover:bg-white/10
                   transition-all"
            :aria-label="'关闭'"
            title="关闭"
            @click="emit('close')"
          >
            <svg viewBox="0 0 24 24" class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <div class="mt-1.5 text-[10px] text-white/50 tracking-wide">
          💡 再次选中或点空白处可关闭
        </div>
      </div>
    </div>
  </Teleport>
</template>
