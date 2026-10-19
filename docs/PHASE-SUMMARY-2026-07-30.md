# SpeakFlow 阶段性产出总结(2026-07-30)

本次迭代完成三大阶段:**生产制造场景扩充**、**自定义场景生成器**、**Android 原生客户端**。
产出位置、验证结果与已知限制汇总如下;待办事项见 [NEXT-STEPS.md](./NEXT-STEPS.md)。

---

## 一、生产制造全链条场景(内容)

在 `content/textile-english/`(textile-apparel 模块)新增 6 个场景,补齐 1 个场景难度:

| 场景 id | 中文 | 核心专业内容 |
|---------|------|-------------|
| `fiber-spinning` | 纺丝与纱线规格沟通 | POY/DTY/FDY、denier、捻度 TPM、Uster CV%、强力伸度 |
| `circular-knitting` | 圆编制造与大圆机沟通 | 机号 gauge、筒径、路数 feeder、single jersey/interlock、GSM、greige |
| `garment-manufacturing` | 服装制造与产线沟通 | CMT、cutting/spreading、SPI、SMV、line efficiency、pressing |
| `printing-process` | 印花工艺沟通 | 圆网/平网/数码印花、色浆、对花 register、strike-off、色牢度 |
| `embroidery-process` | 绣花工艺沟通 | 平绣/贴布绣/亮片绣、stitch count、digitizing、断线率 |
| `finishing-process` | 后整理工艺沟通 | stenter 定型、sanforize 预缩、磨毛、涂层/复合、缩水率 |

内容规格:每场景 3 难度 × 8 轮对话(含 EN/ZH 台词、key_phrases、common_mistakes、tips、user_response_example),配套 12 条专业词汇(共新增 72 条);`garment_washing` 补齐 intermediate/advanced 两档。
**验证**:后端 `/api/scenarios` 实测 39 个场景全部加载、三难度 rounds 齐全;前端构建通过。
**同步**:运行目录 `E:\00.ai\speak2606\content` 已同步全部新内容。

## 二、自定义场景生成器(功能)

用户流程:输入场景名称 → 输入关键词 → AI 生成 → 本地保存 → 进入练习。

- **后端**(`backend/`):新增 `POST /api/custom-scenarios/generate`(名称+关键词 → LLM 生成匹配英语词汇 8–12 条 + 三难度各 6 轮例句对话 + system prompt);`POST /api/sessions` 支持 `custom_scenario` 内联场景(`custom-` 前缀 id 免 content 校验);消息/跟读/反馈/WS 全链路支持 custom 场景。无 API key 或 LLM 超时时回退确定性 mock。
- **前端**(`frontend/`):新页面 `/custom-scenario`(表单 → 生成 → 词汇卡片/例句预览 → 保存);结果存浏览器 localStorage;ScenariosView 新增"我的场景"区块;NavBar/Home 入口;练习链路(free/repeat)完全复用现有会话体系。
- **Workers 版**(`workers/speakflow-api/`):同等能力已同步(custom registry 为单 isolate 内存,已知限制)。
- **验证**:curl 全链路实测——生成 200(8 词汇 + 18 轮对话)→ 建会话 201 → 跟读 prompts 6 条 → 发消息获得引用自定义目标句的 AI 回复;前端 `vue-tsc + vite build` 通过。

## 三、Android 原生客户端(新端)

`android/` 全新工程,Kotlin + Jetpack Compose,结构镜像 iOS SpeakFlowKit:

- **core**:`ApiClient`(OkHttp,REST 端点与 Node 后端对齐)、`WebSocketClient`、`ScenarioLoader`(72 个场景 JSON 打进 assets,离线可读)、`SpeechServices`(SpeechRecognizer 英文识别 + 后端 TTS 优先/系统 TTS 兜底)、`SettingsStore`(服务器地址可配,默认 `http://10.0.2.2:3001`)
- **UI**:场景列表 / 场景预览(难度+模式选择)/ 练习(聊天气泡、录音识别、自动播报、评分卡、跟读目标句)/ 历史 / 设置,共 5 页,全中文文案
- **构建环境**(本机新装):OpenJDK 17、`E:\00.ai\android-sdk`(platform-34 + build-tools 34)、Gradle 8.9 wrapper;仓库已配阿里云 Maven 镜像 + 腾讯 Gradle 镜像,Java 需 `-Djava.net.preferIPv4Stack=true`(已写入构建说明)
- **产出**:`android/app/build/outputs/apk/debug/app-debug.apk`(9.7 MB),`gradlew assembleDebug` 通过;构建/安装/配置说明见 `android/README.md`

## 已知限制

- MiniMax API 本机 30s 超时(网络问题):自定义场景真实生成、真实 TTS/评分未在真链路验证,mock 回退路径已就绪
- Android APK 未经真机/模拟器实测(语音链路、服务器连通)
- 自定义场景仅存浏览器 localStorage(web)/单 isolate 内存(workers),清数据或换 isolate 即失
- 内容存在仓库与 speak2606 两份拷贝,改动需双向同步(见 NEXT-STEPS #2)
