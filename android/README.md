# SpeakFlow Android 客户端

SpeakFlow(服装纺织外贸英语口语练习)的原生 Android 客户端,Kotlin + Jetpack Compose,
功能与代码结构镜像 iOS 版(`ios/SpeakFlowKit` + `ios/SpeakFlow`)。

## 项目结构

```
android/
├── settings.gradle.kts            # 模块声明
├── build.gradle.kts               # 根构建脚本(仅插件版本)
├── gradle.properties
├── gradle/
│   ├── libs.versions.toml         # 版本目录(AGP 8.5.2 / Kotlin 2.0.21 / Compose BOM 2024.06.00 / OkHttp 4.12 / kotlinx-serialization 1.7.1 / navigation-compose 2.7.7)
│   └── wrapper/gradle-wrapper.properties   # Gradle 8.9
└── app/
    ├── build.gradle.kts           # compileSdk/targetSdk 34,minSdk 26
    └── src/main/
        ├── AndroidManifest.xml    # INTERNET + RECORD_AUDIO 权限,usesCleartextTraffic=true
        ├── assets/                # 从 iOS SpeakFlowKit/Resources 原样复制
        │   ├── scenarios.json         # 场景元数据(离线兜底)
        │   ├── Dictionary.json        # 本地词典(345+ 词条,map 格式)
        │   └── Scenarios/*.json       # 72 个场景对话剧本
        ├── res/                   # 最小化资源(平台主题 + 自适应图标占位)
        └── java/com/speakflow/app/
            ├── MainActivity.kt
            ├── SpeakFlowApp.kt        # Application,持有手动单例(不用 Hilt)
            ├── core/                  # 镜像 iOS SpeakFlowKit
            │   ├── Models.kt          # 数据模型 + 难度/模式中文标签(对应 Models/Models.swift)
            │   ├── ScenarioLoader.kt  # assets 剧本/词典加载,缓存(对应 Loading/ScenarioLoader.swift)
            │   ├── ApiClient.kt       # OkHttp REST 客户端(对应 Networking/APIClient.swift,端点按本地后端 3001)
            │   ├── WebSocketClient.kt # OkHttp WS 客户端(对应 Networking/WebSocketClient.swift,协议按 backend/src/ws/session-ws.ts)
            │   ├── SpeechServices.kt  # AsrService(SpeechRecognizer)+ TtsService(后端 MiniMax 优先,系统 TTS 兜底)(对应 Audio/SpeechServices.swift)
            │   └── SettingsStore.kt   # SharedPreferences(对应 Storage/UserProfileStore.swift)
            └── ui/
                ├── theme/Theme.kt         # Material3,主色对齐 web 端 tailwind brand(#1F8FB3)/accent(#D17F50)
                ├── ScenariosScreen.kt     # 场景列表(在线 API,离线 assets 兜底)+ ScenarioRepository
                ├── ScenarioPreviewScreen.kt # 场景详情 + 难度/模式选择 + 开始练习
                ├── PracticeScreen.kt      # 练习页:聊天气泡、录音识别、AI 自动播报、评分卡片、跟读目标句
                ├── HistoryScreen.kt       # 历史会话(GET /api/history)
                ├── SettingsScreen.kt      # 服务器地址配置
                └── navigation/NavGraph.kt # Navigation Compose 路由
```

## 用 Android Studio 打开

1. 安装 Android Studio(Hedgehog 2023.1.1 或更新)。
2. `File → Open`,选择 `android/` 目录(注意是 android 子目录,不是仓库根)。
3. 首次打开会自动同步 Gradle;Android Studio 会提示缺失的 SDK 组件,按提示安装
   **Android SDK Platform 34** 与 **Android SDK Build-Tools**。
4. 等待 Gradle sync 完成后,选择设备(模拟器或真机),点 Run ▶。

## 命令行构建

前置条件:

- **JDK 17**(AGP 8.5 要求;可用 `java -version` 确认)
- **Android SDK**:Platform 34 + Build-Tools,并设置 `ANDROID_HOME` 环境变量
  (或在 `android/local.properties` 写 `sdk.dir=C:\\Users\\<你>\\AppData\\Local\\Android\\Sdk`)
- 本仓库未提交 `gradlew` 脚本和 wrapper jar,首次需用本机已安装的 gradle 生成:
  ```bash
  cd android
  gradle wrapper --gradle-version 8.9
  ```

构建:

```bash
cd android
# Windows
gradlew.bat assembleDebug
# Git Bash / macOS / Linux
./gradlew assembleDebug
```

产物在 `app/build/outputs/apk/debug/app-debug.apk`。

安装到已连接设备:

```bash
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

## 服务器地址配置(重要)

App 所有网络请求都走「设置」页里的 **服务器地址**(默认 `http://10.0.2.2:3001`),改完立即生效,无需重启。

先启动后端(在仓库根目录):

```bash
cd backend
npm install
npm run dev    # 默认监听 3001 端口
```

然后按运行环境填地址:

| 运行环境 | 服务器地址 | 说明 |
| --- | --- | --- |
| Android 模拟器 | `http://10.0.2.2:3001` | 10.0.2.2 是模拟器映射宿主机 localhost 的专用地址,**默认值** |
| 真机(同一 Wi-Fi) | `http://<电脑局域网IP>:3001` | 如 `http://192.168.1.100:3001`;电脑 IP 用 `ipconfig` 查 |
| 不在同一网络 | `https://xxx.trycloudflare.com` | 用 `cloudflared tunnel --url http://localhost:3001` 起隧道,填分发的 https URL |

> Manifest 已开 `usesCleartextTraffic="true"`,局域网 http 调试不会被系统拦截。
> 设置页有「测试连接」按钮,会请求后端 `/health` 验证连通性。

## 语音识别说明

- STT 用 Android 系统 `SpeechRecognizer`(en-US),依赖设备上的 Google 语音服务;
  部分模拟器镜像不带该服务,录音会报「识别服务不可用」,建议用真机调试。
- 录音需要 `RECORD_AUDIO` 运行时权限,首次点麦克风会弹权限申请。
- TTS 优先调后端 `/api/tts`(MiniMax 音色);后端无凭证(mock 模式)或网络失败时
  自动回退系统 `TextToSpeech`。

## 与后端 / iOS 的对应关系

- 网络层端点严格按本地 Node 后端 `backend/src/routes/*`(非 iOS 指向的 Cloudflare Workers):
  `/api/scenarios`、`/api/sessions`(POST)、`/api/sessions/:id/messages`(POST)、
  `/api/sessions/:id/prompts`(GET)、`/api/sessions/:id/complete`(POST)、
  `/api/history`(GET)、`/api/dictionary?w=`(GET)、`/api/tts`(POST)、`/api/tts/voices`(GET)、`/health`。
- WebSocket 协议按 `backend/src/ws/session-ws.ts` 的 envelope(`{type, payload, ts}`),
  与 iOS 版 Workers 协议不同;REST 回合流程与 web 前端一致。
- `DialogRound` 的自定义反序列化兼容两种 JSON 格式(协议格式 + assets 内容格式,
  含 `key_phapes` 笔误 key),与 iOS `Models.swift` 一致。
