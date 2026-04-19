# 智能去背景工具 (BG-Remover)

一个极简的、基于 AI 的在线图片去背景工具，使用 remove.bg API 实现高质量抠图。

## 功能特性

- 拖拽或点击上传图片
- AI 自动抠图
- 原图/结果对比预览
- 一键下载透明背景 PNG
- Google 账号登录
- 纯前端实现，可部署到任何静态托管服务

## 快速开始

### 本地测试

```bash
# 使用任意静态服务器
npx serve
# 或
python -m http.server 3000
```

然后在浏览器中访问 `http://localhost:3000`

### 部署到 Cloudflare Pages

1. 将代码推送到 GitHub
2. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com)
3. 创建 Pages 项目，连接 GitHub 仓库
4. 直接部署（无需构建命令）

### 部署到 Vercel/Netlify

直接拖拽文件夹上传即可。

## 限制说明

- 支持格式: JPG, PNG
- 最大文件大小: 10MB
- remove.bg 免费额度: 每月 50 次

## 文件说明

| 文件 | 说明 |
|------|------|
| index.html | 主页面结构 |
| style.css | 样式文件 |
| app.js | 前端逻辑（直接调用 remove.bg API） |

## Google OAuth 配置

已在 `app.js` 中配置好 Google OAuth 客户端 ID。如需修改：

1. 访问 [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. 创建 OAuth 2.0 客户端 ID（Web 应用类型）
3. 添加授权来源：
   - `http://localhost:3000`（本地测试）
   - `https://你的域名.pages.dev`（线上环境）
4. 复制客户端 ID，替换 `app.js` 中的 `GOOGLE_CLIENT_ID`

## ⚠️ 注意

- 本版本为纯前端实现，API Key 内嵌在代码中
- remove.bg 免费额度为每月 50 次
- Google OAuth 仅用于用户身份识别，不存储任何敏感信息
