// 智能去背景工具 - 纯前端版本

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

// Google OAuth 相关元素
const loginSection = document.getElementById('loginSection');
const userSection = document.getElementById('userSection');
const userAvatar = document.getElementById('userAvatar');
const userName = document.getElementById('userName');
const logoutBtn = document.getElementById('logoutBtn');

let currentResultBlob = null;
let currentUser = null;

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

    currentUser = {
        id: payload.sub,
        name: payload.name,
        email: payload.email,
        picture: payload.picture
    };

    // 保存到本地存储
    localStorage.setItem('user', JSON.stringify(currentUser));

    // 显示用户信息
    showUserInfo();

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

// 绑定退出按钮事件
logoutBtn.addEventListener('click', logout);

// 页面加载完成后初始化 Google 登录
window.addEventListener('load', initGoogleAuth);

// 切换显示区域
function showSection(section) {
    uploadSection.style.display = 'none';
    processingSection.style.display = 'none';
    resultSection.style.display = 'none';
    errorSection.style.display = 'none';
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
        showSection(resultSection);
    } catch (error) {
        console.error('处理失败:', error);
        showError(error.message || '图片处理失败，请重试');
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
