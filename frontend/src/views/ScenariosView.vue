<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { listScenarios } from '@/api/scenarios'
import type { Scenario, Difficulty } from '@/types/api'
import ScenarioCard from '@/components/ScenarioCard.vue'

const scenarios = ref<Scenario[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const search = ref('')
const difficulty = ref<Difficulty | 'all'>('all')

onMounted(async () => {
  loading.value = true
  try {
    scenarios.value = await listScenarios()
  } catch (e) {
    error.value = e instanceof Error ? e.message : '加载场景失败'
  } finally {
    loading.value = false
  }
})

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  return scenarios.value.filter((s) => {
    if (difficulty.value !== 'all' && s.difficulty !== difficulty.value) return false
    if (!q) return true
    return (
      s.title.toLowerCase().includes(q) ||
      (s.subtitle?.toLowerCase().includes(q) ?? false) ||
      (s.description?.toLowerCase().includes(q) ?? false) ||
      (s.tags?.some((t) => t.toLowerCase().includes(q)) ?? false)
    )
  })
})

const grouped = computed(() => {
  const order: Difficulty[] = ['beginner', 'intermediate', 'advanced']
  const groups: Record<string, Scenario[]> = {}
  for (const s of filtered.value) {
    const k = s.difficulty || 'other'
    if (!groups[k]) groups[k] = []
    groups[k].push(s)
  }
  return order
    .filter((d) => groups[d]?.length)
    .map((d) => ({ difficulty: d, items: groups[d] }))
})

const difficultyLabel = (d: Difficulty | string) => {
  switch (d) {
    case 'beginner': return '入门 · 简单短句'
    case 'intermediate': return '进阶 · 日常商务'
    case 'advanced': return '高阶 · 复杂话题'
    default: return '其他'
  }
}
</script>

<template>
  <section class="space-y-6">
    <header class="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
      <div>
        <h1 class="text-2xl sm:text-3xl font-bold text-ink-800">场景库</h1>
        <p class="text-sm text-ink-500 mt-1">选一个场景,开始一段对话练习</p>
      </div>
      <div class="flex gap-2 w-full sm:w-auto">
        <input
          v-model="search"
          type="text"
          placeholder="搜索场景…"
          class="input sm:w-64"
        />
        <select
          v-model="difficulty"
          class="input sm:w-36 cursor-pointer"
        >
          <option value="all">全部难度</option>
          <option value="beginner">入门</option>
          <option value="intermediate">进阶</option>
          <option value="advanced">高阶</option>
        </select>
      </div>
    </header>

    <div v-if="loading" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <div v-for="i in 6" :key="i" class="card p-5 animate-pulse h-40" />
    </div>
    <div v-else-if="error" class="card p-5 text-rose-600 text-sm">加载失败:{{ error }}</div>
    <div v-else-if="filtered.length === 0" class="card p-10 text-center text-ink-500">
      没有匹配的场景。换个关键词或难度试试。
    </div>

    <div v-else class="space-y-8">
      <div v-for="g in grouped" :key="g.difficulty">
        <h2 class="text-sm font-semibold text-ink-500 uppercase tracking-wider mb-3">
          {{ difficultyLabel(g.difficulty) }}
        </h2>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <ScenarioCard
            v-for="s in g.items"
            :key="s.id"
            :scenario="s"
          />
        </div>
      </div>
    </div>
  </section>
</template>
