// content_script.js (ISOLATED world)
// 负责桥接：background ↔ main-world (env_injector.js)
console.log("🚀 content_script.js loaded (ISOLATED world)");

const ENV_CHANNEL = 'ENV_CHANNEL';
const CONFIG_STORAGE_KEY = 'ENV_CONFIG';

// 将 chrome.storage 中的配置同步到 localStorage（供 MAIN world 的 env_injector 读取）
function syncConfigToLocalStorage() {
  try {
    chrome.storage.local.get(['envConfig'], function (result) {
      if (chrome.runtime.lastError) return;
      const config = result.envConfig || { propertyName: '__ENV__', keyTemplate: [] };
      try {
        window.localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
      } catch (e) {}
    });
  } catch (e) {}
}

// 同步配置到 localStorage（env_injector 在 MAIN world 中从 localStorage 读取）
syncConfigToLocalStorage();

// 桥接：向 MAIN world 发送消息
function dispatchEnvMessage(payload) {
  try {
    window.postMessage({
      channel: ENV_CHANNEL,
      ...payload
    }, '*');
  } catch (e) {
    console.warn('[content_script] dispatchEnvMessage error:', e);
  }
}

// 接收 MAIN world 的回包，转发给 background
// 注意：不能用 event.source !== window 过滤，因为 MAIN world 和 ISOLATED world 的 window 对象不同
window.addEventListener('message', function (event) {
  const data = event.data;
  if (!data || data.channel !== ENV_CHANNEL) return;

  chrome.runtime.sendMessage({
    type: 'ENV_BRIDGE',
    payload: data
  });
});

// 接收 background 的指令，转发到 MAIN world
chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  // 环境变量操作：直接转发
  if (message.type === 'ENV_BRIDGE_FORWARD') {
    if (message.payload && message.payload.type) {
      dispatchEnvMessage(message.payload);
      if (sendResponse) sendResponse({ status: 'forwarded' });
    }
    return true;
  }

  // 配置更新：先同步到 localStorage，再通知 env_injector
  if (message.type === 'SYNC_CONFIG') {
    const config = message.payload || {};
    try {
      window.localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
    } catch (e) {}
    if (config.propertyName || config.keyTemplate) {
      dispatchEnvMessage({ type: 'UPDATE_CONFIG', payload: config });
    }
    if (sendResponse) sendResponse({ status: 'synced' });
    return true;
  }
});
