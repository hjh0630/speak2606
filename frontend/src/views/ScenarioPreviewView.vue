<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import { getScenario } from '@/api/scenarios'
import type { CustomScenario, PracticeMode, Scenario } from '@/types/api'
import { useUserStore } from '@/stores/user'
import { useSessionStore } from '@/stores/session'
import { useCustomScenariosStore } from '@/stores/customScenarios'
import DifficultySelector from '@/components/DifficultySelector.vue'
import ModeSelector from '@/components/ModeSelector.vue'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const sessionStore = useSessionStore()
const customStore = useCustomScenariosStore()

const scenario = ref<Scenario | null>(null)
/** The raw AI-generated payload, when the route id starts with "custom-".
 *  Passed through to startSession → POST /api/sessions as custom_scenario. */
const customScenario = ref<CustomScenario | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)
const difficulty = ref(userStore.defaultDifficulty)
const mode = ref<PracticeMode>(userStore.defaultMode)
const starting = ref(false)

// Adapt a locally-stored CustomScenario into the Scenario shape this page
// renders (title / description / roles / goals chips).
function customToScenario(cs: CustomScenario): Scenario {
  return {
    id: cs.id,
    title: cs.title_zh || cs.name,
    subtitle: cs.title_en,
    description: cs.description_zh || cs.description_en,
    difficulty: 'beginner',
    difficulty_levels: ['beginner', 'intermediate', 'advanced'],
    category: '自定义',
    roles: { ai: 'AI 对话伙伴', user: '你' },
    goals: (cs.vocabulary ?? []).slice(0, 6).map((v) => v.term),
    icon: '✨',
    tags: cs.keywords,
  }
}

async function load() {
  loading.value = true
  error.value = null
  customScenario.value = null
  try {
    const id = route.params.id as string
    if (id.startsWith('custom-')) {
      const cs = customStore.getById(id)
      if (!cs) throw new Error('自定义场景不存在或已被删除')
      customScenario.value = cs
      scenario.value = customToScenario(cs)
    } else {
      scenario.value = await getScenario(id)
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : '加载失败'
  } finally {
    loading.value = false
  }
}

onMounted(load)
watch(() => route.params.id, load)

const difficultyMeta = computed(() => {
  switch (difficulty.value) {
    case 'beginner': return { label: '入门', cls: 'bg-emerald-50 text-emerald-700' }
    case 'intermediate': return { label: '进阶', cls: 'bg-amber-50 text-amber-700' }
    case 'advanced': return { label: '高阶', cls: 'bg-rose-50 text-rose-700' }
    default: return { label: difficulty.value, cls: 'bg-ink-100 text-ink-700' }
  }
})

async function start() {
  if (!scenario.value || starting.value) return
  starting.value = true
  try {
    const s = await sessionStore.startSession({
      scenarioId: scenario.value.id,
      mode: mode.value,
      difficulty: difficulty.value,
      customScenario: customScenario.value ?? undefined,
    })
    router.push({ name: 'practice', params: { id: s.id } })
  } catch (e) {
    // store already populated errorMessage
  } finally {
    starting.value = false
  }
}
</script>

<template>
  <section class="space-y-6">
    <RouterLink to="/scenarios" class="text-sm text-ink-500 hover:text-ink-700 inline-flex items-center gap-1">
      <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M15 6l-6 6 6 6"/></svg>
      返回场景列表
    </RouterLink>

    <div v-if="loading" class="card p-8 animate-pulse h-64" />
    <div v-else-if="error" class="card p-8 text-rose-600">加载失败:{{ error }}</div>

    <template v-else-if="scenario">
      <div class="card p-6 sm:p-8">
        <div class="flex items-start gap-4">
          <div class="h-14 w-14 rounded-2xl bg-brand-50 text-brand-700 flex items-center justify-center text-3xl">
            {{ scenario.icon || '💬' }}
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <h1 class="text-2xl sm:text-3xl font-bold text-ink-800">{{ scenario.title }}</h1>
              <span :class="['chip', difficultyMeta.cls]">{{ difficultyMeta.label }}</span>
              <span v-if="scenario.category" class="chip bg-ink-100 text-ink-600">{{ scenario.category }}</span>
            </div>
            <p v-if="scenario.subtitle" class="text-ink-500 mt-1">{{ scenario.subtitle }}</p>
          </div>
        </div>

        <p class="mt-5 text-ink-700 leading-relaxed">{{ scenario.description }}</p>

        <div class="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="rounded-2xl bg-ink-50 p-4">
            <div class="text-xs font-semibold text-ink-500 uppercase tracking-wider">角色</div>
            <dl class="mt-2 text-sm space-y-1.5">
              <div class="flex gap-2">
                <dt class="text-ink-500 w-12">AI</dt>
                <dd class="text-ink-800">{{ scenario.roles.ai }}</dd>
              </div>
              <div class="flex gap-2">
                <dt class="text-ink-500 w-12">你</dt>
                <dd class="text-ink-800">{{ scenario.roles.user }}</dd>
              </div>
            </dl>
          </div>
          <div class="rounded-2xl bg-ink-50 p-4">
            <div class="text-xs font-semibold text-ink-500 uppercase tracking-wider">你将练习</div>
            <ul class="mt-2 text-sm text-ink-700 space-y-1.5 list-disc pl-5">
              <li v-for="(g, i) in scenario.goals" :key="i">{{ g }}</li>
            </ul>
          </div>
        </div>

        <div v-if="scenario.estimated_minutes || (scenario.tags && scenario.tags.length)" class="mt-5 flex flex-wrap gap-2 text-xs text-ink-500">
          <span v-if="scenario.estimated_minutes" class="chip bg-ink-100 text-ink-600">
            预计 {{ scenario.estimated_minutes }} 分钟
          </span>
          <span v-for="t in scenario.tags" :key="t" class="chip bg-ink-100 text-ink-600">#{{ t }}</span>
        </div>
      </div>

      <!-- Settings -->
      <div class="card p-6 sm:p-8 space-y-6">
        <div>
          <h2 class="text-base font-semibold text-ink-800 mb-3">选择模式</h2>
          <ModeSelector v-model="mode" />
        </div>
        <div>
          <h2 class="text-base font-semibold text-ink-800 mb-3">选择难度</h2>
          <DifficultySelector v-model="difficulty" />
        </div>

        <div v-if="sessionStore.errorMessage" class="text-sm text-rose-600">
          {{ sessionStore.errorMessage }}
        </div>

        <div class="flex flex-col sm:flex-row gap-3 sm:justify-end">
          <RouterLink to="/scenarios" class="btn-outline">取消</RouterLink>
          <button
            type="button"
            class="btn-accent"
            :disabled="starting"
            @click="start"
          >
            <span v-if="starting">准备中…</span>
            <span v-else class="inline-flex items-center gap-1.5">
              开始练习
              <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
            </span>
          </button>
        </div>
      </div>
    </template>
  </section>
</template>
