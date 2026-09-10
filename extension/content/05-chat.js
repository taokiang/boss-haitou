/**
 * 05-chat.js
 * HR 交互状态机：打招呼 → 附件简历 → 图片简历 → HR 回复跟进（卡片"同意" / "简历"关键词）
 */
(function () {
  "use strict";

  const { state, util, CONFIG } = BH;

  /* ---------------- 选择器工具 ---------------- */

  function getMessageList() {
    return document.querySelector(".chat-message .im-list");
  }

  function getFriendMessages() {
    const list = getMessageList();
    return list ? list.querySelectorAll("li.message-item.item-friend") : [];
  }

  /**
   * 轮询等待满足条件的元素（用于需要匹配文本的场景）
   */
  async function waitFor(finder, timeout = 5000, interval = 200) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const result = finder();
      if (result) return result;
      await util.delay(interval);
    }
    return null;
  }

  function findToolbarButton(text) {
    return (
      Array.from(document.querySelectorAll(".toolbar-btn")).find(
        (btn) => btn.textContent.trim() === text
      ) || null
    );
  }

  /* ---------------- 发消息 ---------------- */

  /**
   * 拟真输入并发送一条文本消息
   */
  async function sendCustomReply(text) {
    try {
      const input = await util.waitForElement("#chat-input");
      if (!input) {
        BH.log("未找到聊天输入框");
        return false;
      }
      input.textContent = "";
      input.focus();
      // execCommand 模拟真实输入，兼容富文本编辑器
      document.execCommand("insertText", false, text);
      await util.delay(120);

      const sendBtn =
        document.querySelector(".btn-send") ||
        document.querySelector("[class*='btn-send']");
      if (sendBtn) {
        sendBtn.click();
      } else {
        input.dispatchEvent(
          new KeyboardEvent("keydown", { key: "Enter", code: "Enter", bubbles: true })
        );
      }
      return true;
    } catch (e) {
      console.error("[BOSS海投] 发送消息失败:", e);
      return false;
    }
  }

  /**
   * 逐条发送打招呼语
   */
  async function sendGreetings(hrKey) {
    const greetings = state.settings.greetingsList.filter((g) => g && g.trim());
    if (!greetings.length) {
      BH.log("未配置打招呼语，跳过");
      return false;
    }
    for (const greeting of greetings) {
      if (!state.isRunning) return false;
      await sendCustomReply(greeting.trim());
      await util.smartDelay(state.settings.clickDelay, "click");
    }
    BH.storage.addRecordWithLimit(
      state.hrInteractions.sentGreetingsHRs,
      CONFIG.STORAGE_KEYS.SENT_GREETINGS_HRS,
      CONFIG.STORAGE_LIMITS.SENT_GREETINGS_HRS,
      hrKey
    );
    BH.log("打招呼语已发送");
    return true;
  }

  /* ---------------- HR 是否已回复 ---------------- */

  function hasHRResponded() {
    return getFriendMessages().length > 0;
  }

  /* ---------------- 附件简历 ---------------- */

  /**
   * 岗位名 2 字 n-gram 与简历名匹配，都不命中则取第一份
   */
  function findMatchingResume(resumeItems) {
    if (!resumeItems.length) return null;
    const positionName = BH.core.getPositionName();
    if (positionName) {
      const keywords = util.extractTwoCharKeywords(positionName);
      for (const item of resumeItems) {
        const nameEl = item.querySelector(".resume-name");
        const resumeName = nameEl ? nameEl.textContent.trim() : "";
        if (resumeName && keywords.some((kw) => resumeName.includes(kw))) {
          return item;
        }
      }
    }
    return resumeItems[0];
  }

  async function sendResume(hrKey) {
    try {
      const resumeBtn = await waitFor(() => findToolbarButton("发简历"), 5000);
      if (!resumeBtn) {
        BH.log("未找到发简历按钮");
        return false;
      }
      if (resumeBtn.classList.contains("unable")) {
        BH.log("对方未回复，暂无法发送附件简历");
        return false;
      }

      util.safeClick(resumeBtn);
      await util.smartDelay(800, "resume_load");

      // 只有一份附件简历时的确认弹窗
      const singleConfirm = document.querySelector(".panel-resume.sentence-popover .btn-sure-v2");
      if (singleConfirm) {
        util.safeClick(singleConfirm);
        await util.delay(CONFIG.DELAYS.MEDIUM_SHORT);
      } else {
        // 多份简历列表：智能匹配
        const resumeList = await util.waitForElement("ul.resume-list", 3000);
        if (!resumeList) {
          BH.log("简历列表未弹出");
          return false;
        }
        const items = Array.from(resumeList.querySelectorAll("li.list-item"));
        const target = findMatchingResume(items);
        if (!target) {
          BH.log("没有可用的附件简历");
          return false;
        }
        util.safeClick(target);
        await util.smartDelay(500, "selection");

        const confirmBtn = await waitFor(
          () => document.querySelector("button.btn-v2.btn-sure-v2.btn-confirm"),
          3000
        );
        if (!confirmBtn || confirmBtn.disabled) {
          BH.log("简历确认按钮不可用");
          return false;
        }
        util.safeClick(confirmBtn);
        await util.delay(CONFIG.DELAYS.MEDIUM_SHORT);
      }

      if (hrKey) {
        BH.storage.addRecordWithLimit(
          state.hrInteractions.sentResumeHRs,
          CONFIG.STORAGE_KEYS.SENT_RESUME_HRS,
          CONFIG.STORAGE_LIMITS.SENT_RESUME_HRS,
          hrKey
        );
      }
      BH.log("附件简历已发送");
      return true;
    } catch (e) {
      console.error("[BOSS海投] 发送附件简历失败:", e);
      return false;
    }
  }

  /* ---------------- 图片简历 ---------------- */

  /**
   * 选图：只有 1 张直接用；多张按岗位名 2 字 n-gram 匹配文件名，失败取第 1 张
   */
  function selectImageResume() {
    const list = state.settings.imageResumes;
    if (!list.length) return null;
    if (list.length === 1) return list[0];

    const positionName = BH.core.getPositionName();
    if (positionName) {
      const keywords = util.extractTwoCharKeywords(positionName);
      const matched = list.find((img) =>
        keywords.some((kw) => img.path.includes(kw))
      );
      if (matched) return matched;
    }
    return list[0];
  }

  async function sendImageResume(hrKey) {
    try {
      if (!state.settings.useAutoSendImageResume) return false;
      const selected = selectImageResume();
      if (!selected) {
        BH.log("未配置图片简历");
        return false;
      }

      const blob = await BH.imageStore.get(selected.id);
      if (!blob) {
        BH.log(`图片简历读取失败: ${selected.path}`);
        return false;
      }

      const fileInput = await waitFor(
        () =>
          document.querySelector(
            ".toolbar-btn-content.icon.btn-sendimg input[type='file']"
          ),
        5000
      );
      if (!fileInput) {
        BH.log("未找到图片上传入口");
        return false;
      }

      // 合成 FileList 喂给 BOSS 原生上传 input，复用其上传逻辑
      const file = new File([blob], selected.path, { type: "image/jpeg" });
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      fileInput.files = dataTransfer.files;
      fileInput.dispatchEvent(new Event("change", { bubbles: true }));
      await util.delay(CONFIG.DELAYS.MEDIUM_SHORT);

      if (hrKey) {
        BH.storage.addRecordWithLimit(
          state.hrInteractions.sentImageResumeHRs,
          CONFIG.STORAGE_KEYS.SENT_IMAGE_RESUME_HRS,
          CONFIG.STORAGE_LIMITS.SENT_IMAGE_RESUME_HRS,
          hrKey
        );
      }
      BH.log(`图片简历已发送: ${selected.path}`);
      return true;
    } catch (e) {
      console.error("[BOSS海投] 发送图片简历失败:", e);
      return false;
    }
  }

  /* ---------------- 简历发送编排 ---------------- */

  async function handleResumeSending(hrKey) {
    if (state.settings.useAutoSendResume && !state.hrInteractions.sentResumeHRs.has(hrKey)) {
      await sendResume(hrKey);
    }
    if (
      state.settings.useAutoSendImageResume &&
      !state.hrInteractions.sentImageResumeHRs.has(hrKey)
    ) {
      await sendImageResume(hrKey);
    }
  }

  /* ---------------- HR 卡片消息（自动点"同意"） ---------------- */

  function getLastCardMessage() {
    const cards = document.querySelectorAll(".chat-message .im-list .message-card-wrap");
    return cards.length ? cards[cards.length - 1] : null;
  }

  function handleCardMessage() {
    const card = getLastCardMessage();
    if (!card) return false;
    const agreeBtn = Array.from(card.querySelectorAll(".card-btn")).find(
      (btn) => btn.textContent.trim() === "同意"
    );
    if (agreeBtn) {
      util.safeClick(agreeBtn);
      BH.log("已自动同意 HR 的请求");
      return true;
    }
    return false;
  }

  /* ---------------- 跟进回复 ---------------- */

  function getLastFriendMessageText() {
    const friendMsgs = getFriendMessages();
    if (!friendMsgs.length) return "";
    const last = friendMsgs[friendMsgs.length - 1];
    const textEl = last.querySelector(".text span");
    return textEl ? textEl.textContent.trim() : "";
  }

  /**
   * HR 已回复但简历还没发全时的跟进：
   * - 最后一条是卡片消息 → 自动点"同意"
   * - 文本含"简历" → 优先图片简历，其次附件简历
   */
  async function handleFollowUpResponse(hrKey) {
    const lastCard = getLastCardMessage();
    if (lastCard && handleCardMessage()) return;

    const lastText = getLastFriendMessageText();
    if (/简历/.test(lastText)) {
      if (
        state.settings.useAutoSendImageResume &&
        !state.hrInteractions.sentImageResumeHRs.has(hrKey)
      ) {
        await sendImageResume(hrKey);
        return;
      }
      if (
        state.settings.useAutoSendResume &&
        !state.hrInteractions.sentResumeHRs.has(hrKey)
      ) {
        await sendResume(hrKey);
      }
    }
  }

  /* ---------------- 状态机入口 ---------------- */

  async function handleHRInteraction(hrKey) {
    try {
      const responded = hasHRResponded();
      const greeted = state.hrInteractions.sentGreetingsHRs.has(hrKey);

      if (!greeted && !responded) {
        // 首次沟通：打招呼 → 发简历
        BH.log(`首次沟通: ${hrKey}`);
        const sent = await sendGreetings(hrKey);
        if (sent) {
          await util.delay(CONFIG.OPERATION_INTERVAL);
          await handleResumeSending(hrKey);
        }
        return;
      }

      // 已回复但简历未发全 → 跟进
      const resumePending =
        (state.settings.useAutoSendResume &&
          !state.hrInteractions.sentResumeHRs.has(hrKey)) ||
        (state.settings.useAutoSendImageResume &&
          !state.hrInteractions.sentImageResumeHRs.has(hrKey));
      if (responded && resumePending) {
        await handleFollowUpResponse(hrKey);
      }
    } catch (e) {
      console.error("[BOSS海投] HR 交互处理失败:", e);
    }
  }

  BH.chat = {
    handleHRInteraction,
    sendGreetings,
    sendResume,
    sendImageResume,
    sendCustomReply,
    hasHRResponded,
    handleCardMessage,
    getLastFriendMessageText,
  };
})();
