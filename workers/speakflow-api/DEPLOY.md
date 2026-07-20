# SpeakFlow Workers — 部署指南

## 前置（一次性）

### 1. Cloudflare 账号 + 登录

```bash
wrangler login
# 会弹浏览器；用你的 Cloudflare 账号完成 OAuth
```

### 2. 创建 D1 数据库

```bash
wrangler d1 create speakflow-db
# 输出形如：
# {
#   "uuid": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
#   "name": "speakflow-db"
# }

# 把 uuid 填到 wrangler.toml 的 database_id 行
```

### 3. 创建 R2 bucket（两种方式）

- **Web 控制台**：https://dash.cloudflare.com → R2 → Create bucket → 名称 `speakflow-audio` → 允许 public access（设 custom domain `audio.speakflow.pages.dev` 或用 R2.dev 子域）
- **CLI**：
  ```bash
  wrangler r2 bucket create speakflow-audio
  # public access 需要在 dashboard 设置，CLI 不能直接开
  ```

### 4. 跑 schema（建表）

```bash
wrangler d1 execute speakflow-db --remote --file=./schema.sql
```

### 5. 设置 secrets

```bash
wrangler secret put MINIMAX_API_KEY        # 粘贴你的 MiniMax API key
wrangler secret put MINIMAX_GROUP_ID       # 粘贴你的 MiniMax group id（可选）
```

## 部署

```bash
# 同步 content/ 进 workers 项目
npm run sync-content

# 部署到生产
wrangler deploy

# 部署成功后会拿到 URL：speakflow-api.<your-subdomain>.workers.dev
```

## 验证

```bash
# 健康检查
curl https://speakflow-api.<your-subdomain>.workers.dev/health
# 期望: {"ok":true,"ts":...}

# 场景列表
curl https://speakflow-api.<your-subdomain>.workers.dev/api/scenarios | head -c 200

# 状态详情
curl https://speakflow-api.<your-subdomain>.workers.dev/api/status
```

## 前端（Pages）联调

在 Cloudflare Dashboard：
1. Workers & Pages → Create application → Pages → Connect to Git
2. 选 `hjh0630/speak2606` 仓库
3. Build settings:
   - Build command: `cd frontend && npm install && npm run build`
   - Output directory: `frontend/dist`
4. (可选) 加 `_redirects` 把 `/api/*` 和 `/ws/*` 转发到 Workers URL — 但更简单的做法是把 Workers URL 配到前端 `VITE_API_BASE`，前端代码自动处理。
5. 部署

## 调试

```bash
# 本地起 worker + D1 模拟
wrangler dev

# 实时日志
wrangler tail

# 重新跑 schema
wrangler d1 execute speakflow-db --remote --file=./schema.sql
```
