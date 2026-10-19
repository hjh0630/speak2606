package com.speakflow.app.core

import android.content.Context
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonPrimitive

/**
 * 从 assets 加载场景对话 + 词典(离线可用)。
 * 对应 iOS SpeakFlowKit/Loading/ScenarioLoader.swift:
 * - assets/Scenarios/<id>.json 为初级(无后缀),<id>_intermediate.json / <id>_advanced.json 为中/高级
 * - assets/scenarios.json 为场景元数据(离线兜底)
 * - assets/Dictionary.json 为本地词典(map 格式: {word: [释义…]})
 */
class ScenarioLoader(private val context: Context) {

    private val json = Json { ignoreUnknownKeys = true }

    /** 对话缓存: fileName -> ScenarioDialog */
    private val dialogCache = HashMap<String, ScenarioDialog>()

    @Volatile
    private var scenarioMetadata: List<Scenario>? = null

    @Volatile
    private var dictionary: List<DictionaryEntry>? = null

    /**
     * 按场景 + 难度加载剧本,文件名规则与 iOS 一致;
     * 部分场景只有初级文件(如 trade_fair),加载失败时回退无后缀版本。
     */
    fun loadDialog(scenarioId: String, difficulty: String): ScenarioDialog {
        val suffix = when (difficulty.lowercase()) {
            "beginner", "初级" -> ""
            "intermediate", "中级" -> "_intermediate"
            "advanced", "高级" -> "_advanced"
            else -> "_${difficulty.lowercase()}"
        }
        return try {
            loadDialogByName(scenarioId + suffix)
        } catch (e: Exception) {
            if (suffix.isEmpty()) throw e
            loadDialogByName(scenarioId)
        }
    }

    @Synchronized
    fun loadDialogByName(fileName: String): ScenarioDialog {
        dialogCache[fileName]?.let { return it }
        val text = readAsset("Scenarios/$fileName.json")
        val dialog = json.decodeFromString(ScenarioDialog.serializer(), text)
        dialogCache[fileName] = dialog
        return dialog
    }

    /** 列出 assets 内全部场景文件基名(不含 .json) */
    fun allScenarioFiles(): List<String> {
        return try {
            context.assets.list("Scenarios")
                ?.filter { it.endsWith(".json") }
                ?.map { it.removeSuffix(".json") }
                ?: emptyList()
        } catch (e: Exception) {
            emptyList()
        }
    }

    /** assets/scenarios.json 场景元数据(离线兜底,字段与后端 /api/scenarios 一致) */
    @Synchronized
    fun loadScenarioMetadata(): List<Scenario> {
        scenarioMetadata?.let { return it }
        val text = readAsset("scenarios.json")
        val list = json.decodeFromString(kotlinx.serialization.builtins.ListSerializer(Scenario.serializer()), text)
        scenarioMetadata = list
        return list
    }

    /**
     * 加载本地词典。实际文件是 map: {"_comment": "...", "word": ["释义1","释义2"]},
     * 转成 DictionaryEntry(definitionZh 合并, source = "local"),与 iOS 一致。
     */
    @Synchronized
    fun loadDictionary(): List<DictionaryEntry> {
        dictionary?.let { return it }
        val text = readAsset("Dictionary.json")
        val obj = json.parseToJsonElement(text) as JsonObject
        val list = obj.entries.mapNotNull { (key, value) ->
            if (key == "_comment") return@mapNotNull null
            val defs = (value as? JsonArray)?.map { it.jsonPrimitive.content } ?: return@mapNotNull null
            DictionaryEntry(
                word = key,
                definitionZh = defs.joinToString("；"),
                source = "local",
            )
        }.sortedBy { it.word }
        dictionary = list
        return list
    }

    /** 只列 assets 里实际存在的难度(与 iOS localDifficulties 一致) */
    fun localDifficultiesFor(id: String, files: List<String> = allScenarioFiles()): List<String> {
        val result = ArrayList<String>(3)
        if (files.contains(id)) result.add("beginner")
        if (files.contains("${id}_intermediate")) result.add("intermediate")
        if (files.contains("${id}_advanced")) result.add("advanced")
        return result
    }

    private fun readAsset(path: String): String {
        return context.assets.open(path).bufferedReader(Charsets.UTF_8).use { it.readText() }
    }
}
