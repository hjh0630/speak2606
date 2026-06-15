# SpeakFlow · Turso (libSQL) 设置指南(可选 0 元持久化)

> 这是 SpeakFlow 的**可选** 0 元持久化方案。当前默认部署路径用本地 SQLite(接受 15 分钟 sleep 和重启丢数据),**不要求**设 Turso。
>
> 如果你以后想让数据 100% 持久,跟着这个文档走。

---

## 0. Turso 是什么

- **SQLite 兼容云数据库**(libSQL 协议)
- 免费层:9 GB 存储 + 5 亿 reads / 月 + 500 万 writes / 月
- 全球边缘节点 + 永久免费 + 数据不丢
- 跟 better-sqlite3 用**同样的 SQL 方言**,改 `db.ts` 1 个文件就能切

## 1. 创建 Turso 账号(2 分钟)

1. 打开 https://turso.tech
2. **Sign up with GitHub** 一键登录
3. 装 CLI(可选,或用 web UI):
   ```bash
   # macOS / Linux
   curl -sSfL https://get.turso.tech/install.sh | bash
   # Windows
   iwr -useb https://get.turso.tech/install.ps1 | iex
   ```

## 2. 创建数据库 + 拿连接串

### CLI 方式(推荐)

```bash
turso auth login               # 浏览器跳转 GitHub 授权
turso db create speakflow      # 创建数据库
turso db show speakflow        # 查 URL,长这样 libsql://speakflow-xxx.turso.io
turso db tokens create speakflow   # 拿 auth token
```

记下两个值:
- `TURSO_DATABASE_URL` = `libsql://speakflow-xxx.turso.io`
- `TURSO_AUTH_TOKEN` = `eyJ...` (JWT token)

### Web 方式

1. https://turso.tech/app → 选你的 project
2. 左边菜单 **Databases** → Create Database → 命名 `speakflow` → 选最近 region
3. 进数据库详情 → 顶部有 **Connection URL** 和 **Token** 标签 → 复制

## 3. 设到 Render env(2 种方式)

### A. Render Web UI

Dashboard → `speakflow-api` → Environment → Add:
- `TURSO_DATABASE_URL` = `libsql://...`
- `TURSO_AUTH_TOKEN` = `eyJ...`

### B. Render CLI(Blueprint 模式不直接支持,需 web UI)

在 Render 控制台手动设。

## 4. 触发代码迁移(还没做完 — 留为 future work)

`backend/src/db.ts` 已经写了 `runAsync` / `getAsync` / `allAsync` 三个 async helpers,
可以在 Turso 模式下用。但 session-manager.ts / routes/sessions.ts / routes/stats.ts
当前**仍然用同步路径** `getDb().prepare(...).run()`,**只在本地 SQLite 路径下工作**。

要让后端**真正在 Turso 上跑**,需要把以下文件改 async(预计 1-2 小时):

| 文件 | 改动 |
|------|------|
| `backend/src/services/session-manager.ts` | `createSession` / `getSession` / `appendMessage` / `completeSession` / `advanceRound` / `loadMessagesFromDb` 全改 async + `await runAsync/getAsync/allAsync` |
| `backend/src/routes/sessions.ts` | 所有 route handler 加 `async` + `await` |
| `backend/src/routes/stats.ts` | 同上 |
| `backend/src/routes/history.ts` | 同上 |
| `backend/src/index.ts` | 启动时 `await bootstrapDb()` |

本次 demo **不做这部分**。

## 5. 实际部署路径(本次 demo 用,0 改动)

| 步骤 | 操作 |
|------|------|
| 1 | Render dashboard → 选 `speakflow-api` service |
| 2 | **不设** `TURSO_DATABASE_URL`(留空) |
| 3 | 必填 env: `MINIMAX_API_KEY` / `MINIMAX_GROUP_ID` / `CORS_ORIGINS` |
| 4 | Deploy → 5-10 分钟后跑通 |
| 5 | **数据**:**重启 / redeploy 会丢**;**15 min sleep 后冷启动 30s** |
| 6 | 26 场景 JSON 在 `content/` 文件里,**不丢**(打包进 repo) |

接受这限制就完成 0 钱 demo。要 100% 持久 + 0 sleep,**做第 4 节的迁移**。

## 6. 验证数据库连接

部署后,想确认是 SQLite 还是 Turso 路径,看 Render logs:

```
# SQLite 路径:
SQLite ready at /var/data/app.db
SQLite migrations applied (sessions, messages, vocabulary_progress).

# Turso 路径(迁移完后):
Turso ready at libsql://speakflow-xxx.turso.io
Turso migrations applied (sessions, messages, vocabulary_progress).
```

## 7. 关联

- `render-deploy-guide.md` — Render 部署主文档
- `speakflow-secret-mgmt` — API key 管理
- `speakflow-project` — 项目总览
