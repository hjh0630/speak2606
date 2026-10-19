package com.speakflow.app.core

import java.util.concurrent.TimeUnit
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody

/**
 * SpeakFlow REST API 客户端。
 * 对应 iOS SpeakFlowKit/Networking/APIClient.swift,
 * 但端点严格按本地 Node 后端 backend/src/routes/ 目录(端口 3001):
 * - GET  /api/scenarios
 * - GET  /api/scenarios/:id
 * - POST /api/sessions
 * - POST /api/sessions/:id/messages
 * - GET  /api/sessions/:id/prompts
 * - POST /api/sessions/:id/complete
 * - GET  /api/history
 * - GET  /api/stats
 * - GET  /api/dictionary?w=
 * - GET  /api/tts/voices
 * - POST /api/tts
 * - GET  /health
 *
 * baseUrl 每次调用都从 SettingsStore 读,设置页改完立即生效。
 */
class ApiClient(private val settings: SettingsStore) {

    private val json = Json {
        ignoreUnknownKeys = true
        encodeDefaults = true
    }

    private val client = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(60, TimeUnit.SECONDS) // LLM 打分/回复可能较慢
        .writeTimeout(30, TimeUnit.SECONDS)
        .build()

    private val baseUrl: String get() = settings.baseUrl

    // ---------- 场景 ----------

    /** 场景列表(后端返回 { items, count }) */
    suspend fun fetchScenarios(): List<Scenario> {
        val resp = get("/api/scenarios")
        return json.decodeFromString(ScenarioListResponse.serializer(), resp).items
    }

    // ---------- 会话 ----------

    suspend fun createSession(scenarioId: String, difficulty: String, mode: String): CreateSessionResponse {
        val body = json.encodeToString(
            CreateSessionRequest.serializer(),
            CreateSessionRequest(scenarioId, difficulty, mode),
        )
        val resp = post("/api/sessions", body)
        return json.decodeFromString(CreateSessionResponse.serializer(), resp)
    }

    /** 发送一轮用户消息,返回 AI 回复 + 评分 */
    suspend fun sendMessage(sessionId: String, content: String, mode: String? = null): SendMessageResponse {
        val body = json.encodeToString(
            SendMessageRequest.serializer(),
            SendMessageRequest(content, mode),
        )
        val resp = post("/api/sessions/$sessionId/messages", body)
        return json.decodeFromString(SendMessageResponse.serializer(), resp)
    }

    /** 跟读目标句(GET /api/sessions/:id/prompts) */
    suspend fun fetchPrompts(sessionId: String, difficulty: String? = null): List<RepeatPrompt> {
        val query = if (difficulty != null) "?difficulty=$difficulty" else ""
        val resp = get("/api/sessions/$sessionId/prompts$query")
        return json.decodeFromString(PromptsResponse.serializer(), resp).items
    }

    /** 结束会话 */
    suspend fun completeSession(sessionId: String, totalScore: Int? = null): CompleteSessionResponse {
        val body = if (totalScore != null) """{"total_score":$totalScore}""" else "{}"
        val resp = post("/api/sessions/$sessionId/complete", body)
        return json.decodeFromString(CompleteSessionResponse.serializer(), resp)
    }

    // ---------- 历史 ----------

    suspend fun fetchHistory(limit: Int = 50, offset: Int = 0): HistoryResponse {
        val resp = get("/api/history?limit=$limit&offset=$offset")
        return json.decodeFromString(HistoryResponse.serializer(), resp)
    }

    // ---------- 词典 ----------

    suspend fun lookupWord(word: String): DictionaryEntry {
        val encoded = java.net.URLEncoder.encode(word, "UTF-8")
        val resp = get("/api/dictionary?w=$encoded")
        return json.decodeFromString(DictionaryEntry.serializer(), resp)
    }

    // ---------- TTS ----------

    suspend fun fetchVoices(): List<TTSVoice> {
        val resp = get("/api/tts/voices")
        return json.decodeFromString(VoicesResponse.serializer(), resp).voices
    }

    /**
     * 调用后端 TTS 合成。
     * @throws ApiException mocked=true(后端无 MiniMax 凭证)或网络/解析失败时抛出,调用方回退本地 TTS
     */
    suspend fun synthesize(text: String, voiceId: String? = null, speed: Double = 1.0): ByteArray {
        val body = json.encodeToString(TtsRequest.serializer(), TtsRequest(text, voiceId, speed))
        val resp = post("/api/tts", body)
        val r = json.decodeFromString(TtsResponse.serializer(), resp)
        if (r.mocked) {
            throw ApiException(-1, "后端 TTS 为模拟模式: ${r.note ?: "无 MiniMax 凭证"}")
        }
        return android.util.Base64.decode(r.audioBase64, android.util.Base64.DEFAULT)
    }

    // ---------- 健康检查 ----------

    suspend fun health(): Boolean = withContext(Dispatchers.IO) {
        try {
            val req = Request.Builder().url("$baseUrl/health").get().build()
            client.newCall(req).execute().use { it.isSuccessful }
        } catch (e: Exception) {
            false
        }
    }

    // ---------- 内部 ----------

    private suspend fun get(path: String): String = withContext(Dispatchers.IO) {
        val req = Request.Builder()
            .url("$baseUrl$path")
            .header("X-User-Id", settings.userToken)
            .get()
            .build()
        client.newCall(req).execute().use { resp ->
            val body = resp.body?.string().orEmpty()
            if (!resp.isSuccessful) throw ApiException(resp.code, extractError(body, resp.code))
            body
        }
    }

    private suspend fun post(path: String, jsonBody: String): String = withContext(Dispatchers.IO) {
        val req = Request.Builder()
            .url("$baseUrl$path")
            .header("X-User-Id", settings.userToken)
            .post(jsonBody.toRequestBody("application/json; charset=utf-8".toMediaType()))
            .build()
        client.newCall(req).execute().use { resp ->
            val body = resp.body?.string().orEmpty()
            if (!resp.isSuccessful) throw ApiException(resp.code, extractError(body, resp.code))
            body
        }
    }

    /** 后端错误体为 { "error": { "code", "message" } },提取 message */
    private fun extractError(body: String, status: Int): String {
        return try {
            val obj = json.parseToJsonElement(body) as? kotlinx.serialization.json.JsonObject
            val err = obj?.get("error") as? kotlinx.serialization.json.JsonObject
            (err?.get("message") as? kotlinx.serialization.json.JsonPrimitive)?.content
                ?: "HTTP $status"
        } catch (e: Exception) {
            "HTTP $status"
        }
    }

    companion object {
        /** 本地兜底音色(与 iOS TTSVoice.fallbackVoices 一致) */
        val FALLBACK_VOICES = listOf(
            TTSVoice(id = "male-qn-qingse", name = "男生 · 清澈", gender = "male"),
            TTSVoice(id = "male-qn-badao", name = "男生 · 霸道", gender = "male"),
            TTSVoice(id = "male-qn-daxuesheng", name = "男生 · 年轻", gender = "male"),
            TTSVoice(id = "female-shaonv", name = "女生 · 少女", gender = "female"),
            TTSVoice(id = "female-yujie", name = "女生 · 成熟", gender = "female"),
            TTSVoice(id = "female-chengshu", name = "女生 · 知性", gender = "female"),
            TTSVoice(id = "female-tianmei", name = "女生 · 甜美", gender = "female"),
        )
    }
}
