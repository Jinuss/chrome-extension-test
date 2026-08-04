// background.js
console.log("🚀 加载background.js成功")

// popup <-> background <-> content_script <-> main-world env_injector
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // SYNC_CONFIG: 将用户配置同步到当前页面
    if (message.type === 'SYNC_CONFIG') {
        // 先保存到 chrome.storage
        chrome.storage.local.set({ envConfig: message.payload });
        const shouldReload = message.reload === true;
        // 再转发到 content_script，由它写入 localStorage 并通知 env_injector
        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
            if (!tabs || !tabs[0]) {
                if (sendResponse) sendResponse({ status: 'no-tab' });
                return;
            }
            const tabId = tabs[0].id;
            chrome.tabs.sendMessage(tabId, {
                type: 'SYNC_CONFIG',
                payload: message.payload
            }, function (resp) {
                if (chrome.runtime.lastError) {
                    if (sendResponse) sendResponse({ status: 'error', message: chrome.runtime.lastError.message });
                    return;
                }
                // 需要刷新页面时，重新加载当前 tab（env_injector 在 document_start 重新读取配置）
                if (shouldReload) {
                    chrome.tabs.reload(tabId, {}, function () {
                        if (sendResponse) sendResponse({ status: 'reloaded' });
                    });
                } else {
                    if (sendResponse) sendResponse(resp || { status: 'synced' });
                }
            });
        });
        return true;
    }

    // GET_CONFIG: 获取当前配置
    if (message.type === 'GET_CONFIG') {
        chrome.storage.local.get(['envConfig'], function (result) {
            const config = result.envConfig || { propertyName: '__ENV__', keyTemplate: [] };
            // 同时向页面请求实际的配置状态
            chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
                if (!tabs || !tabs[0]) {
                    if (sendResponse) sendResponse({ config, pageStatus: null });
                    return;
                }
                chrome.tabs.sendMessage(tabs[0].id, {
                    type: 'ENV_BRIDGE_FORWARD',
                    payload: { type: 'GET_CONFIG' }
                }, function () {
                    // 页面会通过 ENV_BRIDGE_RESULT 返回实际状态
                    if (sendResponse) sendResponse({ config });
                });
            });
        });
        return true;
    }

    // 来自 popup 的 env 操作指令，转发到 content script
    if (
        message.type === 'GET_ENV_SNAPSHOT' ||
        message.type === 'SET_ENV_OVERRIDES' ||
        message.type === 'RESET_ENV_OVERRIDES'
    ) {
        const needReload = (message.type === 'SET_ENV_OVERRIDES' || message.type === 'RESET_ENV_OVERRIDES');
        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
            if (!tabs || !tabs[0]) {
                if (sendResponse) sendResponse({ status: 'no-tab' });
                return;
            }
            const tabId = tabs[0].id;
            let payload = null;
            if (message.type === 'GET_ENV_SNAPSHOT') {
                payload = { type: 'GET_SNAPSHOT' };
            } else if (message.type === 'SET_ENV_OVERRIDES') {
                payload = { type: 'SET_OVERRIDES', payload: message.payload };
            } else if (message.type === 'RESET_ENV_OVERRIDES') {
                payload = { type: 'RESET_OVERRIDES' };
            }

            chrome.tabs.sendMessage(tabId, {
                type: 'ENV_BRIDGE_FORWARD',
                payload
            }, function (resp) {
                if (chrome.runtime.lastError) {
                    if (sendResponse) sendResponse({ status: 'error', message: chrome.runtime.lastError.message });
                    return;
                }
                // 保存修改 / 重置后需要刷新页面，让业务代码重新读取新值
                if (needReload) {
                    chrome.tabs.reload(tabId, {}, function () {
                        if (sendResponse) sendResponse({ status: 'reloaded' });
                    });
                } else {
                    if (sendResponse) sendResponse({ status: 'forwarded' });
                }
            });
        });
        return true;
    }

    // 来自 content script 的 main-world 回包，转发到 popup
    if (message.type === 'ENV_BRIDGE') {
        chrome.runtime.sendMessage({
            type: 'ENV_BRIDGE_RESULT',
            payload: message.payload
        });
        return;
    }
});
