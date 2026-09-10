/**
 * 03-ui.js
 * 悬浮控制面板：header / 控制区（列表页、聊天页两种形态）/ 日志区 / 拖拽 / 迷你球
 */
(function () {
  "use strict";

  const { state, elements, util } = BH;

  const PAGE_TYPES = { JOB_LIST: "job-list", CHAT: "chat" };

  const SVG = {
    logo: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 17l6-6-6-6"/><path d="M12 19h8"/></svg>`,
    key: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="7.5" cy="15.5" r="4.5"/><path d="M11 12l9-9"/><path d="M16 4l3 3"/><path d="M13 7l3 3"/></svg>`,
    gear: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.01a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
    minus: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M5 12h14"/></svg>`,
  };

  function injectStyles() {
    if (document.getElementById("bh-styles")) return;
    const style = document.createElement("style");
    style.id = "bh-styles";
    style.textContent = `
      #bh-panel {
        position: fixed; top: 32px; right: 20px; width: 340px;
        background: #fff; border-radius: 16px; z-index: 2147483646;
        box-shadow: 0 12px 40px rgba(15, 23, 42, 0.18), 0 2px 8px rgba(15, 23, 42, 0.08);
        font-family: -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif;
        overflow: hidden; transition: transform .3s ease, opacity .3s ease;
      }
      #bh-panel.bh-hidden { transform: translateY(30px) scale(.9); opacity: 0; pointer-events: none; }
      #bh-panel * { box-sizing: border-box; margin: 0; padding: 0; }

      .bh-header {
        display: flex; align-items: center; gap: 8px; padding: 12px 14px;
        background: linear-gradient(135deg, #2563eb, #1d4ed8); color: #fff;
        cursor: move; user-select: none;
      }
      .bh-header-title { flex: 1; min-width: 0; }
      .bh-header-title b { display: block; font-size: 15px; letter-spacing: .5px; }
      .bh-header-title span { display: block; font-size: 11px; opacity: .82; margin-top: 1px; }
      .bh-icon-btn {
        display: flex; align-items: center; justify-content: center;
        width: 28px; height: 28px; border: none; border-radius: 8px;
        background: rgba(255,255,255,.16); color: #fff; cursor: pointer;
        transition: background .15s;
      }
      .bh-icon-btn:hover { background: rgba(255,255,255,.3); }
      .bh-icon-btn:disabled { opacity: .45; cursor: not-allowed; }

      .bh-controls { padding: 14px 14px 10px; display: flex; flex-direction: column; gap: 10px; }
      .bh-input {
        width: 100%; padding: 9px 12px; border: 1px solid #e2e8f0; border-radius: 10px;
        font-size: 13px; outline: none; transition: border-color .15s, box-shadow .15s;
      }
      .bh-input:focus { border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37,99,235,.12); }
      .bh-main-btn {
        width: 100%; padding: 11px; border: none; border-radius: 10px;
        background: linear-gradient(135deg, #2563eb, #1d4ed8); color: #fff;
        font-size: 14px; font-weight: 600; letter-spacing: 1px; cursor: pointer;
        transition: opacity .15s, transform .1s;
      }
      .bh-main-btn:hover { opacity: .92; }
      .bh-main-btn:active { transform: scale(.98); }
      .bh-main-btn.bh-stop { background: linear-gradient(135deg, #ef4444, #dc2626); }

      .bh-log {
        margin: 0 14px; height: 240px; overflow-y: auto; padding: 10px 12px;
        background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px;
        font-size: 12px; line-height: 1.7; color: #334155; user-select: text;
      }
      .bh-log-entry { word-break: break-all; }
      .bh-log::-webkit-scrollbar, .bh-dialog-scroll::-webkit-scrollbar { width: 6px; }
      .bh-log::-webkit-scrollbar-thumb, .bh-dialog-scroll::-webkit-scrollbar-thumb {
        background: #cbd5e1; border-radius: 3px;
      }

      .bh-footer {
        padding: 10px 14px; text-align: center; font-size: 11px; color: #94a3b8;
      }

      #bh-mini {
        position: fixed; right: 30px; bottom: 150px; width: 46px; height: 46px;
        border-radius: 50%; background: linear-gradient(135deg, #2563eb, #1d4ed8);
        color: #fff; display: flex; align-items: center; justify-content: center;
        cursor: pointer; z-index: 2147483646; box-shadow: 0 6px 20px rgba(37,99,235,.4);
        transition: transform .15s;
      }
      #bh-mini:hover { transform: scale(1.08); }
    `;
    document.head.appendChild(style);
  }

  /* ---------------- header ---------------- */
  function createHeader(pageType) {
    const header = document.createElement("div");
    header.className = "bh-header";

    const logo = document.createElement("span");
    logo.innerHTML = SVG.logo;
    logo.style.display = "flex";

    const title = document.createElement("div");
    title.className = "bh-header-title";
    const isChat = pageType === PAGE_TYPES.CHAT;
    title.innerHTML = `<b>${isChat ? "BOSS聊天" : "BOSS海投"}</b><span>${isChat ? "智能沟通，精准应答" : "高效求职，智能投递"}</span>`;

    const activateBtn = document.createElement("button");
    activateBtn.className = "bh-icon-btn";
    activateBtn.innerHTML = SVG.key;
    activateBtn.title = "激活";
    activateBtn.addEventListener("click", () => {
      if (state.activation.isActivated) return;
      BH.dialogs.openActivation();
    });
    elements.activateBtn = activateBtn;

    const settingsBtn = document.createElement("button");
    settingsBtn.className = "bh-icon-btn";
    settingsBtn.innerHTML = SVG.gear;
    settingsBtn.title = "设置";
    settingsBtn.addEventListener("click", () => BH.dialogs.openSettings());

    const minimizeBtn = document.createElement("button");
    minimizeBtn.className = "bh-icon-btn";
    minimizeBtn.innerHTML = SVG.minus;
    minimizeBtn.title = "最小化";
    minimizeBtn.addEventListener("click", () => BH.ui.minimize());

    header.append(logo, title, activateBtn, settingsBtn, minimizeBtn);
    return header;
  }

  /* ---------------- 控制区 ---------------- */
  function createFilterInput(id, placeholder) {
    const input = document.createElement("input");
    input.id = id;
    input.className = "bh-input";
    input.placeholder = placeholder;
    return input;
  }

  function createControls(pageType) {
    const box = document.createElement("div");
    box.className = "bh-controls";

    if (pageType === PAGE_TYPES.CHAT) {
      const includeInput = createFilterInput("bh-communication-include", "沟通岗位包含，如：前端，开发");
      includeInput.value = state.communicationIncludeKeywords.join("，");
      elements.communicationIncludeInput = includeInput;

      const btn = document.createElement("button");
      btn.className = "bh-main-btn";
      btn.textContent = "开始聊天";
      btn.addEventListener("click", () => BH.core.toggleChatProcess());
      elements.controlBtn = btn;

      box.append(includeInput, btn);
      return box;
    }

    const includeInput = createFilterInput("bh-include-filter", "职位名包含，如：前端，开发");
    includeInput.value = state.includeKeywords.join("，");
    const excludeInput = createFilterInput("bh-exclude-filter", "职位名排除，如：销售，司机");
    excludeInput.value = state.excludeKeywords.join("，");
    elements.includeInput = includeInput;
    elements.excludeInput = excludeInput;

    const btn = document.createElement("button");
    btn.className = "bh-main-btn";
    btn.textContent = "启动海投";
    btn.addEventListener("click", () => BH.core.toggleProcess());
    elements.controlBtn = btn;

    box.append(includeInput, excludeInput, btn);
    return box;
  }

  /* ---------------- 日志区 / footer ---------------- */
  function createLogger() {
    const log = document.createElement("div");
    log.id = "bh-log";
    log.className = "bh-log";
    elements.log = log;
    return log;
  }

  function createFooter() {
    const footer = document.createElement("div");
    footer.className = "bh-footer";
    footer.textContent = `© ${new Date().getFullYear()} BOSS海投`;
    return footer;
  }

  /* ---------------- 拖拽 ---------------- */
  function makeDraggable(panel, handle) {
    let startX = 0, startY = 0, startLeft = 0, startTop = 0, dragging = false;

    handle.addEventListener("mousedown", (e) => {
      if (e.target.closest(".bh-icon-btn")) return;
      dragging = true;
      startX = e.clientX;
      startY = e.clientY;
      const rect = panel.getBoundingClientRect();
      startLeft = rect.left;
      startTop = rect.top;
      panel.style.right = "auto";
      e.preventDefault();
    });

    document.addEventListener("mousemove", (e) => {
      if (!dragging) return;
      panel.style.left = `${startLeft + e.clientX - startX}px`;
      panel.style.top = `${startTop + e.clientY - startY}px`;
    });

    document.addEventListener("mouseup", () => (dragging = false));
  }

  /* ---------------- 迷你球 ---------------- */
  function createMiniIcon() {
    if (document.getElementById("bh-mini")) return;
    const mini = document.createElement("div");
    mini.id = "bh-mini";
    mini.innerHTML = SVG.logo;
    mini.title = "展开 BOSS海投 面板";
    mini.style.display = "none";
    mini.addEventListener("click", () => BH.ui.restore());
    document.body.appendChild(mini);
    elements.miniIcon = mini;
  }

  /* ---------------- 对外接口 ---------------- */
  BH.ui = {
    init() {
      const pageType = location.pathname.includes("/chat")
        ? PAGE_TYPES.CHAT
        : PAGE_TYPES.JOB_LIST;

      injectStyles();

      if (document.getElementById("bh-panel")) return;

      const panel = document.createElement("div");
      panel.id = "bh-panel";
      const header = createHeader(pageType);
      panel.append(
        header,
        createControls(pageType),
        createLogger(),
        createFooter()
      );
      document.body.appendChild(panel);
      elements.panel = panel;

      makeDraggable(panel, header);
      createMiniIcon();
      this.refreshActivationUI();
    },

    minimize() {
      state.ui.isMinimized = true;
      elements.panel.classList.add("bh-hidden");
      elements.miniIcon.style.display = "flex";
    },

    restore() {
      state.ui.isMinimized = false;
      elements.panel.classList.remove("bh-hidden");
      elements.miniIcon.style.display = "none";
    },

    /**
     * 激活状态变化时刷新面板上的激活按钮
     */
    refreshActivationUI() {
      if (!elements.activateBtn) return;
      if (state.activation.isActivated) {
        elements.activateBtn.disabled = true;
        elements.activateBtn.title = "已激活";
      } else {
        elements.activateBtn.disabled = false;
        elements.activateBtn.title = "激活";
      }
    },

    /**
     * 运行状态切换主按钮样式/文案
     */
    setRunning(isRunning, runningText, idleText) {
      const btn = elements.controlBtn;
      if (!btn) return;
      btn.textContent = isRunning ? runningText : idleText;
      btn.classList.toggle("bh-stop", isRunning);
    },
  };
})();
