<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter, RouterLink } from 'vue-router'
import { generateCustomScenario } from '@/api/customScenarios'
import { useCustomScenariosStore } from '@/stores/customScenarios'
import type { CustomScenario, Difficulty } from '@/types/api'

const router = useRouter()
const customStore = useCustomScenariosStore()

const name = ref('')
const keywordsText = ref('')
const generating = ref(false)
const error = ref<string | null>(null)
const notice = ref<string>('')

const generated = ref<CustomScenario | null>(null)
const activeTab = ref<Difficulty>('beginner')

const difficultyTabs: { value: Difficulty; label: string }[] = [
  { value: 'beginner', label: '入门' },
  { value: 'intermediate', label: '进阶' },
  { value: 'advanced', label: '高阶' },
]

// Split on 逗号(中英文)/顿号/分号/换行, trim, drop empties and duplicates.
const keywords = computed(() => {
  const parts = keywordsText.value
    .split(/[,，、;；\n]+/)
    .map((k) => k.trim())
    .filter(Boolean)
  return [...new Set(parts)]
})

const activeRounds = computed(() => {
  const d = generated.value?.dialogs
  if (!d) return []
  return d[activeTab.value] ?? []
})

function isSaved(id: string): boolean {
  return !!customStore.getById(id)
}

function formatTime(t: string | number): string {
  const d = new Date(t)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('zh-CN', { hour12: false })
}

async function generate() {
  error.value = null
  notice.value = ''
  if (!name.value.trim()) {
    error.value = '请填写场景名称'
    return
  }
  if (keywords.value.length === 0) {
    error.value = '请至少输入 1 个关键词(用逗号、顿号或换行分隔)'
    return
  }
  if (generating.value) return
  generating.value = true
  try {
    generated.value = await generateCustomScenario({
      name: name.value.trim(),
      keywords: keywords.value,
    })
    activeTab.value = 'beginner'
  } catch (e) {
    error.value = e instanceof Error ? e.message : '生成失败,请稍后重试'
  } finally {
    generating.value = false
  }
}

function save(): boolean {
  if (!generated.value) return false
  customStore.add(generated.value)
  notice.value = '已保存到本地,可在「场景库 → 我的场景」中找到'
  return true
}

function startPractice() {
  if (!generated.value) return
  // Ensure it's persisted so the preview page can load it from the store.
  if (!isSaved(generated.value.id)) customStore.add(generated.value)
  router.push({ name: 'scenario-preview', params: { id: generated.value.id } })
}

function removeSaved(id: string) {
  customStore.remove(id)
}
</script>

