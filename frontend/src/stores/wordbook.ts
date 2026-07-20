import { defineStore } from 'pinia'
import { computed, ref, type Ref } from 'vue'
import type {
  WordbookItem,
  WordbookDifficulty,
  WordbookStats,
} from '@/types/api'
import {
  listWordbook,
  addWord,
  updateWord,
  deleteWord,
  batchDelete,
  batchCheck,
  getWordbookStats,
  type ListWordbookParams,
  type CreateWordbookRequest,
  type PatchWordbookRequest,
} from '@/api/wordbook'

/**
 * Pinia store for the 生词本 module.  Mirrors the setup-style used by the
 * history / session stores — see `stores/history.ts` for the reference shape.
 *
 * All async actions catch their own errors and write to `error` instead of
 * throwing, so views can render the failure inline without try/catch
 * boilerplate.
 */
export const useWordbookStore = defineStore('wordbook', () => {
  // ── state ───────────────────────────────────────────────────────────────
  const items: Ref<WordbookItem[]> = ref([])
  const total = ref(0)
  const stats: Ref<WordbookStats | null> = ref(null)
  const loading = ref(false)
  const statsLoading = ref(false)
  const mutating = ref(false)
  const error: Ref<string | null> = ref(null)
  const selectedIds: Ref<Set<number>> = ref(new Set<number>())

  // ── getters ─────────────────────────────────────────────────────────────
  /**
   * Bucket the items by difficulty so the UI can render one column / section
   * per tier (0 = unrated, 1 = easy, 2 = medium, 3 = hard).
   */
  const byDifficulty = computed<Map<WordbookDifficulty, WordbookItem[]>>(() => {
    const buckets = new Map<WordbookDifficulty, WordbookItem[]>([
      [0, []],
      [1, []],
      [2, []],
      [3, []],
    ])
    for (const it of items.value) {
      const arr = buckets.get(it.difficulty)
      if (arr) arr.push(it)
    }
    return buckets
  })

  const selectedCount = computed(() => selectedIds.value.size)
  const isEmpty = computed(() => !loading.value && items.value.length === 0)

  // ── helpers ─────────────────────────────────────────────────────────────
  function commitError(prefix: string, e: unknown): void {
    error.value = e instanceof Error ? `${prefix}: ${e.message}` : `${prefix}: failed`
  }

  function pruneSelection(): void {
    // Drop selection entries that no longer exist in items.
    if (selectedIds.value.size === 0) return
    const live = new Set<number>(items.value.map((i) => i.id))
    const next = new Set<number>()
    for (const id of selectedIds.value) if (live.has(id)) next.add(id)
    selectedIds.value = next
  }

  // ── actions ─────────────────────────────────────────────────────────────
  async function fetchList(params: ListWordbookParams = {}): Promise<void> {
    loading.value = true
    error.value = null
    try {
      const res = await listWordbook(params)
      items.value = res.items
      total.value = res.total
      pruneSelection()
    } catch (e) {
      commitError('加载生词本失败', e)
    } finally {
      loading.value = false
    }
  }

  async function fetchStats(): Promise<void> {
    statsLoading.value = true
    try {
      stats.value = await getWordbookStats()
    } catch (e) {
      commitError('加载生词统计失败', e)
    } finally {
      statsLoading.value = false
    }
  }

  async function addItem(body: CreateWordbookRequest): Promise<WordbookItem | null> {
    mutating.value = true
    error.value = null
    try {
      const item = await addWord(body)
      // Optimistic merge — if it's already there, refresh in place; otherwise
      // prepend so the user immediately sees the new entry.
      const idx = items.value.findIndex((i) => i.id === item.id)
      if (idx >= 0) items.value.splice(idx, 1, item)
      else items.value = [item, ...items.value]
      total.value = items.value.length
      return item
    } catch (e) {
      commitError('加入生词失败', e)
      return null
    } finally {
      mutating.value = false
    }
  }

  async function updateItem(
    id: number,
    body: PatchWordbookRequest,
  ): Promise<WordbookItem | null> {
    mutating.value = true
    error.value = null
    try {
      const updated = await updateWord(id, body)
      const idx = items.value.findIndex((i) => i.id === id)
      if (idx >= 0) items.value.splice(idx, 1, updated)
      return updated
    } catch (e) {
      commitError('更新生词失败', e)
      return null
    } finally {
      mutating.value = false
    }
  }

  async function removeItem(id: number): Promise<void> {
    mutating.value = true
    error.value = null
    try {
      await deleteWord(id)
      items.value = items.value.filter((i) => i.id !== id)
      total.value = Math.max(0, items.value.length)
      // Also drop the id from the selection.
      if (selectedIds.value.has(id)) {
        const next = new Set(selectedIds.value)
        next.delete(id)
        selectedIds.value = next
      }
    } catch (e) {
      commitError('删除生词失败', e)
    } finally {
      mutating.value = false
    }
  }

  async function batchRemove(ids: number[]): Promise<number> {
    if (ids.length === 0) return 0
    mutating.value = true
    error.value = null
    try {
      const res = await batchDelete(ids)
      const removed = new Set(ids)
      items.value = items.value.filter((i) => !removed.has(i.id))
      total.value = Math.max(0, items.value.length)
      // Drop all removed ids from the selection.
      const next = new Set<number>()
      for (const id of selectedIds.value) if (!removed.has(id)) next.add(id)
      selectedIds.value = next
      return res.deleted
    } catch (e) {
      commitError('批量删除失败', e)
      return 0
    } finally {
      mutating.value = false
    }
  }

  /**
   * Batch-check terms to see which are already saved.  Returns a Set so the
   * caller can do O(1) lookups in render loops.
   */
  async function checkSaved(terms: string[]): Promise<Set<string>> {
    if (terms.length === 0) return new Set<string>()
    try {
      const res = await batchCheck(terms)
      return new Set(res.saved)
    } catch (e) {
      commitError('检查生词状态失败', e)
      return new Set<string>()
    }
  }

  /**
   * Return the full set of terms the user has ever saved, in lowercase.
   * Used by the word-lookup popup to render the ☆/★ toggle without an
   * extra round-trip per selection.  Paginates internally; capped at the
   * `maxItems` argument so the lookup layer doesn't ship the whole
   * history on every page load.
   */
  async function collectAllSavedTerms(maxItems = 2000): Promise<string[]> {
    const out: string[] = []
    const pageSize = 200
    let offset = 0
    // First hit — we need the total to know if we should keep paginating.
    try {
      const first = await listWordbook({ limit: pageSize, offset: 0 })
      for (const it of first.items) out.push(it.term.toLowerCase())
      offset = first.items.length
      while (offset < first.total && out.length < maxItems) {
        const next = await listWordbook({ limit: pageSize, offset })
        if (next.items.length === 0) break
        for (const it of next.items) out.push(it.term.toLowerCase())
        offset += next.items.length
      }
    } catch {
      // best-effort — empty result is fine; popup will render ☆ for everything.
    }
    return out
  }

  function clearSelection(): void {
    selectedIds.value = new Set<number>()
  }

  function toggleSelected(id: number): void {
    const next = new Set(selectedIds.value)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    selectedIds.value = next
  }

  function selectAll(): void {
    selectedIds.value = new Set(items.value.map((i) => i.id))
  }

  function invertSelection(): void {
    const next = new Set<number>()
    for (const it of items.value) {
      if (!selectedIds.value.has(it.id)) next.add(it.id)
    }
    selectedIds.value = next
  }

  function setDifficultyFilter(_d: WordbookDifficulty | null): void {
    // Placeholder for filter wiring — the view holds its own filter state and
    // passes it into fetchList; this hook exists so consumers don't reach
    // into private state.
  }

  return {
    // state
    items,
    total,
    stats,
    loading,
    statsLoading,
    mutating,
    error,
    selectedIds,
    // getters
    byDifficulty,
    selectedCount,
    isEmpty,
    // actions
    fetchList,
    fetchStats,
    addItem,
    updateItem,
    removeItem,
    batchRemove,
    checkSaved,
    collectAllSavedTerms,
    clearSelection,
    toggleSelected,
    selectAll,
    invertSelection,
    setDifficultyFilter,
  }
})
