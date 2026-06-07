<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { useHistoryStore } from '@/stores/history'

const store = useHistoryStore()

onMounted(() => {
  if (store.items.length === 0) store.fetchList()
})

function fmtTime(s: string | number | undefined): string {
  if (s == null) return ''
  try {
    const d = new Date(s)
    if (Number.isNaN(d.getTime())) return String(s)
    return d.toLocaleString([], { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
  } catch {
    return String(s)
  }
}

const diffLabel = (d?: string) =>
  d === 'beginner' ? '入门' : d === 'intermediate' ? '进阶' : d === 'advanced' ? '高阶' : '—'
const modeLabel = (m?: string) => (m === 'repeat' ? '跟读' : '自由')

const items = computed(() => store.items)
</script>

<template>
  <section class="space-y-5">
    <header class="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
      <div>
        <h1 class="text-2xl sm:text-3xl font-bold text-ink-800">历史记录</h1>
        <p class="text-sm text-ink-500 mt-1">回顾每一次练习,找到可以改进的地方</p>
      </div>
      <div class="text-sm text-ink-500">共 {{ store.total }} 次会话</div>
    </header>

    <div v-if="store.loading && items.length === 0" class="space-y-3">
      <div v-for="i in 3" :key="i" class="card p-4 animate-pulse h-24" />
    </div>

    <div v-else-if="store.error" class="card p-5 text-rose-600 text-sm">
      加载失败:{{ store.error }}
    </div>

    <div v-else-if="items.length === 0" class="card p-10 text-center text-ink-500">
      <div class="text-4xl mb-2">📭</div>
      <p>还没有练习记录。</p>
      <RouterLink to="/scenarios" class="btn-primary mt-4 inline-flex">开始第一次练习</RouterLink>
    </div>

    <ul v-else class="space-y-3">
      <li v-for="s in items" :key="s.id">
        <RouterLink
          :to="`/history/${s.id}`"
          class="card p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3 hover:shadow-card transition-shadow"
        >
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <h3 class="text-base font-semibold text-ink-800 truncate">
                {{ s.scenario_title || '场景' }}
              </h3>
              <span class="chip bg-brand-50 text-brand-700">{{ modeLabel(s.mode) }}</span>
              <span class="chip bg-ink-100 text-ink-700">{{ diffLabel(s.difficulty) }}</span>
            </div>
            <p class="text-xs text-ink-500 mt-1">
              {{ fmtTime(s.started_at) }} · {{ s.messages?.length || 0 }} 条消息
            </p>
            <p v-if="s.summary" class="text-sm text-ink-600 mt-2 line-clamp-2">{{ s.summary }}</p>
          </div>
          <div class="flex sm:flex-col items-end sm:items-center gap-1 sm:gap-0">
            <div class="text-2xl font-bold text-brand-700 leading-none">
              {{ Math.round(s.total_score ?? s.avg_score ?? 0) }}
            </div>
            <div class="text-[10px] text-ink-400 mt-1">综合分</div>
          </div>
        </RouterLink>
      </li>
    </ul>
  </section>
</template>
