<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import { listScenarios } from '@/api/scenarios'
import type { Scenario, Difficulty } from '@/types/api'
import { useCustomScenariosStore } from '@/stores/customScenarios'
import ScenarioCard from '@/components/ScenarioCard.vue'

type ModuleKey = 'foreign-trade' | 'textile-apparel' | 'all'

const customStore = useCustomScenariosStore()

function formatTime(t: string | number): string {
  const d = new Date(t)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('zh-CN')
}

const scenarios = ref<Scenario[]>([])
const loading = ref(true)
const error = ref<string | null>(null)
const search = ref('')
const difficulty = ref<Difficulty | 'all'>('all')
const moduleFilter = ref<ModuleKey>('all')

const route = useRoute()
const router = useRouter()

// Sync the module filter from the `?module=` query param so deep links
// from the HomeView module cards land on the right filtered list.
function syncFromQuery(): void {
  const raw = (route.query.module as string | undefined) ?? ''
  if (raw === 'foreign-trade' || raw === 'textile-apparel') {
    moduleFilter.value = raw
  } else if (!moduleFilter.value || moduleFilter.value === 'all') {
    // Leave the existing state alone if the URL has no module param —
    // a route change within the page shouldn't reset a user-chosen filter.
  }
}

onMounted(async () => {
  syncFromQuery()
  loading.value = true
  try {
    scenarios.value = await listScenarios()
  } catch (e) {
    error.value = e instanceof Error ? e.message : '加载场景失败'
  } finally {
    loading.value = false
  }
})

watch(() => route.query.module, syncFromQuery)

function setModule(m: ModuleKey): void {
  moduleFilter.value = m
  // Reflect the choice back into the URL so deep-links and back/forward
  // navigation behave correctly.  Use `replace` to avoid polluting history
  // when the user toggles chips.
  const query = { ...route.query }
  if (m === 'all') delete query.module
  else query.module = m
  router.replace({ path: route.path, query })
}

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  return scenarios.value.filter((s) => {
    if (moduleFilter.value !== 'all' && s.module !== moduleFilter.value) return false
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

const moduleLabel = (m: ModuleKey): string => {
  switch (m) {
    case 'foreign-trade': return '外贸英语口语'
    case 'textile-apparel': return '纺织服装全链条'
    case 'all': return '全部模块'
  }
}
</script>

<template>
  <section class="space-y-6">
    <header class="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
      <div>
        <h1 class="text-2xl sm:text-3xl font-bold text-ink-800">场景库</h1>
        <p class="text-sm text-ink-500 mt-1">
          当前模块:
          <span class="font-medium text-ink-700">{{ moduleLabel(moduleFilter) }}</span>
          · {{ filtered.length }} / {{ scenarios.length }} 个场景
        </p>
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

    <!-- 我的场景(自定义,保存在本机) -->
    <div class="rounded-2xl border border-dashed border-brand-200 bg-brand-50/40 p-5 sm:p-6">
      <div class="flex items-end justify-between mb-4">
        <div>
          <h2 class="text-base sm:text-lg font-semibold text-ink-800">我的场景</h2>
          <p class="text-xs text-ink-500 mt-0.5">AI 生成的自定义场景 · 保存在本机浏览器</p>
        </div>
        <RouterLink to="/custom-scenario" class="text-sm text-brand-700 hover:text-brand-800 font-medium shrink-0">
          + 创建新场景
        </RouterLink>
      </div>

      <div v-if="customStore.items.length === 0" class="flex flex-col sm:flex-row items-center justify-between gap-3">
        <p class="text-sm text-ink-500">
          还没有自定义场景。输入名称和关键词,让 AI 生成一套专属练习内容。
        </p>
        <RouterLink to="/custom-scenario" class="btn-accent shrink-0 text-sm">去创建</RouterLink>
      </div>

      <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <RouterLink
          v-for="s in customStore.items"
          :key="s.id"
          :to="`/scenarios/${s.id}/preview`"
          class="card group p-4 sm:p-5 flex flex-col gap-3 hover:shadow-card hover:-translate-y-0.5
                 transition-all duration-200"
        >
          <div class="flex items-start gap-3">
            <div class="h-11 w-11 shrink-0 rounded-xl bg-brand-50 text-brand-700 flex items-center justify-center text-2xl">
              ✨
            </div>
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2 mb-0.5 flex-wrap">
                <h3 class="text-base font-semibold text-ink-800 truncate">{{ s.title_zh || s.name }}</h3>
                <span class="chip bg-brand-50 text-brand-700">自定义</span>
              </div>
              <p v-if="s.title_en" class="text-xs text-ink-500 truncate">{{ s.title_en }}</p>
            </div>
          </div>
          <div class="flex flex-wrap gap-1.5">
            <span
              v-for="k in s.keywords"
              :key="k"
              class="chip bg-ink-100 text-ink-600 text-[11px]"
            >{{ k }}</span>
          </div>
          <div class="flex items-center justify-between text-xs text-ink-500 mt-auto pt-1">
            <span>{{ formatTime(s.created_at) }}</span>
            <span class="text-brand-600 group-hover:translate-x-0.5 transition-transform">开始练习 →</span>
          </div>
        </RouterLink>
      </div>
    </div>

    <!-- Module filter chips -->
    <div class="flex flex-wrap items-center gap-2">
      <button
        type="button"
        :class="[
          'chip cursor-pointer transition-colors',
          moduleFilter === 'all'
            ? 'bg-ink-800 text-white border-ink-800'
            : 'bg-white text-ink-600 border-ink-200 hover:bg-ink-100',
        ]"
        @click="setModule('all')"
      >
        全部模块
        <span class="ml-1 text-[10px] opacity-70">{{ scenarios.length }}</span>
      </button>
      <button
        type="button"
        :class="[
          'chip cursor-pointer transition-colors',
          moduleFilter === 'textile-apparel'
            ? 'bg-brand-700 text-white border-brand-700'
            : 'bg-white text-ink-600 border-ink-200 hover:bg-brand-50',
        ]"
        @click="setModule('textile-apparel')"
      >
        🧵 纺织服装全链条
        <span class="ml-1 text-[10px] opacity-70">
          {{ scenarios.filter((s) => s.module === 'textile-apparel').length }}
        </span>
      </button>
      <button
        type="button"
        :class="[
          'chip cursor-pointer transition-colors',
          moduleFilter === 'foreign-trade'
            ? 'bg-accent-600 text-white border-accent-600'
            : 'bg-white text-ink-600 border-ink-200 hover:bg-accent-50',
        ]"
        @click="setModule('foreign-trade')"
      >
        💼 外贸英语口语
        <span class="ml-1 text-[10px] opacity-70">
          {{ scenarios.filter((s) => s.module === 'foreign-trade').length }}
        </span>
      </button>
    </div>

    <div v-if="loading" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <div v-for="i in 6" :key="i" class="card p-5 animate-pulse h-40" />
    </div>
    <div v-else-if="error" class="card p-5 text-rose-600 text-sm">加载失败:{{ error }}</div>
    <div v-else-if="filtered.length === 0" class="card p-10 text-center text-ink-500">
      没有匹配的场景。换个关键词、难度或模块试试。
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
