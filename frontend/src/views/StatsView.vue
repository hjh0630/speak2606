<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { useHistoryStore } from '@/stores/history'

const store = useHistoryStore()

onMounted(() => {
  if (!store.stats) store.fetchStats()
})

const stats = computed(() => store.stats)
const hasData = computed(() => Boolean(stats.value && stats.value.total_sessions > 0))

const totalTrend = computed(() => stats.value?.trend?.length ?? 0)

const TREND_WIDTH = 60 // horizontal spacing per data point

function pathY(score: number): number {
  return 200 - ((score || 0) / 100) * 200
}
const trendLinePath = computed(() => {
  const t = stats.value?.trend ?? []
  if (t.length === 0) return ''
  return t
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${i * TREND_WIDTH + 30} ${pathY(p.avg_score)}`)
    .join(' ')
})
const trendAreaPath = computed(() => {
  const t = stats.value?.trend ?? []
  if (t.length === 0) return ''
  const last = (t.length - 1) * TREND_WIDTH + 30
  const top = t
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${i * TREND_WIDTH + 30} ${pathY(p.avg_score)}`)
    .join(' ')
  return `${top} L ${last} 200 L 30 200 Z`
})
</script>

<template>
  <section class="space-y-5">
    <header>
      <h1 class="text-2xl sm:text-3xl font-bold text-ink-800">学习统计</h1>
      <p class="text-sm text-ink-500 mt-1">看看你这一段时间的练习情况</p>
    </header>

    <div v-if="store.statsLoading && !stats" class="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <div v-for="i in 4" :key="i" class="card p-5 animate-pulse h-24" />
    </div>

    <div v-else-if="!stats" class="card p-10 text-center text-ink-500">
      暂无统计数据。
      <RouterLink to="/scenarios" class="btn-primary mt-4 inline-flex">开始练习</RouterLink>
    </div>

    <template v-else>
      <!-- KPIs -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div class="card p-4 sm:p-5">
          <div class="text-xs text-ink-500">总练习次数</div>
          <div class="text-2xl sm:text-3xl font-bold text-ink-800 mt-1">{{ stats.total_sessions }}</div>
        </div>
        <div class="card p-4 sm:p-5">
          <div class="text-xs text-ink-500">总消息数</div>
          <div class="text-2xl sm:text-3xl font-bold text-ink-800 mt-1">{{ stats.total_messages }}</div>
        </div>
        <div class="card p-4 sm:p-5">
          <div class="text-xs text-ink-500">平均分</div>
          <div class="text-2xl sm:text-3xl font-bold text-brand-700 mt-1">{{ Math.round(stats.average_score) }}</div>
        </div>
        <div class="card p-4 sm:p-5">
          <div class="text-xs text-ink-500">练习时长</div>
          <div class="text-2xl sm:text-3xl font-bold text-accent-600 mt-1">{{ Math.round(stats.practice_minutes ?? 0) }}<span class="text-base text-ink-400 ml-0.5">分</span></div>
        </div>
      </div>

      <!-- Growth curve -->
      <div class="card p-5 sm:p-6">
        <div class="flex items-center justify-between mb-3">
          <h2 class="text-base font-semibold text-ink-800">成长曲线</h2>
          <span class="text-xs text-ink-500">最近 {{ totalTrend }} 天</span>
        </div>
        <div v-if="totalTrend === 0" class="text-sm text-ink-500 py-6 text-center">
          暂时还没有成长数据。
        </div>
        <div v-else class="relative h-44 sm:h-56">
          <svg
            class="absolute inset-0 w-full h-full overflow-visible"
            :viewBox="`0 0 ${totalTrend * 60} 200`"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="area" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stop-color="#3a5cf2" stop-opacity="0.3" />
                <stop offset="1" stop-color="#3a5cf2" stop-opacity="0" />
              </linearGradient>
            </defs>
            <line
              v-for="g in [0, 25, 50, 75, 100]"
              :key="g"
              :x1="0" :x2="totalTrend * 60" :y1="200 - g * 2" :y2="200 - g * 2"
              stroke="#eef0f4" stroke-dasharray="2 3"
            />
            <path :d="trendAreaPath" fill="url(#area)" />
            <path
              :d="trendLinePath"
              fill="none" stroke="#3a5cf2" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"
            />
            <g>
              <circle
                v-for="(p, i) in stats.trend"
                :key="i"
                :cx="i * 60 + 30"
                :cy="200 - ((p.avg_score || 0) / 100) * 200"
                r="3.5"
                fill="#fff"
                stroke="#3a5cf2"
                stroke-width="2"
              />
            </g>
          </svg>
          <div class="absolute inset-x-0 -bottom-1 flex justify-between text-[10px] text-ink-400">
            <span v-if="stats.trend[0]">{{ stats.trend[0].date }}</span>
            <span v-if="stats.trend[stats.trend.length - 1]">{{ stats.trend[stats.trend.length - 1].date }}</span>
          </div>
        </div>
      </div>

      <!-- By scenario -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div class="card p-5 sm:p-6">
          <h2 class="text-base font-semibold text-ink-800 mb-3">按场景分布</h2>
          <ul v-if="(stats.by_scenario || []).length" class="space-y-2.5">
            <li
              v-for="row in stats.by_scenario"
              :key="row.scenario_id"
              class="flex items-center gap-3"
            >
              <div class="flex-1 min-w-0">
                <div class="text-sm font-medium text-ink-800 truncate">{{ row.scenario_title }}</div>
                <div class="mt-1 h-1.5 rounded-full bg-ink-100 overflow-hidden">
                  <div
                    class="h-full bg-gradient-to-r from-brand-500 to-accent-500"
                    :style="{ width: Math.min(100, row.avg_score) + '%' }"
                  />
                </div>
              </div>
              <div class="text-right text-xs text-ink-500 shrink-0 w-20">
                <div class="text-sm font-semibold text-ink-800">{{ Math.round(row.avg_score) }} 分</div>
                <div>{{ row.count }} 次</div>
              </div>
            </li>
          </ul>
          <p v-else class="text-sm text-ink-500">暂无场景数据</p>
        </div>

        <div class="card p-5 sm:p-6">
          <h2 class="text-base font-semibold text-ink-800 mb-3">按难度分布</h2>
          <ul v-if="(stats.by_difficulty || []).length" class="space-y-2.5">
            <li
              v-for="row in stats.by_difficulty"
              :key="row.difficulty"
              class="flex items-center gap-3"
            >
              <div class="flex-1 min-w-0">
                <div class="text-sm font-medium text-ink-800">
                  {{ row.difficulty === 'beginner' ? '入门' : row.difficulty === 'intermediate' ? '进阶' : '高阶' }}
                </div>
                <div class="mt-1 h-1.5 rounded-full bg-ink-100 overflow-hidden">
                  <div
                    class="h-full bg-gradient-to-r from-brand-500 to-accent-500"
                    :style="{ width: Math.min(100, row.avg_score) + '%' }"
                  />
                </div>
              </div>
              <div class="text-right text-xs text-ink-500 shrink-0 w-20">
                <div class="text-sm font-semibold text-ink-800">{{ Math.round(row.avg_score) }} 分</div>
                <div>{{ row.count }} 次</div>
              </div>
            </li>
          </ul>
          <p v-else class="text-sm text-ink-500">暂无难度数据</p>
        </div>
      </div>

      <div v-if="!hasData" class="card p-5 sm:p-6 text-center text-ink-500 text-sm">
        数据有了变化,刷新看看?
      </div>
    </template>
  </section>
</template>
