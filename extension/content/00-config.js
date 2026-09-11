/**
 * 00-config.js
 * 全局命名空间、常量配置、运行时状态、基础工具函数
 */
(function () {
  "use strict";

  window.BH = window.BH || {};

  /* ---------------- 常量配置 ---------------- */
  BH.CONFIG = {
    // 卡密验证后端地址（部署后改成你的域名）
    API_BASE: "http://localhost:8788/api",

    // 主循环间隔（ms）
    BASIC_INTERVAL: 1000,
    // 各操作间隔基数（ms）
    OPERATION_INTERVAL: 1200,

    DELAYS: {
      SHORT: 30,
      MEDIUM_SHORT: 200,
    },

    // localStorage key
    STORAGE_KEYS: {
      PROCESSED_JOBS: "bh_processedJobs",
      SENT_GREETINGS_HRS: "bh_sentGreetingsHRs",
      SENT_RESUME_HRS: "bh_sentResumeHRs",
      SENT_IMAGE_RESUME_HRS: "bh_sentImageResumeHRs",
    },
    // 去重集合容量上限（FIFO）
    STORAGE_LIMITS: {
      PROCESSED_JOBS: 5000,
      SENT_GREETINGS_HRS: 5000,
      SENT_RESUME_HRS: 5000,
      SENT_IMAGE_RESUME_HRS: 5000,
    },

    UI: {
      ANIMATION_DURATION: 300,
      DEBOUNCE_DELAY: 300,
    },

    DEFAULT_GREETING: "你好，我对这个职位很有兴趣，如方便能否聊聊？",
  };

  /* ---------------- 工具函数 ---------------- */
  const util = (BH.util = {});

  util.delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  util.getStoredJSON = (key, defaultValue) => {
    try {
      const val = localStorage.getItem(key);
      return val ? JSON.parse(val) : defaultValue;
    } catch (e) {
      console.error(`[BOSS海投] 解析 ${key} 失败:`, e);
      return defaultValue;
    }
  };

  /**
   * 拟人点击：对元素中心点派发完整鼠标事件序列
   */
  util.simulateClick = async (element) => {
    if (!element) return;
    const rect = element.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const events = ["mouseover", "mousemove", "mousedown", "mouseup", "click"];
    for (const type of events) {
      const evt = new MouseEvent(type, {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: x,
        clientY: y,
      });
      element.dispatchEvent(evt);
      await util.delay(BH.CONFIG.DELAYS.SHORT);
    }
  };

  /**
   * 安全点击：临时摘掉 javascript: 协议的 href，规避 CSP 报错
   */
  util.safeClick = (el) => {
    if (!el) return false;
    let originalHref = null;
    if (el.tagName === "A" && el.href && el.href.startsWith("javascript:")) {
      originalHref = el.getAttribute("href");
      el.removeAttribute("href");
    }
    el.click();
    if (originalHref !== null) {
      setTimeout(() => el.setAttribute("href", originalHref), 100);
    }
    return true;
  };

  /**
   * 等待元素出现（MutationObserver），默认超时 5s
   */
  util.waitForElement = (selector, timeout = 5000, context = document) => {
    return new Promise((resolve) => {
      const existing = context.querySelector(selector);
      if (existing) return resolve(existing);

      let settled = false;
      const observer = new MutationObserver(() => {
        const el = context.querySelector(selector);
        if (el && !settled) {
          settled = true;
          observer.disconnect();
          resolve(el);
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });

      setTimeout(() => {
        if (!settled) {
          settled = true;
          observer.disconnect();
          resolve(null);
        }
      }, timeout);
    });
  };

  /**
   * 上下文智能延迟：点击/选择类操作打 8 折
   */
  util.getContextMultiplier = (context) => {
    if (context === "click" || context === "selection") return 0.8;
    return 1.0;
  };

  util.smartDelay = async (baseDelay, context = "default") => {
    const multiplier = util.getContextMultiplier(context);
    await util.delay(Math.round(baseDelay * multiplier));
  };

  /**
   * 提取字符串的全部连续 2 字 n-gram（用于岗位名与简历名匹配）
   */
  util.extractTwoCharKeywords = (text) => {
    if (!text) return [];
    const cleanText = text.replace(/[\s,，.。:：;；!！?？·/\\_\-—|()（）[\]【】]/g, "");
    const keywords = [];
    for (let i = 0; i < cleanText.length - 1; i++) {
      keywords.push(cleanText.substring(i, i + 2));
    }
    return keywords;
  };

  /* ---------------- 日志 ---------------- */
  /**
   * 面板日志（依赖 03-ui.js 的 #bh-log，未渲染前退化为 console）
   */
  BH.log = (message) => {
    const logContainer = document.getElementById("bh-log");
    const time = new Date().toTimeString().slice(0, 8);
    if (!logContainer) {
      console.log(`[BOSS海投] [${time}] ${message}`);
      return;
    }
    const entry = document.createElement("div");
    entry.className = "bh-log-entry";
    entry.textContent = `[${time}] ${message}`;
    logContainer.appendChild(entry);
    logContainer.scrollTop = logContainer.scrollHeight;
  };

  /**
   * 顶部 toast 提示
   */
  BH.notify = (message, duration = 2000) => {
    const existing = document.getElementById("bh-toast");
    if (existing) existing.remove();
    const toast = document.createElement("div");
    toast.id = "bh-toast";
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
      background: rgba(17, 24, 39, 0.92); color: #fff; padding: 10px 20px;
      border-radius: 8px; font-size: 14px; z-index: 2147483647;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2); pointer-events: none;
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), duration);
  };

  /* ---------------- background 代理请求 ---------------- */
  /**
   * 通过 background service worker 发请求（绕开页面 CSP / 跨域）
   */
  BH.apiRequest = (options) => {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        {
          type: "apiRequest",
          options: {
            url: options.url,
            method: options.method || "GET",
            headers: options.headers || {},
            body: options.body,
          },
        },
        (response) => {
          if (chrome.runtime.lastError) {
            resolve({
              success: false,
              message: chrome.runtime.lastError.message,
              status: 0,
            });
            return;
          }
          resolve(response || { success: false, message: "未知错误", status: 0 });
        }
      );
    });
  };

  /* ---------------- 全局运行时状态 ---------------- */
  BH.state = {
    isRunning: false,

    includeKeywords: [],
    cityKeywords: [],
    communicationIncludeKeywords: [],

    ui: {
      isMinimized: false,
      theme: localStorage.getItem("bh_theme") || "light",
    },

    // HR 交互去重集合（新版使用会话/岗位键，同时兼容旧版姓名-公司键）
    hrInteractions: {
      sentGreetingsHRs: new Set(util.getStoredJSON(BH.CONFIG.STORAGE_KEYS.SENT_GREETINGS_HRS, [])),
      sentResumeHRs: new Set(util.getStoredJSON(BH.CONFIG.STORAGE_KEYS.SENT_RESUME_HRS, [])),
      sentImageResumeHRs: new Set(util.getStoredJSON(BH.CONFIG.STORAGE_KEYS.SENT_IMAGE_RESUME_HRS, [])),
    },

    // 已成功发起沟通的岗位（岗位链接/ID），跨启动与跨标签页去重
    jobInteractions: {
      processedJobs: new Set(util.getStoredJSON(BH.CONFIG.STORAGE_KEYS.PROCESSED_JOBS, [])),
    },

    // 单一数据源的用户设置
    settings: {
      useAutoSendResume: util.getStoredJSON("bh_useAutoSendResume", false),
      useAutoSendImageResume: util.getStoredJSON("bh_useAutoSendImageResume", false),
      excludeHeadhunters: util.getStoredJSON("bh_excludeHeadhunters", false),
      continueSearch: util.getStoredJSON("bh_continueSearch", false),
      recruiterActivityStatus: util.getStoredJSON("bh_recruiterActivityStatus", ["不限"]),
      clickDelay: parseInt(localStorage.getItem("bh_clickDelay") || "130", 10) || 130,
      greetingsList: util.getStoredJSON("bh_greetingsList", [
        BH.CONFIG.DEFAULT_GREETING,
      ]),
      imageResumes: util.getStoredJSON("bh_imageResumes", []), // [{id, path}]
    },

    // 激活状态（由 background 管理的 chrome.storage.local 读取）
    activation: {
      isActivated: false,
      cardKey: null,
    },
  };

  /* DOM 引用缓存（由 UI 模块填充） */
  BH.elements = {};
})();
