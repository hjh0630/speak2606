<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { listScenarios } from '@/api/scenarios'
import { useHistoryStore } from '@/stores/history'
import type { Scenario } from '@/types/api'
import ScenarioCard from '@/components/ScenarioCard.vue'

const historyStore = useHistoryStore()

const scenarios = ref<Scenario[]>([])
const loading = ref(true)
const error = ref<string | null>(null)

onMounted(async () => {
  loading.value = true
  try {
    scenarios.value = (await listScenarios()).slice(0, 6)
  } catch (e) {
    error.value = e instanceof Error ? e.message : '加载场景失败'
  } finally {
    loading.value = false
  }
  historyStore.fetchStats().catch(() => undefined)
})

const totalSessions = computed(() => historyStore.stats?.total_sessions ?? 0)
const avgScore = computed(() => historyStore.stats?.average_score ?? 0)
</script>

<template>
  <section class="space-y-12 sm:space-y-16">
    <!-- Hero -->
    <div class="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-900 via-brand-700 to-brand-500 text-white p-6 sm:p-12">
      <div class="absolute inset-0 opacity-30 pointer-events-none" aria-hidden="true">
        <div class="absolute -top-20 -right-20 h-72 w-72 rounded-full bg-accent-500 blur-3xl" />
        <div class="absolute -bottom-20 -left-20 h-72 w-72 rounded-full bg-brand-300 blur-3xl" />
      </div>
      <div class="relative max-w-2xl">
        <span class="chip bg-white/15 text-white border border-white/20 mb-4">英语口语练习</span>
        <h1 class="text-3xl sm:text-5xl font-bold leading-tight tracking-tight">
          用真实场景,<br class="sm:hidden" />练出能用的英语。
        </h1>
        <p class="mt-4 text-white/85 text-base sm:text-lg leading-relaxed max-w-xl">
          选一个场景,说一句英文,得到即时评分和纠错建议。AI 对练 + 跟读两种模式,适配你的节奏。
        </p>
        <div class="mt-6 flex flex-wrap gap-3">
          <RouterLink to="/scenarios" class="btn-accent">
            开始练习
            <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
          </RouterLink>
          <RouterLink to="/history" class="btn bg-white/10 text-white border border-white/20 hover:bg-white/15">
            查看历史
          </RouterLink>
        </div>

        <div v-if="totalSessions > 0" class="mt-6 flex items-center gap-5 text-sm text-white/80">
          <div>
            <span class="text-2xl font-semibold text-white">{{ totalSessions }}</span> 次练习
          </div>
          <div>
            <span class="text-2xl font-semibold text-white">{{ Math.round(avgScore) }}</span> 平均分
          </div>
        </div>
      </div>
    </div>

    <!-- Why -->
    <div>
      <h2 class="text-xl sm:text-2xl font-semibold text-ink-800 mb-5">为什么选 SpeakFlow</h2>
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div class="card p-5">
          <div class="h-10 w-10 rounded-xl bg-brand-50 text-brand-700 flex items-center justify-center text-xl">🎙</div>
          <h3 class="mt-3 text-base font-semibold text-ink-800">真实语音交互</h3>
          <p class="mt-1 text-sm text-ink-500 leading-relaxed">浏览器原生录音,说话即评分,告别手动打字。</p>
        </div>
        <div class="card p-5">
          <div class="h-10 w-10 rounded-xl bg-accent-50 text-accent-600 flex items-center justify-center text-xl">🎯</div>
          <h3 class="mt-3 text-base font-semibold text-ink-800">场景化练习</h3>
          <p class="mt-1 text-sm text-ink-500 leading-relaxed">从客户拜访到产品发布,贴近真实商务情境。</p>
        </div>
        <div class="card p-5">
          <div class="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-xl">📈</div>
          <h3 class="mt-3 text-base font-semibold text-ink-800">可视化进步</h3>
          <p class="mt-1 text-sm text-ink-500 leading-relaxed">逐句评分、成长曲线、问题归因,看得到提升。</p>
        </div>
      </div>
    </div>

    <!-- Featured scenarios -->
    <div>
      <div class="flex items-end justify-between mb-5">
        <div>
          <h2 class="text-xl sm:text-2xl font-semibold text-ink-800">推荐场景</h2>
          <p class="text-sm text-ink-500 mt-1">挑一个开始今天的练习</p>
        </div>
        <RouterLink to="/scenarios" class="text-sm text-brand-700 hover:text-brand-800 font-medium">查看全部 →</RouterLink>
      </div>

      <div v-if="loading" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div v-for="i in 6" :key="i" class="card p-5 animate-pulse">
          <div class="h-11 w-11 rounded-xl bg-ink-100" />
          <div class="mt-3 h-4 w-2/3 rounded bg-ink-100" />
          <div class="mt-2 h-3 w-full rounded bg-ink-100" />
          <div class="mt-1 h-3 w-5/6 rounded bg-ink-100" />
        </div>
      </div>

      <div v-else-if="error" class="card p-5 text-sm text-rose-600">
        加载失败:{{ error }}
      </div>

      <div v-else-if="scenarios.length === 0" class="card p-8 text-center text-ink-500">
        还没有场景。快去
        <RouterLink to="/scenarios" class="text-brand-700 font-medium">场景库</RouterLink>
        看看。
      </div>

      <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <ScenarioCard
          v-for="s in scenarios"
          :key="s.id"
          :scenario="s"
        />
      </div>
    </div>
  </section>
</template>
