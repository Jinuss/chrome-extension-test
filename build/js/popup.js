// popup.js
console.log("🚀 加载popup.js成功");

// DOM 引用
const cfgDoms = {
    header: document.querySelector("#config-header"),
    body: document.querySelector("#config-body"),
    propertyName: document.querySelector("#cfg-property-name"),
    keyTemplate: document.querySelector("#cfg-key-template"),
    apply: document.querySelector("#cfg-apply"),
    summary: document.querySelector("#config-summary"),
};

const envDoms = {
    titleText: document.querySelector("#env-title-text"),
    list: document.querySelector("#env-list"),
    status: document.querySelector("#env-status"),
    refresh: document.querySelector("#env-refresh"),
    save: document.querySelector("#env-save"),
    reset: document.querySelector("#env-reset"),
};

// 当前配置
let currentConfig = { propertyName: '__ENV__', keyTemplate: [] };

// ============ 配置区交互 ============

function setEnvStatus(text, type) {
    envDoms.status.textContent = text || "";
    envDoms.status.className = "env-status" + (type ? " " + type : "");
}

function toggleConfig() {
    cfgDoms.body.classList.toggle('hidden');
    cfgDoms.header.classList.toggle('collapsed');
}

function updateConfigSummary() {
    const keysCount = currentConfig.keyTemplate ? currentConfig.keyTemplate.length : 0;
    cfgDoms.summary.textContent = `${currentConfig.propertyName} · ${keysCount} 个模板 key`;
    envDoms.titleText.textContent = `window.${currentConfig.propertyName}`;
}

function parseKeyTemplate(text) {
    if (!text) return [];
    return text
        .split(/[\n,]+/)
        .map(function (k) { return k.trim(); })
        .filter(function (k) { return k.length > 0; });
}

// 折叠/展开配置区
cfgDoms.header.addEventListener('click', toggleConfig);

// 应用配置
cfgDoms.apply.addEventListener('click', function () {
    const propertyName = (cfgDoms.propertyName.value || '__ENV__').trim();
    const keyTemplate = parseKeyTemplate(cfgDoms.keyTemplate.value);

    if (!propertyName) {
        alert('属性名不能为空');
        return;
    }

    currentConfig = { propertyName: propertyName, keyTemplate: keyTemplate };
    updateConfigSummary();

    setEnvStatus("正在应用配置并刷新页面…", "loading");
    // 同步到 background -> content_script -> localStorage -> env_injector，并刷新页面
    chrome.runtime.sendMessage({
        type: 'SYNC_CONFIG',
        payload: currentConfig,
        reload: true
    }, function (resp) {
        if (chrome.runtime.lastError) {
            setEnvStatus("配置同步失败: " + chrome.runtime.lastError.message, "error");
            return;
        }
        if (resp && resp.status === 'reloaded') {
            setEnvStatus("配置已应用，页面已刷新", "success");
            // 页面刷新后，注入脚本会在 document_start 重新读取配置；稍后获取最新快照
            setTimeout(refreshEnv, 800);
        } else if (resp && resp.status === 'no-tab') {
            setEnvStatus("未找到活动标签页", "error");
        } else {
            setEnvStatus("配置已同步", "success");
            refreshEnv();
        }
    });
});

// ============ 环境变量区交互 ============

function renderEnvList(snapshot) {
    if (!snapshot || typeof snapshot !== 'object') {
        envDoms.list.innerHTML = '<div class="env-empty">无法加载数据</div>';
        return;
    }
    const keys = Object.keys(snapshot);
    if (keys.length === 0) {
        envDoms.list.innerHTML = '<div class="env-empty">暂无数据，请在配置区添加 Key 模板</div>';
        return;
    }

    envDoms.list.innerHTML = '';
    for (const key of keys) {
        const value = snapshot[key];
        const displayValue = (value === undefined || value === null)
            ? 'undefined'
            : (typeof value === 'object' ? JSON.stringify(value) : String(value));

        const row = document.createElement('div');
        row.className = 'env-row';

        const keyCell = document.createElement('div');
        keyCell.className = 'env-key';
        keyCell.textContent = key;
        keyCell.title = '键名不可修改';

        const valueWrap = document.createElement('div');
        valueWrap.className = 'env-value-wrap';

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'env-value';
        input.value = displayValue;
        input.dataset.key = key;

        // undefined 值用灰色显示
        if (value === undefined) {
            input.style.color = '#aaa';
            input.style.fontStyle = 'italic';
        }

        valueWrap.appendChild(input);
        row.appendChild(keyCell);
        row.appendChild(valueWrap);
        envDoms.list.appendChild(row);
    }
}

