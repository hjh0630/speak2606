import { ref, onUnmounted } from 'vue'
import { tts as apiTts } from '@/api/sessions'
import type { TtsResponse } from '@/types/api'

// TtsPlayer lazily requests audio from the backend and plays it with an
// HTMLAudioElement.  If the backend has no /api/tts (or returns an error),
// we silently fall back — callers should not block on the result.

export function useTts() {
  const isPlaying = ref(false)
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  let audio: HTMLAudioElement | null = null
  let objectUrl: string | null = null

  function cleanup() {
    if (audio) {
      audio.onended = null
      audio.onerror = null
      try { audio.pause() } catch { /* noop */ }
      audio = null
    }
    if (objectUrl) {
      try { URL.revokeObjectURL(objectUrl) } catch { /* noop */ }
      objectUrl = null
    }
    isPlaying.value = false
    isLoading.value = false
  }

  async function playUrl(url: string): Promise<void> {
    cleanup()
    audio = new Audio()
    audio.preload = 'auto'
    audio.crossOrigin = 'anonymous'
    audio.src = url
    return new Promise<void>((resolve) => {
      if (!audio) return resolve()
      audio.onended = () => { cleanup(); resolve() }
      audio.onerror = () => { error.value = '音频播放失败'; cleanup(); resolve() }
      audio.play().then(() => { isPlaying.value = true }).catch((e) => {
        error.value = e instanceof Error ? e.message : '无法播放'
        cleanup()
        resolve()
      })
    })
  }

  async function playText(text: string, voice?: string, speed?: number): Promise<TtsResponse | null> {
    if (!text) return null
    isLoading.value = true
    error.value = null
    try {
      const res = await apiTts({ text, voice, speed })
      await playUrl(res.url)
      return res
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'TTS failed'
      return null
    } finally {
      isLoading.value = false
    }
  }

  async function playBlob(blob: Blob): Promise<void> {
    cleanup()
    objectUrl = URL.createObjectURL(blob)
    await playUrl(objectUrl)
  }

  function stop() {
    cleanup()
  }

  onUnmounted(() => cleanup())

  return { playText, playBlob, playUrl, stop, isPlaying, isLoading, error }
}
