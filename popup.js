//popup.js
console.log("🚀 加载popup.js成功");
const doms = {
    input: document.querySelector("#baseURL"),
    btn: document.querySelector("#btn")
}

/** 监听输入框 */
doms.input.addEventListener('input', () => {
    const val = doms.input.value
    if (val) {
        doms.btn.classList.add('active')
    } else {
        doms.btn.classList.remove('active')
    }
})
/** 监听保存按钮事件 */
doms.btn.addEventListener('click', () => {
    const val = doms.input.value
    if (val) {
        if (isValidURL(val)) {
            chrome.runtime.sendMessage({ action: 'UPDATE_GLOBAL_VAR', value: val }, (response) => {
                if (response.status === 'success') {
                    window.close()
                    console.log("🚀设置BASE_URL成功");
                } else {
                    alert("🚀设置BASE_URL失败");
                }
            });
        } else {
            doms.input.value = ""
            alert("接口地址不合法")
        }
    }
})

function isValidURL(string) {
    try {
        new URL(string);
        return true;
    } catch (_) {
        return false;
    }
}

/**读取内容**/
document.addEventListener('DOMContentLoaded', function () {
    // 定义你想要获取的数据键
    const keys = ['globalVar'];

    // 从 chrome.storage.local 获取数据
    chrome.storage.local.get(keys, function (result) {
        // 确保获取的数据存在
        if (chrome.runtime.lastError) {
            console.error('Error retrieving data:', chrome.runtime.lastError);
            document.getElementById('content').textContent = 'Error retrieving data.';
            return;
        }

        // 处理获取的数据
        const data = result.globalVar || 'No data found';

        // 更新 Popup 页面中的内容
        doms.input.value = data;
    });
});
