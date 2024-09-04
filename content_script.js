// content.js
console.log("🚀 加载content_script.js成功")

const _CONST_ = {
    CONFIG_PLUGIN: "CONFIG_PLUGIN",
    FROM_CONTENT_SCRIPT: "FROM_CONTENT_SCRIPT",
    FROM_CONTENT_WEBPAGE: "FROM_CONTENT_WEBPAGE",
}

//发送消息给网页
chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
    console.log('Message received in content script:', message);
    if (message.type === 'UPDATE_CONTENT') {
        console.log('Data from background:', message.data);
        window.postMessage({ type: _CONST_.FROM_CONTENT_SCRIPT, data: message.data })
    }
});

//监听网页消息

window.addEventListener('message', function (event) {
    if (event.source === window && event.data.type && event.data.type == _CONST_.FROM_CONTENT_WEBPAGE) {
        console.log("🚀 ~ WebPage`s Message received in content script:", event)

        // 定义你想要获取的数据键
        const keys = ['globalVar'];

        chrome.storage.local.get(keys, function (result) {
            // 确保获取的数据存在
            if (chrome.runtime.lastError) {
                console.error('Error retrieving data:', chrome.runtime.lastError);
                return;
            }

            // 处理获取的数据
            if (result.globalVar != event.data.data) {
                chrome.storage.local.set({ globalVar: event.data.data });
            }
        });
    }
})

