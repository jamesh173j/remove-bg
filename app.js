// 智能去背景工具 - 前后端分离版本

// ==================== DOM 元素 ====================
const uploadSection = document.getElementById('uploadSection');
const processingSection = document.getElementById('processingSection');
const resultSection = document.getElementById('resultSection');
const errorSection = document.getElementById('errorSection');
const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const originalImage = document.getElementById('originalImage');
const resultImage = document.getElementById('resultImage');
const downloadBtn = document.getElementById('downloadBtn');
const retryBtn = document.getElementById('retryBtn');
const errorRetryBtn = document.getElementById('errorRetryBtn');
const errorText = document.getElementById('errorText');

// 用户相关元素
const loginSection = document.getElementById('loginSection');
const userSection = document.getElementById('userSection');
const userAvatar = document.getElementById('userAvatar');
const userName = document.getElementById('userName');

// 页面区域
const profileSection = document.getElementById('profileSection');
const upgradeSection = document.getElementById('upgradeSection');

let currentResultBlob = null;
let currentUser = null;
let userInfo = null;

// Google OAuth 客户端 ID
const GOOGLE_CLIENT_ID = '396847169891-2kijs0nn49ru4er4j08spc6rnr8i4c43.apps.googleusercontent.com';

// ==================== Google OAuth 功能 ====================

// 初始化 Google 登录
function initGoogleAuth() {
    // 检查本地存储的登录状态
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        showUserInfo();
        fetchUserInfo(); // 从后端获取最新用户信息
    } else {
        updateUsageDisplay();
    }

    // 初始化 Google 登录按钮
    if (window.google && google.accounts) {
        google.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID,
            callback: handleCredentialResponse,
            auto_select: false,
            cancel_on_tap_outside: true
        });

        // 渲染登录按钮
        google.accounts.id.renderButton(
            document.getElementById('g_id_signin'),
            {
                theme: 'outline',
                size: 'medium',
                text: 'signin_with',
                shape: 'rectangular',
                width: 200
            }
        );
    }
}

// 处理登录回调
async function handleCredentialResponse(response) {
    // 解码 JWT token
    const credential = response.credential;
    const payload = JSON.parse(atob(credential.split('.')[1]));

    currentUser = {
        id: payload.sub,
        name: payload.name,
        email: payload.email,
        picture: payload.picture,
        token: credential // 保存 token 用于后端验证
    };

    // 保存到本地存储
    localStorage.setItem('user', JSON.stringify(currentUser));

    // 显示用户信息
    showUserInfo();

    // 从后端获取用户信息
    await fetchUserInfo();

    console.log('登录成功:', currentUser.name);
}

// 显示用户信息
function showUserInfo() {
    if (!currentUser) return;

    loginSection.style.display = 'none';
    userSection.style.display = 'flex';

    userAvatar.src = currentUser.picture;
    userName.textContent = currentUser.name;
}

// 从后端获取用户信息
async function fetchUserInfo() {
    try {
        const headers = {};
        if (currentUser && currentUser.token) {
            headers['Authorization'] = `Bearer ${currentUser.token}`;
        }

        const response = await fetch('/api/remove-bg', {
            method: 'GET',
            headers
        });

        if (response.ok) {
            userInfo = await response.json();
            updateUsageDisplay();
        }
    } catch (error) {
        console.error('获取用户信息失败:', error);
    }
}

// 更新使用次数显示
function updateUsageDisplay() {
    const usageEl = document.getElementById('usageDisplay');
    const upgradeBtn = document.getElementById('upgradeBtn');

    if (!userInfo) {
        if (usageEl) usageEl.textContent = '今日剩余 3 次';
        if (upgradeBtn) upgradeBtn.style.display = 'inline-block';
        return;
    }

    const remaining = userInfo.remaining;
    const plan = userInfo.plan;

    if (usageEl) {
        if (remaining === Infinity) {
            usageEl.textContent = 'Pro 会员 - 无限使用';
        } else {
            usageEl.textContent = `今日剩余 ${remaining} 次`;
        }
    }

    if (upgradeBtn) {
        upgradeBtn.style.display = plan === 'pro' ? 'none' : 'inline-block';
    }
}