function collectEnvOverrides() {
    const overrides = {};
    const inputs = envDoms.list.querySelectorAll('input.env-value');
    inputs.forEach(function (input) {
        const key = input.dataset.key;
        if (key) {
            let val = input.value;
            // 如果原值是 undefined，且用户未修改（灰色显示），则不添加覆盖
            if (input.style.color === 'rgb(170, 170, 170)' && input.style.fontStyle === 'italic') {
                // 用户可能未修改 undefined 值，仍然记录
            }
            overrides[key] = val;
        }
    });
    return overrides;
}

function refreshEnv() {
    setEnvStatus("正在获取页面环境变量…", "loading");
    chrome.runtime.sendMessage({ type: 'GET_ENV_SNAPSHOT' }, function (resp) {
        if (chrome.runtime.lastError) {
            setEnvStatus("获取失败: " + chrome.runtime.lastError.message, "error");
            return;
        }
        if (!resp || resp.status !== 'forwarded') {
            setEnvStatus("无法连接到页面注入脚本，请刷新页面后重试", "error");
        }
    });
}

// 监听来自 background 的回包
chrome.runtime.onMessage.addListener(function (message) {
    if (!message || message.type !== 'ENV_BRIDGE_RESULT' || !message.payload) return;

    const payload = message.payload;
    if (payload.type === 'SNAPSHOT') {
        renderEnvList(payload.payload || {});
        if (payload.propertyName) {
            envDoms.titleText.textContent = `window.${payload.propertyName}`;
        }
        if (payload.hasOriginal) {
            setEnvStatus("已获取最新数据（页面已定义该属性）", "success");
        } else {
            setEnvStatus("已获取数据（使用 Key 模板显示，页面未定义该属性）", "success");
        }
    } else if (payload.type === 'OVERRIDES_APPLIED') {
        renderEnvList(payload.payload || {});
        setEnvStatus("修改已应用到页面", "success");
    } else if (payload.type === 'OVERRIDES_RESET') {
        renderEnvList(payload.payload || {});
        setEnvStatus("已重置为初始值", "success");
    } else if (payload.type === 'CONFIG_UPDATED') {
        renderEnvList(payload.payload || {});
        if (payload.propertyName) {
            envDoms.titleText.textContent = `window.${payload.propertyName}`;
        }
        setEnvStatus("配置已更新", "success");
    }
});

envDoms.refresh.addEventListener('click', function () {
    refreshEnv();
});

envDoms.save.addEventListener('click', function () {
    const overrides = collectEnvOverrides();
    setEnvStatus("正在保存并刷新页面…", "loading");
    chrome.runtime.sendMessage({ type: 'SET_ENV_OVERRIDES', payload: overrides }, function (resp) {
        if (chrome.runtime.lastError) {
            setEnvStatus("保存失败: " + chrome.runtime.lastError.message, "error");
            return;
        }
        if (resp && resp.status === 'reloaded') {
            setEnvStatus("保存成功，页面已刷新", "success");
            setTimeout(refreshEnv, 800);
        } else if (resp && resp.status === 'no-tab') {
            setEnvStatus("未找到活动标签页", "error");
        } else {
            setEnvStatus("保存成功", "success");
            refreshEnv();
        }
    });
});

envDoms.reset.addEventListener('click', function () {
    if (!confirm("确定要重置所有覆盖值吗？\n如果 env.js 已定义初始值，将恢复为初始值；\n如果 env.js 为空，将重置为 undefined。")) {
        return;
    }
    setEnvStatus("正在重置并刷新页面…", "loading");
    chrome.runtime.sendMessage({ type: 'RESET_ENV_OVERRIDES' }, function (resp) {
        if (chrome.runtime.lastError) {
            setEnvStatus("重置失败: " + chrome.runtime.lastError.message, "error");
            return;
        }
        if (resp && resp.status === 'reloaded') {
            setEnvStatus("重置成功，页面已刷新", "success");
            setTimeout(refreshEnv, 800);
        } else if (resp && resp.status === 'no-tab') {
            setEnvStatus("未找到活动标签页", "error");
        } else {
            setEnvStatus("重置成功", "success");
            refreshEnv();
        }
    });
});

// ============ 初始化 ============

document.addEventListener('DOMContentLoaded', function () {
    // 1. 从 chrome.storage 读取已保存的配置
    chrome.storage.local.get(['envConfig'], function (result) {
        const saved = result.envConfig || {};
        currentConfig = {
            propertyName: saved.propertyName || '__ENV__',
            keyTemplate: Array.isArray(saved.keyTemplate) ? saved.keyTemplate : []
        };

        // 填充配置表单
        cfgDoms.propertyName.value = currentConfig.propertyName;
        cfgDoms.keyTemplate.value = currentConfig.keyTemplate.join('\n');
        updateConfigSummary();

        // 2. 同步配置到页面
        chrome.runtime.sendMessage({
            type: 'SYNC_CONFIG',
            payload: currentConfig
        }, function () {
            // 3. 获取环境变量快照
            refreshEnv();
        });
    });
});
