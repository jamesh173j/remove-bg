# 智能去背景工具 (BG-Remover)

一个极简的、基于 AI 的在线图片去背景工具，采用前后端分离架构，部署在 Cloudflare Pages + Workers。

## 技术架构

```
┌─────────────┐      ┌──────────────────┐      ┌─────────────┐
│  Cloudflare │      │  Cloudflare      │      │  remove.bg  │
│  Pages      │ ───▶ │  Workers + KV    │ ───▶ │  API        │
│  (前端)      │      │  (后端API+用户数据) │      │  (去背景)    │
└─────────────┘      └──────────────────┘      └─────────────┘
                           │
                           ▼
                    ┌──────────────┐
                    │  Cloudflare  │
                    │  KV          │
                    │  (用户数据)   │
                    └──────────────┘
```

## 功能特性

- 拖拽或点击上传图片
- AI 自动抠图（后端调用 remove.bg API，API Key 安全存储）
- 原图/结果对比预览
- 一键下载透明背景 PNG
- Google OAuth 登录
- **用户体系**（数据存储在 Cloudflare KV）：
  - 游客：每日 3 次免费
  - 免费用户：每日 5 次免费
  - Pro 会员：无限次使用
- 个人中心（使用统计、历史记录）
- Pro 会员升级页面（模拟支付）

## 部署步骤

### 1. 准备工作

- Cloudflare 账号
- GitHub 账号
- remove.bg API Key（从 https://www.remove.bg/api 获取）
- Google OAuth 客户端 ID

### 2. 创建 Cloudflare KV 命名空间

```bash
# 安装 Wrangler CLI
npm install -g wrangler

# 登录 Cloudflare
wrangler login

# 创建 KV 命名空间
wrangler kv:namespace create "USER_DATA_KV"
wrangler kv:namespace create "USER_DATA_KV" --preview
```

创建成功后，会输出类似：
```
{ binding = "USER_DATA_KV", id = "xxxxx", preview_id = "yyyyy" }
```

### 3. 更新配置文件

编辑 `wrangler.toml`，填入你的 KV ID：

```toml
[[kv_namespaces]]
binding = "USER_DATA_KV"
id = "xxxxx"  # 上面创建的 id
preview_id = "yyyyy"  # 上面创建的 preview_id
```

### 4. 推送到 GitHub

```bash
git add .
git commit -m "前后端分离架构"
git push origin main
```

### 5. 在 Cloudflare Dashboard 配置

1. 访问 https://dash.cloudflare.com
2. 点击 **Workers & Pages** → **Create a project**
3. 选择 **Connect to Git**，选择你的仓库
4. 构建设置：
   - Build command: 留空
   - Build output directory: 留空
5. 点击 **Save and Deploy**

### 6. 设置环境变量

在 Cloudflare Dashboard → 你的项目 → Settings → Environment variables 中添加：

| 变量名 | 值 |
|--------|-----|
| `REMOVE_BG_API_KEY` | 你的 remove.bg API Key |

### 7. 绑定 KV 命名空间

在 Settings → Functions → KV namespace bindings 中添加：

- Variable name: `USER_DATA_KV`
- KV namespace: 选择你创建的命名空间

### 8. 重新部署

修改任意文件推送，或点击 **Retry deployment**

## 本地开发

### 方式 1：纯前端（使用线上 API）

```bash
npx serve
```

访问 http://localhost:3000

### 方式 2：完整开发环境（Wrangler）

```bash
# 创建本地环境变量
echo "REMOVE_BG_API_KEY=你的APIKey" > .dev.vars

# 启动本地开发服务器
wrangler pages dev .
```

访问 http://localhost:8788

## API 端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/remove-bg` | GET | 获取用户信息 |
| `/api/remove-bg` | POST | 上传图片去背景 |

## 用户数据存储

用户数据存储在 Cloudflare KV 中，结构如下：

```json
{
  "plan": "free|pro|guest",
  "usage": {
    "date": "2024-04-19",
    "count": 3
  },
  "totalUsage": 10,
  "history": [
    {
      "id": "123456",
      "filename": "photo.jpg",
      "time": "2024-04-19T10:00:00Z"
    }
  ]
}
```

## 安全说明

- ✅ API Key 仅存储在 Cloudflare Workers 环境变量中，前端不可见
- ✅ 用户数据存储在 Cloudflare KV，跨设备同步
- ✅ 使用次数限制在后端验证，防止绕过
- ⚠️ remove.bg 每月 50 次免费调用，超出需付费

## 文件说明

| 文件/目录 | 说明 |
|-----------|------|
| `index.html` | 主页面（前端） |
| `style.css` | 样式文件 |
| `app.js` | 前端逻辑（调用后端 API） |
| `functions/api/remove-bg.js` | Cloudflare Function（后端 API） |
| `wrangler.toml` | Cloudflare 配置文件 |

## 后续优化方向

- [ ] 接入真实支付（Stripe/PayPal）
- [ ] 批量处理功能
- [ ] 更多图片格式支持
- [ ] 自定义背景颜色

## 技术支持

如有问题，请提交 GitHub Issue。
