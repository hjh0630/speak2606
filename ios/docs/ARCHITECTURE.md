# SpeakFlow iOS 架构图

```
┌────────────────────────────────────────────────────────────┐
│                    iPhone 15 Pro (iOS 17+)                 │
│                                                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │            SpeakFlow (SwiftUI App)                   │  │
│  │  ┌──────┬──────┬──────┬──────┬──────┐                │  │
│  │  │ Home │Scene │Pract.│Word │Hist.│  ← 5 Tab UI    │  │
│  │  └──┬───┴──┬───┴──┬───┴──┬───┴──┬───┘                │  │
│  └─────┼──────┼──────┼──────┼──────┼────────────────────┘  │
│        └──────┴──────┼──────┴──────┘                       │
│                       ▼                                    │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         SpeakFlowKit (Swift Package)                 │  │
│  │  ┌──────────┐  ┌────────────┐  ┌──────────┐          │  │
│  │  │ Models   │  │ Networking │  │  Audio   │          │  │
│  │  │ Scenarios│  │ APIClient  │  │  TTS     │          │  │
│  │  │ Words    │  │ WebSocket  │  │  ASR     │          │  │
│  │  │ Sessions │  └─────┬──────┘  │ (AV/SF)  │          │  │
│  │  └──────────┘        │         └──────────┘          │  │
│  │  ┌──────────┐        │         ┌──────────┐          │  │
│  │  │ Storage  │        │         │ Resources│          │  │
│  │  │SwiftData │        │         │Scenarios/│          │  │
│  │  │VocabStore│        │         │Dictionary│          │  │
│  │  └──────────┘        │         └──────────┘          │  │
│  └───────────────────────┼───────────────────────────────┘  │
│                          │                                   │
└──────────────────────────┼───────────────────────────────────┘
                           │ HTTPS / WSS
                           ▼
┌────────────────────────────────────────────────────────────┐
│       Cloudflare Workers (后端，零改动)                     │
│       speakflow-api.hjinghui.workers.dev                    │
│       ┌─────────────────────────────────────────────┐      │
│       │ Hono routes:                                 │      │
│       │   GET  /api/scenarios                        │      │
│       │   GET  /api/dictionary?w=...                 │      │
│       │   GET  /api/history?user_token=...           │      │
│       │   POST /api/sessions                         │      │
│       │   WS   /ws/session/:id  (实时对话)            │      │
│       └────────────┬────────────────────────────────┘      │
│                    ▼                                        │
│       ┌──────────────────┐  ┌─────────────┐                │
│       │  D1 数据库       │  │ MiniMax API │                │
│       │ sessions/messages│  │  LLM 评分   │                │
│       │ vocabulary       │  │  (iOS不走)  │                │
│       └──────────────────┘  └─────────────┘                │
└────────────────────────────────────────────────────────────┘
```

## 关键决策

| 选择 | 决策 | 理由 |
|---|---|---|
| **后端** | 复用 Workers + D1 | 已经稳定，零改动 |
| **TTS** | AVSpeechSynthesizer（系统原生） | 免费离线，零 API key |
| **ASR** | SFSpeechRecognizer（系统原生） | 免费，中英双语 |
| **LLM 评分** | MiniMax API（经后端代理） | iOS 端零 secret |
| **场景数据** | Bundle 内置 JSON | 离线可用 |
| **词典** | Bundle 内置 JSON + 后端 LLM fallback | 离线命中率高 |
| **存储** | SwiftData（iOS 17+） | @Model 自动持久化，比 Core Data 简单 10x |
| **架构** | MVVM + @Observable | 与 Vue/Pinia 心智最接近 |

## 数据流：一次 8 轮对话

```
1. User 选场景 + 难度
   ↓
2. iOS: ScenarioLoader.loadDialog(id, difficulty)  ← 离线
   ↓
3. iOS: APIClient POST /api/sessions (新建会话)
   ↓ 后端返回 session_id
   ↓
4. iOS: WebSocketClient.connect(session_id)
   ↓
5. 第 1 轮 (Partner) ─→ 后端 → 缓存 dialog JSON 第 1 轮
   ↓ WS push → iOS 显示 + TTS 朗读 (AVSpeechSynthesizer)
   ↓
6. User 录音 (AVAudioEngine)
   ↓
7. iOS: WS send {type: "user_audio", audio_base64, round: 1}
   ↓ 后端: MiniMax ASR 转写 + LLM 评分
   ↓ WS push → iOS 显示 transcript + score
   ↓
8. 重复 5-7 到第 8 轮
   ↓
9. 后端: session_end WS push → iOS 显示总结
   ↓
10. iOS: 写入 SwiftData (Session + 评分 + 加入生词本的词)
```

## Bundle 资源加载机制

SPM `.process("Resources")` 把 `Sources/.../Resources/` 打包成 `SpeakFlowKit_SpeakFlowKit.bundle`，运行时通过 `Bundle.module.resourceURL` 访问。

`ScenarioLoader.swift` 的 `locate()` 函数自动在两个位置查找（兼容 SPM 不同版本的资源布局）：
- `Bundle.module/Dictionary.json`
- `Bundle.module/Scenarios/*.json`