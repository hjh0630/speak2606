<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  isRecording: boolean
  isPreparing?: boolean
  disabled?: boolean
  level?: number
  mode?: 'hold' | 'toggle'
  size?: 'sm' | 'md' | 'lg'
  label?: string
}>(), {
  level: 0,
  mode: 'hold',
  size: 'lg',
})

const emit = defineEmits<{
  (e: 'start'): void
  (e: 'stop', blob: null): void
}>()

const sizeCls = computed(() => {
  switch (props.size) {
    case 'sm': return 'h-12 w-12 text-base'
    case 'md': return 'h-16 w-16 text-lg'
    default: return 'h-20 w-20 sm:h-24 sm:w-24 text-xl'
  }
})

function onPress() {
  if (props.disabled) return
  if (props.mode === 'hold') {
    if (!props.isRecording) emit('start')
  } else {
    if (props.isRecording) emit('stop', null)
    else emit('start')
  }
}

function onRelease() {
  if (props.mode !== 'hold') return
  if (props.isRecording) emit('stop', null)
}

// expose some animation scale based on level
const scale = computed(() => 1 + Math.min(0.06, props.level * 0.4))
</script>

<template>
  <div class="flex flex-col items-center gap-2 select-none">
    <div class="relative">
      <span
        v-if="isRecording"
        class="absolute inset-0 rounded-full animate-pulse-ring pointer-events-none"
        aria-hidden="true"
      />
      <button
        type="button"
        :disabled="disabled || isPreparing"
        :class="[
          'relative z-10 rounded-full text-white font-semibold flex items-center justify-center',
          'shadow-card transition-all duration-150 active:scale-95',
          isRecording
            ? 'bg-accent-600 hover:bg-accent-700'
            : 'bg-brand-700 hover:bg-brand-800',
          (disabled || isPreparing) && 'opacity-50 cursor-not-allowed',
          sizeCls,
        ]"
        :style="isRecording ? { transform: `scale(${scale})` } : undefined"
        :aria-pressed="isRecording"
        :aria-label="isRecording ? '松开结束录音' : (label || '按住说话')"
        @pointerdown.prevent="onPress"
        @pointerup.prevent="onRelease"
        @pointerleave.prevent="onRelease"
        @pointercancel.prevent="onRelease"
        @click.prevent
      >
        <svg
          v-if="!isRecording && !isPreparing"
          viewBox="0 0 24 24"
          class="h-7 w-7 sm:h-9 sm:w-9"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
        >
          <rect x="9" y="3" width="6" height="12" rx="3" />
          <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
        </svg>
        <svg
          v-else-if="isPreparing"
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
          v-else
          viewBox="0 0 24 24"
          class="h-7 w-7 sm:h-9 sm:w-9"
          fill="currentColor"
        >
          <rect x="6" y="6" width="12" height="12" rx="2" />
        </svg>
      </button>
    </div>
    <p class="text-xs text-ink-500 h-4">
      <span v-if="isPreparing">准备中…</span>
      <span v-else-if="isRecording">松开发送 · 录音中</span>
      <span v-else>{{ label || (mode === 'hold' ? '按住说话' : '点击开始录音') }}</span>
    </p>
  </div>
</template>
