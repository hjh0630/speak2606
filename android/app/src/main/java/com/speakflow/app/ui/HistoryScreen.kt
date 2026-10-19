package com.speakflow.app.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
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
import com.speakflow.app.core.HistoryItem
import com.speakflow.app.core.difficultyLabel
import com.speakflow.app.core.modeLabel
import com.speakflow.app.ui.theme.Accent500
import com.speakflow.app.ui.theme.Ink400
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/** 历史会话列表(来自 GET /api/history) */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HistoryScreen(onBack: () -> Unit) {
    var isLoading by remember { mutableStateOf(true) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var historyItems by remember { mutableStateOf<List<HistoryItem>>(emptyList()) }
    var total by remember { mutableStateOf(0) }
    val scope = rememberCoroutineScope()

    fun load() {
        scope.launch {
            isLoading = true
            errorMessage = null
            try {
                val resp = SpeakFlowApp.instance.apiClient.fetchHistory(limit = 100)
                historyItems = resp.items
                total = resp.total
            } catch (e: Exception) {
                errorMessage = "加载历史失败:${e.message}\n请到「设置」检查服务器地址。"
            }
            isLoading = false
        }
    }

    LaunchedEffect(Unit) { load() }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("练习记录") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "返回")
                    }
                },
            )
        },
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding),
        ) {
            when {
                isLoading -> Column(
                    modifier = Modifier.fillMaxSize(),
                    verticalArrangement = Arrangement.Center,
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    CircularProgressIndicator()
                }

                errorMessage != null -> Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(24.dp),
                    verticalArrangement = Arrangement.Center,
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Text(errorMessage!!, color = MaterialTheme.colorScheme.error)
                    Spacer(Modifier.height(12.dp))
                    Button(onClick = { load() }) { Text("重试") }
                }

                historyItems.isEmpty() -> Column(
                    modifier = Modifier.fillMaxSize(),
                    verticalArrangement = Arrangement.Center,
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Text("还没有练习记录,去开始第一次练习吧", color = Ink400)
                }

                else -> {
                    Text(
                        "共 $total 次练习",
                        style = MaterialTheme.typography.labelMedium,
                        color = Ink400,
                        modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                    )
                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = androidx.compose.foundation.layout.PaddingValues(
                            start = 12.dp, end = 12.dp, bottom = 12.dp,
                        ),
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                    ) {
                        items(historyItems, key = { it.id }) { item ->
                            HistoryCard(item)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun HistoryCard(item: HistoryItem) {
    // 场景标题:优先用仓库缓存里的中文标题,否则用 id
    val title = ScenarioRepository.byId(item.scenarioId)?.displayTitle ?: item.scenarioId
    val timeText = remember(item.startedAt) {
        if (item.startedAt > 0) {
            SimpleDateFormat("yyyy-MM-dd HH:mm", Locale.getDefault()).format(Date(item.startedAt))
        } else ""
    }
    Card(modifier = Modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier.padding(12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(Modifier.weight(1f)) {
                Text(title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                Spacer(Modifier.height(2.dp))
                Text(
                    "${difficultyLabel(item.difficulty)} · ${modeLabel(item.mode)} · " +
                        "${item.durationSec / 60}分${item.durationSec % 60}秒 · ${item.messageCount} 条消息",
                    style = MaterialTheme.typography.bodySmall,
                    color = Ink400,
                )
                Text(timeText, style = MaterialTheme.typography.labelSmall, color = Ink400)
            }
            Column(horizontalAlignment = Alignment.End) {
                if (item.totalScore != null) {
                    Text(
                        "${item.totalScore}",
                        style = MaterialTheme.typography.headlineSmall,
                        fontWeight = FontWeight.Bold,
                        color = if (item.totalScore!! >= 60) MaterialTheme.colorScheme.primary else Accent500,
                    )
                    Text("总分", style = MaterialTheme.typography.labelSmall, color = Ink400)
                } else {
                    Text(
                        if (item.status == "completed") "已完成" else "未完成",
                        style = MaterialTheme.typography.labelMedium,
                        color = Ink400,
                    )
                }
            }
        }
    }
}
