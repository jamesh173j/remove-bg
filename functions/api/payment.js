// Cloudflare Function - PayPal 支付处理
// 沙箱环境配置

const PAYPAL_CLIENT_ID = 'AZwt20ycBUiU3Si0IPO8zL1c_nqiKB_BZewlS7utNFX61npnQWiGrayC02AuBbjYfKzOl7_L93a0UjX-';
const PAYPAL_SECRET = 'EGq0wXOglvMfF4FZCt5syUgj7Zare38vc2P3TTPYp5aK-F5WUm0NvJ1iADoLbtMZSbsjj_NFi5X5s607';
const PAYPAL_API = 'https://api-m.sandbox.paypal.com'; // 沙箱环境

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

// 获取 PayPal Access Token
async function getPayPalToken() {
    const auth = btoa(`${PAYPAL_CLIENT_ID}:${PAYPAL_SECRET}`);

    const response = await fetch(`${PAYPAL_API}/v1/oauth2/token`, {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials',
    });

    if (!response.ok) {
        throw new Error('Failed to get PayPal token');
    }

    const data = await response.json();
    return data.access_token;
}

// 创建支付订单
export async function onRequestPost(context) {
    const { request, env } = context;

    try {
        const body = await request.json();
        const { plan, userId } = body;

        if (!plan || !['monthly', 'yearly'].includes(plan)) {
            return new Response(JSON.stringify({ error: 'Invalid plan' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // 计算价格
        const price = plan === 'monthly' ? 19 : 99;
        const description = plan === 'monthly' ? 'Pro 会员 - 月付' : 'Pro 会员 - 年付';

        // 获取 PayPal Token
        const token = await getPayPalToken();

        // 创建订单
        const orderResponse = await fetch(`${PAYPAL_API}/v2/checkout/orders`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                intent: 'CAPTURE',
                purchase_units: [{
                    amount: {
                        currency_code: 'USD',
                        value: price.toString(),
                        breakdown: {
                            item_total: {
                                currency_code: 'USD',
                                value: price.toString(),
                            }
                        }
                    },
                    description: description,
                    custom_id: userId || 'guest', // 存储用户ID
                    items: [{
                        name: description,
                        description: `智能去背景工具 - ${description}`,
                        quantity: '1',
                        unit_amount: {
                            currency_code: 'USD',
                            value: price.toString(),
                        }
                    }]
                }],
                application_context: {
                    brand_name: '智能去背景',
                    landing_page: 'BILLING',
                    shipping_preference: 'NO_SHIPPING',
                    user_action: 'PAY_NOW',
                    return_url: 'https://remove-bg-aba.pages.dev/payment-success',
                    cancel_url: 'https://remove-bg-aba.pages.dev/payment-cancel',
                }
            }),
        });

        if (!orderResponse.ok) {
            const errorData = await orderResponse.json();
            console.error('PayPal order creation failed:', errorData);
            return new Response(JSON.stringify({ error: 'Failed to create order' }), {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        const orderData = await orderResponse.json();

        // 保存订单信息到 KV（用于后续验证）
        if (env.USER_DATA_KV && userId) {
            await env.USER_DATA_KV.put(
                `order:${orderData.id}`,
                JSON.stringify({
                    userId,
                    plan,
                    status: 'created',
                    createdAt: new Date().toISOString()
                }),
                { expirationTtl: 3600 } // 1小时过期
            );
        }

        return new Response(JSON.stringify({
            orderId: orderData.id,
            approveUrl: orderData.links.find(link => link.rel === 'approve')?.href,
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Payment error:', error);
        return new Response(JSON.stringify({ error: 'Payment processing failed' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
}

// 验证支付并升级用户
export async function onRequestGet(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    const orderId = url.searchParams.get('orderId');
    const userId = url.searchParams.get('userId');

    if (!orderId) {
        return new Response(JSON.stringify({ error: 'Order ID required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    try {
        // 获取 PayPal Token
        const token = await getPayPalToken();

        // 获取订单详情
        const orderResponse = await fetch(`${PAYPAL_API}/v2/checkout/orders/${orderId}`, {
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        });

        if (!orderResponse.ok) {
            return new Response(JSON.stringify({ error: 'Order not found' }), {
                status: 404,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        const orderData = await orderResponse.json();

        // 如果订单已完成，捕获支付
        if (orderData.status === 'APPROVED') {
            // 捕获支付
            const captureResponse = await fetch(`${PAYPAL_API}/v2/checkout/orders/${orderId}/capture`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            });

            if (captureResponse.ok) {
                const captureData = await captureResponse.json();

                // 升级用户为 Pro
                if (userId && env.USER_DATA_KV) {
                    const userKey = `user:${userId}`;
                    const userDataStr = await env.USER_DATA_KV.get(userKey);

                    if (userDataStr) {
                        const userData = JSON.parse(userDataStr);
                        userData.plan = 'pro';
                        userData.upgradedAt = new Date().toISOString();
                        userData.paymentInfo = {
                            orderId: orderId,
                            amount: captureData.purchase_units[0]?.payments?.captures[0]?.amount?.value,
                            currency: captureData.purchase_units[0]?.payments?.captures[0]?.amount?.currency_code,
                            time: new Date().toISOString()
                        };

                        await env.USER_DATA_KV.put(userKey, JSON.stringify(userData));

                        return new Response(JSON.stringify({
                            success: true,
                            message: 'Payment successful, upgraded to Pro!',
                            plan: 'pro'
                        }), {
                            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                        });
                    }
                }

                return new Response(JSON.stringify({
                    success: true,
                    message: 'Payment successful!',
                    plan: 'pro'
                }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }
        }

        return new Response(JSON.stringify({
            success: false,
            status: orderData.status,
            message: `Order status: ${orderData.status}`
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Verification error:', error);
        return new Response(JSON.stringify({ error: 'Verification failed' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
}
