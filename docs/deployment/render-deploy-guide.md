# SpeakFlow · Render 部署指南(后端 Fastify + SQLite)

> 目标:把 Fastify + SQLite + WebSocket 后端上 Render,**24/7 永久运行**,
> 跟 Vercel 前端通过 `VITE_API_BASE` env 串起来。
>
> 适用范围:**A · Vercel + Render** 模式 — 前端永久 URL,后端稳定运行。
> 后续:换 named tunnel / 自建域名时,本文档的 env 段照搬即可。

---

## 0. 前置(必须先做,一次性)

| 准备项 | 说明 | 阻断? |
|--------|------|-------|
| GitHub 账号 | Render 用 GitHub 关联,自动部署 | **是** |
| Render 账号 | [注册](https://render.com)(GitHub 一键) | **是** |
| MiniMax API key | `~/.speakflow/key.bin` 里那个,本次以 env var 形式直接传 | **是** |
| 信用卡 | **Render 免费层足够**,但需要绑卡激活(不扣费) | 视地区 |
| 本仓库推送到 GitHub | Render 从 GitHub pull | **是** |

**不需要:** 自己的域名 / ICP 备案(用 `*.onrender.com` 子域名)。

---

## 1. 准备仓库(把代码推上 GitHub)

> 如果仓库已经在 GitHub 上,跳过这步。

```bash
cd E:\00.ai\claude\speak2606
git init   # 如果还没有
git add .
git commit -m "feat: vercel+render deploy ready"
gh repo create speakflow --public --source=. --push
# 或者手动 push 到 GitHub
```

⚠️ **不要**把 `.env` / `key.bin` push 上去,确认 `.gitignore` 正确。

---

## 2. Render Blueprint(推荐 · 一键部署)

`render.yaml` 已经在仓库根目录配好,Render 会自动识别。

### 2.1 在 Render 创建 Blueprint

1. 打开 https://dashboard.render.com/blueprints
2. **New Blueprint Instance** → 选 GitHub 仓库
3. 名字填 `speakflow`
4. Render 读 `render.yaml`,列出 1 个 service: `speakflow-api`
5. 点 **Apply**

### 2.2 必须设的环境变量

Render UI 创建后会显示 env var 输入框(在 Environment tab),设这些:

| Key | Value | 备注 |
|-----|-------|------|
| `MINIMAX_API_KEY` | (你 DPAPI 里那个 key) | 必填,真接 LLM |
| `MINIMAX_GROUP_ID` | (你的 group id) | 可选 |
| `CORS_ORIGINS` | `https://speakflow.vercel.app` | **改**成你的 Vercel URL,逗号分隔多个 |
| `DB_PATH` | `/var/data/app.db` | 已配默认值 |
| `PORT` | `10000` | Render 自动设置,不用手动 |
| `HOST` | `0.0.0.0` | 已配默认值 |
| `LOG_LEVEL` | `info` | 可改 `debug` |

**注意 API key 安全性**:
- 本次 demo 用 env var 直传 key(简单)
- 真上线建议迁移到 DPAPI-equivalent(Render 不支持 Windows DPAPI,改用 Render Secret Files 或 env-var 加密)
- 详见 `speakflow-secret-mgmt` memory

### 2.3 等部署完成

Render 跑 `npm install && npm run build` + `npm start`,约 5-10 分钟首次构建。

部署成功后,URL 形如 `https://speakflow-api.onrender.com`。

---

## 3. 持久化注意事项(关键!)

### 3.1 Render 免费层 **不提供** persistent disk

- 服务**重启**或重新部署时,`/var/data/app.db` 会被**清空**
- 所有历史会话和练习数据丢失
- 但 **24/7 不重启就没事**

### 3.2 付费层($7/月 Starter)有 1GB disk

- `render.yaml` 已配 `disk: { mountPath: /var/data, sizeGB: 1 }`
- SQLite 文件持久化,服务重启不丢数据

### 3.3 免费方案:换外部 DB

如果不想付 Render 起步费,有两个 0 元持久化方案(需改代码):

**A. Turso**(SQLite 兼容,推荐,改动小)
1. 跑 `npx @libsql/cli db create speakflow`
2. 拿 `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN`
3. `npm install @libsql/client` 替换 better-sqlite3
4. 改 `backend/src/db.ts` 用 `createClient({...})`
5. **改动 1 个文件,15 分钟**

**B. Neon PostgreSQL**(免费 0.5GB)
1. 注册 Neon,创建 project,拿连接串
2. `npm install pg`
3. SQL 语法从 SQLite 改 PostgreSQL(`AUTOINCREMENT` → `SERIAL`,`INTEGER` 不变)
4. **改动 2-3 个文件,1-2 小时**

这两个方案都**不在本次 demo 范围**,先用 Render persistent disk 跑。

---

## 4. 冷启动 / Sleep 行为

Render 免费 Web Service:
- **15 分钟无流量 → 进入 sleep**
- 下次访问要 30-50 秒唤醒
- 月度 750 小时 free tier(24/7 占 720,刚好够,但有 sleep 体验)

要避免 sleep,需升 Starter($7/月),24/7 实时响应。

---

## 5. 验证清单(部署后必做)

```bash
# 1. /health
curl https://speakflow-api.onrender.com/health
# 期望: {"ok":true,"ts":...,"minimax":{"hasCredentials":true}}

# 2. /api/scenarios
curl https://speakflow-api.onrender.com/api/scenarios | head -c 200
# 期望: {"items":[...26 个场景...]}

# 3. /api/dictionary?w=denim
curl https://speakflow-api.onrender.com/api/dictionary?w=denim
# 期望: {"word":"denim","meaning_zh":"牛仔布","source":"local"}

# 4. WebSocket (在浏览器 console 测试)
const ws = new WebSocket('wss://speakflow-api.onrender.com/ws/session/test')
ws.onopen = () => { ws.send(JSON.stringify({type:'ping'})); ws.close() }
ws.onmessage = (e) => console.log(e.data)
# 期望: 收到 {"type":"pong"}
```

---

## 6. 串接 Vercel 前端

后端跑起来后,把 Render URL 设到 Vercel 的 `VITE_API_BASE` env:

```bash
# Vercel CLI
vercel env add VITE_API_BASE production
# 输入: https://speakflow-api.onrender.com
vercel --prod
```

前端会构建时把 VITE_API_BASE 烤进 bundle,axios / WebSocket 都从那个 origin 发请求。

---

## 7. 常见问题

| 现象 | 原因 | 解决 |
|------|------|------|
| 部署后 502 Bad Gateway | 启动失败,看 Render logs | 常见:port 冲突,`PORT=10000` |
| 数据库数据丢失 | 用了 free tier 没有 disk | 升 Starter 或换 Turso |
| 15 分钟后访问很慢 | Render sleep | 升 Starter 或保持 5 分钟内 ping 一次 |
| CORS 错误 | `CORS_ORIGINS` 没设 Vercel 域名 | 后端 env 加 `https://speakflow.vercel.app` |
| WebSocket 连不上 | 浏览器拒绝 `wss://` 跨域 | 检查 CORS / Render 是否支持 WSS(支持) |

---

## 8. 关联

- `vercel-deploy-guide.md` — 前端 Vercel 部署
- `speakflow-palette` / `speakflow-secret-mgmt` / `speakflow-project` — 内部设计令牌 / API key 管理 / 项目总览
