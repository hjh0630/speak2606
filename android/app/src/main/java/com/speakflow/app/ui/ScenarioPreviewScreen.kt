package com.speakflow.app.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
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
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.speakflow.app.core.Scenario
import com.speakflow.app.core.difficultyLabel
import com.speakflow.app.core.modeLabel
import com.speakflow.app.ui.theme.Ink400
import com.speakflow.app.ui.theme.Ink500

/**
 * 场景详情 + 难度/模式选择 + 开始练习。
 * 对应 iOS ScenariosView 的难度选择弹窗与跳转逻辑。
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ScenarioPreviewScreen(
    scenarioId: String,
    onBack: () -> Unit,
    onStart: (scenarioId: String, difficulty: String, mode: String, title: String) -> Unit,
) {
    var scenario by remember { mutableStateOf<Scenario?>(ScenarioRepository.byId(scenarioId)) }
    var loadError by remember { mutableStateOf<String?>(null) }
    var selectedDifficulty by remember { mutableStateOf("beginner") }
    var selectedMode by remember { mutableStateOf("free") }

    LaunchedEffect(scenarioId) {
        if (scenario == null) {
            try {
                ScenarioRepository.load()
                scenario = ScenarioRepository.byId(scenarioId)
                if (scenario == null) loadError = "未找到场景: $scenarioId"
            } catch (e: Exception) {
                loadError = e.message ?: "加载失败"
            }
        }
        // 默认选中第一个可用难度
        scenario?.levels?.firstOrNull()?.let { selectedDifficulty = it }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(scenario?.displayTitle ?: "场景详情") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "返回")
                    }
                },
            )
        },
    ) { padding ->
        val s = scenario
        when {
            loadError != null -> Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding)
                    .padding(24.dp),
            ) {
                Text(loadError!!, color = MaterialTheme.colorScheme.error)
            }

            s == null -> Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding),
                verticalArrangement = Arrangement.Center,
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                CircularProgressIndicator()
            }

            else -> Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding)
                    .verticalScroll(rememberScrollState())
                    .padding(16.dp),
            ) {
                // 头部:icon + 标题
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(s.displayIcon, style = MaterialTheme.typography.displaySmall)
                    Spacer(Modifier.padding(6.dp))
                    Column {
                        Text(s.displayTitle, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
                        if (s.displaySubtitle.isNotEmpty()) {
                            Text(s.displaySubtitle, style = MaterialTheme.typography.bodyMedium, color = Ink400)
                        }
                    }
                }

                if (s.displayDescription.isNotEmpty()) {
                    Spacer(Modifier.height(16.dp))
                    Card(Modifier.fillMaxWidth()) {
                        Column(Modifier.padding(12.dp)) {
                            Text("场景介绍", style = MaterialTheme.typography.labelMedium, color = Ink500)
                            Spacer(Modifier.height(4.dp))
                            Text(s.displayDescription, style = MaterialTheme.typography.bodyMedium)
                        }
                    }
                }

                val skills = s.keySkillsZh ?: s.keySkills
                if (!skills.isNullOrEmpty()) {
                    Spacer(Modifier.height(12.dp))
                    Card(Modifier.fillMaxWidth()) {
                        Column(Modifier.padding(12.dp)) {
                            Text("练习目标", style = MaterialTheme.typography.labelMedium, color = Ink500)
                            Spacer(Modifier.height(4.dp))
                            skills.forEach { skill ->
                                Text("· $skill", style = MaterialTheme.typography.bodyMedium)
                            }
                        }
                    }
                }

                s.estimatedMinutes?.let {
                    Spacer(Modifier.height(8.dp))
                    Text("预计时长:约 $it 分钟", style = MaterialTheme.typography.bodySmall, color = Ink400)
                }

                // 难度选择
                Spacer(Modifier.height(20.dp))
                Text("选择难度", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                Spacer(Modifier.height(8.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    s.levels.forEach { d ->
                        FilterChip(
                            selected = selectedDifficulty == d,
                            onClick = { selectedDifficulty = d },
                            label = { Text(difficultyLabel(d)) },
                        )
                    }
                }

                // 模式选择
                Spacer(Modifier.height(16.dp))
                Text("练习模式", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                Spacer(Modifier.height(8.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    listOf("free", "repeat").forEach { m ->
                        FilterChip(
                            selected = selectedMode == m,
                            onClick = { selectedMode = m },
                            label = { Text(modeLabel(m)) },
                        )
                    }
                }
                Text(
                    if (selectedMode == "repeat") "跟读模式:听一句、读一句,按目标句打分"
                    else "自由对话:与 AI 客户自由交流,LLM 实时评分",
                    style = MaterialTheme.typography.bodySmall,
                    color = Ink400,
                )

                Spacer(Modifier.height(28.dp))
                Button(
                    onClick = { onStart(s.id, selectedDifficulty, selectedMode, s.displayTitle) },
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Text("开始练习")
                }
            }
        }
    }
}
