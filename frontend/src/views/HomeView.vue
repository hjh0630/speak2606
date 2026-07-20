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
    // Pull everything — we filter client-side into two cards + 6 featured
    // below.  The backend supports `?category=` & `?module=` query params
    // but at the moment we don't expose those (each call is the full list
    // of < 30 entries, which is fine).
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
          两大学习模块,适配外贸和纺织服装两类岗位。选一个场景,说一句英文,得到即时评分和纠错建议。
        </p>
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

    <!-- ───── 两大学习模块（核心入口） ───── -->
    <div>
      <div class="flex items-end justify-between mb-5">
        <div>
          <h2 class="text-xl sm:text-2xl font-semibold text-ink-800">选一个学习模块开始</h2>
          <p class="text-sm text-ink-500 mt-1">两块独立的内容线 · 选你今天要练的那个</p>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
        <!-- Block 1: 纺织服装全链条英语沟通 -->
        <RouterLink
          to="/scenarios?module=textile-apparel"
          class="group relative overflow-hidden rounded-2xl border border-brand-100 bg-gradient-to-br from-brand-50 via-white to-accent-50 p-6 sm:p-8
                 hover:shadow-card hover:border-brand-300 transition-all"
        >
          <div class="absolute -top-12 -right-12 h-40 w-40 rounded-full bg-brand-200/40 blur-2xl pointer-events-none" />
          <div class="relative">
            <div class="flex items-center gap-2">
              <span class="chip border-brand-200 bg-white text-brand-700">模块 1</span>
              <span class="text-xs text-ink-500">基于 90.英文学习知识库</span>
            </div>
            <h3 class="mt-3 text-xl sm:text-2xl font-bold text-ink-900 leading-tight">
              纺织服装<br class="sm:hidden" />全链条英语沟通
            </h3>
            <p class="mt-2 text-sm text-ink-600 leading-relaxed">
              纺纱 → 织造 → 染整 → 服装 → 工艺 → 品控 → 运动 7 大场景。
              每类带客户-工厂真实对话、专业术语、报价 / ΔE / AQL 等实战关键句。
            </p>
            <div class="mt-4 flex flex-wrap gap-1.5">
              <span class="chip bg-white border border-ink-100 text-ink-600 text-[11px]">纺纱 Spinning</span>
              <span class="chip bg-white border border-ink-100 text-ink-600 text-[11px]">织造 Weaving</span>
              <span class="chip bg-white border border-ink-100 text-ink-600 text-[11px]">染整 Dyeing</span>
              <span class="chip bg-white border border-ink-100 text-ink-600 text-[11px]">服装 Garment</span>
              <span class="chip bg-white border border-ink-100 text-ink-600 text-[11px]">工艺 Crafts</span>
              <span class="chip bg-white border border-ink-100 text-ink-600 text-[11px]">品控 QC</span>
              <span class="chip bg-white border border-ink-100 text-ink-600 text-[11px]">运动 Sportswear</span>
            </div>
            <div class="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 group-hover:text-brand-800">
              进入纺织服装模块
              <svg viewBox="0 0 24 24" class="h-4 w-4 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </div>
          </div>
        </RouterLink>

        <!-- Block 2: 外贸英语口语（现有内容） -->
        <RouterLink
          to="/scenarios?module=foreign-trade"
          class="group relative overflow-hidden rounded-2xl border border-accent-100 bg-gradient-to-br from-accent-50 via-white to-brand-50 p-6 sm:p-8
                 hover:shadow-card hover:border-accent-300 transition-all"
        >
          <div class="absolute -top-12 -right-12 h-40 w-40 rounded-full bg-accent-200/40 blur-2xl pointer-events-none" />
          <div class="relative">
            <div class="flex items-center gap-2">
              <span class="chip border-accent-200 bg-white text-accent-700">模块 2</span>
              <span class="text-xs text-ink-500">20+ 真实业务场景</span>
            </div>
            <h3 class="mt-3 text-xl sm:text-2xl font-bold text-ink-900 leading-tight">
              外贸英语口语
            </h3>
            <p class="mt-2 text-sm text-ink-600 leading-relaxed">
              电话会议 / 询盘报价 / 验厂 / 物流 / 索赔 / 信用证 / 展会 ——
              覆盖外贸业务员全岗位实战。
            </p>
            <div class="mt-4 flex flex-wrap gap-1.5">
              <span class="chip bg-white border border-ink-100 text-ink-600 text-[11px]">📞 电话会议</span>
              <span class="chip bg-white border border-ink-100 text-ink-600 text-[11px]">💼 询盘报价</span>
              <span class="chip bg-white border border-ink-100 text-ink-600 text-[11px]">🏭 验厂</span>
              <span class="chip bg-white border border-ink-100 text-ink-600 text-[11px]">🚢 物流单证</span>
              <span class="chip bg-white border border-ink-100 text-ink-600 text-[11px]">⚖️ 索赔</span>
              <span class="chip bg-white border border-ink-100 text-ink-600 text-[11px]">📑 信用证</span>
              <span class="chip bg-white border border-ink-100 text-ink-600 text-[11px]">💰 催款</span>
            </div>
            <div class="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-accent-700 group-hover:text-accent-800">
              进入外贸口语模块
              <svg viewBox="0 0 24 24" class="h-4 w-4 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </div>
          </div>
        </RouterLink>
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
          <div class="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-xl">📚</div>
          <h3 class="mt-3 text-base font-semibold text-ink-800">生词本 + 生图分享</h3>
          <p class="mt-1 text-sm text-ink-500 leading-relaxed">选词即收,难度打分,挑词导出图片分享。</p>
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
