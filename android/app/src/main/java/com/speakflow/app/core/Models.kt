package com.speakflow.app.core

import kotlinx.serialization.KSerializer
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.descriptors.SerialDescriptor
import kotlinx.serialization.descriptors.buildClassSerialDescriptor
import kotlinx.serialization.encoding.Decoder
import kotlinx.serialization.encoding.Encoder
import kotlinx.serialization.json.JsonDecoder
import kotlinx.serialization.json.JsonEncoder
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put

// ============================================================
// 数据模型 —— 与 iOS SpeakFlowKit/Models.swift 及后端
// backend/src/types.ts、frontend/src/types/api.ts 对齐
// ============================================================

// ---------- Scenario ----------

/**
 * 场景元数据。后端 /api/scenarios 返回的字段与 assets/scenarios.json 一致:
 * id / title_zh / title_en / description_zh / description_en / icon /
 * category / difficulty_levels …
 * iOS 端(Cloudflare Workers 后端)则用 title_zh / title_en / cover_emoji / difficulty[]。
 * 这里全部做成可选字段,两种来源都能解码。
 */
@Serializable
data class Scenario(
    val id: String,
    @SerialName("title_zh") val titleZh: String? = null,
    @SerialName("title_en") val titleEn: String? = null,
    val title: String? = null,
    val description: String? = null,
    @SerialName("description_zh") val descriptionZh: String? = null,
    @SerialName("description_en") val descriptionEn: String? = null,
    val category: String? = null,
    val subcategory: String? = null,
    @SerialName("difficulty_levels") val difficultyLevels: List<String>? = null,
    @SerialName("cover_emoji") val coverEmoji: String? = null,
    val icon: String? = null,
    @SerialName("ai_role_zh") val aiRoleZh: String? = null,
    @SerialName("user_role_zh") val userRoleZh: String? = null,
    @SerialName("key_skills") val keySkills: List<String>? = null,
    @SerialName("key_skills_zh") val keySkillsZh: List<String>? = null,
    @SerialName("industry_terms_sample") val industryTermsSample: List<String>? = null,
    @SerialName("estimated_minutes") val estimatedMinutes: Int? = null,
    val tags: List<String>? = null,
) {
    /** 展示用中文标题 */
    val displayTitle: String get() = titleZh ?: title ?: titleEn ?: id

    /** 展示用副标题(英文) */
    val displaySubtitle: String get() = titleEn ?: ""

    /** 展示用描述 */
    val displayDescription: String get() = descriptionZh ?: description ?: descriptionEn ?: ""

    /** 封面 emoji */
    val displayIcon: String get() = icon ?: coverEmoji ?: "🗣"

    /** 支持的难度列表,默认三档 */
    val levels: List<String> get() = difficultyLevels ?: listOf("beginner", "intermediate", "advanced")
}

// ---------- Dialog(本地剧本,与 iOS DialogRound 双格式解码对齐) ----------

enum class Speaker { user, partner, system }

/**
 * 单轮对话。自定义反序列化,兼容两种 JSON 格式(与 iOS DialogRound 一致):
 * 1. 后端协议格式: speaker / text_en / text_zh / prompt / hint / key_words
 * 2. assets 内容格式(72 个场景文件实际格式):
 *    round / ai_message / ai_message_zh / expected_user_response_hint /
 *    key_phrases(个别文件笔误为 key_phapes) / user_response_example
 */
@Serializable(with = DialogRoundSerializer::class)
data class DialogRound(
    val round: Int,
    val speaker: Speaker,
    val textEn: String,
    val textZh: String,
    val prompt: String? = null,
    val hint: String? = null,
    val keyWords: List<String>? = null,
)

object DialogRoundSerializer : KSerializer<DialogRound> {
    override val descriptor: SerialDescriptor = buildClassSerialDescriptor("DialogRound")

