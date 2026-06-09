<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'

const props = withDefaults(defineProps<{
  isRecording: boolean
  isPreparing?: boolean
  disabled?: boolean
  level?: number
  mode?: 'hold' | 'toggle' | 'countdown'
  countdownMs?: number
  size?: 'sm' | 'md' | 'lg'
  label?: string
}>(), {
  level: 0,
  mode: 'hold',
  countdownMs: 0,
  size: 'lg',
})

const emit = defineEmits<{
  (e: 'start'): void
  (e: 'stop', blob: null): void
  (e: 'countdown-cancel'): void
}>()

const sizeCls = computed(() => {
  switch (props.size) {
    case 'sm': return 'h-12 w-12 text-base'
    case 'md': return 'h-16 w-16 text-lg'
    default: return 'h-20 w-20 sm:h-24 sm:w-24 text-xl'
  }
})

// Countdown state — only used in 'countdown' mode.  Holds the remaining
// seconds (3 / 2 / 1) while counting, null when not counting.
const countdown = ref<number | null>(null)
let countdownTimer: number | null = null

function clearCountdownTimer() {
  if (countdownTimer != null) {
    window.clearInterval(countdownTimer)
    countdownTimer = null
  }
}

function startCountdown() {
  if (props.countdownMs <= 0) {
    // Defensive: shouldn't reach here, but if countdownMs is 0 just start.
    emit('start')
    return
  }
  const totalSeconds = Math.max(1, Math.round(props.countdownMs / 1000))
  countdown.value = totalSeconds
  countdownTimer = window.setInterval(() => {
    if (countdown.value == null) return
    if (countdown.value <= 1) {
      // Time's up: clear timer, emit start, leave countdown at 0 briefly
      // so the user sees the transition (handled in template).
      clearCountdownTimer()
      countdown.value = 0
      window.setTimeout(() => {
        if (countdown.value === 0) countdown.value = null
      }, 250)
      emit('start')
    } else {
      countdown.value = countdown.value - 1
    }
  }, 1000)
}

function cancelCountdown() {
  clearCountdownTimer()
  countdown.value = null
  emit('countdown-cancel')
}

// Reset countdown if parent toggles disabled / isPreparing from underneath us.
watch(
  () => [props.disabled, props.isPreparing, props.isRecording] as const,
  ([disabled, preparing, recording]) => {
    if (recording) {
      // Recording started (by parent emitting 'start' effect). Clear local
      // countdown state if any.
      clearCountdownTimer()
      countdown.value = null
    } else if ((disabled || preparing) && countdown.value != null) {
      cancelCountdown()
    }
  },
)

onBeforeUnmount(() => clearCountdownTimer())

function onPress() {
  if (props.disabled || props.isPreparing) return
  if (props.mode === 'hold') {
    if (!props.isRecording) emit('start')
  } else if (props.mode === 'toggle') {
    if (props.isRecording) emit('stop', null)
    else emit('start')
  } else {
    // 'countdown' mode
    if (props.isRecording) {
      emit('stop', null)
    } else if (countdown.value != null) {
      cancelCountdown()
    } else {
      startCountdown()
    }
  }
}

function onRelease() {
  if (props.mode !== 'hold') return
  if (props.isRecording) emit('stop', null)
}

// expose some animation scale based on level
const scale = computed(() => 1 + Math.min(0.06, props.level * 0.4))

const isCounting = computed(() => countdown.value != null)
const countdownLabel = computed(() => {
  if (countdown.value == null) return ''
  if (countdown.value === 0) return '开始'
  return String(countdown.value)
})
</script>

<template>
  <div class="flex flex-col items-center gap-2 select-none">
    <div class="relative">
      <span
        v-if="isRecording"
        class="absolute inset-0 rounded-full animate-pulse-ring pointer-events-none"
        aria-hidden="true"
      />
      <span
        v-else-if="isCounting"
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
            : isCounting
              ? 'bg-accent-500 hover:bg-accent-600'
              : 'bg-brand-700 hover:bg-brand-800',
          (disabled || isPreparing) && 'opacity-50 cursor-not-allowed',
          sizeCls,
        ]"
        :style="isRecording ? { transform: `scale(${scale})` } : undefined"
        :aria-pressed="isRecording || isCounting"
        :aria-label="
          isRecording
            ? '点击结束录音'
            : isCounting
              ? '点击取消倒计时'
              : (label || (mode === 'hold' ? '按住说话' : '点击开始录音'))
        "
        @pointerdown.prevent="onPress"
        @pointerup.prevent="onRelease"
        @pointerleave.prevent="onRelease"
        @pointercancel.prevent="onRelease"
        @click.prevent
      >
        <!-- Countdown: big number, no mic icon -->
        <span
          v-if="isCounting"
          class="text-3xl sm:text-4xl font-bold tabular-nums"
        >{{ countdownLabel }}</span>
        <!-- Recording: stop icon -->
        <svg
          v-else-if="isRecording"
          viewBox="0 0 24 24"
          class="h-7 w-7 sm:h-9 sm:w-9"
          fill="currentColor"
        >
          <rect x="6" y="6" width="12" height="12" rx="2" />
        </svg>
        <!-- Preparing: spinner -->
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
        <!-- Idle: mic icon -->
        <svg
          v-else
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
      </button>
    </div>
    <p class="text-xs text-ink-500 h-4">
      <span v-if="isPreparing">准备中…</span>
      <span v-else-if="isRecording">点击结束 · 录音中</span>
      <span v-else-if="isCounting">点击取消 · 倒计时中</span>
      <span v-else>{{ label || (mode === 'hold' ? '按住说话' : mode === 'countdown' ? '点击开始 · 3秒倒计时' : '点击开始录音') }}</span>
    </p>
  </div>
</template>
