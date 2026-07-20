<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useWordbookStore } from '@/stores/wordbook'
import type { WordbookDifficulty, WordbookItem } from '@/types/api'

// ---------------------------------------------------------------------------
// store
// ---------------------------------------------------------------------------
const store = useWordbookStore()

// ---------------------------------------------------------------------------
// filter state — view-local, not stored, so it resets on navigation away.
// ---------------------------------------------------------------------------
type DifficultyFilter = WordbookDifficulty | 'all'
const filter = ref<DifficultyFilter>('all')
const search = ref('')

interface FetchDebouncer {
  t: number | null
}
const debouncer: FetchDebouncer = { t: null }

function scheduleFetch(): void {
  if (debouncer.t !== null) window.clearTimeout(debouncer.t)
  debouncer.t = window.setTimeout(() => {
    debouncer.t = null
    void runFetch()
  }, 220)
}

async function runFetch(): Promise<void> {
  await store.fetchList({
    difficulty: filter.value === 'all' ? undefined : filter.value,
    search: search.value.trim() || undefined,
    limit: 200,
  })
}

onMounted(async () => {
  await Promise.all([runFetch(), store.fetchStats()])
})

// ---------------------------------------------------------------------------
// derived
// ---------------------------------------------------------------------------
const filteredCount = computed(() => store.items.length)
const hasItems = computed(() => filteredCount.value > 0)
const allSelected = computed(
  () => hasItems.value && store.selectedCount === filteredCount.value,
)

const difficultyFilters: { key: DifficultyFilter; label: string; emoji: string; tone: string }[] = [
  { key: 'all', label: '全部', emoji: '📚', tone: 'bg-ink-100 text-ink-700' },
  { key: 0, label: '未评分', emoji: '·', tone: 'bg-ink-100 text-ink-600' },
  { key: 1, label: '容易', emoji: '⭐', tone: 'bg-emerald-50 text-emerald-700' },
  { key: 2, label: '中等', emoji: '⭐⭐', tone: 'bg-amber-50 text-amber-700' },
  { key: 3, label: '困难', emoji: '⭐⭐⭐', tone: 'bg-rose-50 text-rose-700' },
]

const difficultyDots: { level: WordbookDifficulty; emoji: string; color: string }[] = [
  { level: 0, emoji: '·', color: 'text-ink-400' },
  { level: 1, emoji: '⭐', color: 'text-emerald-500' },
  { level: 2, emoji: '⭐', color: 'text-amber-500' },
  { level: 3, emoji: '⭐', color: 'text-rose-500' },
]

// ---------------------------------------------------------------------------
// per-row difficulty picker
// ---------------------------------------------------------------------------
const ratingBusy = ref<Set<number>>(new Set<number>())

async function setDifficulty(item: WordbookItem, level: WordbookDifficulty): Promise<void> {
  if (ratingBusy.value.has(item.id)) return
  const busy = new Set(ratingBusy.value)
  busy.add(item.id)
  ratingBusy.value = busy
  try {
    await store.updateItem(item.id, { difficulty: level })
    // stats will lag — refresh quietly without blocking
    void store.fetchStats()
  } finally {
    const next = new Set(ratingBusy.value)
    next.delete(item.id)
    ratingBusy.value = next
  }
}

