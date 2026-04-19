// Cloudflare Function - 后端 API
// 处理去背景请求和用户数据存储

// CORS 响应头
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// 处理 OPTIONS 预检请求
export async function onRequestOptions() {
    return new Response(null, {
        status: 204,
        headers: corsHeaders,
    });
}

// 主处理函数
export async function onRequestPost(context) {
    const { request, env } = context;

    try {
        // 获取用户 ID（从请求头或 JWT）
        const authHeader = request.headers.get('Authorization');
        let userId = 'guest';

        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.slice(7);
            try {
                const payload = JSON.parse(atob(token));
                userId = payload.sub || 'guest';
            } catch (e) {
                userId = 'guest';
            }
        }

        // 检查使用限制
        const canProceed = await checkUsageLimit(env, userId);
        if (!canProceed.allowed) {
            return new Response(JSON.stringify({
                error: canProceed.message,
                remaining: canProceed.remaining,
                plan: canProceed.plan
            }), {
                status: 429,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // 获取上传的文件
        const formData = await request.formData();
        const imageFile = formData.get('image');

        if (!imageFile) {
            return new Response(JSON.stringify({ error: '请上传图片文件' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // 验证文件类型
        const validTypes = ['image/jpeg', 'image/jpg', 'image/png'];
        if (!validTypes.includes(imageFile.type)) {
            return new Response(JSON.stringify({ error: '仅支持 JPG 和 PNG 格式' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // 验证文件大小（10MB）
        const maxSize = 10 * 1024 * 1024;
        if (imageFile.size > maxSize) {
            return new Response(JSON.stringify({ error: '文件大小不能超过 10MB' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // 调用 remove.bg API
        const arrayBuffer = await imageFile.arrayBuffer();
        const bgFormData = new FormData();
        bgFormData.append('image_file', new Blob([arrayBuffer], { type: imageFile.type }), imageFile.name);
        bgFormData.append('size', 'auto');

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
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // 获取处理后的图片
        const imageBuffer = await response.arrayBuffer();

        // 更新使用次数
        await updateUsage(env, userId, imageFile.name);

        // 获取更新后的用户信息
        const userInfo = await getUserInfo(env, userId);

        return new Response(imageBuffer, {
            headers: {
                ...corsHeaders,
                'Content-Type': 'image/png',
                'Content-Length': imageBuffer.byteLength.toString(),
                'X-User-Info': JSON.stringify(userInfo)
            },
        });

    } catch (error) {
        console.error('处理错误:', error);
        return new Response(JSON.stringify({ error: '服务器内部错误' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
}

// 获取用户信息
export async function onRequestGet(context) {
    const { request, env } = context;

    const authHeader = request.headers.get('Authorization');
    let userId = 'guest';

    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.slice(7);
        try {
            const payload = JSON.parse(atob(token));
            userId = payload.sub || 'guest';
        } catch (e) {
            userId = 'guest';
        }
    }

    const userInfo = await getUserInfo(env, userId);

    return new Response(JSON.stringify(userInfo), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
}

// 检查使用限制
async function checkUsageLimit(env, userId) {
    const USAGE_LIMITS = {
        guest: 3,
        free: 5,
        pro: Infinity
    };

    // 获取用户数据
    let userData = await getUserData(env, userId);
    const plan = userData?.plan || 'guest';
    const limit = USAGE_LIMITS[plan];

    if (limit === Infinity) {
        return { allowed: true, plan: 'pro', remaining: Infinity };
    }

    // 检查今日使用次数
    const today = new Date().toDateString();
    const usage = userData?.usage || { date: today, count: 0 };

    if (usage.date !== today) {
        usage.date = today;
        usage.count = 0;
    }

    if (usage.count >= limit) {
        return {
            allowed: false,
            message: plan === 'guest'
                ? '今日免费次数已用完，请登录以获得更多次数'
                : '今日免费次数已用完，升级 Pro 可无限使用',
            remaining: 0,
            plan
        };
    }

    return {
        allowed: true,
        remaining: limit - usage.count,
        plan
    };
}

// 更新使用次数
async function updateUsage(env, userId, filename) {
    const userData = await getUserData(env, userId);
    const today = new Date().toDateString();

    if (!userData.usage || userData.usage.date !== today) {
        userData.usage = { date: today, count: 0 };
    }

    userData.usage.count++;
    userData.totalUsage = (userData.totalUsage || 0) + 1;

    // 添加历史记录
    if (!userData.history) userData.history = [];
    userData.history.unshift({
        id: Date.now().toString(),
        filename,
        time: new Date().toISOString()
    });
    userData.history = userData.history.slice(0, 20);

    await saveUserData(env, userId, userData);
}

// 获取用户信息
async function getUserInfo(env, userId) {
    const userData = await getUserData(env, userId);
    const today = new Date().toDateString();

    const USAGE_LIMITS = {
        guest: 3,
        free: 5,
        pro: Infinity
    };

    const plan = userData.plan || 'guest';
    const limit = USAGE_LIMITS[plan];
    const usage = userData.usage?.date === today ? userData.usage.count : 0;
    const remaining = limit === Infinity ? Infinity : Math.max(0, limit - usage);

    return {
        id: userId,
        plan,
        usage,
        remaining,
        totalUsage: userData.totalUsage || 0,
        history: userData.history || []
    };
}

// 从 KV 获取用户数据
async function getUserData(env, userId) {
    if (!env.USER_DATA_KV) {
        // 如果没有 KV，返回空对象
        return { plan: 'guest', usage: { date: new Date().toDateString(), count: 0 } };
    }

    const key = `user:${userId}`;
    const data = await env.USER_DATA_KV.get(key);

    if (data) {
        return JSON.parse(data);
    }

    return {
        plan: userId === 'guest' ? 'guest' : 'free',
        usage: { date: new Date().toDateString(), count: 0 },
        totalUsage: 0,
        history: []
    };
}

// 保存用户数据到 KV
async function saveUserData(env, userId, data) {
    if (!env.USER_DATA_KV) return;

    const key = `user:${userId}`;
    await env.USER_DATA_KV.put(key, JSON.stringify(data));
}
