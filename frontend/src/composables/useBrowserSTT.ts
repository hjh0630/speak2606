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

export interface UseBrowserSTTOptions {
  lang?: string
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

  let recognition: SpeechRecognition | null = null
  let onFinal: ((text: string) => void) | null = null

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
    r.continuous = options.continuous ?? false
    r.interimResults = options.interimResults ?? true
    return r
  }

  async function start(onFinalCallback: (text: string) => void): Promise<void> {
    if (isListening.value) return
    if (!isBrowserSupported()) {
      notSupported.value = true
      error.value = '当前浏览器不支持语音识别,请用 Chrome / Edge / Safari,或改用文字输入。'
      throw new Error(error.value)
    }
    error.value = null
    interimText.value = ''
    finalText.value = ''
    onFinal = onFinalCallback
    isPreparing.value = true
    try {
      recognition = buildRecognizer()
      recognition.onstart = () => {
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
          finalText.value += final
          if (onFinal) onFinal(finalText.value.trim())
        }
      }
      recognition.onerror = (e) => {
        const msg = e.error === 'not-allowed'
          ? '麦克风权限被拒绝,请在浏览器设置中允许。'
          : `识别失败: ${e.error}${e.message ? ' ' + e.message : ''}`
        error.value = msg
        isListening.value = false
      }
      recognition.onend = () => {
        isListening.value = false
        // ensure caller gets the final accumulated text if onFinal never fired
        if (finalText.value && onFinal) {
          onFinal(finalText.value.trim())
          finalText.value = ''
        }
      }
      recognition.start()
    } catch (e) {
      const msg = e instanceof Error ? e.message : '无法启动语音识别'
      error.value = msg
      isListening.value = false
      throw e
    } finally {
      isPreparing.value = false
    }
  }

  function stop(): void {
    if (recognition) {
      try { recognition.stop() } catch { /* noop */ }
    }
    isListening.value = false
  }

  function abort(): void {
    if (recognition) {
      try { recognition.abort() } catch { /* noop */ }
    }
    isListening.value = false
    interimText.value = ''
    finalText.value = ''
  }

  onUnmounted(() => abort())

  return {
    isListening,
    isPreparing,
    notSupported,
    error,
    interimText,
    finalText,
    start,
    stop,
    abort,
    isBrowserSupported,
  }
}