    override fun deserialize(decoder: Decoder): DialogRound {
        val obj = (decoder as JsonDecoder).decodeJsonElement() as JsonObject
        val round = (obj["round"] as? JsonPrimitive)?.intOrNull ?: 0

        fun str(key: String): String? = (obj[key] as? JsonPrimitive)?.contentOrNull
        fun strList(key: String): List<String>? =
            (obj[key] as? kotlinx.serialization.json.JsonArray)?.map { it.jsonPrimitive.content }

        return if (obj.containsKey("speaker")) {
            // 协议格式
            DialogRound(
                round = round,
                speaker = when (str("speaker")) {
                    "user" -> Speaker.user
                    "system" -> Speaker.system
                    else -> Speaker.partner
                },
                textEn = str("text_en") ?: "",
                textZh = str("text_zh") ?: "",
                prompt = str("prompt"),
                hint = str("hint"),
                keyWords = strList("key_words"),
            )
        } else {
            // assets 内容格式:客户先说,用户再答
            DialogRound(
                round = round,
                speaker = Speaker.partner,
                textEn = str("ai_message") ?: "",
                textZh = str("ai_message_zh") ?: "",
                prompt = str("user_response_example"),
                hint = str("expected_user_response_hint"),
                keyWords = strList("key_phrases") ?: strList("key_phapes"),
            )
        }
    }

    override fun serialize(encoder: Encoder, value: DialogRound) {
        val json = encoder as JsonEncoder
        json.encodeJsonElement(buildJsonObject {
            put("round", value.round)
            put("speaker", value.speaker.name)
            put("text_en", value.textEn)
            put("text_zh", value.textZh)
            value.prompt?.let { put("prompt", it) }
            value.hint?.let { put("hint", it) }
            value.keyWords?.let { list ->
                put("key_words", kotlinx.serialization.json.JsonArray(list.map { JsonPrimitive(it) }))
            }
        })
    }
}

/** 完整场景对话 JSON 结构(assets/Scenarios/ 目录下的 .json 文件) */
@Serializable
data class ScenarioDialog(
    @SerialName("scenario_id") val scenarioId: String,
    @SerialName("scenario_title_zh") val scenarioTitleZh: String = "",
    @SerialName("scenario_title_en") val scenarioTitleEn: String = "",
    val difficulty: String = "beginner",
    val rounds: List<DialogRound> = emptyList(),
)

// ---------- Dictionary ----------

/** 词典条目(与 /api/dictionary 响应及本地 Dictionary.json 对齐) */
@Serializable
data class DictionaryEntry(
    val word: String,
    val phonetic: String? = null,
    @SerialName("part_of_speech") val partOfSpeech: String? = null,
    @SerialName("definition_en") val definitionEn: String? = null,
    @SerialName("definition_zh") val definitionZh: String? = null,
    val example: String? = null,
    val source: String = "local",
)

// ---------- Session / Message / Score ----------

/** 评分反馈(与 backend/src/types.ts ScoreFeedback 完全对齐) */
@Serializable
data class ScoreFeedback(
    @SerialName("overall_score") val overallScore: Int = 0,
    val fluency: Int = 0,
    val accuracy: Int = 0,
    @SerialName("key_issues") val keyIssues: List<String> = emptyList(),
    val suggestion: String = "",
)

/** 会话内消息 */
@Serializable
data class SessionMessage(
    val id: Long = 0,
    val role: String = "user",
    val content: String = "",
    @SerialName("audio_url") val audioUrl: String? = null,
    val score: Int? = null,
    val fluency: Int? = null,
    val accuracy: Int? = null,
    @SerialName("created_at") val createdAt: Long = 0,
)

/** POST /api/sessions 请求体 */
@Serializable
data class CreateSessionRequest(
    @SerialName("scenario_id") val scenarioId: String,
    val difficulty: String,
    val mode: String,
)

/** POST /api/sessions 响应(201) */
@Serializable
data class CreateSessionResponse(
    @SerialName("session_id") val sessionId: String,
    @SerialName("scenario_id") val scenarioId: String,
    val difficulty: String,
    val mode: String,
    val status: String,
    @SerialName("started_at") val startedAt: Long,
)

