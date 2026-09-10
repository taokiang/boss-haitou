/**
 * background.js (MV3 service worker)
 * 职责：卡密验证、激活凭证管理、代理 fetch、打开聊天窗口
 *
 * 注意：API_BASE 需与 content/00-config.js 中保持一致
 */
const API_BASE = "http://localhost:8788/api";

/* ---------- 激活凭证（chrome.storage.local） ---------- */
async function saveActivateCredential(activeStatus, cardKey) {
  await chrome.storage.local.set({
    active_status: activeStatus,
    card_key: cardKey,
  });
}

async function getActivateCredential() {
  const res = await chrome.storage.local.get(["active_status", "card_key"]);
  return {
    active_status: res?.active_status ?? null,
    card_key: res?.card_key ?? null,
  };
}

async function checkActivateStatus() {
  const { active_status, card_key } = await getActivateCredential();
  if (!active_status || !card_key) {
    console.log("[BOSS海投] 无有效激活凭证");
    return;
  }
  console.log("[BOSS海投] 激活凭证已就绪");
}

chrome.runtime.onStartup.addListener(checkActivateStatus);
chrome.runtime.onInstalled.addListener((details) => {
  console.log(`[BOSS海投] onInstalled: ${details.reason}`);
  checkActivateStatus();
});

/* ---------- 消息处理 ---------- */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // 代理 fetch（绕开页面 CSP / 跨域）
  if (request.type === "apiRequest") {
    const options = request.options;
    fetch(options.url, {
      method: options.method || "GET",
      headers: options.headers || {},
      body: options.method !== "GET" ? options.body : undefined,
    })
      .then((response) =>
        response.text().then((text) => ({
          success: true,
          status: response.status,
          responseText: text,
          response: text,
        }))
      )
      .then((data) => sendResponse(data))
      .catch((error) => sendResponse({ success: false, message: error.message }));
    return true; // 异步响应
  }

  // 读取激活信息
  if (request.type === "get_activate_info") {
    getActivateCredential()
      .then((data) => sendResponse(data))
      .catch((error) =>
        sendResponse({ active_status: null, card_key: null, error: error.message })
      );
    return true;
  }

  // 验证卡密
  if (request.type === "verify_card_key") {
    const cardKey = request.card_key;
    const keyPattern = /^[A-Za-z0-9]{32}$/;
    if (!keyPattern.test(cardKey || "")) {
      sendResponse({ success: false, message: "激活卡密格式有误" });
      return true;
    }

    fetch(`${API_BASE}/public/card-keys/verify/${cardKey}`, { method: "GET" })
      .then((response) => response.text().then((text) => ({ status: response.status, text })))
      .then(async ({ status, text }) => {
        let data;
        try {
          data = JSON.parse(text);
        } catch (e) {
          sendResponse({ success: false, message: "响应解析失败" });
          return;
        }
        if (status >= 200 && status < 300 && data.code === 200 && data.message === "success") {
          try {
            await saveActivateCredential(true, cardKey);
            sendResponse({ success: true });
          } catch (e) {
            sendResponse({ success: false, message: "激活凭证保存失败，请重试" });
          }
        } else {
          sendResponse({ success: false, message: data.message || "激活卡密无效" });
        }
      })
      .catch((error) => {
        sendResponse({ success: false, message: `网络请求失败: ${error.message || ""}` });
      });

    return true;
  }
});
