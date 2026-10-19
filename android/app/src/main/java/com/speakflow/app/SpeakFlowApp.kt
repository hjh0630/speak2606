package com.speakflow.app

import android.app.Application
import com.speakflow.app.core.ApiClient
import com.speakflow.app.core.ScenarioLoader
import com.speakflow.app.core.SettingsStore
import com.speakflow.app.core.TtsService

/**
 * Application 入口,持有手动单例(不用 Hilt,保持简单)。
 * 对应 iOS 的 SpeakFlowKit 各 shared 实例。
 */
class SpeakFlowApp : Application() {

    lateinit var settings: SettingsStore
        private set
    lateinit var scenarioLoader: ScenarioLoader
        private set
    lateinit var apiClient: ApiClient
        private set
    lateinit var ttsService: TtsService
        private set

    override fun onCreate() {
        super.onCreate()
        settings = SettingsStore(this)
        scenarioLoader = ScenarioLoader(this)
        apiClient = ApiClient(settings)
        ttsService = TtsService(this, apiClient, settings)
        instance = this
    }

    companion object {
        lateinit var instance: SpeakFlowApp
            private set
    }
}
