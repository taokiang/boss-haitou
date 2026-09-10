/**
 * 03-ui.js
 * 悬浮控制面板：全部使用内联样式（避免被 zhipin 页面全局 CSS 干扰）
 * 布局：白色头部(logo+标题+圆形图标按钮) / 浅灰控制卡片(并排带label输入框+主按钮) / 日志区 / footer / 迷你球
 */
(function () {
  "use strict";

  const { state, elements } = BH;

  const COLORS = {
    primary: "#07c160",
    primaryRgb: "7, 193, 96",
    secondary: "#f8fafc",
    accent: "#d9f2e3",
    neutral: "#64748b",
    titleDark: "#2c3e50",
    border: "#d1d5db",
  };

  const LOGO_SVG = `
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"
         style="width: 60%; height: 60%; fill: white;">
      <path d="M2.5 21.5l19-9.5-19-9.5v7.4l13.6 2.1-13.6 2.1v7.4z"/>
    </svg>`;

  const KEY_SVG = `
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor"
         stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block;">
      <circle cx="7.5" cy="15.5" r="4.5"/><path d="M11 12l9-9"/><path d="M16 4l3 3"/><path d="M13 7l3 3"/>
    </svg>`;

  function injectScrollbarStyles() {
    if (document.getElementById("bh-scrollbar-styles")) return;
    const style = document.createElement("style");
    style.id = "bh-scrollbar-styles";
    style.textContent = `
      #bh-panel::-webkit-scrollbar, #bh-panel *::-webkit-scrollbar,
      #bh-log::-webkit-scrollbar, #bh-log *::-webkit-scrollbar {
        width: 6px !important; height: 6px !important;
      }
      #bh-panel::-webkit-scrollbar-thumb, #bh-panel *::-webkit-scrollbar-thumb,
      #bh-log::-webkit-scrollbar-thumb, #bh-log *::-webkit-scrollbar-thumb {
        background: rgba(0,0,0,.15) !important; border-radius: 3px !important;
      }
      #bh-panel::-webkit-scrollbar-track, #bh-panel *::-webkit-scrollbar-track,
      #bh-log::-webkit-scrollbar-track, #bh-log *::-webkit-scrollbar-track {
        background: transparent !important;
      }
      @keyframes bh-guide-bounce {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-6px); }
      }
    `;
    document.head.appendChild(style);
  }

  /* ---------------- 聊天页引导（红色小手指向"消息"） ---------------- */
  let guideEl = null;

  function findMessageNavTarget() {
    const candidates = new Set();
    // href 指向聊天页的链接
    document
      .querySelectorAll('a[href*="/web/geek/chat"]')
      .forEach((el) => candidates.add(el));
    // 文本恰为"消息"的叶子元素
    document.querySelectorAll("a, li, span, div, i").forEach((el) => {
      if (el.childElementCount === 0 && el.textContent.trim() === "消息") {
        candidates.add(el);
      }
    });
    // 只保留顶部导航带（视口顶部 90px 内）中可见的候选
    const inNav = Array.from(candidates).filter((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && r.top >= 0 && r.bottom <= 90;
    });
    if (!inNav.length) return null;
    // 取最靠右的（"消息"位于右上角用户区）
    inNav.sort((a, b) => {
      const ra = a.getBoundingClientRect();
      const rb = b.getBoundingClientRect();
      return rb.left - ra.left || ra.top - rb.top;
    });
    return inNav[0];
  }

  function onGuideStorage(e) {
    // 聊天页心跳：用户打开消息页后自动关闭引导
    if (e.key === "bh_chat_ready" && e.newValue) {
      BH.ui.hideChatGuide();
    }
  }

  function showChatGuide() {
    BH.ui.hideChatGuide();
    injectScrollbarStyles();
    // 清除旧标记，等待聊天页心跳
    localStorage.removeItem("bh_chat_ready");

    const target = findMessageNavTarget();
    const rect = target ? target.getBoundingClientRect() : null;

    guideEl = document.createElement("div");
    guideEl.id = "bh-chat-guide";
    guideEl.title = "点击关闭提示";
    const centerX = rect ? rect.left + rect.width / 2 : window.innerWidth - 200;
    const topY = rect ? rect.bottom + 6 : 56;
    // 外层负责定位（translateX(-50%) 居中），内层负责跳动动画
    // —— 动画关键帧会覆盖 transform，两者不能放同一元素
    guideEl.style.cssText = `
      position: fixed; left: ${Math.round(centerX)}px; top: ${Math.round(topY)}px;
      transform: translateX(-50%); z-index: 2147483647; cursor: pointer;
      filter: drop-shadow(0 4px 10px rgba(239, 68, 68, .35));
    `;
    guideEl.innerHTML = `
      <div style="
        display:flex;flex-direction:column;align-items:center;gap:2px;
        animation: bh-guide-bounce 1s ease-in-out infinite;
      ">
        <svg viewBox="0 0 24 24" width="30" height="30" style="display:block;">
          <path d="M12 1 L4 11 H9 V21 H15 V11 H20 Z" fill="#ef4444" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/>
        </svg>
        <div style="
          background:#fff;border:2px solid #ef4444;border-radius:10px;
          padding:7px 14px;font-size:13px;font-weight:600;color:#ef4444;
          white-space:nowrap;font-family:'Segoe UI',system-ui,'PingFang SC','Microsoft YaHei',sans-serif;
        ">右键-&gt;在新标签页打开链接-&gt;即可开聊</div>
      </div>
    `;
    guideEl.addEventListener("click", () => BH.ui.hideChatGuide());
    document.body.appendChild(guideEl);
    window.addEventListener("storage", onGuideStorage);
  }

  function hideChatGuide() {
    if (guideEl) {
      guideEl.remove();
      guideEl = null;
    }
    window.removeEventListener("storage", onGuideStorage);
  }

  /* ---------------- 头部 ---------------- */
  function createTitle(pageType) {
    const title = document.createElement("div");
    title.style.cssText = "display:flex;align-items:center;gap:10px;";

    const main =
      pageType === "chat"
        ? `<span style="color:${COLORS.primary};">BOSS</span>聊天`
        : `<span style="color:${COLORS.primary};">BOSS</span>海投`;
    const sub = pageType === "chat" ? "智能沟通，精准应答" : "高效求职，智能投递";

    title.innerHTML = `
      <div style="
          width:40px;height:40px;background:${COLORS.primary};border-radius:10px;
          display:flex;justify-content:center;align-items:center;
          box-shadow:0 2px 8px rgba(${COLORS.primaryRgb},.3);
      ">${LOGO_SVG}</div>
      <div>
        <h3 style="margin:0;color:${COLORS.titleDark};font-weight:600;font-size:1.2rem;">${main}</h3>
        <span style="font-size:.8em;color:${COLORS.neutral};">${sub}</span>
      </div>
    `;
    return title;
  }

  function createIconButton(iconHtml, title, onClick) {
    const btn = document.createElement("button");
    btn.title = title;
    btn.style.cssText = `
      width:32px;height:32px;border-radius:50%;border:none;background:${COLORS.accent};
      cursor:pointer;font-size:16px;transition:all .2s ease;
      display:flex;justify-content:center;align-items:center;color:${COLORS.primary};
      padding:0;line-height:1;
    `;
    if (iconHtml.includes("<svg")) {
      btn.innerHTML = iconHtml;
    } else {
      btn.textContent = iconHtml;
    }
    btn.addEventListener("mouseenter", () => {
      if (btn.disabled) return;
      btn.style.background = COLORS.primary;
      btn.style.color = "#fff";
    });
    btn.addEventListener("mouseleave", () => {
      if (btn.disabled) return;
      btn.style.background = COLORS.accent;
      btn.style.color = COLORS.primary;
    });
    btn.addEventListener("click", () => {
      if (!btn.disabled) onClick();
    });
    return btn;
  }

  function createHeader(pageType) {
    const header = document.createElement("div");
    header.className = "bh-panel-header";
    header.style.cssText = `
      display:flex;justify-content:space-between;align-items:center;
      padding:0 10px 15px;margin-bottom:15px;cursor:move;
      border-bottom:1px solid ${COLORS.accent};
    `;

    const btnBox = document.createElement("div");
    btnBox.style.cssText = "display:flex;gap:8px;";

    elements.activateBtn = createIconButton(
      KEY_SVG,
      state.activation.isActivated ? "插件已激活" : "激活插件",
      () => BH.dialogs.openActivation()
    );

    const settingsBtn = createIconButton("⚙", "插件设置", () => BH.dialogs.openSettings());
    const closeBtn = createIconButton("✕", "最小化面板", () => BH.ui.minimize());

    btnBox.append(elements.activateBtn, settingsBtn, closeBtn);
    header.append(createTitle(pageType), btnBox);
    return header;
  }

  /* ---------------- 控制区 ---------------- */
  function createInputControl(labelText, id, placeholder) {
    const col = document.createElement("div");
    col.style.cssText = "flex:1;min-width:0;";

    const label = document.createElement("label");
    label.textContent = labelText;
    label.style.cssText =
      "display:block;margin-bottom:5px;font-weight:500;color:#333;font-size:.9rem;";

    const input = document.createElement("input");
    input.id = id;
    input.placeholder = placeholder;
    input.style.cssText = `
      width:100%;padding:8px 10px;border-radius:8px;border:1px solid ${COLORS.border};
      font-size:14px;box-shadow:0 1px 2px rgba(0,0,0,.05);transition:all .2s ease;
      box-sizing:border-box;margin:0;background:#fff;color:#333;text-align:left;outline:none;
    `;
    input.addEventListener("focus", () => (input.style.borderColor = COLORS.primary));
    input.addEventListener("blur", () => (input.style.borderColor = COLORS.border));

    col.append(label, input);
    return col;
  }

  function createMainButton(text, onClick) {
    const btn = document.createElement("button");
    btn.textContent = text;
    btn.style.cssText = `
      width:100%;padding:11px 16px;background:${COLORS.primary};color:#fff;border:none;
      border-radius:10px;cursor:pointer;font-size:14px;font-weight:500;
      transition:all .2s ease;display:flex;justify-content:center;align-items:center;
      box-shadow:0 2px 8px rgba(0,0,0,.08);margin:0 auto;box-sizing:border-box;
    `;
    btn.addEventListener("mouseenter", () => {
      btn.style.boxShadow = `0 6px 15px rgba(${COLORS.primaryRgb},.3)`;
    });
    btn.addEventListener("mouseleave", () => {
      btn.style.boxShadow = "0 2px 8px rgba(0,0,0,.08)";
    });
    btn.addEventListener("click", onClick);
    return btn;
  }

  function createControls(pageType) {
    const container = document.createElement("div");
    container.style.cssText = `
      background:${COLORS.secondary};border-radius:12px;padding:14px;
      margin:0 8px 12px;box-sizing:border-box;
    `;

    if (pageType === "chat") {
      const row = document.createElement("div");
      row.style.cssText = "display:flex;gap:10px;margin-bottom:12px;";
      const col = createInputControl(
        "沟通岗位包含：",
        "bh-communication-include",
        "技术，产品，设计"
      );
      row.appendChild(col);
      elements.communicationIncludeInput = col.querySelector("input");
      elements.communicationIncludeInput.value = state.communicationIncludeKeywords.join("，");
      elements.controlBtn = createMainButton("开始聊天", () => BH.core.toggleChatProcess());
      container.append(row, elements.controlBtn);
      return container;
    }

    const filterRow = document.createElement("div");
    filterRow.style.cssText = "display:flex;gap:10px;margin-bottom:10px;";

    const includeCol = createInputControl("职位名包含：", "bh-include-filter", "前端，开发");
    const cityCol = createInputControl("城市包含：", "bh-city-filter", "上海，西安");
    filterRow.append(includeCol, cityCol);
    elements.includeInput = includeCol.querySelector("input");
    elements.cityInput = cityCol.querySelector("input");
    elements.includeInput.value = state.includeKeywords.join("，");
    elements.cityInput.value = state.cityKeywords.join("，");

    elements.controlBtn = createMainButton("启动海投", () => BH.core.toggleProcess());
    container.append(filterRow, elements.controlBtn);
    return container;
  }

  /* ---------------- 日志区 / footer ---------------- */
  function createLogger() {
    const log = document.createElement("div");
    log.id = "bh-log";
    log.style.cssText = `
      height:260px;overflow-y:auto;background:${COLORS.secondary};border-radius:12px;
      padding:12px;font-size:13px;line-height:1.5;margin:0 10px 15px;
      transition:all .3s ease;user-select:text;box-sizing:border-box;color:#334155;
    `;
    elements.log = log;
    return log;
  }

  function createFooter() {
    const footer = document.createElement("div");
    footer.style.cssText = `
      text-align:center;font-size:.8em;color:${COLORS.neutral};
      padding-top:12px;border-top:1px solid ${COLORS.accent};margin-top:auto;
      box-sizing:border-box;
    `;
    footer.textContent = `© ${new Date().getFullYear()} BOSS海投 · All Rights Reserved`;
    return footer;
  }

  /* ---------------- 拖拽 ---------------- */
  function makeDraggable(panel) {
    const header = panel.querySelector(".bh-panel-header");
    if (!header) return;

    let isDragging = false;
    let startX = 0, startY = 0, initialX = 0, initialY = 0;

    header.addEventListener("mousedown", (e) => {
      if (e.target.closest("button")) return;
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      initialX = panel.offsetLeft;
      initialY = panel.offsetTop;
      panel.style.transition = "none";
      panel.style.zIndex = "2147483647";
      e.preventDefault();
    });

    document.addEventListener("mousemove", (e) => {
      if (!isDragging) return;
      panel.style.left = `${initialX + e.clientX - startX}px`;
      panel.style.top = `${initialY + e.clientY - startY}px`;
      panel.style.right = "auto";
    });

    document.addEventListener("mouseup", () => {
      if (isDragging) {
        isDragging = false;
        panel.style.transition = "all .3s ease";
      }
    });
  }

  /* ---------------- 迷你球 ---------------- */
  function createMiniIcon() {
    if (document.getElementById("bh-mini")) return;
    const mini = document.createElement("div");
    mini.id = "bh-mini";
    mini.title = "BOSS海投";
    mini.style.cssText = `
      width:48px;height:48px;cursor:pointer;display:none;position:fixed;
      right:30px;bottom:150px;z-index:2147483647;
      background:${COLORS.primary};border-radius:50%;
      box-shadow:0 4px 12px rgba(${COLORS.primaryRgb},.4);
      justify-content:center;align-items:center;transition:all .3s ease;
      box-sizing:border-box;
    `;
    mini.innerHTML = LOGO_SVG;
    mini.addEventListener("mouseenter", () => {
      mini.style.boxShadow = `0 6px 16px rgba(${COLORS.primaryRgb},.5)`;
    });
    mini.addEventListener("mouseleave", () => {
      mini.style.boxShadow = `0 4px 12px rgba(${COLORS.primaryRgb},.4)`;
    });
    mini.addEventListener("click", () => BH.ui.restore());
    document.body.appendChild(mini);
    elements.miniIcon = mini;
  }

  /* ---------------- 对外接口 ---------------- */
  BH.ui = {
    init() {
      // 聊天页不展示面板（自动开聊，无需界面）
      if (location.pathname.includes("/chat")) {
        document.getElementById("bh-panel")?.remove();
        document.getElementById("bh-mini")?.remove();
        return;
      }

      const pageType = "job-list";
      injectScrollbarStyles();

      const old = document.getElementById("bh-panel");
      if (old) old.remove();

      const panel = document.createElement("div");
      panel.id = "bh-panel";
      panel.style.cssText = `
        position:fixed;top:64px;right:20px;width:clamp(300px,80vw,380px);
        border-radius:16px;padding:14px;
        font-family:'Segoe UI',system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;
        z-index:2147483646;display:flex;flex-direction:column;transition:all .3s ease;
        background:#fff;box-shadow:0 8px 24px rgba(${COLORS.primaryRgb},.12);
        border:1px solid ${COLORS.accent};cursor:default;box-sizing:border-box;
      `;

      const header = createHeader(pageType);
      panel.append(header, createControls(pageType), createLogger(), createFooter());
      document.body.appendChild(panel);
      elements.panel = panel;

      makeDraggable(panel);
      createMiniIcon();
      this.refreshActivationUI();
    },

    minimize() {
      state.ui.isMinimized = true;
      elements.panel.style.transform = "translateY(160%)";
      elements.miniIcon.style.display = "flex";
    },

    restore() {
      state.ui.isMinimized = false;
      elements.panel.style.transform = "translateY(0)";
      elements.miniIcon.style.display = "none";
    },

    refreshActivationUI() {
      const btn = elements.activateBtn;
      if (!btn) return;
      if (state.activation.isActivated) {
        btn.disabled = true;
        btn.title = "插件已激活";
        btn.style.opacity = "0.5";
        btn.style.cursor = "not-allowed";
      } else {
        btn.disabled = false;
        btn.title = "激活插件";
        btn.style.opacity = "1";
        btn.style.cursor = "pointer";
      }
    },

    setRunning(isRunning, runningText, idleText) {
      const btn = elements.controlBtn;
      if (!btn) return;
      btn.textContent = isRunning ? runningText : idleText;
    },

    showChatGuide,
    hideChatGuide,
  };
})();
