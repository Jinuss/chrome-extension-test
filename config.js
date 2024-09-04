
const _CONST_ = {
    CONFIG_PLUGIN: "CONFIG_PLUGIN",
    FROM_CONTENT_SCRIPT: "FROM_CONTENT_SCRIPT",
    FROM_CONTENT_WEBPAGE: "FROM_CONTENT_WEBPAGE",
}

window.addEventListener('message', function (event) {
    if (event.source === window && event.data.type && event.data.type == _CONST_.FROM_CONTENT_SCRIPT) {
        window.localStorage.setItem(_CONST_.CONFIG_PLUGIN, JSON.stringify({ BASE_URL: event.data.data }))
        window.location.reload();
    }
})

let CONFIG_PLUGIN_STORAGE = window.localStorage.getItem(_CONST_.CONFIG_PLUGIN)

CONFIG_PLUGIN_STORAGE = CONFIG_PLUGIN_STORAGE ? JSON.parse(CONFIG_PLUGIN_STORAGE) : {}


window.config = {
    BASE_URL: "http://192.168.145.74:18430",
    ...CONFIG_PLUGIN_STORAGE,
}

window.postMessage({ type: _CONST_.FROM_CONTENT_WEBPAGE, data: window.config.BASE_URL })


/**测试*/
window.onload = () => {
    document.querySelector("p").innerHTML = window.config.BASE_URL
}