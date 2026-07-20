# SpeakFlow iOS · Mac 上手指南

> 装到我自己 iPhone 15 Pro 上 —— 个人 Apple ID + TestFlight 自用，**免 $99/年商业开发者账号**。

## 🚀 一、Mac 准备（一次性）

### 1.1 系统要求
- **macOS 14+ Sonoma**（Xcode 15.4+ 需要）
- **Xcode 15.4+**（含 Swift 5.9 + iOS 17 SDK）
- **iPhone 15 Pro** + iOS 17+（必须真机，ASR/麦克风权限）

### 1.2 拉代码
```bash
# 克隆仓库到 Mac（建议 ~/Developer/SpeakFlow）
mkdir -p ~/Developer && cd ~/Developer
git clone https://github.com/hjh0630/speak2606.git SpeakFlow
cd SpeakFlow
ls ios/   # 应该看到 SpeakFlow/ + SpeakFlowKit/ + docs/
```

### 1.3 信任开发者证书（首次）
1. iPhone 用数据线连 Mac → 信任此电脑
2. iPhone 设置 → 通用 → VPN与设备管理 → 信任你的 Apple ID
3. Mac Xcode → Settings → Accounts → 添加你的 Apple ID（个人免费即可）

---

## 🏗 二、Xcode 项目初始化（首次 30 分钟）

### 方案 A（推荐）：SwiftUI App + 本地 Package
```
Xcode → File → New → Project
  ├─ iOS → App
  ├─ Product Name: SpeakFlow
  ├─ Interface: SwiftUI
  ├─ Language: Swift
  ├─ Storage: None（我们用 SwiftData 手动管理）
  └─ Minimum Deployment: iOS 17.0
```

把生成的 `SpeakFlow/` 目录**整体替换**为本仓库 `ios/SpeakFlow/`，并：
1. **Info.plist**：用 `ios/SpeakFlow/SpeakFlow/Resources/Info.plist.template` 内容替换自动生成的 Info.plist
2. **添加本地 Package**：
   - File → Add Package Dependencies → Add Local...
   - 选 `ios/SpeakFlowKit/`（含 Package.swift）
   - 选 SpeakFlowKit 产品加入 SpeakFlow target
3. **删除** Xcode 自动生成的 `ContentView.swift`（我们用仓库的 `SpeakFlowApp.swift`）
4. **Bundle 资源已就位**：`SpeakFlowKit/Sources/SpeakFlowKit/Resources/Scenarios/*.json` + `Dictionary.json` 会被 Xcode 自动识别为 Bundle 资源

### 方案 B（备选）：完全命令生成
```bash
cd ~/Developer/SpeakFlow
# 用 XcodeGen 或 Tuist（如果已装）
# 否则走方案 A
```

---

## ▶️ 三、首次运行

### 3.1 真机编译
- Xcode 顶部选择 target: **SpeakFlow** → **你的 iPhone 15 Pro**
- 点 ▶ Run（或 ⌘R）
- 首次会弹 "需要信任开发者"，到 iPhone 设置里信任

### 3.2 启动后预期
- 5 Tab 出现（首页/场景/练习/生词本/历史）
- 首页能加载（占位 Text）
- 场景 Tab 是空的（待实现）
- 麦克风权限会弹（首次启动后）

### 3.3 冒烟测试（Mac 终端）
```bash
# 验证后端在线
curl https://speakflow-api.hjinghui.workers.dev/health
# 期望: {"ok":true}

# 拉场景列表
curl https://speakflow-api.hjinghui.workers.dev/api/scenarios | python3 -m json.tool | head -30
# 期望: 26 个 scenario

# 词典查词（验证本地缓存）
curl 'https://speakflow-api.hjinghui.workers.dev/api/dictionary?w=denim' | python3 -m json.tool
```

---

## 📦 四、Bundle 资源验证

72 个场景 JSON + 1 个 Dictionary.json 已放到：
```
ios/SpeakFlowKit/Sources/SpeakFlowKit/Resources/
├── Dictionary.json                  (10 KB · 345 词条)
└── Scenarios/
    ├── accessories_sourcing.json
    ├── claim_aftersales.json
    ├── claim_aftersales_intermediate.json
    ├── claim_aftersales_advanced.json
    ├── customs_hold.json
    ├── customs_hold_intermediate.json
    ├── customs_hold_advanced.json
    └── ... (共 72 个)
```

在 Xcode 里：左侧 SpeakFlowKit → Resources/Scenarios/ 应该全部可见。
运行时由 `ScenarioLoader.swift` 加载（`Bundle.module.resourceURL`）。

---

## 🛠 五、本地开发约定

### 5.1 修改后端地址
改 `SpeakFlowKit/Sources/SpeakFlowKit/Networking/APIClient.swift`:
```swift
public static let shared = APIClient(baseURL: URL(string: "https://你的地址")!)
```

