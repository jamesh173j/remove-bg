const express = require('express');
const cors = require('cors');
const multer = require('multer');
const FormData = require('form-data');
const fetch = require('node-fetch');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Remove.bg API Key（仅在服务端存储）
const REMOVE_BG_API_KEY = 'X23XZh61nTi1tjoXAx7RcupD';

// 内存存储（不保存到硬盘）
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
    },
    fileFilter: (req, file, cb) => {
        const validTypes = ['image/jpeg', 'image/jpg', 'image/png'];
        if (validTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('仅支持 JPG 和 PNG 格式'));
        }
    },
});

// 限流配置（内存存储，简单实现）
const rateLimit = new Map();
const RATE_LIMIT_PER_MINUTE = 10;

function checkRateLimit(ip) {
    const now = Date.now();
    const windowStart = now - 60000; // 1分钟窗口

    if (!rateLimit.has(ip)) {
        rateLimit.set(ip, []);
    }

    const requests = rateLimit.get(ip);
    // 清理过期记录
    const validRequests = requests.filter(time => time > windowStart);

    if (validRequests.length >= RATE_LIMIT_PER_MINUTE) {
        return false;
    }

    validRequests.push(now);
    rateLimit.set(ip, validRequests);
    return true;
}

// 中间件
app.use(cors());
app.use(express.static('.'));

// 去背景 API 端点
app.post('/api/remove-bg', upload.single('image'), async (req, res) => {
    try {
        // 获取客户端 IP
        const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

        // 限流检查
        if (!checkRateLimit(clientIp)) {
            return res.status(429).json({
                error: '请求过于频繁，请稍后再试（每分钟最多10次）',
            });
        }

        if (!req.file) {
            return res.status(400).json({ error: '请上传图片文件' });
        }

        // 调用 remove.bg API
        const formData = new FormData();
        formData.append('image_file', req.file.buffer, {
            filename: req.file.originalname,
            contentType: req.file.mimetype,
        });
        formData.append('size', 'auto');

        const response = await fetch('https://api.remove.bg/v1.0/removebg', {
            method: 'POST',
            headers: {
                'X-Api-Key': REMOVE_BG_API_KEY,
                ...formData.getHeaders(),
            },
            body: formData,
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const errorMsg = errorData.errors?.[0]?.title || `处理失败 (${response.status})`;
            return res.status(response.status).json({ error: errorMsg });
        }

        // 获取处理后的图片
        const imageBuffer = await response.buffer();

        // 设置响应头
        res.set('Content-Type', 'image/png');
        res.set('Content-Length', imageBuffer.length);
        res.send(imageBuffer);

    } catch (error) {
        console.error('处理错误:', error);
        res.status(500).json({ error: '服务器内部错误，请稍后重试' });
    }
});

// 健康检查
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 错误处理中间件
app.use((err, req, res, next) => {
    console.error('错误:', err.message);
    res.status(400).json({ error: err.message });
});

app.listen(PORT, () => {
    console.log(`🚀 服务器已启动: http://localhost:${PORT}`);
    console.log('📁 静态文件服务: 已启用');
    console.log('🔒 API 保护: 已启用（后端代理）');
});