<template>
  <section class="space-y-8">
    <header>
      <h1 class="text-2xl sm:text-3xl font-bold text-ink-800">自定义场景生成器</h1>
      <p class="text-sm text-ink-500 mt-1">
        输入场景名称和关键词,AI 为你生成一套外贸英语口语练习场景(含词汇表和三档难度对话)。
      </p>
    </header>

    <!-- 生成表单 -->
    <div class="card p-6 sm:p-8 space-y-5">
      <div>
        <label class="block text-sm font-semibold text-ink-800 mb-2">
          场景名称 <span class="text-rose-500">*</span>
        </label>
        <input
          v-model="name"
          type="text"
          class="input"
          placeholder="例如:展会现场接待外国客户"
          :disabled="generating"
        />
      </div>
      <div>
        <label class="block text-sm font-semibold text-ink-800 mb-2">
          关键词 <span class="text-rose-500">*</span>
          <span class="ml-1 text-xs font-normal text-ink-400">用逗号、顿号或换行分隔,至少 1 个</span>
        </label>
        <textarea
          v-model="keywordsText"
          rows="3"
          class="input resize-y"
          placeholder="例如:样品报价、最小起订量、交期、付款方式"
          :disabled="generating"
        />
        <div v-if="keywords.length" class="mt-2 flex flex-wrap gap-1.5">
          <span
            v-for="k in keywords"
            :key="k"
            class="chip bg-brand-50 text-brand-700 border border-brand-100"
          >{{ k }}</span>
        </div>
      </div>

      <div v-if="error" class="text-sm text-rose-600">{{ error }}</div>

      <div class="flex justify-end">
        <button
          type="button"
          class="btn-accent"
          :disabled="generating"
          @click="generate"
        >
          <span v-if="generating" class="inline-flex items-center gap-2">
            <svg class="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
              <path class="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
            AI 生成中,请稍候…
          </span>
          <span v-else class="inline-flex items-center gap-1.5">
            ✨ AI 生成
          </span>
        </button>
      </div>
    </div>

    <!-- 生成结果 -->
    <template v-if="generated">
      <div class="card p-6 sm:p-8">
        <div class="flex items-start gap-4">
          <div class="h-14 w-14 rounded-2xl bg-brand-50 text-brand-700 flex items-center justify-center text-3xl">
            ✨
          </div>
          <div class="flex-1 min-w-0">
            <h2 class="text-xl sm:text-2xl font-bold text-ink-800">{{ generated.title_zh }}</h2>
            <p class="text-ink-500 mt-1">{{ generated.title_en }}</p>
          </div>
        </div>
        <p class="mt-4 text-ink-700 leading-relaxed">{{ generated.description_zh }}</p>
        <p v-if="generated.description_en" class="mt-2 text-sm text-ink-500 leading-relaxed">
          {{ generated.description_en }}
        </p>
        <div class="mt-4 flex flex-wrap gap-1.5">
          <span
            v-for="k in generated.keywords"
            :key="k"
            class="chip bg-ink-100 text-ink-600"
          >#{{ k }}</span>
        </div>
      </div>

      <!-- 词汇卡片 -->
      <div v-if="generated.vocabulary?.length">
        <h3 class="text-base font-semibold text-ink-800 mb-3">
          核心词汇 <span class="text-xs font-normal text-ink-400">{{ generated.vocabulary.length }} 个</span>
        </h3>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div
            v-for="v in generated.vocabulary"
            :key="v.term"
            class="card p-4 flex flex-col gap-1.5"
          >
            <div class="flex items-baseline gap-2 flex-wrap">
              <span class="text-base font-semibold text-ink-800">{{ v.term }}</span>
              <span v-if="v.phonetic" class="text-xs text-ink-400">{{ v.phonetic }}</span>
            </div>
            <p v-if="v.full_form" class="text-xs text-ink-500">{{ v.full_form }}</p>
            <p class="text-sm text-ink-700">{{ v.definition_zh }}</p>
            <p v-if="v.definition_en" class="text-xs text-ink-500">{{ v.definition_en }}</p>
            <p class="mt-auto pt-1 text-xs text-brand-700 leading-relaxed border-t border-ink-100">
              {{ v.example }}
            </p>
          </div>
        </div>
      </div>

      <!-- 按难度展示例句对话 -->
      <div>
        <h3 class="text-base font-semibold text-ink-800 mb-3">示例对话(每档 6 轮)</h3>
        <div class="flex gap-2 mb-4">
          <button
            v-for="t in difficultyTabs"
            :key="t.value"
            type="button"
            :class="[
              'chip cursor-pointer transition-colors',
              activeTab === t.value
                ? 'bg-brand-700 text-white border-brand-700'
                : 'bg-white text-ink-600 border-ink-200 hover:bg-brand-50',
            ]"
            @click="activeTab = t.value"
          >{{ t.label }}</button>
        </div>
        <div class="space-y-3">
          <div
            v-for="r in activeRounds"
            :key="r.round"
            class="card p-4 sm:p-5"
          >
            <div class="text-xs font-semibold text-ink-400 uppercase tracking-wider mb-2">
              第 {{ r.round }} 轮
            </div>
            <p class="text-sm sm:text-base text-ink-800 leading-relaxed">{{ r.ai_message }}</p>
            <p class="mt-1 text-sm text-ink-500">{{ r.ai_message_zh }}</p>
            <div
              v-if="r.user_response_example"
              class="mt-3 rounded-lg bg-brand-50 border border-brand-100 px-3 py-2"
            >
              <div class="text-[11px] font-semibold text-brand-700 mb-0.5">参考回答</div>
              <p class="text-sm text-ink-700 leading-relaxed">{{ r.user_response_example }}</p>
            </div>
          </div>
          <div v-if="!activeRounds.length" class="card p-6 text-center text-sm text-ink-500">
            该难度暂无对话内容。
          </div>
        </div>
      </div>

      <div v-if="notice" class="text-sm text-emerald-600">{{ notice }}</div>

      <!-- 操作按钮 -->
      <div class="flex flex-col sm:flex-row gap-3 sm:justify-end">
        <button type="button" class="btn-outline" :disabled="generating" @click="generate">
          重新生成
        </button>
        <button
          v-if="!isSaved(generated.id)"
          type="button"
          class="btn-outline"
          @click="save"
        >
          保存到本地
        </button>
        <button type="button" class="btn-accent" @click="startPractice">
          <span class="inline-flex items-center gap-1.5">
            开始练习
            <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
          </span>
        </button>
      </div>
    </template>

    <!-- 已保存的自定义场景 -->
    <div>
      <div class="flex items-end justify-between mb-4">
        <div>
          <h2 class="text-xl font-semibold text-ink-800">我的自定义场景</h2>
          <p class="text-sm text-ink-500 mt-1">保存在本机浏览器中 · {{ customStore.items.length }} 个</p>
        </div>
      </div>

      <div v-if="customStore.items.length === 0" class="card p-8 text-center text-ink-500">
        还没有自定义场景。在上方填写名称和关键词,点「AI 生成」创建第一个吧。
      </div>

      <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div
          v-for="s in customStore.items"
          :key="s.id"
          class="card p-4 sm:p-5 flex flex-col gap-3"
        >
          <div class="flex items-start gap-3">
            <div class="h-11 w-11 shrink-0 rounded-xl bg-brand-50 text-brand-700 flex items-center justify-center text-2xl">
              ✨
            </div>
            <div class="min-w-0 flex-1">
              <h3 class="text-base font-semibold text-ink-800 truncate">{{ s.title_zh || s.name }}</h3>
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
          <div class="text-xs text-ink-400">创建于 {{ formatTime(s.created_at) }}</div>
          <div class="mt-auto pt-1 flex items-center gap-2">
            <RouterLink
              :to="`/scenarios/${s.id}/preview`"
              class="btn-accent flex-1 text-center !py-1.5 text-sm"
            >开始练习</RouterLink>
            <button
              type="button"
              class="btn-outline !py-1.5 text-sm text-rose-600 hover:!border-rose-300"
              @click="removeSaved(s.id)"
            >删除</button>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
