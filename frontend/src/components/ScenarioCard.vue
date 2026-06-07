<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import type { Scenario } from '@/types/api'

const props = defineProps<{ scenario: Scenario; compact?: boolean }>()

const difficultyMeta = computed(() => {
  switch (props.scenario.difficulty) {
    case 'beginner':
      return { label: '入门', cls: 'bg-emerald-50 text-emerald-700' }
    case 'intermediate':
      return { label: '进阶', cls: 'bg-amber-50 text-amber-700' }
    case 'advanced':
      return { label: '高阶', cls: 'bg-rose-50 text-rose-700' }
    default:
      return { label: props.scenario.difficulty, cls: 'bg-ink-100 text-ink-700' }
  }
})
</script>

<template>
  <RouterLink
    :to="`/scenarios/${scenario.id}/preview`"
    class="card group p-4 sm:p-5 flex flex-col gap-3 hover:shadow-card hover:-translate-y-0.5
           transition-all duration-200"
  >
    <div class="flex items-start gap-3">
      <div
        class="h-11 w-11 shrink-0 rounded-xl bg-brand-50 text-brand-700 flex items-center
               justify-center text-2xl"
      >
        <span>{{ scenario.icon || '💬' }}</span>
      </div>
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-2 mb-0.5 flex-wrap">
          <h3 class="text-base sm:text-lg font-semibold text-ink-800 truncate">
            {{ scenario.title }}
          </h3>
          <span :class="['chip', difficultyMeta.cls]">{{ difficultyMeta.label }}</span>
        </div>
        <p v-if="scenario.subtitle" class="text-sm text-ink-500 truncate">
          {{ scenario.subtitle }}
        </p>
      </div>
    </div>

    <p
      v-if="!compact"
      class="text-sm text-ink-600 leading-relaxed line-clamp-3"
    >
      {{ scenario.description }}
    </p>

    <div class="flex items-center justify-between text-xs text-ink-500 mt-auto pt-1">
      <div class="flex items-center gap-3">
        <span v-if="scenario.estimated_minutes" class="inline-flex items-center gap-1">
          <svg viewBox="0 0 24 24" class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2" stroke-linecap="round"/></svg>
          {{ scenario.estimated_minutes }} 分钟
        </span>
        <span v-if="scenario.category">{{ scenario.category }}</span>
      </div>
      <span class="text-brand-600 group-hover:translate-x-0.5 transition-transform">查看 →</span>
    </div>
  </RouterLink>
</template>
