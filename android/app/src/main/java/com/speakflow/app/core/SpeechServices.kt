package com.speakflow.app.core

import android.content.Context
import android.content.Intent
import android.media.MediaPlayer
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.speech.tts.TextToSpeech
import java.io.File
import java.io.FileOutputStream
import java.util.Locale
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

/**
 * 语音识别服务(英文 STT)—— 封装 Android SpeechRecognizer。
 * 对应 iOS SpeakFlowKit/Audio/SpeechServices.swift 的 ASRService(SFSpeechRecognizer)。
 *
 * 注意:SpeechRecognizer 全部方法必须在主线程调用;
 * 使用前需已获得 RECORD_AUDIO 运行时权限。
 */
class AsrService(private val context: Context) {

    var onPartialResult: ((String) -> Unit)? = null
    var onFinalResult: ((String) -> Unit)? = null
    var onError: ((String) -> Unit)? = null
    var onReadyForSpeech: (() -> Unit)? = null

    private val mainHandler = Handler(Looper.getMainLooper())
    private var recognizer: SpeechRecognizer? = null

    val isAvailable: Boolean
        get() = SpeechRecognizer.isRecognitionAvailable(context)

    /** 开始识别(内部切主线程)。识别英文 en-US。 */
    fun start() {
        mainHandler.post {
            destroyInternal()
            if (!SpeechRecognizer.isRecognitionAvailable(context)) {
                onError?.invoke("本机语音识别服务不可用,请检查 Google 语音服务")
                return@post
            }
            val rec = SpeechRecognizer.createSpeechRecognizer(context)
            rec.setRecognitionListener(object : RecognitionListener {
                override fun onReadyForSpeech(params: Bundle?) {
                    onReadyForSpeech?.invoke()
                }

                override fun onPartialResults(partialResults: Bundle?) {
                    val text = partialResults
                        ?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                        ?.firstOrNull()
                    if (!text.isNullOrEmpty()) onPartialResult?.invoke(text)
                }

                override fun onResults(results: Bundle?) {
                    val text = results
                        ?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                        ?.firstOrNull()
                    onFinalResult?.invoke(text.orEmpty())
                }

                override fun onError(error: Int) {
                    // ERROR_NO_MATCH(7)/ERROR_SPEECH_TIMEOUT(6) 不算致命错误
                    when (error) {
                        SpeechRecognizer.ERROR_NO_MATCH,
                        SpeechRecognizer.ERROR_SPEECH_TIMEOUT,
                        -> onFinalResult?.invoke("")
                        SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS ->
                            onError?.invoke("缺少录音权限")
                        else -> onError?.invoke("识别失败(code=$error)")
                    }
                }

                override fun onBeginningOfSpeech() {}
                override fun onRmsChanged(rmsdB: Float) {}
                override fun onBufferReceived(buffer: ByteArray?) {}
                override fun onEndOfSpeech() {}
                override fun onEvent(eventType: Int, params: Bundle?) {}
            })
            recognizer = rec

            val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
                putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                putExtra(RecognizerIntent.EXTRA_LANGUAGE, "en-US")
                putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, "en-US")
                putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
                putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
            }
            rec.startListening(intent)
        }
    }

    /** 停止并取最终结果 */
    fun stop() {
        mainHandler.post { recognizer?.stopListening() }
    }

    /** 取消(不出最终结果)并释放 */
    fun destroy() {
        mainHandler.post { destroyInternal() }
    }

    private fun destroyInternal() {
        try {
            recognizer?.cancel()
            recognizer?.destroy()
        } catch (e: Exception) {
            // 忽略重复释放
        }
        recognizer = null
    }
}

/**
 * 语音合成服务(TTS)。
 * 对应 iOS SpeechServices.swift 的 TTSService:
 * - 优先调后端 /api/tts(MiniMax 大模型音色),失败时回退系统 TextToSpeech
 * - 后端返回 mp3 base64,写临时文件后用 MediaPlayer 播放
 */
class TtsService(
    private val context: Context,
    private val apiClient: ApiClient,
    private val settings: SettingsStore,
) {

    @Volatile
    var isSpeaking: Boolean = false
        private set

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private val mainHandler = Handler(Looper.getMainLooper())

    private var mediaPlayer: MediaPlayer? = null
    private var tts: TextToSpeech? = null
    private var ttsReady = false

    init {
        tts = TextToSpeech(context) { status ->
            ttsReady = status == TextToSpeech.SUCCESS
            if (ttsReady) {
                tts?.language = Locale.US
                tts?.setSpeechRate(0.9f)
            }
        }
    }

    /** 朗读英文文本:优先后端 MiniMax,失败回退系统 TTS */
    fun speak(text: String, speed: Double = 0.9) {
        if (text.isBlank()) return
        stopCurrentPlayback()
        scope.launch {
            try {
                val audio = apiClient.synthesize(text, settings.voiceId, speed)
                playRemoteAudio(audio)
            } catch (e: Exception) {
                speakLocal(text)
            }
        }
    }

    /** 停止播放 */
    fun stop() {
        stopCurrentPlayback()
    }

    /** 页面销毁时调用 */
    fun shutdown() {
        stopCurrentPlayback()
        tts?.shutdown()
        tts = null
    }

    private fun stopCurrentPlayback() {
        try {
            mediaPlayer?.stop()
            mediaPlayer?.release()
        } catch (e: Exception) {
            // 忽略状态机异常
        }
        mediaPlayer = null
        tts?.stop()
        isSpeaking = false
    }

    /** 调用方已在主线程(scope 基于 Dispatchers.Main) */
    private fun playRemoteAudio(bytes: ByteArray) {
        try {
            // MediaPlayer 不能直接播 byte[],写缓存临时文件
            val tmp = File.createTempFile("sf_tts_", ".mp3", context.cacheDir)
            FileOutputStream(tmp).use { it.write(bytes) }
            val player = MediaPlayer()
            player.setDataSource(tmp.absolutePath)
            player.setOnCompletionListener {
                isSpeaking = false
                it.release()
                if (mediaPlayer === it) mediaPlayer = null
                tmp.delete()
            }
            player.setOnErrorListener { mp, _, _ ->
                isSpeaking = false
                mp.release()
                if (mediaPlayer === mp) mediaPlayer = null
                tmp.delete()
                true
            }
            player.prepare()
            mediaPlayer = player
            player.start()
            isSpeaking = true
        } catch (e: Exception) {
            isSpeaking = false
        }
    }

    private fun speakLocal(text: String) {
        mainHandler.post {
            if (ttsReady) {
                isSpeaking = true
                tts?.speak(text, TextToSpeech.QUEUE_FLUSH, null, "speakflow_tts")
            }
        }
    }
}
