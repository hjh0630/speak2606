# Cloudflare Pages 部署指南（前端）

## 操作步骤（Dashboard UI）

1. **打开** https://dash.cloudflare.com → **Workers & Pages** → **Create application** → **Pages** → **Connect to Git**
2. **选仓库**：`hjh0630/speak2606`
3. **Build settings**：
   - **Build command**：`cd frontend && npm install && npm run build`
   - **Build output directory**：`frontend/dist`
   - **Root directory**：留空（仓库根）
   - **Environment variables**：加一条 `NODE_VERSION=20`（避免 Vite 默认用 Node 14）
4. **Save and Deploy** → 等首次部署完成（2-3 分钟）

## 前端同源配置（关键）

部署成功后：
1. 拿到 Pages URL：`https://<project-name>.pages.dev`
2. **不要**在 Pages 设置 `VITE_API_BASE`（保持空，axios/WS 自动走同源）
3. **添加 `_redirects` 转发**：在 Cloudflare Pages → Settings → Functions → `_redirects`（或上传 `frontend/public/_redirects` 文件，**替换 `REPLACE_WITH_WORKERS_SUBDOMAIN` 占位**为你的 Workers 子域）

`_redirects` 内容（已经写在 `frontend/public/_redirects`）：
```
/api/*  https://speakflow-api.<sub>.workers.dev/api/:splat  200
/ws/*   https://speakflow-api.<sub>.workers.dev/ws/:splat   200
```

## 验证（部署后跑）

```bash
# 1. Pages 主入口
curl -I https://<project>.pages.dev
# 期望: 200

# 2. 透过 _redirects 转发到 Workers 的 API
curl https://<project>.pages.dev/api/scenarios | head -c 200
# 期望: {"items":[...],"count":26}

# 3. 完整 Playwright（用 memory 里的 pw-2viewports.js）
SF_URL=https://<project>.pages.dev node C:/Users/S115336/pw-2viewports.js
```

## 国内访问测试

部署后，用手机 4G 或国内 WiFi 打开 `https://<project>.pages.dev`：
- ✅ 国内免 VPN 直接打开
- 速度应比 `speakflow-beryl.vercel.app` 快（Cloudflare 香港节点）

## Vercel 旧部署清理（可选，验证完再删）

```bash
# 列出 Vercel 项目
vercel ls

# 删除（不可恢复）
vercel rm speakflow-beryl
```
