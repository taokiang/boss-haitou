/**
 * 06-core.js
 * 主循环、职位列表页流程（过滤/立即沟通/留在此页/滚动加载/续搜）、
 * 聊天页流程（会话遍历/关键词过滤）、HR 新消息监听
 */
(function () {
  "use strict";

  const { state, elements, util, CONFIG } = BH;

  // 会话级去重：已点过的职位卡片（职位链接）
  const processedCards = new Set();
  // 已处理职位名：用于"投递完成继续搜索"取词
  const processedJobNames = [];

  // 聊天页监听状态
  let currentMonitoredHR = null;
  let messageObserver = null;
  let processingMessage = false;
  let lastProcessedMessage = "";
  // 正在交互中的 HR（防主循环 1s 节拍在交互完成前重入，导致重复发送）
  let interactingHRKey = null;
  // 聊天页就绪心跳时间戳（跨标签页通知列表页关闭引导）
  let lastReadyBeat = 0;
  // 列表页"海投运行中"心跳时间戳（聊天页据此判断是否允许自动开聊）
  let lastRunBeat = 0;

  /* ================= 主循环 ================= */

  async function startProcessing() {
    while (state.isRunning) {
      try {
        const pathname = location.pathname;
        if (pathname.includes("/jobs")) {
          // 心跳：告知聊天页"海投运行中"
          if (Date.now() - lastRunBeat > 5000) {
            lastRunBeat = Date.now();
            localStorage.setItem("bh_haitou_running", String(lastRunBeat));
          }
          await processJobList();
        } else if (pathname.includes("/chat")) {
          // 列表页已停止海投（心跳过期）→ 聊天页自动停止
          const runningTs = parseInt(localStorage.getItem("bh_haitou_running") || "0", 10);
          if (Date.now() - runningTs > 20000) {
            state.isRunning = false;
            BH.log("未检测到海投运行，已自动停止聊天处理");
            break;
          }
          // 心跳：告知列表页"消息页已就绪"，自动关闭红色引导提示
          if (Date.now() - lastReadyBeat > 5000) {
            lastReadyBeat = Date.now();
            localStorage.setItem("bh_chat_ready", String(lastReadyBeat));
          }
          await handleChatPage();
        }
      } catch (e) {
        console.error("[BOSS海投] 主循环异常:", e);
      }
      await util.delay(CONFIG.BASIC_INTERVAL);
    }
  }

  /* ================= 职位列表页 ================= */

  function getCardKey(card) {
    const link = card.querySelector(".job-name");
    if (link && link.getAttribute("href")) {
      try {
        const url = new URL(link.getAttribute("href"), location.origin);
        if (!/\/job_detail\/[^/]+/.test(url.pathname)) {
          for (const param of ["jobId", "encryptJobId", "securityId"]) {
            const value = url.searchParams.get(param);
            if (value) return `${url.pathname}?${param}=${value}`;
          }
        }
        return url.pathname;
      } catch (_) {
        return link.getAttribute("href");
      }
    }
    return (card.textContent || "").slice(0, 50);
  }

  function syncProcessedJobs() {
    BH.storage.syncRecordSet(state.jobInteractions.processedJobs, CONFIG.STORAGE_KEYS.PROCESSED_JOBS);
  }

  /**
   * 取未处理且通过过滤的卡片
   */
  function getFilteredCards() {
    syncProcessedJobs();
    const cards = Array.from(document.querySelectorAll("li.job-card-box"));
    return cards.filter((card) => {
      const key = getCardKey(card);
      if (processedCards.has(key)) return false;
      if (state.jobInteractions.processedJobs.has(key)) return false;

      const nameEl = card.querySelector(".job-name");
      const jobName = (nameEl ? nameEl.textContent : "").toLowerCase();

      if (
        state.includeKeywords.length &&
        !state.includeKeywords.some((kw) => jobName.includes(kw))
      ) {
        return false;
      }
      // 城市包含：匹配卡片上的工作地区（.job-area，如"上海·青浦区·徐泾"），兜底卡片全文
      if (state.cityKeywords.length) {
        const areaEl = card.querySelector(".job-area");
        const cityText = (areaEl && areaEl.textContent.trim()) || card.textContent || "";
        if (!state.cityKeywords.some((kw) => cityText.includes(kw))) {
          return false;
        }
      }
      if (state.settings.excludeHeadhunters) {
        const tagIcon = card.querySelector(".job-tag-icon");
        if (tagIcon && (tagIcon.getAttribute("alt") || "").includes("猎头")) {
          return false;
        }
      }
      return true;
    });
  }

  function getRecruiterActiveStatus() {
    const onlineTag = document.querySelector(".boss-online-tag");
    if (onlineTag && onlineTag.textContent.trim() === "在线") return "在线";
    const activeTime = document.querySelector(".boss-active-time");
    return activeTime ? activeTime.textContent.trim() : "未知";
  }

  /**
   * "留在此页"弹窗：点立即沟通后留在列表页，沟通由聊天窗口接管
   */
  async function handleGreetingModal() {
    await util.delay(CONFIG.OPERATION_INTERVAL * 4);
    const stayBtn = Array.from(
      document.querySelectorAll(".default-btn.cancel-btn")
    ).find((btn) => btn.textContent.trim() === "留在此页");
    if (stayBtn) {
      util.safeClick(stayBtn);
      await util.delay(CONFIG.OPERATION_INTERVAL * 2);
    }
  }

  /* ----- 投递完成继续搜索 ----- */

  function getSearchKeyword() {
    if (!processedJobNames.length) return null;
    const len45 = processedJobNames.find((n) => n.length >= 4 && n.length <= 5);
    if (len45) return len45;
    const len3 = processedJobNames.find((n) => n.length === 3);
    if (len3) return len3;
    return processedJobNames[0].slice(0, 3);
  }

  async function performSearch(keyword) {
    const input = await util.waitForElement(".c-search-input .input", 3000);
    const searchBtn = document.querySelector(".c-search-input .search-btn");
    if (!input || !searchBtn) {
      BH.log("未找到搜索框，无法继续搜索");
      return false;
    }
    input.value = keyword;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await util.delay(CONFIG.DELAYS.MEDIUM_SHORT);
    util.safeClick(searchBtn);
    BH.log(`已自动搜索新关键词: ${keyword}`);
    await util.delay(3000);
    return true;
  }

  function resetCycle(reason) {
    state.isRunning = false;
    BH.ui.setRunning(false, "停止海投", "启动海投");
    BH.ui.hideChatGuide();
    localStorage.removeItem("bh_haitou_running");
    BH.log(reason || "所有岗位沟通完成，已自动停止");
  }

  /* ----- 列表页单轮处理 ----- */

  async function processJobList() {
    const filteredCards = getFilteredCards();

    if (!filteredCards.length) {
      // 无限滚动加载更多
      const before = document.querySelectorAll("li.job-card-box").length;
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
      await util.delay(2000);
      const after = document.querySelectorAll("li.job-card-box").length;

      // 加载不出新内容且仍无匹配 → 换词续搜或停止
      if (after === before && !getFilteredCards().length) {
        if (state.settings.continueSearch && processedJobNames.length) {
          const keyword = getSearchKeyword();
          if (keyword && (await performSearch(keyword))) {
            processedCards.clear();
            return;
          }
        }
        resetCycle();
      }
      return;
    }

    // 处理第一张匹配卡片
    const currentCard = filteredCards[0];
    const cardKey = getCardKey(currentCard);
    processedCards.add(cardKey);

    const nameEl = currentCard.querySelector(".job-name");
    const jobName = nameEl ? nameEl.textContent.trim() : "未知职位";
    processedJobNames.push(jobName);
    BH.log(`处理职位: ${jobName}`);

    await BH.storage.withCrossTabLock("job-processing", async () => {
      syncProcessedJobs();
      if (state.jobInteractions.processedJobs.has(cardKey)) return;

      currentCard.scrollIntoView({ behavior: "smooth", block: "center" });
      await util.delay(CONFIG.DELAYS.MEDIUM_SHORT);
      currentCard.click();
      await util.delay(CONFIG.OPERATION_INTERVAL * 2);

      // 招聘者活跃度过滤（付费功能，未激活强制"不限"）
      const activeStatusFilter = state.activation.isActivated
        ? state.settings.recruiterActivityStatus
        : ["不限"];
      if (!activeStatusFilter.includes("不限")) {
        const status = getRecruiterActiveStatus();
        if (!activeStatusFilter.some((s) => status.includes(s))) {
          BH.log(`跳过：招聘者状态「${status}」不在筛选范围`);
          return;
        }
      }

      const chatBtn = document.querySelector("a.op-btn-chat");
      if (!chatBtn || chatBtn.textContent.trim() !== "立即沟通") {
        BH.log("已沟通过，跳过");
        BH.storage.addRecordWithLimit(
          state.jobInteractions.processedJobs,
          CONFIG.STORAGE_KEYS.PROCESSED_JOBS,
          CONFIG.STORAGE_LIMITS.PROCESSED_JOBS,
          cardKey
        );
        return;
      }
      const recorded = BH.storage.addRecordWithLimit(
        state.jobInteractions.processedJobs,
        CONFIG.STORAGE_KEYS.PROCESSED_JOBS,
        CONFIG.STORAGE_LIMITS.PROCESSED_JOBS,
        cardKey
      );
      if (!recorded) {
        BH.log("无法保存岗位发送占位，已停止沟通以避免重复");
        return;
      }
      if (!util.safeClick(chatBtn)) {
        BH.storage.removeRecord(
          state.jobInteractions.processedJobs,
          CONFIG.STORAGE_KEYS.PROCESSED_JOBS,
          cardKey
        );
        return;
      }
      BH.log("已点击立即沟通");
      await handleGreetingModal();
    });
  }

  /* ================= 聊天页 ================= */

  function getLatestChatLi() {
    return document.querySelector(
      'ul[role="group"] li[role="listitem"][class]:has(.friend-content-warp)'
    );
  }

  function getPositionName() {
    const selectors = [
      ".position-name",
      ".job-name",
      '[class*="position-content"] .left-content .position-name',
    ];
    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el && el.textContent.trim()) return el.textContent.trim();
    }
    return "";
  }

  /**
   * 随机滚动会话列表，模拟真人浏览
   */
  async function scrollUserList() {
    const container = document.querySelector(".user-list-content");
    if (!container) return;
    const steps = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < steps; i++) {
      container.scrollTo({
        top: Math.random() * container.scrollHeight,
        behavior: "smooth",
      });
      await util.delay(1000 + Math.random() * 2000);
    }
    container.scrollTo({
      top: Math.random() > 0.5 ? 0 : container.scrollHeight,
      behavior: "smooth",
    });
  }

  /* ----- HR 新消息监听 ----- */

  async function handleNewMessage(hrKey, legacyHrKey = null) {
    if (processingMessage) return;
    processingMessage = true;
    try {
      await BH.storage.withCrossTabLock("chat-send", async () => {
        // 防抖：200ms 后确认消息稳定；拿锁后再同步，第二个标签页会看到首个标签页的记录。
        await util.delay(CONFIG.DELAYS.MEDIUM_SHORT);
        BH.chat.syncDedupSets();
        const currentText = BH.chat.getLastFriendMessageText();
        if (!currentText || currentText === lastProcessedMessage) return;
        lastProcessedMessage = currentText;

        if (/简历/.test(currentText)) {
          const imageSent =
            state.hrInteractions.sentImageResumeHRs.has(hrKey) ||
            (legacyHrKey && state.hrInteractions.sentImageResumeHRs.has(legacyHrKey));
          const resumeSent =
            state.hrInteractions.sentResumeHRs.has(hrKey) ||
            (legacyHrKey && state.hrInteractions.sentResumeHRs.has(legacyHrKey));
          if (state.settings.useAutoSendImageResume && !imageSent) {
            BH.log("HR 索要简历，发送图片简历");
            await BH.chat.sendImageResume(hrKey);
          } else if (state.settings.useAutoSendResume && !resumeSent) {
            BH.log("HR 索要简历，发送附件简历");
            await BH.chat.sendResume(hrKey);
          }
        } else {
          // 卡片消息（交换简历/微信请求）→ 自动同意
          BH.chat.handleCardMessage();
        }
      });
    } finally {
      processingMessage = false;
    }
  }

  function setupMessageObserver(hrKey, legacyHrKey = null) {
    if (messageObserver) messageObserver.disconnect();
    const messageList = document.querySelector(".chat-message .im-list");
    if (!messageList) return;

    messageObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (
            node.nodeType === Node.ELEMENT_NODE &&
            node.classList &&
            node.classList.contains("item-friend")
          ) {
            handleNewMessage(hrKey, legacyHrKey);
            return;
          }
        }
      }
    });
    messageObserver.observe(messageList, { childList: true, subtree: true });
  }

  function getConversationKey(chatLi, legacyHrKey) {
    const identityElements = [chatLi, chatLi.querySelector(".figure")].filter(Boolean);
    const conversationAttributes = [
      "data-conversation-id",
      "data-conversationid",
      "data-chat-id",
    ];
    for (const element of identityElements) {
      for (const attribute of conversationAttributes) {
        const value = element.getAttribute(attribute);
        if (value) return `conversation:${attribute}:${value}`.toLowerCase();
      }
    }

    const jobAttributes = ["data-job-id"];
    for (const element of identityElements) {
      for (const attribute of jobAttributes) {
        const value = element.getAttribute(attribute);
        if (value) return `job:${attribute}:${value}|hr:${legacyHrKey}`.toLowerCase();
      }
    }

    const jobLink =
      document.querySelector('.position-name[href*="job_detail"]') ||
      document.querySelector('a[href*="/job_detail/"]');
    if (jobLink && jobLink.getAttribute("href")) {
      try {
        const url = new URL(jobLink.getAttribute("href"), location.origin);
        return `job:${url.pathname}|hr:${legacyHrKey}`.toLowerCase();
      } catch (_) {}
    }

    const positionName = getPositionName().trim().toLowerCase();
    return `hr-position:${legacyHrKey}|${positionName || "unknown"}`;
  }

  /* ----- 聊天页单轮处理 ----- */

  async function handleChatPage() {
    const latestChatLi = getLatestChatLi();
    if (!latestChatLi) return;

    // HR 唯一标识：姓名-公司
    const nameEl = latestChatLi.querySelector(".name-text");
    const companyEl = latestChatLi.querySelector(".name-box span:nth-child(2)");
    const name = nameEl ? nameEl.textContent.trim() : "";
    const company = companyEl ? companyEl.textContent.trim() : "";
    if (!name) return;
    const hrKey = `${name}-${company}`.toLowerCase();

    // 当前标签页正在交互时跳过
    if (interactingHRKey === hrKey) return;

    // 沟通岗位包含关键词过滤
    if (state.communicationIncludeKeywords.length) {
      const figure = latestChatLi.querySelector(".figure");
      if (figure) await util.simulateClick(figure);
      await util.delay(CONFIG.OPERATION_INTERVAL);
      const positionName = getPositionName().toLowerCase();
      const matched = state.communicationIncludeKeywords.some((kw) =>
        positionName.includes(kw)
      );
      if (!matched) {
        BH.log(`岗位「${positionName}」不匹配沟通关键词，跳过`);
        await scrollUserList();
        return;
      }
    }

    // 进入会话（li 上标记类防重复进入）
    if (!latestChatLi.classList.contains("bh-last-clicked")) {
      document
        .querySelectorAll("li.bh-last-clicked")
        .forEach((li) => li.classList.remove("bh-last-clicked"));
      latestChatLi.classList.add("bh-last-clicked");
      const figure = latestChatLi.querySelector(".figure");
      if (figure) await util.simulateClick(figure);
      await util.delay(CONFIG.OPERATION_INTERVAL);
    }

    const conversationKey = getConversationKey(latestChatLi, hrKey);
    if (conversationKey === currentMonitoredHR && messageObserver) return;
    currentMonitoredHR = conversationKey;
    lastProcessedMessage = "";

    // 监听和主动交互共用岗位/会话键；跨标签页锁覆盖完整的检查、发送、落盘过程。
    setupMessageObserver(conversationKey, hrKey);
    interactingHRKey = conversationKey;
    try {
      await BH.storage.withCrossTabLock("chat-send", async () => {
        if (!state.isRunning) return;
        await BH.chat.handleHRInteraction(conversationKey, hrKey);
      });
    } finally {
      interactingHRKey = null;
    }
  }

  /* ================= 启动 / 停止入口 ================= */

  function parseKeywords(raw) {
    return raw
      .split(/[,，]/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
  }

  async function toggleProcess() {
    if (state.isRunning) {
      resetCycle("已手动停止");
      return;
    }

    state.isRunning = true;
    state.includeKeywords = parseKeywords(elements.includeInput?.value || "");
    state.cityKeywords = parseKeywords(elements.cityInput?.value || "");
    processedCards.clear();
    if (elements.log) elements.log.innerHTML = "";

    BH.ui.setRunning(true, "停止海投", "启动海投");
    BH.log("开始海投…");

    // 不自动跳转：红色小手指引用户手动打开消息页（消息页会自动开聊）
    BH.ui.showChatGuide();
    BH.log("请右键顶部「消息」-> 在新标签页打开链接，即可自动开聊");

    await startProcessing();
  }

  async function toggleChatProcess() {
    if (state.isRunning) {
      state.isRunning = false;
      BH.ui.setRunning(false, "停止聊天", "开始聊天");
      BH.log("已手动停止");
      return;
    }

    state.isRunning = true;
    state.communicationIncludeKeywords = parseKeywords(
      elements.communicationIncludeInput?.value || ""
    );

    BH.ui.setRunning(true, "停止聊天", "开始聊天");
    BH.log("开始智能沟通…");
    await startProcessing();
  }

  BH.core = {
    toggleProcess,
    toggleChatProcess,
    getPositionName,
    scrollUserList,
  };
})();
