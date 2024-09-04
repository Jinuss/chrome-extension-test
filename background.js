

// background.js
console.log("🚀 加载background.js成功")

// background.js
chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.set({ globalVar: '' });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'UPDATE_GLOBAL_VAR') {
        chrome.storage.local.set({ globalVar: message.value });
        sendResponse({ status: 'success' });
        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
            chrome.tabs.sendMessage(tabs[0].id, { type: 'UPDATE_CONTENT', data: message.value });
        });
    }
});