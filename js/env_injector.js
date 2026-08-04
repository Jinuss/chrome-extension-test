(function () {
  if (window.__ENV_INJECTED__) {
    return;
  }
  window.__ENV_INJECTED__ = true;

  console.log('[env_injector] Running in MAIN world');

  const CONFIG_KEY = 'ENV_CONFIG';
  const STORAGE_KEY = 'ENV_OVERRIDES';
  const ORIGINAL_KEY = 'ENV_ORIGINAL';
  const CHANNEL = 'ENV_CHANNEL';

  // 从 localStorage 读取配置
  let config = { propertyName: '__ENV__', keyTemplate: [] };
  try {
    const raw = window.localStorage.getItem(CONFIG_KEY);
    if (raw) config = { ...config, ...JSON.parse(raw) };
  } catch (e) {}

  let propertyName = config.propertyName || '__ENV__';
  let keyTemplate = config.keyTemplate || [];

  // 读取覆盖值
  let overrides = {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) overrides = JSON.parse(raw);
    if (typeof overrides !== 'object' || overrides === null) overrides = {};
  } catch (e) { overrides = {}; }

  // 读取原始值（用于重置）
  let originalValues = null;
  try {
    const raw = window.localStorage.getItem(ORIGINAL_KEY);
    if (raw) originalValues = JSON.parse(raw);
  } catch (e) { originalValues = null; }

  // 当前生效的 env 对象
  let currentEnv = {};

  // 根据 originalValues / keyTemplate / overrides 重建 currentEnv
  // 核心：即使 env.js 为空，也用 keyTemplate 填充 key（值为 undefined）
  function rebuildCurrentEnv() {
    const result = {};
    const templateKeys = Array.isArray(keyTemplate) ? keyTemplate : [];

    // 1. 先用原始值填充（env.js 定义过的）
    if (originalValues && typeof originalValues === 'object') {
      for (const key of Object.keys(originalValues)) {
        result[key] = originalValues[key];
      }
    }

    // 2. 再用 keyTemplate 补充（env.js 没定义的 key，值为 undefined）
    for (const key of templateKeys) {
      if (!(key in result)) {
        result[key] = undefined;
      }
    }

    // 3. 最后应用覆盖值
    for (const key of Object.keys(overrides)) {
      result[key] = overrides[key];
    }

    currentEnv = result;
    console.log('[env_injector] rebuildCurrentEnv:', currentEnv);
  }

  function getAllKeys() {
    const envKeys = Object.keys(currentEnv || {});
    const templateKeys = Array.isArray(keyTemplate) ? keyTemplate : [];
    const set = new Set([...envKeys, ...templateKeys]);
    return Array.from(set);
  }

  function buildSnapshot() {
    const keys = getAllKeys();
    const snapshot = {};
    for (const key of keys) {
      if (Object.prototype.hasOwnProperty.call(currentEnv, key)) {
        snapshot[key] = currentEnv[key];
      } else {
        snapshot[key] = undefined;
      }
    }
    return snapshot;
  }

  function setupPropertyProxy() {
    try {
      if (propertyName in window) {
        try {
          delete window[propertyName];
        } catch (e) {}
      }

      Object.defineProperty(window, propertyName, {
        configurable: true,
        enumerable: true,
        get() {
          return currentEnv;
        },
        set(newValue) {
          console.log('[env_injector] set ' + propertyName, newValue);
          // 首次赋值时捕获原始值
          if (!originalValues && newValue && typeof newValue === 'object') {
            originalValues = {};
            for (const k of Object.keys(newValue)) {
              originalValues[k] = newValue[k];
            }
            try {
              window.localStorage.setItem(ORIGINAL_KEY, JSON.stringify(originalValues));
              console.log('[env_injector] Captured original values:', originalValues);
            } catch (e) {}
          }
          // 用原始值 + 模板 + 覆盖值重建
          rebuildCurrentEnv();
          // 如果 env.js 传入了新值，合并进去（覆盖模板的 undefined）
          if (newValue && typeof newValue === 'object') {
            for (const key of Object.keys(newValue)) {
              if (!(key in overrides)) {
                currentEnv[key] = newValue[key];
              }
            }
          }
          return true;
        }
      });

      console.log('[env_injector] Proxy set up for window.' + propertyName);
    } catch (e) {
      console.error('[env_injector] defineProperty failed:', e);
    }
  }

  setupPropertyProxy();

  // 初始化 currentEnv：用 keyTemplate + overrides 填充
  // 这样即使 env.js 为空，window.__ENV__ 也会有这些 key（值为 undefined）
  rebuildCurrentEnv();

  // 如果属性之前已被设置过（例如页面在我们的代理设置前就已经赋值了）
  if (typeof window[propertyName] !== 'undefined' && window[propertyName] !== currentEnv) {
    try {
      console.log('[env_injector] restoring from pre-existing value');
      const preExisting = window[propertyName];
      if (preExisting && typeof preExisting === 'object') {
        if (!originalValues) {
          originalValues = {};
          for (const k of Object.keys(preExisting)) {
            originalValues[k] = preExisting[k];
          }
        }
        rebuildCurrentEnv();
      }
    } catch (e) {}
  }

  // 消息监听：同时接受 MAIN world 和 ISOLATED world 的消息
  window.addEventListener('message', function (event) {
    const data = event.data;
    if (!data || data.channel !== CHANNEL) return;

    console.log('[env_injector] Received message:', data.type);

    if (data.type === 'GET_SNAPSHOT') {
      window.postMessage({
        channel: CHANNEL,
        type: 'SNAPSHOT',
        payload: buildSnapshot(),
        propertyName: propertyName,
        hasOriginal: !!originalValues
      }, '*');
    } else if (data.type === 'SET_OVERRIDES') {
      const next = (data.payload && typeof data.payload === 'object') ? data.payload : {};
      overrides = next;
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
      } catch (e) {}

      rebuildCurrentEnv();

      window.postMessage({
        channel: CHANNEL,
        type: 'OVERRIDES_APPLIED',
        payload: buildSnapshot()
      }, '*');
    } else if (data.type === 'RESET_OVERRIDES') {
      overrides = {};
      try {
        window.localStorage.removeItem(STORAGE_KEY);
      } catch (e) {}

      rebuildCurrentEnv();

      window.postMessage({
        channel: CHANNEL,
        type: 'OVERRIDES_RESET',
        payload: buildSnapshot()
      }, '*');
    } else if (data.type === 'UPDATE_CONFIG') {
      const newConfig = data.payload || {};
      let needReroute = false;
      if (newConfig.propertyName && newConfig.propertyName !== propertyName) {
        propertyName = newConfig.propertyName;
        config.propertyName = propertyName;
        needReroute = true;
      }
      if (Array.isArray(newConfig.keyTemplate)) {
        keyTemplate = newConfig.keyTemplate;
        config.keyTemplate = keyTemplate;
      }
      try {
        window.localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
      } catch (e) {}

      if (needReroute) {
        setupPropertyProxy();
      }

      rebuildCurrentEnv();

      window.postMessage({
        channel: CHANNEL,
        type: 'CONFIG_UPDATED',
        payload: buildSnapshot(),
        propertyName: propertyName,
        hasOriginal: !!originalValues
      }, '*');
    } else if (data.type === 'GET_CONFIG') {
      window.postMessage({
        channel: CHANNEL,
        type: 'CONFIG_SNAPSHOT',
        payload: {
          propertyName: propertyName,
          keyTemplate: Array.isArray(keyTemplate) ? keyTemplate : [],
          hasOriginal: !!originalValues,
          originalKeys: originalValues ? Object.keys(originalValues) : []
        }
      }, '*');
    }
  });

  console.log('[env_injector] Ready. currentEnv =', currentEnv);
})();
