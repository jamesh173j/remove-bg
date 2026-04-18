// Cloudflare Function - 代理 remove.bg API
export async function onRequestPost(context) {
    const { request, env } = context;

    try {
        // 简单的限流检查（基于 IP）
        const clientIp = request.headers.get('cf-connecting-ip') || 'unknown';
        const rateLimitKey = `ratelimit:${clientIp}`;

        // 从 KV 获取请求次数（如果有配置 KV）
        let requestCount = 0;
        let windowStart = Date.now();

        if (env.REMOVE_BG_KV) {
            const stored = await env.REMOVE_BG_KV.get(rateLimitKey);
            if (stored) {
                const data = JSON.parse(stored);
                if (data.windowStart > Date.now() - 60000) {
                    requestCount = data.count;
                    windowStart = data.windowStart;
                }
            }
        }

        // 限流：每分钟最多 10 次
        if (requestCount >= 10) {
            return new Response(JSON.stringify({
                error: '请求过于频繁，请稍后再试（每分钟最多10次）'
            }), {
                status: 429,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // 更新请求计数
        if (env.REMOVE_BG_KV) {
            await env.REMOVE_BG_KV.put(rateLimitKey, JSON.stringify({
                count: requestCount + 1,
                windowStart: windowStart
            }), { expirationTtl: 60 });
        }

        // 获取上传的文件
        const formData = await request.formData();
        const imageFile = formData.get('image');

        if (!imageFile) {
            return new Response(JSON.stringify({ error: '请上传图片文件' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // 验证文件类型
        const validTypes = ['image/jpeg', 'image/jpg', 'image/png'];
        if (!validTypes.includes(imageFile.type)) {
            return new Response(JSON.stringify({ error: '仅支持 JPG 和 PNG 格式' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // 验证文件大小（10MB）
        const maxSize = 10 * 1024 * 1024;
        if (imageFile.size > maxSize) {
            return new Response(JSON.stringify({ error: '文件大小不能超过 10MB' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // 读取文件为 ArrayBuffer
        const arrayBuffer = await imageFile.arrayBuffer();

        // 构造发送到 remove.bg 的 formData
        const bgFormData = new FormData();
        bgFormData.append('image_file', new Blob([arrayBuffer], { type: imageFile.type }), imageFile.name);
        bgFormData.append('size', 'auto');

        // 调用 remove.bg API
        const response = await fetch('https://api.remove.bg/v1.0/removebg', {
            method: 'POST',
            headers: {
                'X-Api-Key': env.REMOVE_BG_API_KEY,
            },
            body: bgFormData,
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const errorMsg = errorData.errors?.[0]?.title || `处理失败 (${response.status})`;
            return new Response(JSON.stringify({ error: errorMsg }), {
                status: response.status,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // 获取处理后的图片
        const imageBuffer = await response.arrayBuffer();

        return new Response(imageBuffer, {
            headers: {
                'Content-Type': 'image/png',
                'Content-Length': imageBuffer.byteLength.toString(),
            },
        });

    } catch (error) {
        console.error('处理错误:', error);
        return new Response(JSON.stringify({ error: '服务器内部错误' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

// 健康检查
export async function onRequestGet() {
    return new Response(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }), {
        headers: { 'Content-Type': 'application/json' }
    });
}