### 5.2 改后端 WebSocket
改 `SpeakFlowKit/Sources/SpeakFlowKit/Networking/WebSocketClient.swift`:
```swift
public init(baseURL: URL = URL(string: "wss://你的-ws-地址")!)
```

### 5.3 后端 workers 改动后
```bash
# 在 Mac 上（需要有 wrangler）
cd ~/Developer/SpeakFlow/workers/speakflow-api
npm install && wrangler deploy
```

---

## 📱 六、TestFlight 自用发布（推荐路径）

### 6.1 一次性
1. Mac Xcode → Product → Archive → Distribute App → **TestFlight Internal Testing**（不要选 App Store）
2. 选个人 Apple ID → 自动注册为"未付费开发者"（**不要付 $99**，自用不需要）
3. 上传成功后 → App Store Connect → 我的 App → SpeakFlow → TestFlight
4. 添加测试员 = 你的 Apple ID → 你自己邮箱收到邀请

### 6.2 每次更新
1. Xcode → Product → Archive → Distribute App → TestFlight
2. 自动覆盖上一版；iPhone TestFlight App 收到更新通知

### 6.3 真机直接装（最快，跳过 TestFlight）
- USB 连 iPhone → Xcode 选 iPhone → ⌘R
- 缺点：拔 USB 重启手机后 App 签名失效（开发者证书 7 天有效期）
- 解决：每 7 天连一次 Mac 重新 run，或上 TestFlight

---

## 🍎 七、iPhone 15 Pro 独占功能

### 7.1 Dynamic Island（录音/评分状态显示）
练习时顶部 Dynamic Island 显示：
- 🔴 录音中
- ⏳ LLM 评分中
- ✅ 评分完成

实现：`ios/SpeakFlow/SpeakFlow/Resources/` 需要加 `SpeakFlowWidget.entitlement` 和 Widget Extension target。
**优先级 P2**（v1 不做也行）。

### 7.2 Action Button（一键启动 Practice）
iPhone 15 Pro 独有 Action Button → 设置 → Action Button → 快捷指令 → SpeakFlow 练习
**优先级 P3**（App Intents framework 实现，v2 再说）。

### 7.3 ProMotion 120Hz
SwiftUI 默认支持；如果想锁定 120Hz 动画用 `.animation(.smooth)`。

---

## 🧪 八、调试与排错

### 8.1 真机调试常见坑
| 现象 | 解决 |
|---|---|
| "无法安装 App" | iPhone 设置→VPN与设备管理→信任开发者 |
| "找不到 Bundle 资源" | Xcode 左侧 SpeakFlowKit → Build Phases → 确认 Resources 在 Copy Bundle Resources 里 |
| ASR 不识别 | iPhone 设置→SpeakFlow→麦克风/语音识别 都打开 |
| WS 连接失败 | 终端跑 `curl -I https://speakflow-api.hjinghui.workers.dev/health` 看后端通不通 |
| TTS 无声 | 检查 iPhone 是否静音模式；iOS 17+ 静音模式下 TTS 也会静默 |

### 8.2 调试技巧
```bash
# Xcode Console 看 iOS 端日志
Window → Devices and Simulators → 选你的 iPhone → Open Console → 搜 "SpeakFlow"

# 真机跑单元测试
⌘U (SpeakFlowKitTests target)
```

---

## 📋 九、3 周路线图

| Week | 任务 | 完成标志 |
|---|---|---|
| W1（5d）| ✅ Xcode init + APIClient + WebSocket + TTS/ASR + SwiftData | 真机跑通，5 Tab 可见 |
| W2（5d）| ⏳ 5 个核心视图完整实现 | 能跑通 1 个完整 8 轮对话 |
| W3（3d）| ⏳ Dynamic Island + TestFlight + 推送 | TestFlight 上自用发布 |

---

## 📞 十、备份与同步

- 代码：`git push` 到 GitHub（hjh0630/speak2606）
- iPhone 数据：SwiftData 自动存本机，定期 iCloud 备份整机即可
- 生词本：可导出 Anki CSV（`VocabularyStore.exportAnkiCSV()`）→ 邮件给自己
- 后端数据：D1 在 Cloudflare，自动备份 30 天

---

## ❓ FAQ

**Q: 个人 Apple ID 装的 App 几天就过期？**
A: 7 天。解法：每 7 天连 Mac ⌘R 一次，或用 TestFlight（30 天）。

**Q: 我能在 iPad 上跑吗？**
A: 可以。SwiftUI 自适应；如需 iPad 专属布局后面调。

**Q: 后端 Workers 还需要改吗？**
A: 不需要。iOS client 完全复用现有 API。后续若想加 native 功能（如实时识别评分）再扩展。

**Q: Web 版会被替代吗？**
A: 暂时并存。Web 版还在 `https://speakflow-5zl.pages.dev` 跑着，作为兜底。iOS 版稳定后再决定。

**Q: Memory 文件在哪？**
A: `~/.claude/projects/E--00-ai-claude/memory/speakflow-project.md`（已更新，含 iOS 路线图）。