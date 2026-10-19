package com.speakflow.app.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.List
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SuggestionChip
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.speakflow.app.SpeakFlowApp
import com.speakflow.app.core.Scenario
import com.speakflow.app.core.difficultyLabel
import com.speakflow.app.ui.theme.Accent500
import com.speakflow.app.ui.theme.Brand500
import com.speakflow.app.ui.theme.Ink400
import kotlinx.coroutines.launch

/**
 * 场景数据共享仓库(手动单例):
 * 列表页加载成功后缓存,详情页直接按 id 取,避免重复请求。
 */
object ScenarioRepository {
    var scenarios: List<Scenario> = emptyList()
        private set

    fun update(list: List<Scenario>) {
        scenarios = list
    }

    suspend fun load(forceRefresh: Boolean = false): List<Scenario> {
        if (!forceRefresh && scenarios.isNotEmpty()) return scenarios
        val app = SpeakFlowApp.instance
        scenarios = try {
            // 在线:后端 /api/scenarios
            app.apiClient.fetchScenarios()
        } catch (e: Exception) {
            // 离线:回退 assets 内 scenarios.json(与 iOS loadScenarioMetadata 一致)
            app.scenarioLoader.loadScenarioMetadata()
        }
        return scenarios
    }

    fun byId(id: String): Scenario? = scenarios.firstOrNull { it.id == id }
}

/** 业务分类中文展示名(与 iOS businessCategory 一致) */
fun categoryTitle(category: String): String = when (category.lowercase()) {
    "communication", "sales", "business" -> "商务洽谈"
    "refine" -> "订单对接"
    "operations", "product" -> "生产质量"
    "process", "weaving" -> "工艺技术"
    "logistics" -> "物流关务"
    "service" -> "售后财务"
    "local" -> "本地场景"
    else -> category
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ScenariosScreen(
    onScenarioClick: (String) -> Unit,
    onHistoryClick: () -> Unit,
    onSettingsClick: () -> Unit,
) {
    var isLoading by remember { mutableStateOf(true) }
    var isOffline by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var scenarios by remember { mutableStateOf<List<Scenario>>(emptyList()) }
    val scope = rememberCoroutineScope()

    fun load() {
        scope.launch {
            isLoading = true
            errorMessage = null
            val app = SpeakFlowApp.instance
            scenarios = try {
                val list = app.apiClient.fetchScenarios()
                ScenarioRepository.update(list)
                isOffline = false
                list
            } catch (e: Exception) {
                // 离线兜底:assets/scenarios.json
                val local = try {
                    app.scenarioLoader.loadScenarioMetadata()
                } catch (e2: Exception) {
                    emptyList()
                }
                ScenarioRepository.update(local)
                isOffline = true
                errorMessage = e.message
                local
            }
            isLoading = false
        }
    }

    LaunchedEffect(Unit) { load() }

    // 按分类分组,保持出现顺序
    val grouped: List<Pair<String, List<Scenario>>> = remember(scenarios) {
        val order = ArrayList<String>()
        val map = LinkedHashMap<String, MutableList<Scenario>>()
        for (s in scenarios) {
            val cat = s.category ?: "其他"
            if (!map.containsKey(cat)) {
                order.add(cat)
                map[cat] = ArrayList()
            }
            map[cat]?.add(s)
        }
        order.map { it to (map[it] ?: emptyList()) }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("SpeakFlow 口语练习") },
                actions = {
                    IconButton(onClick = onHistoryClick) {
                        Icon(Icons.Default.List, contentDescription = "历史记录")
                    }
                    IconButton(onClick = onSettingsClick) {
                        Icon(Icons.Default.Settings, contentDescription = "设置")
                    }
                },
            )
        },
    ) { padding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding),
        ) {
            when {
                isLoading -> Column(
                    modifier = Modifier.align(Alignment.Center),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    CircularProgressIndicator()
                    Spacer(Modifier.height(12.dp))
                    Text("加载场景…", color = Ink400)
                }

                scenarios.isEmpty() -> Column(
                    modifier = Modifier
                        .align(Alignment.Center)
                        .padding(24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Text("暂无可用场景", style = MaterialTheme.typography.titleMedium)
                    errorMessage?.let {
                        Spacer(Modifier.height(8.dp))
                        Text(it, color = MaterialTheme.colorScheme.error)
                    }
                    Spacer(Modifier.height(12.dp))
                    androidx.compose.material3.Button(onClick = { load() }) {
                        Text("重试")
                    }
                }

                else -> LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = androidx.compose.foundation.layout.PaddingValues(12.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    if (isOffline) {
                        item(key = "offline_banner") {
                            Card(modifier = Modifier.fillMaxWidth()) {
                                Column(Modifier.padding(12.dp)) {
                                    Text(
                                        "离线模式 · 展示本地场景",
                                        style = MaterialTheme.typography.labelMedium,
                                        color = Accent500,
                                    )
                                    errorMessage?.let {
                                        Text(
                                            "原因:$it",
                                            style = MaterialTheme.typography.labelSmall,
                                            color = Ink400,
                                        )
                                    }
                                }
                            }
                        }
                    }
                    grouped.forEach { (category, list) ->
                        item(key = "header_$category") {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                modifier = Modifier.padding(vertical = 4.dp),
                            ) {
                                Text(
                                    categoryTitle(category),
                                    style = MaterialTheme.typography.titleSmall,
                                    fontWeight = FontWeight.SemiBold,
                                    color = Brand500,
                                )
                                Spacer(Modifier.width(8.dp))
                                Text(
                                    "${list.size} 个场景",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = Ink400,
                                )
                            }
                        }
                        items(list, key = { it.id }) { scenario ->
                            ScenarioCard(scenario = scenario, onClick = { onScenarioClick(scenario.id) })
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun ScenarioCard(scenario: Scenario, onClick: () -> Unit) {
    Card(onClick = onClick, modifier = Modifier.fillMaxWidth()) {
        Row(modifier = Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
            Text(scenario.displayIcon, style = MaterialTheme.typography.headlineMedium)
            Spacer(Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(scenario.displayTitle, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                if (scenario.displaySubtitle.isNotEmpty()) {
                    Text(scenario.displaySubtitle, style = MaterialTheme.typography.bodySmall, color = Ink400)
                }
                if (scenario.displayDescription.isNotEmpty()) {
                    Spacer(Modifier.height(4.dp))
                    Text(
                        scenario.displayDescription,
                        style = MaterialTheme.typography.bodySmall,
                        maxLines = 2,
                    )
                }
                Spacer(Modifier.height(6.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    scenario.levels.forEach { d ->
                        SuggestionChip(
                            onClick = onClick,
                            label = { Text(difficultyLabel(d), style = MaterialTheme.typography.labelSmall) },
                        )
                    }
                }
            }
        }
    }
}
