import { ref, onUnmounted } from 'vue'

// Pick a mime type MediaRecorder actually supports on this browser.  We
// prefer Opus in WebM; Safari/iOS get mp4.  Empty string lets the browser
// choose a default.
function pickMime(): string {
  if (typeof MediaRecorder === 'undefined') return ''
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/mp4;codecs=mp4a.40.2',
    'audio/mp4',
    'audio/wav',
  ]
  for (const c of candidates) {
    try {
      if (MediaRecorder.isTypeSupported(c)) return c
    } catch { /* noop */ }
  }
  return ''
}

export interface UseRecorderOptions {
  // timeslice in ms — when > 0 the recorder emits ondataavailable periodically
  timesliceMs?: number
}

export function useRecorder(options: UseRecorderOptions = {}) {
  const isRecording = ref(false)
  const isPreparing = ref(false)
  const error = ref<string | null>(null)
  const permissionDenied = ref(false)
  const durationMs = ref(0)
  const level = ref(0) // simple RMS level 0..1, useful for visual feedback
  const audioBlob = ref<Blob | null>(null)
  const mimeType = ref<string>('')

  let mediaStream: MediaStream | null = null
  let recorder: MediaRecorder | null = null
  let chunks: BlobPart[] = []
  let startTs = 0
  let levelTimer: number | null = null
  let audioCtx: AudioContext | null = null
  let analyser: AnalyserNode | null = null

  function clearLevelTimer() {
    if (levelTimer != null) {
      window.clearInterval(levelTimer)
      levelTimer = null
    }
  }

  function startLevelMonitor() {
    if (!mediaStream) return
    try {
      const Ctor = (window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)
      audioCtx = new Ctor()
      const src = audioCtx.createMediaStreamSource(mediaStream)
      analyser = audioCtx.createAnalyser()
      analyser.fftSize = 1024
      src.connect(analyser)
      const data = new Uint8Array(analyser.fftSize)
      levelTimer = window.setInterval(() => {
        if (!analyser) return
        analyser.getByteTimeDomainData(data)
        let sum = 0
        for (let i = 0; i < data.length; i++) {
          const v = (data[i] - 128) / 128
          sum += v * v
        }
        const rms = Math.sqrt(sum / data.length)
        level.value = Math.min(1, rms * 2.4)
        durationMs.value = Date.now() - startTs
      }, 100)
    } catch {
      // level monitoring is optional
    }
  }

  function stopLevelMonitor() {
    clearLevelTimer()
    if (audioCtx && audioCtx.state !== 'closed') {
      audioCtx.close().catch(() => undefined)
    }
    audioCtx = null
    analyser = null
  }

  async function ensureStream(): Promise<MediaStream> {
    if (mediaStream && mediaStream.active) return mediaStream
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('当前浏览器不支持麦克风录制,请改用文字输入。')
    }
    mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true })
    return mediaStream
  }

  async function start(): Promise<void> {
    if (isRecording.value) return
    error.value = null
    audioBlob.value = null
    isPreparing.value = true
    console.log('[useRecorder] start: requesting mic stream…')
    try {
      const stream = await ensureStream()
      const mime = pickMime()
      mimeType.value = mime
      chunks = []
      recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream)
      console.log('[useRecorder] start: MediaRecorder created, mime=', mime || '(browser default)')
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data)
      }
      recorder.onerror = (e: Event) => {
        const ev = e as unknown as { error?: { message?: string } }
        error.value = ev?.error?.message || '录音发生错误'
        console.error('[useRecorder] onerror', e)
      }
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: mime || 'audio/webm' })
        audioBlob.value = blob
        isRecording.value = false
        stopLevelMonitor()
        console.log('[useRecorder] onstop: blob size=', blob.size, 'mime=', blob.type)
      }
      const timeslice = options.timesliceMs ?? 250
      if (timeslice > 0) recorder.start(timeslice)
      else recorder.start()
      startTs = Date.now()
      isRecording.value = true
      startLevelMonitor()
      console.log('[useRecorder] start: recording, timeslice=', timeslice)
    } catch (e) {
      const msg = e instanceof Error ? e.message : '无法访问麦克风'
      if (/permission|denied|not allowed/i.test(msg)) permissionDenied.value = true
      error.value = msg
      isRecording.value = false
      console.error('[useRecorder] start failed:', msg)
      throw e
    } finally {
      isPreparing.value = false
    }
  }

  function stop(): Promise<Blob | null> {
    return new Promise((resolve) => {
      const r = recorder
      if (!r || r.state === 'inactive') {
        console.log('[useRecorder] stop: recorder inactive, returning cached blob, size=', audioBlob.value?.size ?? 0)
        resolve(audioBlob.value)
        return
      }
      r.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType.value || 'audio/webm' })
        audioBlob.value = blob
        isRecording.value = false
        stopLevelMonitor()
        console.log('[useRecorder] stop: blob ready, size=', blob.size)
        resolve(blob)
      }
      try {
        r.stop()
        console.log('[useRecorder] stop: MediaRecorder.stop() called')
      } catch (e) {
        console.warn('[useRecorder] stop threw', e)
        resolve(null)
      }
    })
  }

  function cancel() {
    if (recorder && recorder.state !== 'inactive') {
      try { recorder.stop() } catch { /* noop */ }
    }
    chunks = []
    audioBlob.value = null
    isRecording.value = false
    stopLevelMonitor()
  }

  function release() {
    cancel()
    if (mediaStream) {
      mediaStream.getTracks().forEach((t) => t.stop())
      mediaStream = null
    }
  }

  onUnmounted(() => release())

  return {
    isRecording,
    isPreparing,
    permissionDenied,
    error,
    durationMs,
    level,
    audioBlob,
    mimeType,
    start,
    stop,
    cancel,
    release,
  }
}
