import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import type { Difficulty, PracticeMode } from '@/types/api'

const STORAGE_KEY = 'sf_user_prefs_v1'

interface UserPrefs {
  defaultDifficulty: Difficulty
  defaultMode: PracticeMode
  autoPlayTts: boolean
  preferredVoice: string
}

const defaults: UserPrefs = {
  defaultDifficulty: 'beginner',
  defaultMode: 'free',
  autoPlayTts: true,
  preferredVoice: '',
}

function load(): UserPrefs {
  if (typeof window === 'undefined') return { ...defaults }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...defaults }
    const parsed = JSON.parse(raw) as Partial<UserPrefs>
    return { ...defaults, ...parsed }
  } catch {
    return { ...defaults }
  }
}

export const useUserStore = defineStore('user', () => {
  const initial = load()
  const defaultDifficulty = ref<Difficulty>(initial.defaultDifficulty)
  const defaultMode = ref<PracticeMode>(initial.defaultMode)
  const autoPlayTts = ref<boolean>(initial.autoPlayTts)
  const preferredVoice = ref<string>(initial.preferredVoice)

  function persist() {
    const payload: UserPrefs = {
      defaultDifficulty: defaultDifficulty.value,
      defaultMode: defaultMode.value,
      autoPlayTts: autoPlayTts.value,
      preferredVoice: preferredVoice.value,
    }
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
    } catch { /* quota / private mode */ }
  }

  watch([defaultDifficulty, defaultMode, autoPlayTts, preferredVoice], persist, { deep: true })

  function reset() {
    defaultDifficulty.value = defaults.defaultDifficulty
    defaultMode.value = defaults.defaultMode
    autoPlayTts.value = defaults.autoPlayTts
    preferredVoice.value = defaults.preferredVoice
  }

  return { defaultDifficulty, defaultMode, autoPlayTts, preferredVoice, reset }
})
