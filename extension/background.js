/**
 * background.js (MV3 service worker)
 * 职责：卡密验证、激活凭证管理、打开聊天窗口
 */
const API_BASE = "https://boss-haitou-api.qiujiangtao1990.workers.dev/api";

/* ---------- 激活凭证（chrome.storage.local） ---------- */
async function saveActivateCredential(activeStatus, cardKey) {
  await chrome.storage.local.set({
    active_status: activeStatus,
    card_key: cardKey,
  });
}

async function getActivateCredential() {
  const res = await chrome.storage.local.get(["active_status", "card_key", "device_id"]);
  return {
    active_status: res?.active_status ?? null,
    card_key: res?.card_key ?? null,
    device_id: res?.device_id ?? null,
  };
}

async function getOrCreateDeviceId() {
  const { device_id: existingDeviceId } = await getActivateCredential();
  if (existingDeviceId) return existingDeviceId;
  const deviceId = crypto.randomUUID();
  await chrome.storage.local.set({ device_id: deviceId });
  return deviceId;
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

    getOrCreateDeviceId()
      .then((deviceId) => fetch(`${API_BASE}/public/card-keys/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: cardKey, deviceId }),
      }))
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