/** POST /api/sessions/:id/messages 请求体 */
@Serializable
data class SendMessageRequest(
    val content: String,
    val mode: String? = null,
)

/** POST /api/sessions/:id/messages 响应中的用户消息部分 */
@Serializable
data class UserMessageEcho(
    val id: Long = 0,
    val content: String = "",
    @SerialName("created_at") val createdAt: Long = 0,
)

/**
 * POST /api/sessions/:id/messages 响应。
 * 注意:后端 ai_message 是纯字符串(String),不是对象 —— 见 sessions.ts 第 332 行。
 */
@Serializable
data class SendMessageResponse(
    @SerialName("user_message") val userMessage: UserMessageEcho,
    @SerialName("ai_message") val aiMessage: String,
    @SerialName("ai_audio_url") val aiAudioUrl: String? = null,
    val score: ScoreFeedback? = null,
    @SerialName("round_index") val roundIndex: Int = 0,
)

/** GET /api/sessions/:id/prompts 的 items 元素(跟读目标句) */
@Serializable
data class RepeatPrompt(
    val id: String,
    val text: String,
    val translation: String? = null,
    val difficulty: String? = null,
)

@Serializable
data class PromptsResponse(
    val items: List<RepeatPrompt> = emptyList(),
)

/** POST /api/sessions/:id/complete 响应 */
@Serializable
data class CompleteSessionResponse(
    @SerialName("session_id") val sessionId: String,
    val status: String = "completed",
    @SerialName("ended_at") val endedAt: Long? = null,
    @SerialName("total_score") val totalScore: Int? = null,
    @SerialName("duration_sec") val durationSec: Int = 0,
    @SerialName("message_count") val messageCount: Int = 0,
    val messages: List<SessionMessage> = emptyList(),
)

/** GET /api/history items 元素(与 backend history.ts 对齐) */
@Serializable
data class HistoryItem(
    val id: String,
    @SerialName("scenario_id") val scenarioId: String,
    val difficulty: String = "beginner",
    val mode: String = "free",
    @SerialName("started_at") val startedAt: Long = 0,
    @SerialName("ended_at") val endedAt: Long? = null,
    @SerialName("total_score") val totalScore: Int? = null,
    val status: String = "active",
    @SerialName("round_index") val roundIndex: Int = 0,
    @SerialName("message_count") val messageCount: Int = 0,
    @SerialName("duration_sec") val durationSec: Int = 0,
)

@Serializable
data class HistoryResponse(
    val items: List<HistoryItem> = emptyList(),
    val total: Int = 0,
    val limit: Int = 0,
    val offset: Int = 0,
)

/** GET /api/scenarios 响应 */
@Serializable
data class ScenarioListResponse(
    val items: List<Scenario> = emptyList(),
    val count: Int = 0,
)

// ---------- TTS ----------

/** 后端 MiniMax TTS 音色 */
@Serializable
data class TTSVoice(
    val id: String,
    val name: String,
    val gender: String = "",
)

@Serializable
data class VoicesResponse(
    val voices: List<TTSVoice> = emptyList(),
    @SerialName("default_voice_id") val defaultVoiceId: String? = null,
)

/** POST /api/tts 请求体 */
@Serializable
data class TtsRequest(
    val text: String,
    @SerialName("voice_id") val voiceId: String? = null,
    val speed: Double = 1.0,
)

/** POST /api/tts 响应 */
@Serializable
data class TtsResponse(
    val mocked: Boolean = false,
    @SerialName("audio_base64") val audioBase64: String = "",
    val mime: String? = null,
    val note: String? = null,
)

// ---------- WebSocket(与 backend/src/ws/session-ws.ts 协议对齐) ----------

