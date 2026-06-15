# SpeakFlow · Vercel 部署指南(前端 SPA)

> 目标:把 Vue 3 SPA 上 Vercel,拿到**永久** `xxx.vercel.app` 域名,**不依赖你电脑一直开机**。
>
> 适用范围:**A · Vercel + Render** 模式 — 前端静态,后端在 Render(见 `render-deploy-guide.md`)。
> 后续:走 named tunnel / 自建域名时,本文档的 Env 段照搬即可。

---

## 0. 前置(必须先做,一次性)

| 准备项 | 说明 | 阻断? |
|--------|------|-------|
| Node.js ≥ 18.17 | [下载](https://nodejs.org) | **是** |
| Vercel 账号 | [注册](https://vercel.com/signup)(GitHub 一键) | **是** |
| 邮箱 | 接收部署通知 | 否 |

**不需要:** 信用卡 / 域名 / 数据库(本次纯前端,后端走 Render)。

---

## 1. CLI 部署(推荐 · 4 条命令)

> 适合:本地能跑命令行的开发者。最快,出问题最好排查。

### 1.1 装 Vercel CLI

```bash
npm i -g vercel
```

### 1.2 登录(浏览器弹窗,首次需要)

```bash
vercel login
```

会弹出浏览器要求授权 GitHub/GitLab/邮箱,选哪个都行。完成后命令行显示 `Success!`。

### 1.3 进项目根目录

```bash
cd E:\00.ai\claude\speak2606
```

### 1.4 部署到生产环境

```bash
vercel --prod
```

**首次会被问几个问题,全部按回车用默认值即可:**

```
? Set up and deploy? [Y/n]                            → Y
? Which scope?                                        → 选你的账号
? Link to existing project? [y/N]                     → N
? What's your project's name?                        → speakflow
? In which directory is your code located?            → ./   (vercel.json 已写死 buildCommand/output)
? Want to modify these settings? [y/N]               → N
```

约 60-120 秒后给你**生产 URL**,形如 `https://speakflow.vercel.app` 或 `https://speakflow-<hash>.vercel.app`。

---

## 2. 必须设的环境变量

部署后必须设 `VITE_API_BASE` 指向 Render 后端(见 `render-deploy-guide.md`),否则前端会请求自己的 `/api` 拿到 404。

### CLI 方式(推荐,部署完直接设):

```bash
vercel env add VITE_API_BASE production
# 粘贴你的 Render URL,比如 https://speakflow-api.onrender.com
# 选 Production,然后 redeploy:
vercel --prod
```

### Web 方式:

1. 打开 https://vercel.com/dashboard → 进 speakflow 项目
2. Settings → Environment Variables
3. 名称:`VITE_API_BASE`,值:`https://<你的-render-url>.onrender.com`,选 Production
4. Deployments → 选最新 → Redeploy

---

## 3. 验证清单(部署后必做)

1. 打开 `https://speakflow.vercel.app/` → 看到 hero 渐变 + 推荐场景
2. 滚到 `场景库` → 26 个场景都显示,3 个 ⚠️ 异常 + 建议先学 chip 出现
3. 试选词查词:**双击**任意英文单词 → 弹小卡片显示中文 + 喇叭听发音
4. 进 `电话会议` → 自由对话模式 → 文字输入 1-2 句 → 看 AI 回复 + LLM 评分

如果 LLM 评分是 mock(全 78,key_issues 是 "No scored turns yet" 这类通用兜底),说明 `VITE_API_BASE` 没设,后端还是 dev 的 mock。

---

## 4. 常见问题

| 现象 | 原因 | 解决 |
|------|------|------|
| 部署成功但页面 404 | `vercel.json` 路由 rewrite 没生效 | 检查 `outputDirectory` 写的是 `frontend/dist` |
| 场景加载但 LLM 评分都是 mock | `VITE_API_BASE` 没设 / 设错 | 重新 `vercel env add VITE_API_BASE production` |
| 选词弹中文后读音不工作 | 浏览器 STT/TTS 权限 | HTTPS 下浏览器必须授权麦克风 + 音频 |
| Vercel 部署慢 / 失败 | npm install 太慢 | Vercel 默认用 npm,你的 package-lock 锁了版本应该没问题 |

---

## 5. 自定义域名(可选,后续)

1. 买域名(Cloudflare / Namecheap / 阿里云,年费 ¥50-¥200)
2. Vercel 项目 → Settings → Domains → Add: `speakflow.yourdomain.com`
3. 配 DNS(`CNAME` 指向 `cname.vercel-dns.com`)
4. 自动 https 证书
5. Render 那边也加一个 custom domain,跟前端保持一致(`api.yourdomain.com`)

---

## 关联

- `render-deploy-guide.md` — 后端部署
- `speakflow-palette` / `speakflow-secret-mgmt` / `speakflow-project` — 内部设计令牌 / API key 管理 / 项目总览
