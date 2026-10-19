package com.speakflow.app.core

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import kotlinx.serialization.json.putJsonObject
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener

/**
 * 实时会话 WebSocket 客户端。
 * 对应 iOS SpeakFlowKit/Networking/WebSocketClient.swift,
 * 协议按本地后端 backend/src/ws/session-ws.ts:
 * - 端点: {baseUrl}/ws/session/:id (http→ws, https→wss)
 * - 客户端发送: {type:"text", payload:{content}} / {type:"ping"} /
 *   {type:"request_tts", payload:{text}} / audio_chunk / audio_end
 * - 服务端推送: ready / transcript_partial / transcript_final / ai_message /
 *   ai_audio_url / ai_audio_chunk / score / session_state / error / pong
 *   (统一 envelope: {type, payload, ts})
 */
class WebSocketClient(
    private val settings: SettingsStore,
    private val onEvent: (WsServerEvent) -> Unit,
) {

    private val json = Json { ignoreUnknownKeys = true }

    private val client = OkHttpClient.Builder()
        .pingInterval(20, java.util.concurrent.TimeUnit.SECONDS)
        .build()

    private var webSocket: WebSocket? = null

    /** 连接到指定会话 */
    fun connect(sessionId: String) {
        disconnect()
        val wsUrl = settings.baseUrl
            .replaceFirst(Regex("^http"), "ws") + "/ws/session/$sessionId"
        val req = Request.Builder().url(wsUrl).build()
        webSocket = client.newWebSocket(req, object : WebSocketListener() {
            override fun onMessage(webSocket: WebSocket, text: String) {
                val event = try {
                    parseWsServerEvent(text, json)
                } catch (e: Exception) {
                    WsServerEvent.Error("PARSE_ERROR", "解析失败: ${e.message}")
                }
                onEvent(event)
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                onEvent(WsServerEvent.Error("WS_FAILURE", t.message ?: "连接失败"))
            }

            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                onEvent(WsServerEvent.Closed)
            }
        })
    }

    /** 发送文本回合(绕过 ASR,直接走 LLM 对话) */
    fun sendText(content: String): Boolean = send(buildJsonObject {
        put("type", "text")
        putJsonObject("payload") { put("content", content) }
    }.toString())

    /** 请求服务端合成一段文本的 TTS 音频 */
    fun requestTts(text: String): Boolean = send(buildJsonObject {
        put("type", "request_tts")
        putJsonObject("payload") { put("text", text) }
    }.toString())

    /** 推送一帧录音(PCM 等,base64) */
    fun sendAudioChunk(audioBase64: String): Boolean = send(buildJsonObject {
        put("type", "audio_chunk")
        putJsonObject("payload") { put("audio_base64", audioBase64) }
    }.toString())

    /** 结束录音,触发服务端 ASR 收尾 */
    fun sendAudioEnd(): Boolean = send(buildJsonObject {
        put("type", "audio_end")
    }.toString())

    fun ping(): Boolean = send(buildJsonObject { put("type", "ping") }.toString())

    fun disconnect() {
        webSocket?.close(1000, null)
        webSocket = null
    }

    private fun send(text: String): Boolean = webSocket?.send(text) ?: false
}
