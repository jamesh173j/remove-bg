// 智能去背景工具 - 纯前端版本（含用户体系）

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
const logoutBtn = document.getElementById('logoutBtn');

let currentResultBlob = null;
let currentUser = null;

// ==================== 用户体系配置 ====================
const USAGE_LIMITS = {
    guest: 3,    // 未登录用户每日限制
    free: 5,     // 免费登录用户每日限制
    pro: Infinity // Pro 用户无限制
};

const PRICING = {
    monthly: 19,
    yearly: 99
};

// 获取用户数据（带默认值）
function getUserData() {
    const saved = localStorage.getItem('userData');
    if (saved) {
        return JSON.parse(saved);
    }
    return null;
}

// 保存用户数据
function saveUserData(data) {
    localStorage.setItem('userData', JSON.stringify(data));
}

// 获取今日使用次数
function getTodayUsage() {
    const today = new Date().toDateString();
    const userData = getUserData();

    if (!userData || !userData.usage) {
        return { date: today, count: 0 };
    }

    if (userData.usage.date !== today) {
        return { date: today, count: 0 };
    }

    return userData.usage;
}

// 更新使用次数
function updateUsage() {
    const userData = getUserData() || {};
    const usage = getTodayUsage();
    usage.count++;
    userData.usage = usage;
    userData.totalUsage = (userData.totalUsage || 0) + 1;
    saveUserData(userData);
    return usage.count;
}

// 获取剩余次数
function getRemainingUsage() {
    const user = getUserData();
    const plan = user?.plan || 'guest';
    const limit = USAGE_LIMITS[plan];

    if (limit === Infinity) {
        return Infinity;
    }

    const usage = getTodayUsage();
    return Math.max(0, limit - usage.count);
}

// 检查是否可以使用
function canUse() {
    const remaining = getRemainingUsage();
    return remaining === Infinity || remaining > 0;
}

