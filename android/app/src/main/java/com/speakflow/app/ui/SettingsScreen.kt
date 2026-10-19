package com.speakflow.app.ui

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
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.speakflow.app.SpeakFlowApp
import com.speakflow.app.core.SettingsStore
import com.speakflow.app.ui.theme.Ink400
import com.speakflow.app.ui.theme.Ink500
import kotlinx.coroutines.launch

/** 设置页:服务器地址配置(模拟器 10.0.2.2 / 真机局域网 IP / cloudflared 隧道) */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(onBack: () -> Unit) {
    val settings = SpeakFlowApp.instance.settings
    var baseUrl by remember { mutableStateOf(settings.baseUrl) }
    var saved by remember { mutableStateOf(false) }
    var testing by remember { mutableStateOf(false) }
    var testResult by remember { mutableStateOf<String?>(null) }
    var testOk by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("设置") },
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
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
        ) {
            Text("服务器地址", style = MaterialTheme.typography.titleMedium)
            Spacer(Modifier.height(8.dp))
            OutlinedTextField(
                value = baseUrl,
                onValueChange = {
                    baseUrl = it
                    saved = false
                    testResult = null
                },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                placeholder = { Text(SettingsStore.DEFAULT_BASE_URL) },
                supportingText = { Text("后端 API 根地址(不带 /api 后缀)") },
            )

            Spacer(Modifier.height(12.dp))
            Row {
                Button(
                    onClick = {
                        settings.baseUrl = baseUrl
                        saved = true
                    },
                ) {
                    Text("保存")
                }
                Spacer(Modifier.padding(4.dp))
                OutlinedButton(
                    onClick = {
                        baseUrl = SettingsStore.DEFAULT_BASE_URL
                        settings.resetBaseUrl()
                        saved = true
                    },
                ) {
                    Text("恢复默认")
                }
                Spacer(Modifier.padding(4.dp))
                OutlinedButton(
                    enabled = !testing,
                    onClick = {
                        testing = true
                        testResult = null
                        scope.launch {
                            // 测试前先暂存,让 ApiClient 用新地址
                            val old = settings.baseUrl
                            settings.baseUrl = baseUrl
                            val ok = SpeakFlowApp.instance.apiClient.health()
                            if (!ok) settings.baseUrl = old
                            testOk = ok
                            testResult = if (ok) "✅ 连接成功" else "❌ 连接失败,请检查地址与后端是否启动"
                            testing = false
                        }
                    },
                ) {
                    if (testing) {
                        CircularProgressIndicator(
                            modifier = Modifier.height(16.dp),
                            strokeWidth = 2.dp,
                        )
                    } else {
                        Text("测试连接")
                    }
                }
            }
            if (saved) {
                Spacer(Modifier.height(4.dp))
                Text("已保存", color = MaterialTheme.colorScheme.primary)
            }
            testResult?.let {
                Spacer(Modifier.height(4.dp))
                Text(it, color = if (testOk) Color(0xFF2E7D32) else MaterialTheme.colorScheme.error)
            }

            Spacer(Modifier.height(24.dp))
            Card(Modifier.fillMaxWidth()) {
                Column(Modifier.padding(12.dp)) {
                    Text("如何填写?", style = MaterialTheme.typography.titleSmall)
                    Spacer(Modifier.height(8.dp))
                    Text(
                        "1. Android 模拟器:用 http://10.0.2.2:3001\n" +
                            "   (10.0.2.2 是模拟器访问宿主机 localhost 的专用地址)\n\n" +
                            "2. 真机调试:手机和电脑连同一 Wi-Fi,填电脑局域网 IP,如\n" +
                            "   http://192.168.1.100:3001\n\n" +
                            "3. 不在同一网络:用 cloudflared 隧道暴露 3001 端口,填分发的 https URL,如\n" +
                            "   https://xxx.trycloudflare.com",
                        style = MaterialTheme.typography.bodySmall,
                        color = Ink500,
                    )
                }
            }

            Spacer(Modifier.height(12.dp))
            Card(Modifier.fillMaxWidth()) {
                Column(Modifier.padding(12.dp)) {
                    Text("关于", style = MaterialTheme.typography.titleSmall)
                    Spacer(Modifier.height(8.dp))
                    Text(
                        "SpeakFlow Android · 服装纺织外贸英语口语练习\n" +
                            "后端需先启动:cd backend && npm run dev(默认 3001 端口)",
                        style = MaterialTheme.typography.bodySmall,
                        color = Ink400,
                    )
                }
            }
        }
    }
}
