import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { CustomScenario } from '@/types/api'

const STORAGE_KEY = 'speakflow.customScenarios'

function load(): CustomScenario[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as CustomScenario[]) : []
  } catch {
    return []
  }
}

export const useCustomScenariosStore = defineStore('customScenarios', () => {
  const items = ref<CustomScenario[]>([])

  function persist() {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items.value))
    } catch { /* quota / private mode */ }
  }

  /** Read persisted scenarios from localStorage.  Call once on app/page init. */
  function loadFromStorage() {
    items.value = load()
  }

  function add(scenario: CustomScenario) {
    // Replace an existing entry with the same id (e.g. re-saved after
    // regenerate), otherwise prepend so newest shows first.
    const idx = items.value.findIndex((s) => s.id === scenario.id)
    if (idx >= 0) items.value.splice(idx, 1, scenario)
    else items.value.unshift(scenario)
    persist()
  }

  function remove(id: string) {
    items.value = items.value.filter((s) => s.id !== id)
    persist()
  }

  function getById(id: string): CustomScenario | undefined {
    return items.value.find((s) => s.id === id)
  }

  loadFromStorage()

  return { items, add, remove, getById, loadFromStorage }
})
