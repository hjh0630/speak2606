<script setup lang="ts">
import { computed } from 'vue'
import type { SessionMessage } from '@/types/api'

const props = defineProps<{ message: SessionMessage; pending?: boolean }>()

const isUser = computed(() => props.message.role === 'user')

const time = computed(() => {
  try {
    const d = new Date(props.message.created_at)
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
})
</script>

<template>
  <div :class="['flex w-full', isUser ? 'justify-end' : 'justify-start']">
    <div :class="['flex items-end gap-2 max-w-[85%] sm:max-w-[75%]', isUser ? 'flex-row-reverse' : '']">
      <div
        :class="[
          'h-8 w-8 shrink-0 rounded-full flex items-center justify-center text-xs font-semibold',
          isUser ? 'bg-accent-500 text-white' : 'bg-brand-700 text-white',
        ]"
        :aria-label="isUser ? '你' : 'AI'"
      >
        {{ isUser ? '我' : 'AI' }}
      </div>
      <div
        :class="[
          'rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words shadow-soft',
          isUser
            ? 'bg-accent-500 text-white rounded-br-md'
            : 'bg-white text-ink-800 border border-ink-100 rounded-bl-md',
        ]"
      >
        <div>{{ message.content }}</div>
        <div
          v-if="message.audio_url"
          class="mt-2 flex items-center gap-1.5 text-xs"
          :class="isUser ? 'text-white/80' : 'text-brand-600'"
        >
          <svg viewBox="0 0 24 24" class="h-3.5 w-3.5" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
          语音回复
        </div>
        <div
          v-if="time"
          class="mt-1 text-[10px] tracking-wide"
          :class="isUser ? 'text-white/70' : 'text-ink-400'"
        >
          {{ time }}<span v-if="pending" class="ml-1">·发送中…</span>
        </div>
      </div>
    </div>
  </div>
</template>
