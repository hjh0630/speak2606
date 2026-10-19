package com.speakflow.app.ui

import android.Manifest
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
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
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import com.speakflow.app.SpeakFlowApp
import com.speakflow.app.core.AsrService
import com.speakflow.app.core.RepeatPrompt
import com.speakflow.app.core.ScoreFeedback
import com.speakflow.app.core.difficultyLabel
import com.speakflow.app.core.modeLabel
import com.speakflow.app.ui.theme.Accent500
import com.speakflow.app.ui.theme.Brand500
import com.speakflow.app.ui.theme.Brand50
import com.speakflow.app.ui.theme.Ink100
import com.speakflow.app.ui.theme.Ink400
import kotlinx.coroutines.launch

/** 聊天气泡本地模型 */
private data class ChatItem(
    val role: String,          // "user" | "assistant"
    val text: String,
    val score: ScoreFeedback? = null,
)

/**
 * 练习页(核心):聊天气泡 + 语音输入 + AI 回复自动播报 + 评分卡片。
 * 流程对应 iOS PracticeView + 后端 REST 回合接口:
 *   录音 → SpeechRecognizer 识别英文 → POST /api/sessions/:id/messages
 *   → 用户气泡 + 评分卡片 + AI 气泡(TTS 自动播报)
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PracticeScreen(
    scenarioId: String,
    difficulty: String,
    mode: String,
    scenarioTitle: String,
    onBack: () -> Unit,
    onFinish: () -> Unit,
) {
    val context = LocalContext.current
    val app = SpeakFlowApp.instance
    val scope = rememberCoroutineScope()

    // 服务
    val asr = remember { AsrService(context.applicationContext) }
    val tts = app.ttsService

    // 会话状态
    var sessionId by remember { mutableStateOf<String?>(null) }
    var initError by remember { mutableStateOf<String?>(null) }
    var isSending by remember { mutableStateOf(false) }
    var roundIndex by remember { mutableIntStateOf(0) }
    val messages = remember { mutableStateListOf<ChatItem>() }

    // 跟读模式目标句
    var prompts by remember { mutableStateOf<List<RepeatPrompt>>(emptyList()) }
    val currentTarget: RepeatPrompt? = prompts.getOrNull(roundIndex)

    // 录音状态
    var isRecording by remember { mutableStateOf(false) }
    var partialText by remember { mutableStateOf("") }
    var micError by remember { mutableStateOf<String?>(null) }

    // 结算
    var showSummary by remember { mutableStateOf(false) }
    var summaryText by remember { mutableStateOf("") }

    val listState = rememberLazyListState()

    // ---------- 发送一轮 ----------
    fun sendTurn(text: String) {
        val sid = sessionId ?: return
        isSending = true
        micError = null
        messages.add(ChatItem(role = "user", text = text))
        scope.launch {
            try {
                val resp = app.apiClient.sendMessage(sid, text, mode)
                // 更新用户气泡的评分(替换最后一条)
                val lastIdx = messages.lastIndex
                if (lastIdx >= 0 && resp.score != null) {
                    messages[lastIdx] = messages[lastIdx].copy(score = resp.score)
                }
                roundIndex = resp.roundIndex
                messages.add(ChatItem(role = "assistant", text = resp.aiMessage))
                // AI 回复自动播报
                tts.speak(resp.aiMessage)
            } catch (e: Exception) {
                messages.add(ChatItem(role = "assistant", text = "(发送失败: ${e.message})"))
            } finally {
                isSending = false
            }
        }
    }

    // ---------- ASR 回调 ----------
    DisposableEffect(Unit) {
        asr.onPartialResult = { text -> partialText = text }
        asr.onFinalResult = { text ->
            isRecording = false
            partialText = ""
            val said = text.trim()
            if (said.isNotEmpty() && !isSending) {
                sendTurn(said)
            } else if (said.isEmpty()) {
                micError = "没有识别到内容,请再说一次"
            }
        }
        asr.onError = { msg ->
            isRecording = false
            micError = msg
        }
        onDispose {
            asr.destroy()
            tts.stop()
        }
    }

    // ---------- 初始化:创建会话 + 加载目标句 + 开场白 ----------
    LaunchedEffect(scenarioId, difficulty, mode) {
        try {
            val session = app.apiClient.createSession(scenarioId, difficulty, mode)
            sessionId = session.sessionId

            if (mode == "repeat") {
                // 跟读模式:取目标句列表
                prompts = try {
                    app.apiClient.fetchPrompts(session.sessionId, difficulty)
                } catch (e: Exception) {
                    emptyList()
                }
                prompts.firstOrNull()?.let { first ->
                    messages.add(ChatItem(role = "assistant", text = first.text))
                    tts.speak(first.text)
                }
            } else {
                // 自由对话:用本地剧本第一轮做开场白(离线可用)
                val opening = try {
                    app.scenarioLoader.loadDialog(scenarioId, difficulty).rounds.firstOrNull()
                } catch (e: Exception) {
                    null
                }
                if (opening != null && opening.textEn.isNotEmpty()) {
                    messages.add(ChatItem(role = "assistant", text = opening.textEn))
                    tts.speak(opening.textEn)
                } else {
                    messages.add(ChatItem(role = "assistant", text = "Hello! Let's start our practice."))
                }
            }
        } catch (e: Exception) {
            initError = "创建会话失败:${e.message}\n请到「设置」检查服务器地址,并确认后端已启动(默认 http://10.0.2.2:3001)。"
        }
    }

    // 新消息时滚动到底部
    LaunchedEffect(messages.size) {
        if (messages.isNotEmpty()) listState.animateScrollToItem(messages.size - 1)
    }

    // ---------- 录音 ----------
    val permissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { granted ->
        if (granted) {
            tts.stop()
            partialText = ""
            micError = null
            asr.start()
            isRecording = true
        } else {
            micError = "麦克风权限未授予,请到系统设置中允许"
        }
    }

    fun toggleRecording() {
        if (isRecording) {
            asr.stop() // 等 onFinalResult 回调
            return
        }
        val granted = ContextCompat.checkSelfPermission(
            context, Manifest.permission.RECORD_AUDIO,
        ) == PackageManager.PERMISSION_GRANTED
        if (granted) {
            tts.stop()
            partialText = ""
            micError = null
            asr.start()
            isRecording = true
        } else {
            permissionLauncher.launch(Manifest.permission.RECORD_AUDIO)
        }
    }

    // ---------- 结束练习 ----------
    fun finishSession() {
        val sid = sessionId ?: run { onFinish(); return }
        scope.launch {
            val scores = messages.mapNotNull { it.score?.overallScore }
            val avg = if (scores.isNotEmpty()) scores.sum() / scores.size else null
            summaryText = try {
                val result = app.apiClient.completeSession(sid, avg)
                "本次练习 ${result.messageCount} 条消息,用时 ${result.durationSec / 60} 分 ${result.durationSec % 60} 秒" +
                    (result.totalScore?.let { "\n总分:$it" } ?: "")
            } catch (e: Exception) {
                "会话已结束(同步结果失败: ${e.message})"
            }
            showSummary = true
        }
    }

    // ---------- UI ----------
    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text(scenarioTitle, style = MaterialTheme.typography.titleMedium)
                        Text(
                            "${difficultyLabel(difficulty)} · ${modeLabel(mode)} · 第 ${roundIndex + 1} 轮",
                            style = MaterialTheme.typography.labelSmall,
                            color = Ink400,
                        )
                    }
                },
                navigationIcon = {
                    IconButton(onClick = {
                        tts.stop()
                        onBack()
                    }) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "返回")
                    }
                },
                actions = {
                    TextButton(onClick = { finishSession() }, enabled = sessionId != null) {
                        Text("结束练习")
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
            if (initError != null) {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(24.dp),
                    verticalArrangement = Arrangement.Center,
                ) {
                    Text(initError!!, color = MaterialTheme.colorScheme.error)
                    Spacer(Modifier.height(12.dp))
                    OutlinedButton(onClick = onBack) { Text("返回") }
                }
                return@Column
            }

            // 跟读模式:目标句卡片
            if (mode == "repeat" && currentTarget != null) {
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 12.dp, vertical = 6.dp),
                    colors = CardDefaults.cardColors(containerColor = Brand50),
                ) {
                    Row(
                        modifier = Modifier.padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Column(Modifier.weight(1f)) {
                            Text("跟读目标(第 ${roundIndex + 1} / ${prompts.size} 句)",
                                style = MaterialTheme.typography.labelMedium, color = Brand500)
                            Spacer(Modifier.height(4.dp))
                            Text(currentTarget.text, style = MaterialTheme.typography.bodyLarge)
                            currentTarget.translation?.let {
                                Text(it, style = MaterialTheme.typography.bodySmall, color = Ink400)
                            }
                        }
                        IconButton(onClick = { tts.speak(currentTarget.text) }) {
                            Icon(Icons.Default.PlayArrow, contentDescription = "播放目标句", tint = Brand500)
                        }
                    }
                }
            }

            // 消息列表
            LazyColumn(
                state = listState,
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth(),
                contentPadding = androidx.compose.foundation.layout.PaddingValues(12.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                items(messages) { msg ->
                    ChatBubble(msg, onReplay = { tts.speak(msg.text) })
                }
                if (isSending) {
                    item {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier.padding(8.dp),
                        ) {
                            CircularProgressIndicator(modifier = Modifier.height(18.dp).width(18.dp), strokeWidth = 2.dp)
                            Spacer(Modifier.width(8.dp))
                            Text("AI 思考中…", style = MaterialTheme.typography.bodySmall, color = Ink400)
                        }
                    }
                }
            }

            // 录音中实时识别文本
            if (isRecording && partialText.isNotEmpty()) {
                Text(
                    partialText,
                    style = MaterialTheme.typography.bodyMedium,
                    fontStyle = FontStyle.Italic,
                    color = Ink400,
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp),
                )
            }
            micError?.let {
                Text(
                    it,
                    color = MaterialTheme.colorScheme.error,
                    style = MaterialTheme.typography.bodySmall,
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 2.dp),
                )
            }
            if (isRecording) {
                LinearProgressIndicator(modifier = Modifier.fillMaxWidth())
            }

            // 底部录音按钮
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 16.dp),
                contentAlignment = Alignment.Center,
            ) {
                FloatingActionButton(
                    onClick = { toggleRecording() },
                    containerColor = if (isRecording) MaterialTheme.colorScheme.error else Accent500,
                    contentColor = Color.White,
                ) {
                    Text(
                        if (isRecording) "■" else "🎤",
                        style = MaterialTheme.typography.titleLarge,
                    )
                }
            }
            Text(
                if (isRecording) "正在聆听… 再点一次结束" else "点击麦克风说英语",
                style = MaterialTheme.typography.labelSmall,
                color = Ink400,
                modifier = Modifier
                    .align(Alignment.CenterHorizontally)
                    .padding(bottom = 8.dp),
            )
        }
    }

    // 结算弹窗
    if (showSummary) {
        AlertDialog(
            onDismissRequest = { },
            title = { Text("练习完成 🎉") },
            text = { Text(summaryText) },
            confirmButton = {
                Button(onClick = {
                    showSummary = false
                    onFinish()
                }) {
                    Text("返回场景列表")
                }
            },
        )
    }
}

@Composable
private fun ChatBubble(msg: ChatItem, onReplay: () -> Unit) {
    val isUser = msg.role == "user"
    Column(
        modifier = Modifier.fillMaxWidth(),
        horizontalAlignment = if (isUser) Alignment.End else Alignment.Start,
    ) {
        Surface(
            color = if (isUser) Brand500 else Ink100,
            contentColor = if (isUser) Color.White else MaterialTheme.colorScheme.onSurface,
            shape = MaterialTheme.shapes.medium,
        ) {
            Column(Modifier.padding(10.dp)) {
                Text(
                    if (isUser) "你" else "客户(AI)",
                    style = MaterialTheme.typography.labelSmall,
                    color = if (isUser) Color.White.copy(alpha = 0.8f) else Ink400,
                )
                Text(msg.text, style = MaterialTheme.typography.bodyMedium)
                if (!isUser) {
                    TextButton(onClick = onReplay) {
                        Text("🔊 重播", style = MaterialTheme.typography.labelMedium)
                    }
                }
            }
        }

        // 评分卡片(用户气泡下方)
        msg.score?.let { score ->
            Spacer(Modifier.height(4.dp))
            Card(
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
            ) {
                Column(Modifier.padding(10.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            "得分:${score.overallScore}",
                            style = MaterialTheme.typography.titleSmall,
                            fontWeight = FontWeight.Bold,
                            color = if (score.overallScore >= 60) Color(0xFF2E7D32) else Accent500,
                        )
                        Spacer(Modifier.width(12.dp))
                        Text("流利度 ${score.fluency}", style = MaterialTheme.typography.labelSmall)
                        Spacer(Modifier.width(8.dp))
                        Text("准确度 ${score.accuracy}", style = MaterialTheme.typography.labelSmall)
                    }
                    if (score.keyIssues.isNotEmpty()) {
                        Spacer(Modifier.height(4.dp))
                        score.keyIssues.take(3).forEach { issue ->
                            Text("· $issue", style = MaterialTheme.typography.bodySmall, color = Ink400)
                        }
                    }
                    if (score.suggestion.isNotEmpty()) {
                        Spacer(Modifier.height(4.dp))
                        Text("建议:${score.suggestion}", style = MaterialTheme.typography.bodySmall)
                    }
                }
            }
        }
    }
}
