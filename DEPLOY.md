# Cloudflare Pages 部署指南

## 项目结构说明

```
remove-background/
├── index.html              # 前端页面
├── style.css               # 样式文件
├── app.js                  # 前端逻辑（已修改为同域调用）
├── functions/              # Cloudflare Functions 目录
│   └── api/
│       └── remove-bg.js    # 后端 API（替代 server.js）
├── _headers                # 自定义 HTTP 响应头
├── wrangler.toml           # Cloudflare 配置文件
└── DEPLOY.md               # 本文件
```

## 部署步骤

### 方法一：Git 集成自动部署（推荐）

1. **将代码推送到 GitHub**
   ```bash
   git add .
   git commit -m "适配 Cloudflare Pages"
   git push origin main
   ```

2. **登录 Cloudflare Dashboard**
   - 访问 https://dash.cloudflare.com
   - 点击左侧 **Pages**

3. **创建项目**
   - 点击 **Create a project**
   - 选择 **Connect to Git**
   - 授权并选择你的 GitHub 仓库

4. **配置构建设置**
   - Build command: 留空（纯静态，不需要构建）
   - Build output directory: 留空（根目录）

5. **设置环境变量**
   - 在 **Environment variables** 中添加：
     - Name: `REMOVE_BG_API_KEY`
     - Value: 你的 remove.bg API Key（如 `X23XZh61nTi1tjoXAx7RcupD`）

6. **点击 Save and Deploy**

### 方法二：Wrangler CLI 手动部署

1. **安装 Wrangler**
   ```bash
   npm install -g wrangler
   ```

2. **登录 Cloudflare**
   ```bash
   wrangler login
   ```

3. **设置环境变量**
   ```bash
   wrangler pages project create remove-bg
   wrangler pages secret put REMOVE_BG_API_KEY
   # 输入你的 API Key
   ```

4. **部署**
   ```bash
   wrangler pages deploy .
   ```

## 访问网站

部署成功后，你会得到一个类似 `https://remove-bg.pages.dev` 的网址。

## API 测试

```bash
# 健康检查
curl https://你的域名/api/remove-bg

# 上传图片
curl -X POST https://你的域名/api/remove-bg \
  -F "image=@test.jpg"
```

## 注意事项

1. **API Key 安全**：
   - 不要在代码中硬编码 API Key
   - 已通过环境变量 `env.REMOVE_BG_API_KEY` 注入

2. **免费额度**：
   - Cloudflare Pages：无限请求，但 Functions 有每日 100,000 次请求限制（免费版）
   - remove.bg：每月 50 次免费调用

3. **可选配置 KV**：
   - 如需精确的限流控制，可创建 KV 命名空间
   - 在 wrangler.toml 中更新 `id`
   - 非必需，代码中已做兼容处理

4. **原 server.js**：
   - Cloudflare 部署后不需要 server.js
   - 如需本地测试，可继续使用 `npm start`
