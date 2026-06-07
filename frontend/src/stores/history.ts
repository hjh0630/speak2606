import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { PracticeSession, StatsOverview } from '@/types/api'
import { listHistory, getHistoryDetail } from '@/api/history'
import { getStats } from '@/api/stats'

export const useHistoryStore = defineStore('history', () => {
  const items = ref<PracticeSession[]>([])
  const total = ref(0)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const detail = ref<PracticeSession | null>(null)
  const stats = ref<StatsOverview | null>(null)
  const statsLoading = ref(false)

  async function fetchList(limit = 50) {
    loading.value = true
    error.value = null
    try {
      const res = await listHistory({ limit })
      items.value = res.items
      total.value = res.total
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load history'
    } finally {
      loading.value = false
    }
  }

  async function fetchDetail(id: string) {
    loading.value = true
    error.value = null
    try {
      detail.value = await getHistoryDetail(id)
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load session'
    } finally {
      loading.value = false
    }
  }

  async function fetchStats() {
    statsLoading.value = true
    try {
      stats.value = await getStats()
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load stats'
    } finally {
      statsLoading.value = false
    }
  }

  function clearDetail() {
    detail.value = null
  }

  return {
    items,
    total,
    loading,
    error,
    detail,
    stats,
    statsLoading,
    fetchList,
    fetchDetail,
    fetchStats,
    clearDetail,
  }
})
