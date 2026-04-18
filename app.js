// 智能去背景工具 - 前端逻辑

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

let currentResultBlob = null;

// 后端 API 地址
// 本地开发时使用 Cloudflare 线上 API，线上部署时使用同域
const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'https://remove-bg-aba.pages.dev'  // 本地开发：调用线上 API
    : '';  // 线上部署：同域调用

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

// 调用后端 API（不直接暴露 remove.bg API Key）
async function removeBackground(file) {
    const formData = new FormData();
    formData.append('image', file);

    const response = await fetch(`${API_BASE}/api/remove-bg`, {
        method: 'POST',
        body: formData,
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMsg = errorData.error || `请求失败 (${response.status})`;
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
