import { ref, onUnmounted } from 'vue'

/**
 * useBrowserSTT — fallback ASR using the browser's built-in Web Speech API
 * (Chrome / Edge / Safari support SpeechRecognition; Firefox does not).
 *
 * Returns the user's transcribed text. If the browser does not support it,
 * the caller can fall back to text input.
 *
 * This avoids requiring a server-side ASR endpoint, and works in real-time
 * (interim results visible while the user speaks).
 */

type AnyWindow = Window & {
  SpeechRecognition?: new () => SpeechRecognition
  webkitSpeechRecognition?: new () => SpeechRecognition
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  start: () => void
  stop: () => void
  abort: () => void
  onresult: ((e: SpeechRecognitionEvent) => void) | null
  onerror: ((e: SpeechRecognitionErrorEvent) => void) | null
  onend: (() => void) | null
  onstart: (() => void) | null
}

interface SpeechRecognitionEvent {
  resultIndex: number
  results: ArrayLike<ArrayLike<{ transcript: string; confidence: number }>> & {
    [k: number]: { isFinal: boolean; 0: { transcript: string; confidence: number } }
  }
}

interface SpeechRecognitionErrorEvent {
  error: string
  message?: string
}

// Best-effort human message for the most common SpeechRecognition errors.
// Anything not listed falls through to a generic "识别失败" message.
function describeRecognitionError(code: string): string {
  switch (code) {
    case 'not-allowed':
    case 'service-not-allowed':
      return '麦克风权限被拒绝,请在浏览器设置中允许。'
    case 'no-speech':
      return '没有检测到语音,请靠近麦克风再说一次。'
    case 'audio-capture':
      return '无法访问麦克风,请检查设备是否被其他程序占用。'
    case 'network':
      return '语音识别服务连接失败(网络问题),请稍后再试。'
    case 'aborted':
      return '识别被中断。'
    case 'language-not-supported':
      return '当前语言不支持,请改用 Chrome / Edge / Safari 后再试。'
    default:
      return `识别失败 (${code})。请重试,或直接用文字输入。`
  }
}

export interface UseBrowserSTTOptions {
  lang?: string
  /**
   * Default: true.  The press-and-hold use case needs the recognizer to keep
   * listening across mid-sentence pauses until the caller explicitly calls
   * `stop()`.  Set this to false if you want auto-end on silence.
   */
  continuous?: boolean
  interimResults?: boolean
}

