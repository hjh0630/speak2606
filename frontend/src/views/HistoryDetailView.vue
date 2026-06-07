<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { useRoute, RouterLink } from 'vue-router'
import { useHistoryStore } from '@/stores/history'
import MessageBubble from '@/components/MessageBubble.vue'
import ScoreCard from '@/components/ScoreCard.vue'

const route = useRoute()
const store = useHistoryStore()

const id = computed(() => route.params.id as string)

async function load() {
  if (!store.detail || store.detail.id !== id.value) {
    await store.fetchDetail(id.value)
  }
}

onMounted(load)
watch(id, load)

const session = computed(() => store.detail)
const scores = computed(() =>
  (session.value?.messages ?? [])
    .map((m) => m.score)
    .filter((s): s is NonNullable<typeof s> => Boolean(s)),
)
const overallScore = computed(() => {
  if (session.value?.total_score != null) return session.value.total_score
  if (session.value?.avg_score != null) return session.value.avg_score
  if (scores.value.length === 0) return 0
  return Math.round(
    scores.value.reduce((acc, s) => acc + (s.overall || 0), 0) / scores.value.length,
  )
})

const lastMessageScore = computed(() => {
  const msgs = session.value?.messages ?? []
  for (let i = msgs.length - 1; i >= 0; i--) {
    const s = msgs[i].score
    if (s) return s
  }
  return scores.value[scores.value.length - 1] ?? null
})

const startedAt = computed(() => {
  if (!session.value?.started_at) return ''
  try { return new Date(session.value.started_at).toLocaleString() } catch { return '' }
})
const endedAt = computed(() => {
  if (!session.value?.ended_at) return ''
  try { return new Date(session.value.ended_at).toLocaleString() } catch { return '' }
})
</script>

<template>
  <section class="space-y-4">
    <RouterLink to="/history" class="text-sm text-ink-500 hover:text-ink-700 inline-flex items-center gap-1">
      <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M15 6l-6 6 6 6"/></svg>
      返回历史
    </RouterLink>

    <div v-if="store.loading && !session" class="card p-6 animate-pulse h-40" />
    <div v-else-if="!session" class="card p-6 text-rose-600 text-sm">
      加载失败:{{ store.error || '未找到会话' }}
    </div>

    <template v-else>
      <div class="card p-5 sm:p-6">
        <div class="flex flex-col sm:flex-row sm:items-center gap-3">
          <div class="flex-1 min-w-0">
            <h1 class="text-xl sm:text-2xl font-bold text-ink-800">
              {{ session.scenario_title || '场景练习' }}
            </h1>
            <div class="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-500">
              <span class="chip bg-brand-50 text-brand-700">
                {{ session.mode === 'repeat' ? '跟读' : '自由' }}
              </span>
              <span class="chip bg-ink-100 text-ink-700">
                {{ session.difficulty === 'beginner' ? '入门' : session.difficulty === 'intermediate' ? '进阶' : '高阶' }}
              </span>
              <span v-if="startedAt">开始 {{ startedAt }}</span>
              <span v-if="endedAt">· 结束 {{ endedAt }}</span>
            </div>
            <p v-if="session.summary" class="text-sm text-ink-600 mt-3 leading-relaxed">
              {{ session.summary }}
            </p>
          </div>
          <div class="rounded-2xl bg-brand-50 text-brand-700 px-5 py-3 text-center min-w-[112px]">
            <div class="text-3xl font-bold leading-none">{{ Math.round(overallScore) }}</div>
            <div class="text-[11px] text-ink-500 mt-1">综合分</div>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
        <div class="card p-4 sm:p-6 space-y-3 max-h-[70vh] overflow-y-auto scrollbar-thin">
          <h2 class="text-sm font-semibold text-ink-500 uppercase tracking-wider mb-2">对话回放</h2>
          <MessageBubble
            v-for="m in (session.messages ?? [])"
            :key="m.id"
            :message="m"
          />
          <div v-if="!(session.messages && session.messages.length)" class="text-sm text-ink-500 text-center py-10">
            这条会话没有消息记录。
          </div>
        </div>

        <aside class="space-y-4">
          <ScoreCard :score="lastMessageScore" />
          <div v-if="scores.length > 1" class="card p-4 sm:p-5">
            <h3 class="text-sm font-semibold text-ink-800 mb-3">逐句评分</h3>
            <div class="flex items-end gap-1 h-20">
              <div
                v-for="(s, i) in scores"
                :key="i"
                class="flex-1 rounded-t bg-gradient-to-t from-brand-500 to-accent-500"
                :style="{ height: Math.max(6, s.overall || 0) + '%' }"
                :title="`第 ${i + 1} 句 · ${Math.round(s.overall || 0)} 分`"
              />
            </div>
            <div class="mt-2 text-[11px] text-ink-400">共 {{ scores.length }} 次评分</div>
          </div>
        </aside>
      </div>
    </template>
  </section>
</template>
