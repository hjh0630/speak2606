import { onMounted, onUnmounted, ref } from 'vue'
import { useTts } from './useTTS'
import dictRaw from '@/data/garment-textile-dict.json'

// Strip the `_comment` metadata key from the dictionary JSON (TS doesn't
// allow extra string fields against `Record<string, string[]>`).
const dict = Object.fromEntries(
  Object.entries(dictRaw as Record<string, unknown>).filter(([k]) => !k.startsWith('_')),
) as Record<string, string[]>

interface Popup {
  word: string
  meaning: string
  x: number
  y: number
  below: boolean
  loading?: boolean
  source?: 'local' | 'llm' | 'mock'
}

/**
 * Whole-app word lookup.
 *
 * Tiered lookup:
 *   1. Local garment-textile dictionary (instant, free) — fuzzy match covers
 *      plural / -ed / -ing / -ly stems.
 *   2. If the local dictionary misses, pop a "loading" popup and call
 *      `/api/dictionary?w=…`, which hits the MiniMax LLM with a 1.5 s hard
 *      timeout. The user sees the answer or a graceful "no result" close.
 *
 * Listens to `mouseup` / `touchend` / `selectionchange` to detect when the
 * user finishes a selection gesture, then positions the popup above (or
 * below when near the top of the viewport) the selection.
 */