// 退出登录
function logout() {
    currentUser = null;
    userInfo = null;
    localStorage.removeItem('user');

    // 显示登录按钮
    loginSection.style.display = 'block';
    userSection.style.display = 'none';
    toggleUserMenu(false);

    // 清除 Google 登录状态
    if (window.google && google.accounts) {
        google.accounts.id.disableAutoSelect();
    }

    // 返回首页
    showHome();
    updateUsageDisplay();

    console.log('已退出登录');
}

// ==================== 页面切换功能 ====================

// 隐藏所有主内容区域
function hideAllMainSections() {
    uploadSection.style.display = 'none';
    processingSection.style.display = 'none';
    resultSection.style.display = 'none';
    errorSection.style.display = 'none';
    profileSection.style.display = 'none';
    upgradeSection.style.display = 'none';
}

// 显示首页
function showHome() {
    hideAllMainSections();
    uploadSection.style.display = 'block';
    updateUsageDisplay();
}

// 显示个人中心
async function showProfile() {
    hideAllMainSections();
    profileSection.style.display = 'block';
    toggleUserMenu(false);
    await updateProfileInfo();
}

// 显示升级页面
function showUpgrade() {
    hideAllMainSections();
    upgradeSection.style.display = 'block';
    toggleUserMenu(false);
}

// 切换用户下拉菜单
function toggleUserMenu(show) {
    const dropdown = document.getElementById('userDropdown');
    if (typeof show === 'boolean') {
        dropdown.style.display = show ? 'block' : 'none';
    } else {
        dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
    }
}

// 点击外部关闭下拉菜单
document.addEventListener('click', (e) => {
    const userSection = document.getElementById('userSection');
    if (userSection && !userSection.contains(e.target)) {
        toggleUserMenu(false);
    }
});

// 更新个人中心信息
async function updateProfileInfo() {
    // 获取最新用户信息
    await fetchUserInfo();

    if (!userInfo && !currentUser) {
        // 游客状态
        document.getElementById('profileAvatar').src = '';
        document.getElementById('profileName').textContent = '游客';
        document.getElementById('profileEmail').textContent = '请登录以查看更多功能';
        document.getElementById('planBadge').textContent = '游客';
        document.getElementById('planBadge').className = 'plan-badge free';
        document.getElementById('profileUpgradeBtn').style.display = 'inline-block';
        document.getElementById('todayUsage').textContent = userInfo?.usage || 0;
        document.getElementById('totalUsage').textContent = userInfo?.totalUsage || 0;
        document.getElementById('remainingUsage').textContent = userInfo?.remaining ?? 3;
        document.getElementById('historyList').innerHTML = '<p class="empty-history">请登录以查看历史记录</p>';
        return;
    }

    // 头像和基本信息
    document.getElementById('profileAvatar').src = currentUser?.picture || '';
    document.getElementById('profileName').textContent = currentUser?.name || '用户';
    document.getElementById('profileEmail').textContent = currentUser?.email || '';

    // 会员状态
    const planBadge = document.getElementById('planBadge');
    const plan = userInfo?.plan || 'guest';
    if (plan === 'pro') {
        planBadge.textContent = 'Pro 会员';
        planBadge.className = 'plan-badge pro';
        document.getElementById('profileUpgradeBtn').style.display = 'none';
    } else if (plan === 'free') {
        planBadge.textContent = '免费版';
        planBadge.className = 'plan-badge free';
        document.getElementById('profileUpgradeBtn').style.display = 'inline-block';
    } else {
        planBadge.textContent = '游客';
        planBadge.className = 'plan-badge free';
        document.getElementById('profileUpgradeBtn').style.display = 'inline-block';
    }

    // 使用统计
    document.getElementById('todayUsage').textContent = userInfo?.usage || 0;
    document.getElementById('totalUsage').textContent = userInfo?.totalUsage || 0;
    document.getElementById('remainingUsage').textContent = userInfo?.remaining === Infinity ? '∞' : (userInfo?.remaining ?? 3);

    // 历史记录
    const historyList = document.getElementById('historyList');
    const history = userInfo?.history || [];

    if (history.length === 0) {
        historyList.innerHTML = '<p class="empty-history">暂无处理记录</p>';
    } else {
        historyList.innerHTML = history.map(item => `
            <div class="history-item">
                <span>${item.filename}</span>
                <span>${new Date(item.time).toLocaleString()}</span>
            </div>
        `).join('');
    }
}

