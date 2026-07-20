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

export function useWordLookup() {
  const popup = ref<Popup | null>(null)
  const isPlaying = ref(false)
  /**
   * `savedTerms` is the set of terms already present in the user's wordbook.
   * App.vue populates this from the wordbook store so the popup can render
   * the ☆/★ toggle correctly without an extra round-trip per lookup.
   */
  const savedTerms = ref<Set<string>>(new Set())
  const isCurrentSaved = ref(false)
  /** True while a saveWord() call is in flight. */
  const isSaving = ref(false)
  const tts = useTts()

  let debounceTimer: number | null = null
  let lastSelText = ''
  // Monotonic counter so out-of-order async LLM responses can't clobber a
  // newer selection's popup.
  let reqId = 0
  // Monotonic counter for save requests — protects against a stale save
  // completing after the user has already moved on to a different word.
  let saveReqId = 0

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

  // ── Core: single entry point for showing the popup ──────────────────
  // Called from onMouseUp / onTouchEnd / onDblClick after a suitable
  // debounce.  We do NOT listen to selectionchange — that event fires
  // continuously during drag-select and also spuriously on DOM mutations
  // (including the Teleport popup insertion itself), making it impossible
  // to avoid flash-without the arm/disarm machinery that proved fragile.

  async function tryShow() {
    if (debounceTimer) {
      window.clearTimeout(debounceTimer)
      debounceTimer = null
    }

    // Read selection synchronously — at this point the browser has settled
    // the selection (mouseup / dblclick already fired).
    const sel = typeof window !== 'undefined' ? window.getSelection() : null
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
      // No valid selection → nothing to do (but DON'T clear an existing
      // popup — another gesture may have opened it and we shouldn't steal).
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
      isCurrentSaved.value = savedTerms.value.has(found.key.toLowerCase())
      return
    }

    // Local miss → try backend LLM.
    const pos = rectForSelection()
    if (!pos) return
    const myReqId = ++reqId
    popup.value = { word: raw, meaning: '查询中…', ...pos, loading: true }
    isCurrentSaved.value = savedTerms.value.has(raw.toLowerCase())
    const remote = await fetchRemote(raw, myReqId)
    if (myReqId !== reqId) return
    if (!remote) {
      popup.value = null
      return
    }
    popup.value = { ...remote, ...pos, loading: false }
    isCurrentSaved.value = savedTerms.value.has(remote.word.toLowerCase())
  }

  function close() {
    if (debounceTimer) {
      window.clearTimeout(debounceTimer)
      debounceTimer = null
    }
    popup.value = null
    isCurrentSaved.value = false
    lastSelText = ''
  }

  /**
   * Hand off the currently-shown term to the wordbook store. The actual
   * network call lives in the store; this method just makes sure we don't
   * double-fire when the user spams the ☆ button, and that the local
   * `savedTerms` cache is updated optimistically on success so the popup
   * flips to ★ immediately.
   *
   * Returns the resolved item (or null) so callers can show a toast.
   */
  async function saveCurrent(): Promise<{ ok: boolean; term?: string; reason?: string }> {
    const cur = popup.value
    if (!cur || cur.loading) return { ok: false, reason: 'no-popup' }
    if (isCurrentSaved.value) return { ok: false, reason: 'already-saved' }
    if (isSaving.value) return { ok: false, reason: 'in-flight' }

    isSaving.value = true
    const myReqId = ++saveReqId
    try {
      // Lazy import to avoid a circular dep — wordbook store imports session
      // store in some setups, so we resolve on demand.
      const { useWordbookStore } = await import('@/stores/wordbook')
      const store = useWordbookStore()
      const item = await store.addItem({
        term: cur.word,
        meaning: cur.meaning,
        source: 'popup',
        source_ref: null,
      })
      if (myReqId !== saveReqId) return { ok: false, reason: 'stale' }
      if (item) {
        savedTerms.value.add(item.term.toLowerCase())
        isCurrentSaved.value = true
        return { ok: true, term: item.term }
      }
      return { ok: false, reason: 'no-item' }
    } catch (err) {
      return { ok: false, reason: (err as Error).message }
    } finally {
      if (myReqId === saveReqId) isSaving.value = false
    }
  }

  /**
   * Refresh the set of saved terms from the wordbook store. Call this on
   * app mount and after returning to the app from the wordbook page so the
   * popup's ★/☆ state stays in sync.
   */
  async function refreshSavedTerms(): Promise<void> {
    try {
      const { useWordbookStore } = await import('@/stores/wordbook')
      const store = useWordbookStore()
      const set = await store.collectAllSavedTerms()
      savedTerms.value = new Set(set.map((t) => t.toLowerCase()))
      if (popup.value) {
        isCurrentSaved.value = savedTerms.value.has(popup.value.word.toLowerCase())
      }
    } catch {
      // Store may not be ready yet — keep the empty set; the popup will
      // still work, just with ☆ instead of ★ until the next refresh.
    }
  }

  // ── Event handlers ──────────────────────────────────────────────────

  function onMouseUp(_e: Event) {
    // 150 ms debounce — long enough to absorb the second click of a
    // double-click (so we don't fire twice), short enough to feel instant.
    if (debounceTimer) window.clearTimeout(debounceTimer)
    debounceTimer = window.setTimeout(tryShow, 150)
  }

  function onDblClick(_e: Event) {
    // Double-click always selects a word (browser default).  Fire
    // immediately — the 150 ms mouseup debounce will be cancelled below.
    if (debounceTimer) window.clearTimeout(debounceTimer)
    debounceTimer = window.setTimeout(tryShow, 0)
  }

  function onMouseDown(e: MouseEvent) {
    const target = e.target as HTMLElement | null
    // Click inside the popup → let the popup handle it (play / close).
    if (target && target.closest('[data-word-popup]')) return
    // Click anywhere else → close the popup.
    close()
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
    document.addEventListener('dblclick', onDblClick)
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKeyDown)
  })

  onUnmounted(() => {
    document.removeEventListener('mouseup', onMouseUp)
    document.removeEventListener('touchend', onMouseUp)
    document.removeEventListener('dblclick', onDblClick)
    document.removeEventListener('mousedown', onMouseDown)
    document.removeEventListener('keydown', onKeyDown)
  })

  return {
    popup,
    isPlaying,
    isCurrentSaved,
    isSaving,
    savedTerms,
    playWord,
    close,
    saveCurrent,
    refreshSavedTerms,
  }
}