export function useWordLookup() {
  const popup = ref<Popup | null>(null)
  const isPlaying = ref(false)
  const tts = useTts()

  let debounceTimer: number | null = null
  let lastSelText = ''
  // Pop the popup only on `mouseup` / `touchend` / explicit double-click —
  // i.e. after the user finishes a deliberate selection gesture, NOT on
  // every selectionchange tick (which fires on every cursor micro-move).
  let armSelection = false
  // Monotonic counter so out-of-order async LLM responses can't clobber a
  // newer selection's popup.
  let reqId = 0

  function normalize(text: string): string {
    return text
      .toLowerCase()
      .replace(/[’']/g, "'")
      .replace(/[^a-z0-9\s_-]/g, ' ')
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  }

  function lookupLocal(raw: string): { key: string; meaning: string } | null {
    const norm = normalize(raw)
    if (!norm || norm.length > 24) return null
    // Skip pure-numeric tokens (years, dollar amounts, GSM numbers, etc.)
    if (/^\d+(\.\d+)?$/.test(norm)) return null

    // 1) exact match
    if (dict[norm]) return { key: norm, meaning: dict[norm].join(' · ') }

    // 2) try simple plural / -s / -es
    if (norm.endsWith('ies') && norm.length > 4) {
      const sg = norm.slice(0, -3) + 'y'
      if (dict[sg]) return { key: sg, meaning: dict[sg].join(' · ') }
    }
    if (norm.endsWith('es') && norm.length > 4) {
      const sg = norm.slice(0, -2)
      if (dict[sg]) return { key: sg, meaning: dict[sg].join(' · ') }
    }
    if (norm.endsWith('s') && norm.length > 3 && !norm.endsWith('ss')) {
      const sg = norm.slice(0, -1)
      if (dict[sg]) return { key: sg, meaning: dict[sg].join(' · ') }
    }

    // 3) -ed → base form
    if (norm.endsWith('ed') && norm.length > 4) {
      const candidates = [norm.slice(0, -2), norm.slice(0, -1)]
      for (const c of candidates) {
        if (dict[c]) return { key: c, meaning: dict[c].join(' · ') }
      }
    }

    // 4) -ing → base form
    if (norm.endsWith('ing') && norm.length > 5) {
      const candidates = [norm.slice(0, -3), norm.slice(0, -3) + 'e']
      for (const c of candidates) {
        if (dict[c]) return { key: c, meaning: dict[c].join(' · ') }
      }
    }

    // 5) -ly → base adjective
    if (norm.endsWith('ly') && norm.length > 4) {
      const stem = norm.slice(0, -2)
      if (dict[stem]) return { key: stem, meaning: dict[stem].join(' · ') }
    }

    return null
  }

  function rectForSelection(): { x: number; y: number; below: boolean } | null {
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0) return null
    const range = sel.getRangeAt(0)
    const rect = range.getBoundingClientRect()
    if (rect.width === 0 && rect.height === 0) return null
    const POPUP_H = 96
    const below = rect.top < POPUP_H + 12
    return {
      x: Math.max(120, Math.min(window.innerWidth - 120, rect.left + rect.width / 2)),
      y: below ? rect.bottom + 8 : rect.top - 8,
      below,
    }
  }

  async function fetchRemote(raw: string, myReqId: number): Promise<{ word: string; meaning: string; source: 'local' | 'llm' | 'mock' } | null> {
    const ac = new AbortController()
    const t = window.setTimeout(() => ac.abort(), 1500)
    try {
      const res = await fetch(`/api/dictionary?w=${encodeURIComponent(raw)}`, { signal: ac.signal })
      if (!res.ok) return null
      const data = (await res.json()) as { word?: unknown; meaning_zh?: unknown; source?: unknown }
      if (myReqId !== reqId) return null
      const word = typeof data.word === 'string' ? data.word : raw
      const meaning = typeof data.meaning_zh === 'string' ? data.meaning_zh : ''
      const source = data.source === 'llm' || data.source === 'mock' ? data.source : 'mock'
      if (!meaning || meaning === '暂无释义') return null
      return { word, meaning, source }
    } catch {
      return null
    } finally {
      window.clearTimeout(t)
    }
  }

  async function show() {
    if (debounceTimer) {
      window.clearTimeout(debounceTimer)
      debounceTimer = null
    }
    const sel = typeof window !== 'undefined' ? window.getSelection() : null
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
      popup.value = null
      lastSelText = ''
      return
    }
    const raw = sel.toString().trim()
    if (!raw || raw === lastSelText) return
    lastSelText = raw
    const found = lookupLocal(raw)
    if (found) {
      const pos = rectForSelection()
      if (!pos) return
      popup.value = { word: found.key, meaning: found.meaning, ...pos, source: 'local' }
      return
    }
    // Local miss → try backend LLM. Show a "loading" placeholder first so
    // the user gets immediate feedback that something is happening.
    const pos = rectForSelection()
    if (!pos) return
    const myReqId = ++reqId
    popup.value = {
      word: raw,
      meaning: '查询中…',
      ...pos,
      loading: true,
    }
    const remote = await fetchRemote(raw, myReqId)
    if (myReqId !== reqId) return
    if (!remote) {
      // LLM also missed (or timed out / errored). Close silently.
      popup.value = null
      return
    }
    popup.value = { ...remote, ...pos, loading: false }
  }

  function close() {
    popup.value = null
    lastSelText = ''
    armSelection = false
  }

  function onMouseUp() {
    armSelection = true
    if (debounceTimer) window.clearTimeout(debounceTimer)
    debounceTimer = window.setTimeout(show, 60)
  }

  function onSelectionChange() {
    if (!armSelection) return
    if (debounceTimer) window.clearTimeout(debounceTimer)
    debounceTimer = window.setTimeout(show, 80)
  }

  function onMouseDown(e: MouseEvent) {
    const target = e.target as HTMLElement | null
    if (target && target.closest('[data-word-popup]')) return
    setTimeout(() => {
      popup.value = null
      lastSelText = ''
    }, 0)
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') close()
  }

  async function playWord() {
    if (!popup.value || isPlaying.value) return
    isPlaying.value = true
    try {
      const res = await tts.playText(popup.value.word, undefined, 0.85)
      if (!res && 'speechSynthesis' in window) {
        const u = new SpeechSynthesisUtterance(popup.value.word)
        u.lang = 'en-US'
        u.rate = 0.85
        window.speechSynthesis.speak(u)
      }
    } finally {
      isPlaying.value = false
    }
  }

  onMounted(() => {
    document.addEventListener('mouseup', onMouseUp)
    document.addEventListener('touchend', onMouseUp)
    document.addEventListener('selectionchange', onSelectionChange)
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKeyDown)
  })

  onUnmounted(() => {
    document.removeEventListener('mouseup', onMouseUp)
    document.removeEventListener('touchend', onMouseUp)
    document.removeEventListener('selectionchange', onSelectionChange)
    document.removeEventListener('mousedown', onMouseDown)
    document.removeEventListener('keydown', onKeyDown)
  })

  return { popup, isPlaying, playWord, close }
}