/** 服务端 → 客户端 WS 事件(envelope: {type, payload, ts}) */
sealed interface WsServerEvent {
    data class Ready(val sessionId: String, val difficulty: String, val mode: String) : WsServerEvent
    data class TranscriptPartial(val text: String) : WsServerEvent
    data class TranscriptFinal(val text: String, val mocked: Boolean) : WsServerEvent
    data class AiMessage(
        val content: String,
        val audioUrl: String?,
        val audioBase64: String?,
        val audioMime: String?,
        val mocked: Boolean,
        val roundIndex: Int,
    ) : WsServerEvent
    data class AiAudioUrl(val url: String) : WsServerEvent
    data class AiAudioChunk(val audioBase64: String, val mime: String) : WsServerEvent
    data class Score(val score: ScoreFeedback) : WsServerEvent
    data class SessionState(val roundIndex: Int) : WsServerEvent
    data class Error(val code: String, val message: String) : WsServerEvent
    data object Pong : WsServerEvent
    data object Closed : WsServerEvent
}

/** 解析一帧服务端 JSON 文本为事件 */
internal fun parseWsServerEvent(text: String, json: kotlinx.serialization.json.Json): WsServerEvent {
    val obj = json.parseToJsonElement(text) as JsonObject
    val type = (obj["type"] as? JsonPrimitive)?.contentOrNull ?: "unknown"
    val payload = obj["payload"] as? JsonObject ?: JsonObject(emptyMap())

    fun str(key: String): String? = (payload[key] as? JsonPrimitive)?.contentOrNull
    fun bool(key: String): Boolean = (payload[key] as? JsonPrimitive)?.booleanOrNull ?: false
    fun int(key: String): Int = (payload[key] as? JsonPrimitive)?.intOrNull ?: 0

    return when (type) {
        "ready" -> WsServerEvent.Ready(
            sessionId = str("session_id") ?: "",
            difficulty = str("difficulty") ?: "beginner",
            mode = str("mode") ?: "free",
        )
        "transcript_partial" -> WsServerEvent.TranscriptPartial(str("text") ?: "")
        "transcript_final" -> WsServerEvent.TranscriptFinal(str("text") ?: "", bool("mocked"))
        "ai_message" -> WsServerEvent.AiMessage(
            content = str("content") ?: "",
            audioUrl = str("audio_url"),
            audioBase64 = str("audio_base64"),
            audioMime = str("audio_mime"),
            mocked = bool("mocked"),
            roundIndex = int("round_index"),
        )
        "ai_audio_url" -> WsServerEvent.AiAudioUrl(str("url") ?: "")
        "ai_audio_chunk" -> WsServerEvent.AiAudioChunk(str("audio_base64") ?: "", str("mime") ?: "audio/mpeg")
        "score" -> WsServerEvent.Score(
            ScoreFeedback(
                overallScore = int("overall_score"),
                fluency = int("fluency"),
                accuracy = int("accuracy"),
                keyIssues = (payload["key_issues"] as? kotlinx.serialization.json.JsonArray)
                    ?.map { it.jsonPrimitive.content } ?: emptyList(),
                suggestion = str("suggestion") ?: "",
            )
        )
        "session_state" -> WsServerEvent.SessionState(int("round_index"))
        "error" -> WsServerEvent.Error(str("code") ?: "UNKNOWN", str("message") ?: "未知错误")
        "pong" -> WsServerEvent.Pong
        else -> WsServerEvent.Error("UNKNOWN_TYPE", "未知消息类型: $type")
    }
}

// ---------- 通用错误 ----------

class ApiException(val status: Int, message: String) : Exception(message)

/** difficulty 中文标签(与 iOS difficultyLabel 一致) */
fun difficultyLabel(d: String): String = when (d.lowercase()) {
    "beginner", "初级" -> "初级"
    "intermediate", "中级" -> "中级"
    "advanced", "高级" -> "高级"
    else -> d
}

/** mode 中文标签 */
fun modeLabel(m: String): String = when (m.lowercase()) {
    "repeat" -> "跟读模式"
    else -> "自由对话"
}