// 升级 Pro
async function upgradeToPro(plan) {
    // 模拟支付成功，调用后端更新用户等级
    try {
        const headers = {};
        if (currentUser && currentUser.token) {
            headers['Authorization'] = `Bearer ${currentUser.token}`;
        }

        // 调用后端升级接口（这里简化处理，实际应该有支付验证）
        alert(`恭喜！已成功升级 ${plan === 'monthly' ? '月付' : '年付'} Pro 会员！`);

        // 刷新用户信息
        await fetchUserInfo();
        await showProfile();
    } catch (error) {
        console.error('升级失败:', error);
        alert('升级失败，请稍后重试');
    }
}

// ==================== 去背景功能 ====================

// 切换显示区域
function showSection(section) {
    hideAllMainSections();
    section.style.display = 'block';
}

// 点击上传区域
document.querySelector('.click-text').addEventListener('click', (e) => {
    e.stopPropagation();
    fileInput.click();
});

uploadArea.addEventListener('click', () => {
    fileInput.click();
});

// 拖拽事件
uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('dragover');
});

uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('dragover');
});

uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        handleFile(files[0]);
    }
});

// 文件选择
fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        handleFile(e.target.files[0]);
    }
});

// 验证文件
function validateFile(file) {
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    if (!validTypes.includes(file.type)) {
        return { valid: false, error: '请上传 JPG 或 PNG 格式的图片' };
    }
    if (file.size > 10 * 1024 * 1024) {
        return { valid: false, error: '文件大小不能超过 10MB' };
    }
    return { valid: true };
}

// 处理文件
async function handleFile(file) {
    const validation = validateFile(file);
    if (!validation.valid) {
        showError(validation.error);
        return;
    }

    // 显示原图预览
    const reader = new FileReader();
    reader.onload = (e) => {
        originalImage.src = e.target.result;
    };
    reader.readAsDataURL(file);

    showSection(processingSection);

    try {
        const resultBlob = await removeBackground(file);
        currentResultBlob = resultBlob;
        const resultUrl = URL.createObjectURL(resultBlob);
        resultImage.src = resultUrl;

        // 更新用户信息和显示
        await fetchUserInfo();
        updateUsageDisplay();

        showSection(resultSection);
    } catch (error) {
        console.error('处理失败:', error);
        showError(error.message || '图片处理失败，请重试');
    }
}

// 调用后端 API 去背景
async function removeBackground(file) {
    const formData = new FormData();
    formData.append('image', file);

    const headers = {};
    if (currentUser && currentUser.token) {
        headers['Authorization'] = `Bearer ${currentUser.token}`;
    }

    const response = await fetch('/api/remove-bg', {
        method: 'POST',
        headers,
        body: formData,
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));

        // 如果是次数限制错误
        if (response.status === 429) {
            const remaining = errorData.remaining;
            const plan = errorData.plan;
            if (plan === 'guest') {
                throw new Error('今日免费次数已用完，请登录以获得更多次数');
            } else {
                throw new Error('今日免费次数已用完，升级 Pro 可无限使用');
            }
        }

        const errorMsg = errorData.error || `请求失败 (${response.status})`;
        throw new Error(errorMsg);
    }

    // 获取用户信息（从响应头）
    const userInfoHeader = response.headers.get('X-User-Info');
    if (userInfoHeader) {
        userInfo = JSON.parse(userInfoHeader);
    }

    return await response.blob();
}

// 显示错误
function showError(message) {
    errorText.textContent = message;
    showSection(errorSection);
}

// 下载按钮
downloadBtn.addEventListener('click', () => {
    if (!currentResultBlob) return;

    const url = URL.createObjectURL(currentResultBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `removed-bg-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
});

// 重试按钮
retryBtn.addEventListener('click', reset);
errorRetryBtn.addEventListener('click', reset);

function reset() {
    fileInput.value = '';
    currentResultBlob = null;
    originalImage.src = '';
    resultImage.src = '';
    showHome();
}

// 页面加载完成后初始化
window.addEventListener('load', initGoogleAuth);

// 绑定按钮事件
document.getElementById('upgradeBtn')?.addEventListener('click', showUpgrade);
document.getElementById('profileUpgradeBtn')?.addEventListener('click', showUpgrade);
document.getElementById('backToHome')?.addEventListener('click', showHome);
document.getElementById('backFromUpgrade')?.addEventListener('click', showProfile);
