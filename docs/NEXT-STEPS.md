# SpeakFlow 后续工作清单

> 2026-07-30 三阶段扩展(生产制造场景 / 自定义场景生成器 / Android 版)完成后的待办。
> 按优先级排序,每项标注原因与建议做法。

## 🔴 高优先级

### 1. 提交未入库的改动
工作区有大量未提交内容,建议分多个 commit 入库:
- 阶段 1:`content/textile-english/`(6 新场景 + 词汇)+ `content/dialogs/garment_washing_{intermediate,advanced}.json`
- 阶段 2:`backend/`(custom-scenarios 路由/服务、sessions.ts、session-ws.ts、types.ts、index.ts)+ `frontend/`(CustomScenarioView、stores/customScenarios、api/customScenarios、ScenariosView、ScenarioPreviewView、NavBar、router、types/api)+ `workers/speakflow-api/` 对应同步
- 阶段 3:`android/` 整个新工程(**先加 `.gitignore`:`build/`、`.gradle/`、`local.properties`、`*.iml`——`local.properties` 含本机 SDK 路径,绝不能入库**)
- 此前遗留:iOS 客户端改动 + TTS voices 端点(`backend`/`workers` 的 `/api/tts/voices`)

### 2. 内容目录双拷贝问题(隐患)
`backend/.env` 的 `CONTENT_DIR` 指向 `E:\00.ai\speak2606\content`(独立拷贝),与仓库 `content/` 是两份数据。本次新内容已手动同步,但以后每次改内容都要两边同步,极易漏。建议二选一:
- 把 `.env` 的 `CONTENT_DIR` 改为仓库内 `E:\00.ai\00.project\10.HTalk\content`,speak2606 只做部署不再存内容;
- 或写一个 `scripts/sync-content.bat` 一键同步并纳入部署流程。

### 3. MiniMax 真实生成链路未验证
本机访问 MiniMax API 30s 超时(网络问题),自定义场景目前只能走 mock 回退。网络/配额恢复后需实测:
- `POST /api/custom-scenarios/generate` 真实 LLM 输出(重点验证 JSON 解析健壮性,LLM 偶尔会包 markdown 围栏)
- TTS 真实合成、ASR、评分链路

## 🟡 中优先级

### 4. Android 真机/模拟器实测
`app-debug.apk` 已编译通过(9.7 MB)但未经设备验证:
- 语音链路:SpeechRecognizer 识别英文、TtsService(后端 /api/tts 优先,系统 TTS 兜底)
- 设置页服务器地址:模拟器用 `http://10.0.2.2:3001`,真机用局域网 IP 或 cloudflared 隧道 URL
- 已知小警告:`Icons.Filled.List`/`ArrowBack` 建议换 AutoMirrored 版本(不影响运行)

### 5. 前端自定义场景的浏览器实测
构建与类型检查已过、API 链路 curl 验证过,但没做过 UI 点击级测试(生成 → 保存 → 列表 → 练习页)。建议用 webapp-testing/Playwright 跑一遍。

### 6. 重新部署线上
- `speak2606` 的前端 dist 需重新构建部署(自定义场景入口才上线)
- Vercel(frontend)+ Render(backend)按 `docs/deployment/` 流程更新
- cloudflared 临时隧道 URL 每次重启会变,分享前重新取

## 🟢 低优先级 / 优化项

### 7. Android 功能对齐
- Android 端还没有"自定义场景"功能(目前仅 web 有),可后续加(后端 API 已就绪)
- release 签名打包(目前只有 debug APK)、应用图标美化(现为占位矢量图)

### 8. Workers 版 custom 场景的 isolate 限制
`workers/speakflow-api` 的自定义场景存模块级 Map,仅单 isolate 有效,冷启动后丢失。若线上用得多,迁移到 D1(sessions 表加 JSON 列)。

### 9. workers 类型检查脚本修复
`workers/speakflow-api` 的 `npx tsc` 会解析到全局 TS 6 报既有配置错,`.bin` shim 也损坏。建议把 typecheck 脚本改为 `node ./node_modules/typescript/bin/tsc --noEmit`。

### 10. iOS 遗留改动收尾
未提交的 iOS 改动(TTS voices、`BackgroundMusicService`、`UserProfileStore`、新增 Views/Tests)需要在 Xcode 里编译验证后提交;iOS 侧同样没有自定义场景功能。

### 11. e2e 测试更新
`e2e/` 的测试未覆盖新功能(自定义场景生成、practice 链路),建议补充。
