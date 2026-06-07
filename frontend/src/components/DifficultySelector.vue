<script setup lang="ts">
import type { Difficulty } from '@/types/api'

const props = defineProps<{ modelValue: Difficulty; size?: 'sm' | 'md' }>()
const emit = defineEmits<{ (e: 'update:modelValue', v: Difficulty): void }>()

const items: { value: Difficulty; label: string; desc: string }[] = [
  { value: 'beginner', label: '入门', desc: '简单短句,慢速对话' },
  { value: 'intermediate', label: '进阶', desc: '日常商务场景' },
  { value: 'advanced', label: '高阶', desc: '复杂表达与话题' },
]

function pick(v: Difficulty) {
  emit('update:modelValue', v)
}
</script>

<template>
  <div :class="['grid gap-2 sm:gap-3', size === 'sm' ? 'grid-cols-3' : 'grid-cols-1 sm:grid-cols-3']">
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
      @click="pick(i.value)"
    >
      <div class="flex items-center gap-2">
        <span
          :class="[
            'h-2.5 w-2.5 rounded-full',
            i.value === 'beginner' && 'bg-emerald-500',
            i.value === 'intermediate' && 'bg-amber-500',
            i.value === 'advanced' && 'bg-rose-500',
          ]"
        />
        <span class="text-sm font-semibold text-ink-800">{{ i.label }}</span>
      </div>
      <p v-if="size !== 'sm'" class="text-xs text-ink-500 mt-1">{{ i.desc }}</p>
    </button>
  </div>
</template>
