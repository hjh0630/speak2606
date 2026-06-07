<script setup lang="ts">
import type { PracticeMode } from '@/types/api'

const props = defineProps<{ modelValue: PracticeMode; size?: 'sm' | 'md' }>()
const emit = defineEmits<{ (e: 'update:modelValue', v: PracticeMode): void }>()

const items: { value: PracticeMode; label: string; desc: string; icon: string }[] = [
  { value: 'free', label: '自由对话', desc: '和 AI 围绕场景自由交流', icon: '💬' },
  { value: 'repeat', label: '跟读练习', desc: '听一句、跟一句、逐句评分', icon: '🎯' },
]
</script>

<template>
  <div class="grid gap-2 sm:gap-3 grid-cols-1 sm:grid-cols-2">
    <button
      v-for="i in items"
      :key="i.value"
      type="button"
      :class="[
        'text-left rounded-2xl border transition-all duration-150',
        size === 'sm' ? 'px-3 py-2' : 'px-4 py-3',
        props.modelValue === i.value
          ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-100 shadow-soft'
          : 'border-ink-200 bg-white hover:border-ink-300',
      ]"
      @click="emit('update:modelValue', i.value)"
    >
      <div class="flex items-center gap-2">
        <span class="text-base">{{ i.icon }}</span>
        <span class="text-sm font-semibold text-ink-800">{{ i.label }}</span>
      </div>
      <p v-if="size !== 'sm'" class="text-xs text-ink-500 mt-1">{{ i.desc }}</p>
    </button>
  </div>
</template>
