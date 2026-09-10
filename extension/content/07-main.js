/**
 * 07-main.js
 * 初始化入口、SPA 路由适配、BOSS 打招呼语设置页引导
 */
(function () {
  "use strict";

  const { state, util } = BH;

  let chatAutoStarted = false;

  function getPageType() {
    const path = location.pathname;
    if (path.includes("/chat")) return "chat";
    if (path.includes("/jobs")) return "jobs";
    if (path.includes("/notify-set")) return "notify-set";
    return "other";
  }

  /**
   * BOSS 打招呼语设置页：提示并尝试自动打开官方打招呼语开关
   */
  async function handleGreetSettingsPage() {
    try {
      const title = await util.waitForElement("h3.title-wrap", 5000);
      if (title) {
        title.textContent = "请务必打开 打招呼语功能";
        title.style.color = "#ef4444";
        title.style.fontWeight = "600";
      }

      const selectors = [".ui-switch", ".boss-switch", "[class*='switch']"];
      for (let attempt = 0; attempt < 3; attempt++) {
        await util.delay(800);
        for (const selector of selectors) {
          const switchEl = document.querySelector(selector);
          if (switchEl && !switchEl.classList.contains("checked") && !switchEl.classList.contains("active")) {
            util.safeClick(switchEl);
            BH.log("已尝试自动打开打招呼语开关");
            return;
          }
        }
      }
      BH.log("请手动确认打招呼语开关已打开");
    } catch (e) {
      console.error("[BOSS海投] 打招呼语设置页处理失败:", e);
    }
  }

  /**
   * 路由分发：按页面类型初始化
   */
  function dispatch(pageType) {
    switch (pageType) {
      case "jobs":
        BH.log("面板已就绪，设置筛选条件后点击「启动海投」");
        break;
      case "chat":
        if (!chatAutoStarted) {
          chatAutoStarted = true;
          BH.log("聊天页已就绪，即将自动开始…");
          setTimeout(() => {
            if (!state.isRunning) BH.core.toggleChatProcess();
          }, 2500);
        }
        break;
      case "notify-set":
        handleGreetSettingsPage();
        break;
      default:
        BH.log("当前页面不支持，请到职位列表或聊天页使用");
    }
  }

  function rebuildPanelIfNeeded(pageType) {
    const panel = document.getElementById("bh-panel");
    if (!panel) return;
    const isChatPanel = !!document.getElementById("bh-communication-include");
    const needChat = pageType === "chat";
    if (isChatPanel !== needChat) {
      panel.remove();
      document.getElementById("bh-mini")?.remove();
      BH.elements.panel = null;
      BH.ui.init();
    }
  }

  /* ---------------- SPA 路由监听 ---------------- */

  function setupRouteObserver() {
    let lastUrl = location.href;
    const observer = new MutationObserver(() => {
      if (location.href === lastUrl) return;
      lastUrl = location.href;
      const pageType = getPageType();
      setTimeout(() => {
        rebuildPanelIfNeeded(pageType);
        dispatch(pageType);
      }, 500);
    });
    observer.observe(document, { childList: true, subtree: true });
  }

  /* ---------------- 初始化 ---------------- */

  async function init() {
    try {
      BH.storage.ensureLimits();
      await BH.activation.load();
      BH.ui.init();
      dispatch(getPageType());
      setupRouteObserver();
      console.log("[BOSS海投] 初始化完成", {
        activated: state.activation.isActivated,
        page: getPageType(),
      });
    } catch (e) {
      console.error("[BOSS海投] 初始化失败:", e);
    }
  }

  if (document.readyState === "loading") {
    window.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
