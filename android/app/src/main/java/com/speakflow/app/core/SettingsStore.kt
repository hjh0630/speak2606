package com.speakflow.app.core

import android.content.Context
import android.content.SharedPreferences
import java.util.UUID

/**
 * 本地设置存储(SharedPreferences)。
 * 对应 iOS SpeakFlowKit/Storage/UserProfileStore.swift(UserDefaults)。
 * 主要存:服务器地址、用户 token、TTS 音色。
 */
class SettingsStore(context: Context) {

    private val prefs: SharedPreferences =
        context.getSharedPreferences("speakflow_settings", Context.MODE_PRIVATE)

    var baseUrl: String
        get() = prefs.getString(KEY_BASE_URL, DEFAULT_BASE_URL) ?: DEFAULT_BASE_URL
        set(value) = prefs.edit().putString(KEY_BASE_URL, value.trim().removeSuffix("/")).apply()

    /** 稳定的设备用户标识(首次生成 UUID,供后端按用户聚合历史) */
    val userToken: String
        get() {
            val existing = prefs.getString(KEY_USER_TOKEN, null)
            if (!existing.isNullOrEmpty()) return existing
            val created = UUID.randomUUID().toString()
            prefs.edit().putString(KEY_USER_TOKEN, created).apply()
            return created
        }

    /** 选中的后端 MiniMax 音色 ID;null 表示用后端默认 */
    var voiceId: String?
        get() = prefs.getString(KEY_VOICE_ID, null)?.takeIf { it.isNotEmpty() }
        set(value) = prefs.edit().putString(KEY_VOICE_ID, value).apply()

    fun resetBaseUrl() {
        prefs.edit().remove(KEY_BASE_URL).apply()
    }

    companion object {
        private const val KEY_BASE_URL = "base_url"
        private const val KEY_USER_TOKEN = "user_token"
        private const val KEY_VOICE_ID = "voice_id"

        /** 默认指向 Android 模拟器宿主机回环地址 */
        const val DEFAULT_BASE_URL = "http://10.0.2.2:3001"
    }
}
