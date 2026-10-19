<script setup lang="ts">
import { computed } from 'vue'
import type { ScoreFeedback } from '@/types/api'

const props = defineProps<{ score: ScoreFeedback | null; compact?: boolean }>()

const overall = computed(() => props.score?.overall ?? 0)
const tone = computed(() => {
  const v = overall.value
  if (v >= 85) return { color: 'text-emerald-600', bg: 'bg-emerald-50', label: '优秀' }
  if (v >= 70) return { color: 'text-brand-700', bg: 'bg-brand-50', label: '良好' }
  if (v >= 55) return { color: 'text-amber-600', bg: 'bg-amber-50', label: '继续加油' }
  return { color: 'text-rose-600', bg: 'bg-rose-50', label: '需要练习' }
})

interface SubItem { key: string; label: string; value: number | undefined }
const subItems = computed<SubItem[]>(() => {
  if (!props.score) return []
  return [
    { key: 'pronunciation', label: '发音', value: props.score.pronunciation },
    { key: 'fluency', label: '流利度', value: props.score.fluency },
    { key: 'grammar', label: '语法', value: props.score.grammar },
    { key: 'vocabulary', label: '用词', value: props.score.vocabulary },
    { key: 'relevance', label: '相关度', value: props.score.relevance },
  ].filter((i) => typeof i.value === 'number')
})
</script>

<template>
  <div v-if="score" class="card p-4 sm:p-5 animate-slide-up">
    <div class="flex items-center gap-4">
      <div :class="['rounded-2xl p-3 text-center min-w-[88px]', tone.bg]">
        <div :class="['text-3xl font-bold leading-none', tone.color]">{{ Math.round(overall) }}</div>
        <div class="text-[11px] text-ink-500 mt-1">总分</div>
      </div>
      <div class="flex-1 min-w-0">
        <div class="text-sm font-semibold text-ink-800">本轮评分</div>
        <div :class="['text-xs mt-0.5', tone.color]">{{ tone.label }}</div>
        <div v-if="!compact" class="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-2">
          <div
            v-for="s in subItems"
            :key="s.key"
            class="rounded-lg bg-ink-50 px-2.5 py-1.5"
          >
            <div class="text-[10px] text-ink-500">{{ s.label }}</div>
            <div class="text-sm font-semibold text-ink-800">{{ Math.round(s.value ?? 0) }}</div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="score.key_issues && score.key_issues.length" class="mt-4">
      <div class="text-xs font-semibold text-ink-500 uppercase tracking-wider mb-1.5">关键问题</div>
      <ul class="text-sm text-ink-700 space-y-1 list-disc pl-5">
        <li v-for="(k, i) in score.key_issues" :key="i">{{ k }}</li>
      </ul>
    </div>

    <div v-if="score.suggestions && score.suggestions.length" class="mt-4">
      <div class="text-xs font-semibold text-ink-500 uppercase tracking-wider mb-1.5">改进建议</div>
      <ul class="text-sm text-ink-700 space-y-1 list-disc pl-5">
        <li v-for="(s, i) in score.suggestions" :key="i">{{ s }}</li>
      </ul>
    </div>

    <div v-if="score.native_polish" class="mt-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-ink-800">
      <div class="flex items-center gap-1.5 text-xs font-bold text-emerald-700 uppercase tracking-wider mb-1">
        <span>✨ 母语老兵地道重构 (Native Polish)</span>
      </div>
      <p class="text-sm font-semibold text-emerald-950 leading-snug">
        {{ score.native_polish }}
      </p>
    </div>
  </div>
  <div v-else class="card p-4 text-sm text-ink-500">尚无评分,先说一句话试试看。</div>
</template>