// 注意：纯前端版本，API Key 会暴露在浏览器中
// remove.bg 免费额度：每月 50 次
const REMOVE_BG_API_KEY = 'X23XZh61nTi1tjoXAx7RcupD';

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
function handleCredentialResponse(response) {
    // 解码 JWT token
    const credential = response.credential;
    const payload = JSON.parse(atob(credential.split('.')[1]));

    // 检查是否已有用户数据
    let userData = getUserData();

    currentUser = {
        id: payload.sub,
        name: payload.name,
        email: payload.email,
        picture: payload.picture,
        plan: userData?.plan || 'free',  // 新用户默认免费版
        usage: userData?.usage || { date: new Date().toDateString(), count: 0 },
        history: userData?.history || [],
        totalUsage: userData?.totalUsage || 0
    };

    // 保存到本地存储
    localStorage.setItem('user', JSON.stringify(currentUser));
    saveUserData(currentUser);

    // 显示用户信息
    showUserInfo();
    updateUsageDisplay();

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

// 退出登录
function logout() {
    currentUser = null;
    localStorage.removeItem('user');

    // 显示登录按钮
    loginSection.style.display = 'block';
    userSection.style.display = 'none';

    // 清除 Google 登录状态
    if (window.google && google.accounts) {
        google.accounts.id.disableAutoSelect();
    }

    console.log('已退出登录');
}

// ==================== 页面切换功能 ====================
const profileSection = document.getElementById('profileSection');
const upgradeSection = document.getElementById('upgradeSection');

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
function showProfile() {
    hideAllMainSections();
    profileSection.style.display = 'block';
    toggleUserMenu(false);
    updateProfileInfo();
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
function updateProfileInfo() {
    const userData = getUserData();
    if (!userData) return;

    // 头像和基本信息
    document.getElementById('profileAvatar').src = userData.picture || '';
    document.getElementById('profileName').textContent = userData.name || '用户';
    document.getElementById('profileEmail').textContent = userData.email || '';

    // 会员状态
    const planBadge = document.getElementById('planBadge');
    const plan = userData.plan || 'guest';
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
    const usage = getTodayUsage();
    const limit = USAGE_LIMITS[plan];
    const total = userData.totalUsage || 0;

    document.getElementById('todayUsage').textContent = usage.count;
    document.getElementById('totalUsage').textContent = total;
    document.getElementById('remainingUsage').textContent = limit === Infinity ? '∞' : Math.max(0, limit - usage.count);

    // 历史记录
    const historyList = document.getElementById('historyList');
    const history = getHistory();

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
function upgradeToPro(plan) {
    const userData = getUserData() || {};

    // 模拟支付成功
    alert(`恭喜！已成功升级 ${plan === 'monthly' ? '月付' : '年付'} Pro 会员！`);

    // 更新用户状态
    userData.plan = 'pro';
    saveUserData(userData);

    // 刷新页面
    showProfile();
}

// 退出登录
function logout() {
    currentUser = null;
    localStorage.removeItem('userData');
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

    console.log('已退出登录');
}

// 页面加载完成后初始化
window.addEventListener('load', () => {
    initGoogleAuth();
    updateUsageDisplay();
});

// 绑定按钮事件
document.getElementById('upgradeBtn')?.addEventListener('click', showUpgrade);
document.getElementById('profileUpgradeBtn')?.addEventListener('click', showUpgrade);
document.getElementById('backToHome')?.addEventListener('click', showHome);
document.getElementById('backFromUpgrade')?.addEventListener('click', showProfile);

// 切换显示区域（兼容旧代码）
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

    // 检查使用次数
    if (!canUse()) {
        const user = getUserData();
        const plan = user?.plan || 'guest';
        if (plan === 'guest') {
            showError('今日免费次数已用完，请登录以获得更多次数');
        } else if (plan === 'free') {
            showError('今日免费次数已用完，升级 Pro 可无限使用');
        }
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

        // 更新使用次数并记录历史
        updateUsage();
        addToHistory(file.name);
        updateUsageDisplay();

        showSection(resultSection);
    } catch (error) {
        console.error('处理失败:', error);
        showError(error.message || '图片处理失败，请重试');
    }
}

// 添加到历史记录
function addToHistory(filename) {
    const userData = getUserData() || {};
    if (!userData.history) {
        userData.history = [];
    }

    const record = {
        id: Date.now().toString(),
        filename: filename,
        time: new Date().toISOString(),
        resultBlob: null // 不存储图片数据，只存元数据
    };

    userData.history.unshift(record);
    // 只保留最近 20 条
    userData.history = userData.history.slice(0, 20);
    saveUserData(userData);
}

// 获取历史记录
function getHistory() {
    const userData = getUserData();
    return userData?.history || [];
}

// 更新使用次数显示
function updateUsageDisplay() {
    const userData = getUserData();
    const plan = userData?.plan || 'guest';
    const remaining = getRemainingUsage();

    const usageEl = document.getElementById('usageDisplay');
    const upgradeBtn = document.getElementById('upgradeBtn');

    if (usageEl) {
        if (remaining === Infinity) {
            usageEl.textContent = 'Pro 会员 - 无限使用';
        } else {
            usageEl.textContent = `今日剩余 ${remaining} 次`;
        }
    }

    // 显示升级按钮（免费用户和游客显示）
    if (upgradeBtn) {
        if (plan === 'pro') {
            upgradeBtn.style.display = 'none';
        } else {
            upgradeBtn.style.display = 'inline-block';
        }
    }
}

// 直接调用 remove.bg API（纯前端，API Key 会暴露）
async function removeBackground(file) {
    const formData = new FormData();
    formData.append('image_file', file);
    formData.append('size', 'auto');

    const response = await fetch('https://api.remove.bg/v1.0/removebg', {
        method: 'POST',
        headers: {
            'X-Api-Key': REMOVE_BG_API_KEY,
        },
        body: formData,
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMsg = errorData.errors?.[0]?.title || `请求失败 (${response.status})`;
        throw new Error(errorMsg);
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
    showSection(uploadSection);
}