export function useBrowserSTT(options: UseBrowserSTTOptions = {}) {
  const isListening = ref(false)
  const isPreparing = ref(false)
  const error = ref<string | null>(null)
  const notSupported = ref(false)
  const interimText = ref('')
  const finalText = ref('')
  // lastResult: kept after recognition ends, so the UI can still show what
  // was heard even after `isListening` flips to false.
  const lastResult = ref('')

  let recognition: SpeechRecognition | null = null
  let onFinal: ((text: string) => void) | null = null
  let endWaiters: Array<() => void> = []
  let firedFinal = false

  function isBrowserSupported(): boolean {
    if (typeof window === 'undefined') return false
    const w = window as AnyWindow
    return !!(w.SpeechRecognition || w.webkitSpeechRecognition)
  }

  function buildRecognizer(): SpeechRecognition {
    const w = window as AnyWindow
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition
    if (!Ctor) throw new Error('当前浏览器不支持语音识别,请用 Chrome / Edge / Safari,或改用文字输入。')
    const r = new Ctor()
    r.lang = options.lang ?? 'en-US'
    // Press-and-hold / "follow along" needs continuous listening — otherwise
    // the recognizer ends the session on the first mid-sentence pause and
    // the user loses the rest of their speech.
    r.continuous = options.continuous ?? true
    r.interimResults = options.interimResults ?? true
    return r
  }

  function deliverFinal() {
    if (firedFinal) return
    firedFinal = true
    const text = (finalText.value + ' ' + interimText.value).replace(/\s+/g, ' ').trim()
    lastResult.value = text
    if (text && onFinal) onFinal(text)
  }

  async function start(onFinalCallback: (text: string) => void): Promise<void> {
    if (isListening.value) return
    if (!isBrowserSupported()) {
      notSupported.value = true
      error.value = '当前浏览器不支持语音识别,请用 Chrome / Edge / Safari,或改用文字输入。'
      console.warn('[useBrowserSTT] SpeechRecognition not supported in this browser.')
      throw new Error(error.value)
    }
    error.value = null
    interimText.value = ''
    finalText.value = ''
    lastResult.value = ''
    firedFinal = false
    onFinal = onFinalCallback
    isPreparing.value = true
    console.log('[useBrowserSTT] start: building recognizer…')
    try {
      recognition = buildRecognizer()
      recognition.onstart = () => {
        console.log('[useBrowserSTT] onstart fired')
        isPreparing.value = false
        isListening.value = true
      }
      recognition.onresult = (e) => {
        let interim = ''
        let final = ''
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const res = e.results[i]
          if (res.isFinal) final += res[0].transcript
          else interim += res[0].transcript
        }
        if (interim) interimText.value = interim
        if (final) {
          // Accumulate all finals — we only call onFinal once, from onend.
          finalText.value = (finalText.value + ' ' + final).replace(/\s+/g, ' ').trim()
        }
        console.log('[useBrowserSTT] onresult', { interim, final, finalText: finalText.value })
      }
      recognition.onerror = (e) => {
        const msg = describeRecognitionError(e.error)
        error.value = msg
        isListening.value = false
        // Make sure any pending stop() waiter resolves with whatever we have,
        // and that the UI shows an error instead of hanging.
        lastResult.value = ''
        console.warn('[useBrowserSTT] onerror', e.error, e.message, '->', msg)
        const waiters = endWaiters
        endWaiters = []
        for (const w of waiters) w()
      }
      recognition.onend = () => {
        console.log('[useBrowserSTT] onend fired, finalText=', JSON.stringify(finalText.value), 'interimText=', JSON.stringify(interimText.value))
        isListening.value = false
        deliverFinal()
        const waiters = endWaiters
        endWaiters = []
        for (const w of waiters) w()
      }
      recognition.start()
      console.log('[useBrowserSTT] recognition.start() called, awaiting onstart…')
    } catch (e) {
      const msg = e instanceof Error ? e.message : '无法启动语音识别'
      error.value = msg
      isListening.value = false
      console.error('[useBrowserSTT] start threw', e)
      throw e
    } finally {
      isPreparing.value = false
    }
  }

  /**
   * Stops the recognizer and resolves with the final text once `onend`
   * fires (or after an internal safety timeout, so the UI never hangs).
   */
  function stop(): Promise<string> {
    return new Promise<string>((resolve) => {
      if (!recognition) {
        const text = (finalText.value + ' ' + interimText.value).replace(/\s+/g, ' ').trim()
        lastResult.value = text
        console.log('[useBrowserSTT] stop: no recognizer, resolving with', JSON.stringify(text))
        resolve(text)
        return
      }
      try {
        recognition.stop()
        console.log('[useBrowserSTT] stop: recognition.stop() called, awaiting onend…')
      } catch (e) {
        console.warn('[useBrowserSTT] stop: recognition.stop() threw', e)
      }
      const safety = window.setTimeout(() => {
        // If onend never fires (browser quirk), still hand the caller a
        // best-effort transcript so the UI doesn't look frozen.
        const text = (finalText.value + ' ' + interimText.value).replace(/\s+/g, ' ').trim()
        lastResult.value = text
        if (!firedFinal && text && onFinal) {
          firedFinal = true
          onFinal(text)
        }
        isListening.value = false
        console.warn('[useBrowserSTT] stop: safety timeout fired, resolving with', JSON.stringify(text))
        resolve(text)
      }, 1500)
      endWaiters.push(() => {
        window.clearTimeout(safety)
        const text = (finalText.value + ' ' + interimText.value).replace(/\s+/g, ' ').trim()
        lastResult.value = text
        resolve(text)
      })
    })
  }

  function abort(): void {
    if (recognition) {
      try { recognition.abort() } catch { /* noop */ }
    }
    isListening.value = false
    interimText.value = ''
    finalText.value = ''
    lastResult.value = ''
  }

  onUnmounted(() => abort())

  return {
    isListening,
    isPreparing,
    notSupported,
    error,
    interimText,
    finalText,
    lastResult,
    start,
    stop,
    abort,
    isBrowserSupported,
  }
}