// ---------------------------------------------------------------------------
// formatting helpers
// ---------------------------------------------------------------------------
function fmtTs(ts: number | undefined | null): string {
  if (ts == null) return ''
  try {
    const d = new Date(ts)
    if (Number.isNaN(d.getTime())) return ''
    return d.toLocaleString([], { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

function sourceLabel(src: string | undefined | null): string {
  switch (src) {
    case 'popup':
      return '弹窗'
    case 'practice':
      return '练习'
    case 'manual':
      return '手动'
    case 'import':
      return '导入'
    default:
      return src || '其他'
  }
}

// ---------------------------------------------------------------------------
// selection wiring
// ---------------------------------------------------------------------------
function onSelectAll(): void {
  if (allSelected.value) store.clearSelection()
  else store.selectAll()
}

async function onBatchDelete(): Promise<void> {
  if (store.selectedCount === 0) return
  const ids = Array.from(store.selectedIds)
  const ok = window.confirm(`确定删除选中的 ${ids.length} 个生词？此操作不可撤销。`)
  if (!ok) return
  await store.batchRemove(ids)
  await store.fetchStats()
}

async function onDeleteOne(id: number): Promise<void> {
  const ok = window.confirm('确定删除这个生词？')
  if (!ok) return
  await store.removeItem(id)
  await store.fetchStats()
}

// ---------------------------------------------------------------------------
// 「生图分享 / 导出」
// ---------------------------------------------------------------------------
const sharing = ref(false)
const shareError = ref<string | null>(null)
const exportMenuOpen = ref(false)
// Close the dropdown when the user clicks anywhere outside it.
const exportMenuEl = ref<HTMLElement | null>(null)
function onDocClick(e: MouseEvent): void {
  if (!exportMenuOpen.value) return
  const root = exportMenuEl.value
  if (root && e.target instanceof Node && !root.contains(e.target)) {
    exportMenuOpen.value = false
  }
}
onMounted(() => {
  document.addEventListener('mousedown', onDocClick)
})
onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onDocClick)
})

function todayStr(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

async function exportJson(itemsToExport: WordbookItem[]): Promise<void> {
  const blob = new Blob([JSON.stringify(itemsToExport, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `wordbook-${todayStr()}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1500)
}

/**
 * Export as Anki-compatible CSV.  We use the 2-column "term,definition"
 * format which Anki imports natively when you pick "Basic" note type on
 * import.  Definition = meaning (Chinese), falling back to a synthesized
 * "(无释义)" so the column never goes empty (which would confuse Anki's
 * field mapper).  Double-quotes inside fields are doubled per RFC 4180.
 */
function csvEscape(s: string): string {
  if (s == null) return ''
  // Always quote — simplifies escaping and matches how Anki tools like
  // AnkiConnect expect fields.
  return '"' + String(s).replace(/"/g, '""') + '"'
}

async function exportAnkiCsv(itemsToExport: WordbookItem[]): Promise<void> {
  const lines = ['term,definition']
  for (const it of itemsToExport) {
    const def = (it.meaning && it.meaning.trim()) || '(无释义)'
    lines.push(`${csvEscape(it.term)},${csvEscape(def)}`)
  }
  // BOM so Excel on Windows opens UTF-8 correctly.  Anki ignores the BOM
  // when importing CSV.
  const body = '﻿' + lines.join('\r\n')
  const blob = new Blob([body], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `wordbook-anki-${todayStr()}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1500)
}

async function shareAsImage(itemsToExport: WordbookItem[]): Promise<void> {
  if (itemsToExport.length === 0) {
    shareError.value = '没有可分享的生词'
    return
  }
  sharing.value = true
  shareError.value = null
  const host = document.createElement('div')
  host.id = 'wordbook-share-host'
  host.style.cssText =
    'position:fixed;top:0;left:-99999px;z-index:-1;width:760px;background:#ffffff;'
  document.body.appendChild(host)

  try {
    host.innerHTML = buildShareMarkup(itemsToExport)
    // wait one paint so layout settles before screenshot
    await nextTick()
    // dynamic import so html2canvas is optional — if missing, we fall back
    // to JSON export and still succeed.  We intentionally cast through
    // `unknown` because html2canvas lacks first-party types and adding
    // `@types/html2canvas` is out of scope for this change.  We resolve the
    // module via a runtime-only path so vue-tsc doesn't try to resolve it
    // at type-check time.
    let html2canvas: ((el: HTMLElement, opts?: Record<string, unknown>) => Promise<HTMLCanvasElement>) | null = null
    try {
      const moduleName = 'html2canvas'
      const mod: unknown = await import(/* webpackIgnore: true */ moduleName)
      const def = (mod as { default?: unknown }).default
      if (typeof def === 'function') {
        html2canvas = def as (el: HTMLElement, opts?: Record<string, unknown>) => Promise<HTMLCanvasElement>
      }
    } catch {
      html2canvas = null
    }

    if (!html2canvas) {
      await exportJson(itemsToExport)
      shareError.value = 'html2canvas 未安装,已改为导出 JSON'
      return
    }

    const target = host.firstElementChild as HTMLElement | null
    if (!target) throw new Error('share host rendered empty')
    const canvas = await html2canvas(target, {
      backgroundColor: '#ffffff',
      scale: 2,
      logging: false,
      useCORS: true,
    })
    const dataUrl = canvas.toDataURL('image/png')
    const a = document.createElement('a')
    a.href = dataUrl
    a.download = `my-wordbook-${todayStr()}.png`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  } catch (e) {
    shareError.value = e instanceof Error ? e.message : '生图失败'
    // last-resort: at least give the user a JSON copy so nothing is lost
    try {
      await exportJson(itemsToExport)
    } catch {
      /* swallow */
    }
  } finally {
    if (host.parentNode) host.parentNode.removeChild(host)
    sharing.value = false
  }
}

function buildShareMarkup(itemsToExport: WordbookItem[]): string {
  const rows = itemsToExport
    .slice(0, 30)
    .map(
      (it, i) => `
      <tr style="border-top:1px solid #e2e8f0;">
        <td style="padding:8px 10px;color:#64748b;font-size:13px;width:36px;">${i + 1}</td>
        <td style="padding:8px 10px;color:#0f172a;font-weight:600;font-size:15px;">${escapeHtml(it.term)}</td>
        <td style="padding:8px 10px;color:#334155;font-size:14px;">${escapeHtml(it.meaning ?? '')}</td>
        <td style="padding:8px 10px;color:${dotColor(it.difficulty)};font-size:13px;width:60px;">${stars(it.difficulty)}</td>
      </tr>`,
    )
    .join('')
  return `
    <div style="padding:24px;font-family:'PingFang SC','Hiragino Sans GB','Microsoft YaHei',sans-serif;color:#0f172a;background:#ffffff;">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:18px;">
        <div style="width:32px;height:32px;border-radius:8px;background:linear-gradient(135deg,#1F8FB3,#D17F50);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;">SF</div>
        <div style="font-size:18px;font-weight:700;">SpeakFlow · 我的生词表</div>
        <div style="margin-left:auto;color:#64748b;font-size:13px;">${todayStr()} · 共 ${itemsToExport.length} 词</div>
      </div>
      <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
        <thead>
          <tr style="background:#f1f5f9;">
            <th style="padding:8px 10px;text-align:left;color:#475569;font-size:12px;width:36px;">#</th>
            <th style="padding:8px 10px;text-align:left;color:#475569;font-size:12px;">单词</th>
            <th style="padding:8px 10px;text-align:left;color:#475569;font-size:12px;">中文</th>
            <th style="padding:8px 10px;text-align:left;color:#475569;font-size:12px;width:60px;">难度</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <div style="margin-top:18px;display:flex;align-items:center;justify-content:space-between;color:#64748b;font-size:12px;">
        <span>SpeakFlow · 让英语开口就来</span>
        <span>speakflow.app</span>
      </div>
    </div>
  `
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function stars(d: WordbookDifficulty): string {
  return d === 0 ? '·' : d === 1 ? '⭐' : d === 2 ? '⭐⭐' : '⭐⭐⭐'
}

function dotColor(d: WordbookDifficulty): string {
  return d === 0 ? '#94a3b8' : d === 1 ? '#10b981' : d === 2 ? '#f59e0b' : '#ef4444'
}

const itemsForSelectedShare = computed(() =>
  store.items.filter((i) => store.selectedIds.has(i.id)),
)
</script>

<template>
  <section class="space-y-5">
    <!-- header -->
    <header class="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
      <div>
        <h1 class="text-2xl sm:text-3xl font-bold text-ink-800">生词本</h1>
        <p class="text-sm text-ink-500 mt-1">把不熟的词攒起来,练口语时随时调用</p>
      </div>
      <div class="text-sm text-ink-500">共 {{ store.total }} 个生词</div>
    </header>

    <!-- stats strip -->
    <div v-if="store.stats" class="grid grid-cols-2 lg:grid-cols-6 gap-3">
      <div class="card p-4 col-span-2 lg:col-span-1">
        <div class="text-xs text-ink-500">总数</div>
        <div class="text-2xl font-bold text-ink-800 mt-1">{{ store.stats.total }}</div>
      </div>
      <div class="card p-4">
        <div class="text-xs text-ink-500 flex items-center gap-1">⭐ 容易</div>
        <div class="text-xl font-semibold text-emerald-600 mt-1">{{ store.stats.by_difficulty[1] }}</div>
      </div>
      <div class="card p-4">
        <div class="text-xs text-ink-500 flex items-center gap-1">⭐⭐ 中等</div>
        <div class="text-xl font-semibold text-amber-600 mt-1">{{ store.stats.by_difficulty[2] }}</div>
      </div>
      <div class="card p-4">
        <div class="text-xs text-ink-500 flex items-center gap-1">⭐⭐⭐ 困难</div>
        <div class="text-xl font-semibold text-rose-600 mt-1">{{ store.stats.by_difficulty[3] }}</div>
      </div>
      <div class="card p-4">
        <div class="text-xs text-ink-500">未评分</div>
        <div class="text-xl font-semibold text-ink-600 mt-1">{{ store.stats.by_difficulty[0] }}</div>
      </div>
      <div class="card p-4">
        <div class="text-xs text-ink-500">本周新增</div>
        <div class="text-xl font-semibold text-brand-700 mt-1">{{ store.stats.recent_week }}</div>
      </div>
    </div>
    <div v-else-if="store.statsLoading" class="grid grid-cols-2 lg:grid-cols-6 gap-3">
      <div v-for="i in 6" :key="i" class="card p-4 animate-pulse h-16" />
    </div>

    <!-- toolbar -->
    <div class="card p-3 sm:p-4 flex flex-col gap-3">
      <div class="flex flex-wrap items-center gap-2">
        <button
          v-for="f in difficultyFilters"
          :key="String(f.key)"
          type="button"
          :class="[
            'chip cursor-pointer transition',
            filter === f.key
              ? 'bg-brand-700 text-white shadow-soft'
              : f.tone + ' hover:brightness-95',
          ]"
          @click="filter = f.key; scheduleFetch()"
        >
          <span aria-hidden="true">{{ f.emoji }}</span>
          <span>{{ f.label }}</span>
        </button>
        <div class="ml-auto w-full sm:w-64">
          <input
            v-model="search"
            type="text"
            placeholder="搜索单词/释义…"
            class="input"
            @input="scheduleFetch()"
          />
        </div>
      </div>
      <div class="flex flex-wrap items-center gap-2 text-xs">
        <span class="text-ink-500">已选 {{ store.selectedCount }} 项</span>
        <button
          type="button"
          class="btn-outline px-3 py-1 text-xs"
          :disabled="!hasItems"
          @click="onSelectAll"
        >
          {{ allSelected ? '取消全选' : '全选当前' }}
        </button>
        <button
          type="button"
          class="btn-outline px-3 py-1 text-xs"
          :disabled="store.selectedCount === 0"
          @click="store.invertSelection()"
        >
          反选
        </button>
        <button
          type="button"
          class="btn-outline px-3 py-1 text-xs text-rose-600 border-rose-200 hover:bg-rose-50"
          :disabled="store.selectedCount === 0 || store.mutating"
          @click="onBatchDelete"
        >
          批量删除
        </button>
        <button
          type="button"
          class="btn-ghost px-3 py-1 text-xs"
          :disabled="store.selectedCount === 0"
          @click="store.clearSelection()"
        >
          清空选择
        </button>
      </div>
    </div>

    <!-- error banner -->
    <div v-if="store.error" class="card p-4 text-sm text-rose-600">
      {{ store.error }}
      <button class="ml-2 underline text-xs" @click="runFetch()">重试</button>
    </div>

    <!-- list / empty / loading -->
    <div v-if="store.loading && !hasItems" class="space-y-3">
      <div v-for="i in 4" :key="i" class="card p-4 animate-pulse h-20" />
    </div>

    <div
      v-else-if="store.isEmpty && !store.loading"
      class="card p-10 text-center text-ink-500"
    >
      <div class="text-4xl mb-2">📭</div>
      <p class="text-sm">
        生词本是空的。试试选中页面上的英文单词,或在练习中点 ☆ 加进来。
      </p>
      <RouterLink to="/scenarios" class="btn-accent mt-4 inline-flex">
        去练习
      </RouterLink>
    </div>

    <ul v-else class="space-y-3">
      <li
        v-for="item in store.items"
        :key="item.id"
        class="card p-4 sm:p-5 flex flex-col gap-3"
      >
        <div class="flex items-start gap-3">
          <label class="flex items-center pt-1">
            <input
              type="checkbox"
              class="h-4 w-4 rounded border-ink-300 text-brand-700 focus:ring-brand-200"
              :checked="store.selectedIds.has(item.id)"
              @change="store.toggleSelected(item.id)"
            />
          </label>
          <div class="min-w-0 flex-1">
            <div class="flex items-baseline gap-2 flex-wrap">
              <h3 class="text-base sm:text-lg font-semibold text-ink-800 break-words">
                {{ item.term }}
              </h3>
              <span v-if="item.meaning" class="text-sm text-ink-600 break-words">
                · {{ item.meaning }}
              </span>
            </div>
            <div class="mt-1 flex items-center gap-2 text-[11px] text-ink-500">
              <span class="chip bg-ink-100 text-ink-700">{{ sourceLabel(item.source) }}</span>
              <span>{{ fmtTs(item.created_at) }}</span>
              <span v-if="item.source_ref" class="truncate max-w-[160px]" :title="item.source_ref">
                {{ item.source_ref }}
              </span>
            </div>
          </div>
          <button
            type="button"
            class="btn-ghost px-2 py-1 text-xs text-rose-600 hover:bg-rose-50"
            :disabled="store.mutating"
            aria-label="删除该生词"
            @click="onDeleteOne(item.id)"
          >
            删除
          </button>
        </div>

        <!-- inline difficulty picker -->
        <div class="flex items-center gap-1 pl-7">
          <span class="text-xs text-ink-500 mr-1">难度</span>
          <button
            v-for="d in difficultyDots"
            :key="d.level"
            type="button"
            :title="['未评分', '容易', '中等', '困难'][d.level]"
            :disabled="ratingBusy.has(item.id)"
            :class="[
              'inline-flex h-7 w-7 items-center justify-center rounded-full text-sm transition',
              d.level === 0 ? 'text-xs' : 'text-base',
              item.difficulty >= d.level
                ? d.color + ' bg-white shadow-soft'
                : 'text-ink-300 hover:text-ink-500',
              ratingBusy.has(item.id) ? 'opacity-50' : '',
            ]"
            @click="setDifficulty(item, d.level)"
          >
            {{ d.level === 0 ? '·' : '☆' }}
          </button>
          <span class="ml-2 text-[11px] text-ink-500">
            {{ ['未评', '容易', '中等', '困难'][item.difficulty] }}
          </span>
        </div>
      </li>
    </ul>

    <!-- floating export bar (replaces the old "生图分享" pair).  When the
         user has rows selected we export just those, otherwise the whole
         page.  The three formats cover the common use cases: JSON for
         round-tripping back into the app, Anki CSV for studying in Anki,
         and PNG for sharing on socials. -->
    <div
      v-if="hasItems"
      class="sticky bottom-3 z-10 flex flex-wrap items-center justify-center gap-2"
      ref="exportMenuEl"
    >
      <button
        type="button"
        class="btn-accent shadow-card"
        :disabled="store.selectedCount === 0 || sharing"
        @click="shareAsImage(itemsForSelectedShare)"
      >
        {{ sharing ? '生图中…' : `生图分享（已选 ${store.selectedCount} 项）` }}
      </button>

      <!-- Export dropdown — three options: JSON / Anki CSV / PNG.
           Clicking outside closes it.  We intentionally keep the existing
           "生图分享" buttons above so users who never use the dropdown
           aren't forced to learn a new UI. -->
      <div class="relative">
        <button
          type="button"
          class="btn-primary shadow-card"
          :disabled="sharing"
          aria-haspopup="menu"
          :aria-expanded="exportMenuOpen"
          @click="exportMenuOpen = !exportMenuOpen"
        >
          导出全部 ▼
        </button>
        <div
          v-if="exportMenuOpen"
          role="menu"
          class="absolute right-0 bottom-full mb-2 w-44 rounded-xl bg-white border border-ink-200 shadow-card overflow-hidden"
        >
          <button
            type="button"
            role="menuitem"
            class="w-full text-left px-4 py-2 text-sm hover:bg-ink-50 flex items-center gap-2"
            @click="exportMenuOpen = false; exportJson(store.items)"
          >
            <span aria-hidden="true">📄</span>
            <span>JSON (数据备份)</span>
          </button>
          <button
            type="button"
            role="menuitem"
            class="w-full text-left px-4 py-2 text-sm hover:bg-ink-50 flex items-center gap-2"
            @click="exportMenuOpen = false; exportAnkiCsv(store.items)"
          >
            <span aria-hidden="true">🃏</span>
            <span>Anki CSV (导入卡片)</span>
          </button>
          <button
            type="button"
            role="menuitem"
            class="w-full text-left px-4 py-2 text-sm hover:bg-ink-50 flex items-center gap-2"
            @click="exportMenuOpen = false; shareAsImage(store.items)"
          >
            <span aria-hidden="true">🖼️</span>
            <span>PNG 图片 (分享)</span>
          </button>
        </div>
      </div>

      <span v-if="shareError" class="text-xs text-rose-600 ml-2">{{ shareError }}</span>
    </div>
  </section>
</template>
