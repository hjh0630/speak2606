# SpeakFlow · 服装纺织外贸英语口语练习 App

一个垂直场景的英语口语练习应用,基于 MiniMax 语音大模型,专注服装纺织外贸业务。
内置 6 个高频场景(电话会议、询盘报价、工厂参观、物流船期、打样、索赔售后),
三个难度(入门 / 进阶 / 高阶),两种模式(自由对话 / 跟读),
每轮 AI 回复后给简洁反馈(总分 + 流利度 + 准确度 + 关键问题 + 改进建议)。

## ✨ 特性

- 🎙 **真实语音合成** —— 对接 MiniMax `speech-2.8-turbo`,男声 128kbps mp3
- 🗣 **浏览器原生 ASR** —— Chrome / Edge / Safari 用 Web Speech API 实时识别
- 💬 **真实 LLM 对话** —— MiniMax `abab` 系列,理解外贸场景上下文
- 📊 **简洁版反馈** —— 总分 + 3 条关键问题 + 1 句改进建议
- 🧠 **学习记录** —— 每次练习写入 SQLite,统计页有成长曲线、按场景分布
- 🌐 **单端口部署** —— 后端同时 serve API + WebSocket + 静态前端,生产环境一个 URL 就够

## 📁 目录

```
/workspace
├── content/            # 静态内容(场景/对话/词汇/system prompts) — 不需要启动
│   ├── scenarios.json
│   ├── dialogs/        # 18 个对话脚本(6 场景 × 3 难度)
│   ├── vocabulary.json # 64+ 行业术语
│   └── system_prompts.json
├── backend/            # Fastify + TypeScript + SQLite + WebSocket
│   ├── src/
│   │   ├── services/   # MiniMax LLM/TTS/ASR 客户端封装
│   │   ├── routes/     # /api/scenarios, /api/sessions, /api/history, /api/stats
│   │   └── ws/         # /ws/session/:id
│   └── data/           # SQLite 数据库
└── frontend/           # Vue 3 + Vite + Pinia + Vue Router + TailwindCSS
    ├── src/
    │   ├── views/      # 7 个页面
    │   ├── components/ # 8 个组件
    │   ├── stores/     # 3 个 Pinia stores
    │   └── composables/useRecorder.ts + useBrowserSTT.ts + useTTS.ts
    └── dist/           # 生产构建(后端会自动 serve)
```

## 🚀 快速启动(开发模式)

需要 Node.js 18+。开两个终端:

**1. 启动后端(端口 3001)**

```bash
cd /workspace/backend
cp .env.example .env   # 第一次需要,然后填入 MiniMax API key
npm install
npm run dev
```

健康检查:`curl http://localhost:3001/health`

**2. 启动前端(端口 5173)**

```bash
cd /workspace/frontend
npm install
npm run dev
```

打开:`http://localhost:5173`

## 📦 快速启动(生产模式 — 单端口)

```bash
# 构建前端
cd /workspace/frontend && npm run build

# 启动后端(它会自动 serve 前端 dist)
cd /workspace/backend
npm install && npm run dev
```

打开:`http://localhost:3001` — 前后端同源,无需 proxy。

## 🔑 环境变量

写在 `/workspace/backend/.env`:

```ini
# MiniMax 语音大模型 API
MINIMAX_API_KEY=sk-cp-...
MINIMAX_GROUP_ID=2019754696415122059
API_BASE=https://api.minimax.chat

# Server
PORT=3001
HOST=0.0.0.0
LOG_LEVEL=info

# CORS(逗号分隔,生产可以收紧)
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173

# 内容目录
CONTENT_DIR=/workspace/content
```

如果 `MINIMAX_API_KEY` 留空,后端仍会启动,但对话 / 评分 / TTS 走 mock 模式(方便纯前端调试,无 API 消耗)。

## 🎯 6 个内置场景

| ID | 中文 | 角色扮演 | 你练什么 |
|----|------|---------|---------|
| `phone_meeting` | 电话会议 | 海外采购商 | 开场白 / 介绍公司 / 处理异议 |
| `inquiry_quote` | 询盘报价 | 客户 RFQ | 报价 / 议价 / 解释 MOQ / lead time |
| `factory_audit` | 工厂参观 / 验厂 | 客户验厂 | 介绍产线 / 产能 / 资质 |
| `logistics_shipping` | 物流 / 船期 / 单证 | 货代 / 报关 | 催货 / 装柜 / 提单 / 装船通知 |
| `sample_development` | 款式开发 / 打样 | 设计师 / 客户 | 确认样板 / 工艺 / 修改意见 |
| `claim_aftersales` | 索赔 / 售后 | 客户投诉 | 质量问题 / 延误 / 谈判解决 |

## 🧪 验证后端联通

```bash
# 健康
curl http://localhost:3001/health

# 列出场景
curl http://localhost:3001/api/scenarios | python3 -m json.tool

# 创建会话
curl -X POST http://localhost:3001/api/sessions \
  -H "Content-Type: application/json" \
  -d '{"scenario_id":"phone_meeting","difficulty":"beginner","mode":"free"}'

# 发消息(替换 session_id)
curl -X POST http://localhost:3001/api/sessions/<SID>/messages \
  -H "Content-Type: application/json" \
  -d '{"content":"Hello, this is Chen from Guangzhou."}'
```

## ⚠️ 已知限制

- **ASR** 用浏览器原生 Web Speech API(Firefox 不支持,自动降级到文字输入)
- **TTS** 音频用后端 hex → mp3 实时合成,首次加载略慢(等 LLM 几秒)
- **MiniMax 配额** 受你账号 plan 限制
- **历史记录** 存在本地 SQLite,清空数据库会丢

## 🛠 技术栈

- **后端**:Fastify 4 + TypeScript + better-sqlite3 + ws + dotenv
- **前端**:Vue 3.5 + Vite 5 + Pinia 2 + Vue Router 4 + TailwindCSS 3
- **录音**:MediaRecorder API + Web Audio API(电平监测)
- **ASR**:Web Speech API(浏览器原生,无需服务器)
- **TTS/LLM**:MiniMax 语音大模型(API 文档见 `src/services/minimax-*.ts`)
