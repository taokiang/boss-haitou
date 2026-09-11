/**
 * 04-dialogs.js
 * 设置弹窗（打招呼语 / 高级开关 / 图片简历 / 招聘者状态多选）、激活弹窗、付费墙
 */
(function () {
  "use strict";

  const { state, util } = BH;

  const RECRUITER_STATUS_OPTIONS = [
    "不限", "在线", "刚刚活跃", "今日活跃", "3日内活跃", "本周活跃", "本月活跃", "半年前活跃",
  ];
  const IMAGE_RESUME_LIMIT = 5;
  const SETTINGS_ICON = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M12 15.25A3.25 3.25 0 1 0 12 8.75a3.25 3.25 0 0 0 0 6.5Z"/>
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.86 2.86-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21H9.55v-.1A1.7 1.7 0 0 0 8.5 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.86-2.86.06-.06A1.7 1.7 0 0 0 4.1 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H2.3V9.55h.1A1.7 1.7 0 0 0 4.1 8.5a1.7 1.7 0 0 0-.34-1.88l-.06-.06L6.56 3.7l.06.06A1.7 1.7 0 0 0 8.5 4.1a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1v-.1h4.05v.1A1.7 1.7 0 0 0 15 4.1a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.86 2.86-.06.06A1.7 1.7 0 0 0 19.4 8.5c.15.46.5.82.96 1 .2.08.42.12.64.12h.1v4.05H21A1.7 1.7 0 0 0 19.4 15Z"/>
    </svg>`;
  const KEY_ICON = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <circle cx="8" cy="15" r="4"/><path d="m11 12 8-8"/><path d="m16 7 2 2"/><path d="m14 9 2 2"/>
    </svg>`;

  function injectDialogStyles() {
    if (document.getElementById("bh-dialog-styles")) return;
    const style = document.createElement("style");
    style.id = "bh-dialog-styles";
    style.textContent = `
      @keyframes bh-dialog-enter {
        from { opacity: 0; transform: translateY(12px) scale(.985); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }
      .bh-mask {
        --bh-green: #00b86b;
        --bh-green-dark: #009d5b;
        --bh-green-soft: #eaf9f1;
        --bh-navy: #173042;
        --bh-text: #243746;
        --bh-muted: #7c8c9d;
        --bh-line: #e5edf2;
        --bh-surface: #f6f9fb;
        position: fixed; inset: 0; padding: 24px;
        background: rgba(12, 27, 41, .56);
        -webkit-backdrop-filter: blur(3px); backdrop-filter: blur(3px);
        z-index: 2147483647; display: flex; align-items: center; justify-content: center;
        font-family: "SF Pro Text", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif;
      }
      .bh-dialog {
        position: relative; width: 500px; max-width: 100%; max-height: min(720px, 88vh);
        background: #fff; border: 1px solid rgba(255,255,255,.72); border-radius: 20px;
        display: flex; flex-direction: column; overflow: hidden;
        color: var(--bh-text); box-shadow: 0 28px 80px rgba(9,30,45,.28), 0 3px 12px rgba(9,30,45,.12);
        animation: bh-dialog-enter .22s cubic-bezier(.2,.8,.2,1) both;
      }
      .bh-dialog::before {
        content: ""; position: absolute; z-index: 2; inset: 0 0 auto; height: 3px;
        background: linear-gradient(90deg, var(--bh-green) 0 58%, #44d4a0 58% 78%, #bceedd 78% 100%);
      }
      .bh-dialog * { box-sizing: border-box; margin: 0; padding: 0; }
      .bh-dialog button, .bh-dialog input, .bh-dialog textarea { font: inherit; }
      .bh-dialog-header {
        display: flex; align-items: flex-start; justify-content: space-between; gap: 20px;
        padding: 24px 24px 17px; border-bottom: 1px solid var(--bh-line);
      }
      .bh-dialog-heading { display: flex; align-items: center; gap: 12px; min-width: 0; }
      .bh-dialog-heading-icon {
        width: 38px; height: 38px; flex: 0 0 38px; border-radius: 12px;
        display: grid; place-items: center; color: var(--bh-green-dark); background: var(--bh-green-soft);
        box-shadow: inset 0 0 0 1px rgba(0,184,107,.08);
      }
      .bh-dialog-heading-icon svg { width: 19px; height: 19px; display: block; }
      .bh-dialog-title { color: var(--bh-navy); font-size: 17px; line-height: 1.35; font-weight: 700; letter-spacing: -.01em; }
      .bh-dialog-subtitle { color: var(--bh-muted); font-size: 12px; line-height: 1.5; margin-top: 2px; }
      .bh-dialog-close {
        width: 32px; height: 32px; flex: 0 0 32px; display: grid; place-items: center;
        border: 0; border-radius: 10px; background: transparent; color: #91a0af;
        font-size: 20px; line-height: 1; cursor: pointer; transition: background .18s ease, color .18s ease, transform .18s ease;
      }
      .bh-dialog-close:hover { color: var(--bh-navy); background: var(--bh-surface); transform: rotate(4deg); }
      .bh-dialog-close:focus-visible, .bh-btn:focus-visible, .bh-tab:focus-visible,
      .bh-add-btn:focus-visible, .bh-greeting-del:focus-visible, .bh-img-del:focus-visible,
      .bh-multi-display:focus-visible, .bh-switch input:focus-visible + .bh-slider {
        outline: 3px solid rgba(0,184,107,.18); outline-offset: 2px;
      }
      .bh-tabs {
        display: flex; gap: 4px; padding: 6px; margin: 16px 24px 0;
        border: 1px solid var(--bh-line); border-radius: 12px; background: var(--bh-surface);
      }
      .bh-tab {
        flex: 1; min-height: 38px; padding: 8px 14px; border: 0; border-radius: 8px;
        text-align: center; font-size: 13px; color: #687b8d; background: transparent;
        cursor: pointer; transition: color .18s ease, background .18s ease, box-shadow .18s ease;
      }
      .bh-tab:hover { color: var(--bh-navy); }
      .bh-tab.bh-active { color: var(--bh-green-dark); background: #fff; font-weight: 650; box-shadow: 0 2px 8px rgba(20,48,66,.08); }
      .bh-dialog-body { padding: 18px 24px 22px; overflow-y: auto; overscroll-behavior: contain; flex: 1; }
      .bh-dialog-body::-webkit-scrollbar { width: 6px; }
      .bh-dialog-body::-webkit-scrollbar-thumb { background: #ced9e1; border-radius: 6px; }
      .bh-panel-intro {
        display: flex; align-items: flex-start; gap: 10px; padding: 11px 12px; margin-bottom: 14px;
        color: #607486; background: #f4f9f7; border: 1px solid #e0f1e9; border-radius: 12px;
        font-size: 12px; line-height: 1.65;
      }
      .bh-panel-intro-mark {
        width: 20px; height: 20px; flex: 0 0 20px; display: grid; place-items: center;
        color: var(--bh-green-dark); background: #dff5ea; border-radius: 50%; font-size: 12px; font-weight: 700;
      }
      .bh-dialog-footer {
        display: flex; justify-content: flex-end; gap: 10px;
        padding: 14px 24px 18px; border-top: 1px solid var(--bh-line); background: rgba(255,255,255,.97);
      }
      .bh-btn {
        min-height: 40px; padding: 9px 18px; border-radius: 10px; font-size: 13px; font-weight: 600;
        cursor: pointer; border: 1px solid transparent; transition: transform .16s ease, box-shadow .16s ease, background .16s ease;
      }
      .bh-btn:hover:not(:disabled) { transform: translateY(-1px); }
      .bh-btn-plain { background: var(--bh-surface); border-color: var(--bh-line); color: #536778; }
      .bh-btn-plain:hover { background: #edf3f6; }
      .bh-btn-primary { background: var(--bh-green); color: #fff; box-shadow: 0 6px 16px rgba(0,184,107,.2); }
      .bh-btn-primary:hover { background: var(--bh-green-dark); box-shadow: 0 8px 20px rgba(0,157,91,.24); }
      .bh-btn-primary:disabled { opacity: .52; cursor: not-allowed; box-shadow: none; }

      .bh-advanced-panel { display: grid; gap: 10px; }
      .bh-setting-item {
        display: flex; align-items: center; justify-content: space-between; gap: 18px;
        min-height: 62px; padding: 11px 13px; border: 1px solid var(--bh-line); border-radius: 12px;
        background: #fff; font-size: 13px; color: var(--bh-text); transition: border-color .18s ease, background .18s ease;
      }
      .bh-setting-item:hover { border-color: #d5e5dd; background: #fbfdfc; }
      .bh-setting-item small { display: block; color: #8a9aaa; font-size: 11px; line-height: 1.5; margin-top: 3px; }
      .bh-switch { position: relative; width: 42px; height: 24px; flex: 0 0 42px; }
      .bh-switch input { position: absolute; opacity: 0; width: 1px; height: 1px; }
      .bh-slider {
        position: absolute; inset: 0; border-radius: 24px; background: #d9e2e9;
        box-shadow: inset 0 0 0 1px rgba(74,94,112,.04); transition: .2s; cursor: pointer;
      }
      .bh-slider::before {
        content: ""; position: absolute; width: 18px; height: 18px; border-radius: 50%;
        left: 3px; top: 3px; background: #fff; box-shadow: 0 2px 5px rgba(26,47,62,.22); transition: .2s;
      }
      .bh-switch input:checked + .bh-slider { background: var(--bh-green); }
      .bh-switch input:checked + .bh-slider::before { transform: translateX(18px); }
      .bh-switch.bh-locked .bh-slider { opacity: .55; cursor: not-allowed; }

      .bh-greeting-item { display: grid; grid-template-columns: 28px minmax(0,1fr) 32px; gap: 9px; margin-bottom: 10px; align-items: start; }
      .bh-greeting-index {
        width: 28px; height: 28px; margin-top: 7px; display: grid; place-items: center;
        color: var(--bh-green-dark); background: var(--bh-green-soft); border-radius: 9px;
        font: 700 11px/1 "SFMono-Regular", Consolas, monospace;
      }
      .bh-greeting-item textarea {
        width: 100%; min-height: 68px; padding: 11px 12px; border: 1px solid #dbe5eb;
        border-radius: 11px; background: #fff; color: var(--bh-text); font-size: 13px; line-height: 1.55;
        resize: vertical; outline: none; transition: border-color .18s ease, box-shadow .18s ease;
      }
      .bh-greeting-item textarea:hover { border-color: #c9d8e0; }
      .bh-greeting-item textarea:focus { border-color: var(--bh-green); box-shadow: 0 0 0 3px rgba(0,184,107,.1); }
      .bh-greeting-item textarea.bh-locked {
        cursor: pointer; color: #7c8c9d; background: #f8fafb;
      }
      .bh-greeting-del {
        border: 0; background: transparent; color: #a0adba; border-radius: 9px;
        width: 32px; height: 32px; margin-top: 5px; cursor: pointer; flex-shrink: 0; font-size: 18px;
        transition: color .18s ease, background .18s ease;
      }
      .bh-greeting-del:hover { color: #d94e55; background: #fff0f1; }
      .bh-add-btn {
        width: 100%; min-height: 42px; padding: 9px 12px; border: 1px dashed #b9ccd7; border-radius: 11px;
        background: #f8fbfc; color: #607486; font-size: 12px; cursor: pointer;
        transition: border-color .18s ease, color .18s ease, background .18s ease;
      }
      .bh-add-btn:hover { border-color: var(--bh-green); color: var(--bh-green-dark); background: var(--bh-green-soft); }

      .bh-image-manager { padding: 2px 0 0; }
      .bh-img-item {
        display: flex; align-items: center; justify-content: space-between; gap: 12px;
        padding: 9px 12px; background: var(--bh-surface); border: 1px solid var(--bh-line); border-radius: 10px; margin-top: 8px;
        font-size: 12px; color: #536778;
      }
      .bh-img-item span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .bh-img-del { border: 0; background: transparent; color: #d94e55; cursor: pointer; font-size: 12px; }

      .bh-multi-select { position: relative; width: 220px; max-width: 52%; flex-shrink: 0; }
      .bh-multi-display {
        min-height: 36px; padding: 8px 30px 8px 11px; border: 1px solid #dbe5eb; border-radius: 9px;
        position: relative; font-size: 12px; cursor: pointer; background: #fff; color: #536778;
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      }
      .bh-multi-display::after { content: "⌄"; position: absolute; right: 10px; top: 7px; color: #91a0af; }
      .bh-multi-display.bh-locked { opacity: .58; cursor: not-allowed; }
      .bh-multi-options {
        position: absolute; right: 0; top: calc(100% + 7px); width: 180px; max-height: 238px; overflow-y: auto;
        background: #fff; border: 1px solid var(--bh-line); border-radius: 12px;
        box-shadow: 0 14px 34px rgba(15,39,54,.16); padding: 6px; display: none; z-index: 10;
      }
      .bh-multi-options.bh-open { display: block; }
      .bh-multi-option {
        display: flex; align-items: center; gap: 8px; padding: 8px;
        font-size: 12px; border-radius: 8px; cursor: pointer; color: #536778;
      }
      .bh-multi-option:hover { background: var(--bh-green-soft); color: var(--bh-green-dark); }
      .bh-multi-option input { accent-color: var(--bh-green); }

      .bh-activation-dialog { width: 430px; }
      .bh-activation-dialog .bh-dialog-body { padding-top: 20px; }
      .bh-activation-lead {
        display: flex; gap: 11px; align-items: flex-start; padding: 12px 13px; margin-bottom: 17px;
        background: #fff8eb; border: 1px solid #f7e4ba; border-radius: 12px; color: #775d2c;
        font-size: 12px; line-height: 1.55;
      }
      .bh-activation-lead strong { display: block; color: #5d4721; font-size: 13px; margin-bottom: 2px; }
      .bh-activation-lead-mark { color: #bd8121; font-size: 16px; line-height: 1.35; }
      .bh-field-label { display: block; color: var(--bh-navy); font-size: 12px; font-weight: 650; margin-bottom: 7px; }
      .bh-activate-input {
        width: 100%; height: 46px; padding: 11px 13px; border: 1px solid #dbe5eb; border-radius: 11px;
        background: #fbfcfd; color: var(--bh-navy); font-size: 13px; letter-spacing: .06em; outline: none;
        transition: border-color .18s ease, box-shadow .18s ease, background .18s ease;
      }
      .bh-activate-input::placeholder { color: #a4b0bb; letter-spacing: 0; }
      .bh-activate-input:focus { border-color: var(--bh-green); background: #fff; box-shadow: 0 0 0 3px rgba(0,184,107,.1); }
      .bh-activate-error { color: #d94e55; font-size: 12px; min-height: 20px; padding-top: 5px; }
      .bh-activation-submit { width: 100%; min-height: 44px; margin-top: 5px; }
      .bh-buy-tip { color: #8a9aaa; text-align: center; font-size: 11px; margin-top: 11px; }
      .bh-activate-ok { text-align: center; color: var(--bh-green-dark); font-size: 14px; padding: 12px 0 18px; }
      .bh-activate-ok-mark {
        width: 54px; height: 54px; display: grid; place-items: center; margin: 0 auto 12px;
        color: #fff; background: var(--bh-green); border-radius: 17px; font-size: 25px;
        box-shadow: 0 10px 24px rgba(0,184,107,.22);
      }
      .bh-activate-ok small { display: block; color: #8a9aaa; margin-top: 5px; }

      @media (max-width: 560px) {
        .bh-mask { padding: 12px; align-items: flex-end; }
        .bh-dialog { width: 100%; max-height: 90vh; border-radius: 18px 18px 14px 14px; }
        .bh-dialog-header { padding: 20px 18px 14px; }
        .bh-tabs { margin: 13px 18px 0; }
        .bh-dialog-body { padding: 16px 18px 18px; }
        .bh-dialog-footer { padding: 12px 18px 16px; }
        .bh-setting-item { align-items: flex-start; }
        .bh-multi-select { width: 150px; max-width: 50%; }
      }
      @media (prefers-reduced-motion: reduce) {
        .bh-dialog { animation: none; }
        .bh-dialog *, .bh-dialog *::before, .bh-dialog *::after { transition: none !important; }
      }
    `;
    document.head.appendChild(style);
  }

  /* ---------------- 通用小部件 ---------------- */

  /**
   * 开关（带付费墙）
   */
  function createToggle(label, desc, checked, onChange, requiresActivation = false) {
    const item = document.createElement("div");
    item.className = "bh-setting-item";

    const textBox = document.createElement("div");
    textBox.innerHTML = `${label}${desc ? `<small>${desc}</small>` : ""}`;

    const switchEl = document.createElement("label");
    switchEl.className = "bh-switch";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = checked;
    checkbox.setAttribute("aria-label", label);
    const slider = document.createElement("span");
    slider.className = "bh-slider";
    switchEl.append(checkbox, slider);

    const locked = requiresActivation && !state.activation.isActivated;
    if (locked) {
      switchEl.classList.add("bh-locked");
      checkbox.disabled = true;
      slider.title = "激活后可用";
      slider.addEventListener("click", () => BH.dialogs.openActivation());
    } else {
      checkbox.addEventListener("change", () => onChange(checkbox.checked));
    }

    item.append(textBox, switchEl);
    return item;
  }

  /**
   * 招聘者状态多选下拉
   */
  function createStatusMultiSelect(selected, onChange) {
    const wrap = document.createElement("div");
    wrap.className = "bh-multi-select";

    const display = document.createElement("div");
    display.className = "bh-multi-display";
    display.tabIndex = 0;
    display.setAttribute("role", "button");
    const renderDisplay = () => {
      display.textContent = selected.length ? selected.join("、") : "不限";
    };
    renderDisplay();

    const optionsBox = document.createElement("div");
    optionsBox.className = "bh-multi-options";

    const locked = !state.activation.isActivated;
    if (locked) {
      display.classList.add("bh-locked");
      display.title = "激活后可用";
      display.addEventListener("click", () => BH.dialogs.openActivation());
    } else {
      display.addEventListener("click", () => optionsBox.classList.toggle("bh-open"));
      display.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          optionsBox.classList.toggle("bh-open");
        }
      });
      document.addEventListener("click", (e) => {
        if (!wrap.contains(e.target)) optionsBox.classList.remove("bh-open");
      });
    }

    RECRUITER_STATUS_OPTIONS.forEach((option) => {
      const row = document.createElement("label");
      row.className = "bh-multi-option";
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = selected.includes(option);
      checkbox.addEventListener("change", () => {
        if (option === "不限" && checkbox.checked) {
          selected.length = 0;
          selected.push("不限");
        } else {
          const unlimitedIdx = selected.indexOf("不限");
          if (unlimitedIdx > -1) selected.splice(unlimitedIdx, 1);
          const idx = selected.indexOf(option);
          if (checkbox.checked && idx === -1) selected.push(option);
          if (!checkbox.checked && idx > -1) selected.splice(idx, 1);
          if (!selected.length) selected.push("不限");
        }
        optionsBox.querySelectorAll("input").forEach((input, i) => {
          input.checked = selected.includes(RECRUITER_STATUS_OPTIONS[i]);
        });
        renderDisplay();
        onChange([...selected]);
      });
      row.append(checkbox, document.createTextNode(option));
      optionsBox.appendChild(row);
    });

    wrap.append(display, optionsBox);
    return wrap;
  }

  /* ---------------- 设置弹窗 ---------------- */
  let settingsDialog = null;

  function openSettings() {
    injectDialogStyles();
    if (settingsDialog) return;

    // 草稿：编辑期间不污染 state.settings，保存时才写回
    const draft = JSON.parse(JSON.stringify(state.settings));
    if (!Array.isArray(draft.greetingsList) || !draft.greetingsList.some((text) => text && text.trim())) {
      draft.greetingsList = [BH.CONFIG.DEFAULT_GREETING];
    }

    const mask = document.createElement("div");
    mask.className = "bh-mask";

    const dialog = document.createElement("div");
    dialog.className = "bh-dialog bh-settings-dialog";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-labelledby", "bh-settings-title");

    // header
    const header = document.createElement("div");
    header.className = "bh-dialog-header";
    header.innerHTML = `
      <div class="bh-dialog-heading">
        <span class="bh-dialog-heading-icon">${SETTINGS_ICON}</span>
        <div>
          <div class="bh-dialog-title" id="bh-settings-title">投递设置</div>
          <div class="bh-dialog-subtitle">按你的求职偏好配置自动沟通</div>
        </div>
      </div>`;
    const closeBtn = document.createElement("button");
    closeBtn.className = "bh-dialog-close";
    closeBtn.textContent = "×";
    closeBtn.type = "button";
    closeBtn.setAttribute("aria-label", "关闭设置");
    closeBtn.addEventListener("click", close);
    header.appendChild(closeBtn);

    // tabs
    const tabs = document.createElement("div");
    tabs.className = "bh-tabs";
    const tabChat = document.createElement("button");
    tabChat.className = "bh-tab bh-active";
    tabChat.type = "button";
    tabChat.textContent = "聊天设置";
    const tabAdvanced = document.createElement("button");
    tabAdvanced.className = "bh-tab";
    tabAdvanced.type = "button";
    tabAdvanced.textContent = "高级设置";
    tabs.append(tabChat, tabAdvanced);

    // body
    const body = document.createElement("div");
    body.className = "bh-dialog-body bh-dialog-scroll";

    const chatPanel = buildChatPanel(draft);
    const advancedPanel = buildAdvancedPanel(draft);
    advancedPanel.style.display = "none";
    body.append(chatPanel, advancedPanel);

    tabChat.addEventListener("click", () => {
      tabChat.classList.add("bh-active");
      tabAdvanced.classList.remove("bh-active");
      chatPanel.style.display = "";
      advancedPanel.style.display = "none";
    });
    tabAdvanced.addEventListener("click", () => {
      tabAdvanced.classList.add("bh-active");
      tabChat.classList.remove("bh-active");
      advancedPanel.style.display = "";
      chatPanel.style.display = "none";
    });

    // footer
    const footer = document.createElement("div");
    footer.className = "bh-dialog-footer";
    const cancelBtn = document.createElement("button");
    cancelBtn.className = "bh-btn bh-btn-plain";
    cancelBtn.type = "button";
    cancelBtn.textContent = "取消";
    cancelBtn.addEventListener("click", close);
    const saveBtn = document.createElement("button");
    saveBtn.className = "bh-btn bh-btn-primary";
    saveBtn.type = "button";
    saveBtn.textContent = "保存设置";
    saveBtn.addEventListener("click", () => {
      const validGreetings = draft.greetingsList.filter((text) => text && text.trim());
      if (!validGreetings.length) {
        BH.notify("至少保留一条聊天文案");
        tabChat.click();
        return;
      }
      draft.greetingsList = validGreetings;
      Object.assign(state.settings, draft);
      BH.storage.saveSettings();
      BH.notify("设置已保存");
      close();
    });
    footer.append(cancelBtn, saveBtn);

    dialog.append(header, tabs, body, footer);
    mask.appendChild(dialog);
    mask.addEventListener("click", (e) => {
      if (e.target === mask) close();
    });
    document.body.appendChild(mask);
    settingsDialog = mask;
    closeBtn.focus();
    document.addEventListener("keydown", onKeydown);

    function onKeydown(e) {
      if (e.key === "Escape") close();
    }

    function close() {
      document.removeEventListener("keydown", onKeydown);
      mask.remove();
      settingsDialog = null;
    }
  }

  /* ----- 聊天设置 Tab：打招呼语列表 ----- */
  function buildChatPanel(draft) {
    const panel = document.createElement("div");
    const locked = !state.activation.isActivated;

    const requireActivation = () => {
      BH.notify("激活插件后可修改聊天文案");
      BH.dialogs.openActivation();
    };

    const tip = document.createElement("div");
    tip.className = "bh-panel-intro";
    tip.innerHTML = `<span class="bh-panel-intro-mark">i</span><span>把自我介绍拆成简短消息，系统会按下方顺序逐条发送，更方便招聘者阅读。</span>`;
    panel.appendChild(tip);

    const list = document.createElement("div");
    panel.appendChild(list);

    const renderList = () => {
      list.innerHTML = "";
      draft.greetingsList.forEach((text, idx) => {
        const row = document.createElement("div");
        row.className = "bh-greeting-item";

        const index = document.createElement("span");
        index.className = "bh-greeting-index";
        index.textContent = String(idx + 1).padStart(2, "0");

        const textarea = document.createElement("textarea");
        textarea.maxLength = 100;
        textarea.value = text;
        if (locked) {
          textarea.readOnly = true;
          textarea.classList.add("bh-locked");
          textarea.title = "激活插件后可修改";
          textarea.addEventListener("click", requireActivation);
        }
        textarea.addEventListener("input", () => {
          draft.greetingsList[idx] = textarea.value;
        });
        textarea.addEventListener("blur", () => {
          if (!textarea.value.trim()) {
            if (draft.greetingsList.length === 1) {
              draft.greetingsList[0] = BH.CONFIG.DEFAULT_GREETING;
              BH.notify("至少保留一条聊天文案");
            } else {
              draft.greetingsList.splice(idx, 1);
            }
            renderList();
          }
        });

        const del = document.createElement("button");
        del.className = "bh-greeting-del";
        del.type = "button";
        del.textContent = "×";
        del.title = "删除";
        del.addEventListener("click", () => {
          if (locked) {
            requireActivation();
            return;
          }
          if (draft.greetingsList.length === 1) {
            BH.notify("至少保留一条聊天文案");
            return;
          }
          draft.greetingsList.splice(idx, 1);
          renderList();
        });

        row.append(index, textarea, del);
        list.appendChild(row);
      });
    };
    renderList();

    const addBtn = document.createElement("button");
    addBtn.className = "bh-add-btn";
    addBtn.type = "button";
    addBtn.textContent = "＋ 添加一条介绍";
    addBtn.addEventListener("click", () => {
      if (locked) {
        requireActivation();
        return;
      }
      if (draft.greetingsList.length >= 10) {
        BH.notify("最多 10 条打招呼语");
        return;
      }
      draft.greetingsList.push("");
      renderList();
      const textareas = list.querySelectorAll("textarea");
      textareas[textareas.length - 1]?.focus();
    });
    panel.appendChild(addBtn);

    return panel;
  }

  /* ----- 高级设置 Tab ----- */
  function buildAdvancedPanel(draft) {
    const panel = document.createElement("div");
    panel.className = "bh-advanced-panel";

    // 1. 招聘者状态多选（付费）
    const statusItem = document.createElement("div");
    statusItem.className = "bh-setting-item";
    const statusLabel = document.createElement("div");
    statusLabel.innerHTML = `投递招聘者状态<small>仅向指定活跃状态的招聘者投递</small>`;
    statusItem.append(
      statusLabel,
      createStatusMultiSelect(draft.recruiterActivityStatus, (v) => (draft.recruiterActivityStatus = v))
    );
    panel.appendChild(statusItem);

    // 2. 自动发送附件简历（付费）
    panel.appendChild(
      createToggle("自动发送附件简历", "打招呼后自动发送在线附件简历", draft.useAutoSendResume, (v) => (draft.useAutoSendResume = v), true)
    );

    // 3. 投递完成继续搜索（付费）
    panel.appendChild(
      createToggle("投递完成继续搜索", "当前列表投完后自动换关键词继续", draft.continueSearch, (v) => (draft.continueSearch = v), true)
    );

    // 4. 排除猎头（付费）
    panel.appendChild(
      createToggle("投递时排除猎头", "跳过猎头发布的职位", draft.excludeHeadhunters, (v) => (draft.excludeHeadhunters = v), true)
    );

    // 5. 发送图片简历
    const imageToggle = createToggle("发送图片简历", "在聊天中发送本地图片简历", draft.useAutoSendImageResume, (v) => {
      if (v && !draft.imageResumes.length) {
        BH.notify("请先添加图片简历");
        return;
      }
      draft.useAutoSendImageResume = v;
    });
    panel.appendChild(imageToggle);

    // 图片简历管理
    const imgManager = document.createElement("div");
    imgManager.className = "bh-image-manager";

    const renderImgList = () => {
      imgManager.querySelectorAll(".bh-img-item").forEach((n) => n.remove());
      draft.imageResumes.forEach((img, idx) => {
        const row = document.createElement("div");
        row.className = "bh-img-item";
        const name = document.createElement("span");
        name.textContent = img.path;
        const del = document.createElement("button");
        del.className = "bh-img-del";
        del.type = "button";
        del.textContent = "删除";
        del.addEventListener("click", async () => {
          await BH.imageStore.remove(img.id).catch(() => {});
          draft.imageResumes.splice(idx, 1);
          // 图片简历删除立即落库（与草稿其余部分解耦，避免取消后数据残留）
          state.settings.imageResumes = [...draft.imageResumes];
          BH.storage.saveSettings();
          renderImgList();
        });
        row.append(name, del);
        imgManager.appendChild(row);
      });
    };
    renderImgList();

    const addImgBtn = document.createElement("button");
    addImgBtn.className = "bh-add-btn";
    addImgBtn.type = "button";
    addImgBtn.textContent = "＋ 添加图片简历 · JPG";
    addImgBtn.addEventListener("click", () => {
      if (draft.imageResumes.length >= IMAGE_RESUME_LIMIT) {
        BH.notify(`最多添加 ${IMAGE_RESUME_LIMIT} 个图片简历`);
        return;
      }
      const fileInput = document.createElement("input");
      fileInput.type = "file";
      fileInput.accept = ".jpg,.jpeg,image/jpeg";
      fileInput.addEventListener("change", async () => {
        const file = fileInput.files[0];
        if (!file) return;
        if (!/\.jpe?g$/i.test(file.name)) {
          BH.notify("仅支持 JPG 格式");
          return;
        }
        if (draft.imageResumes.some((img) => img.path === file.name)) {
          BH.notify("同名文件已存在");
          return;
        }
        const id = `resume_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        try {
          await BH.imageStore.save(id, file);
          draft.imageResumes.push({ id, path: file.name });
          state.settings.imageResumes = [...draft.imageResumes];
          BH.storage.saveSettings();
          renderImgList();
          BH.notify("图片简历已添加");
        } catch (e) {
          BH.notify("图片保存失败");
          console.error("[BOSS海投] 图片保存失败:", e);
        }
      });
      fileInput.click();
    });
    imgManager.appendChild(addImgBtn);
    panel.appendChild(imgManager);

    return panel;
  }

  /* ---------------- 激活弹窗 ---------------- */
  let activationDialog = null;

  function openActivation() {
    injectDialogStyles();
    if (activationDialog) return;

    const mask = document.createElement("div");
    mask.className = "bh-mask";
    const dialog = document.createElement("div");
    dialog.className = "bh-dialog bh-activation-dialog";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-labelledby", "bh-activation-title");

    const header = document.createElement("div");
    header.className = "bh-dialog-header";
    header.innerHTML = `
      <div class="bh-dialog-heading">
        <span class="bh-dialog-heading-icon">${KEY_ICON}</span>
        <div>
          <div class="bh-dialog-title" id="bh-activation-title">激活 BOSS 海投</div>
          <div class="bh-dialog-subtitle">解锁更完整的自动投递能力</div>
        </div>
      </div>`;
    const closeBtn = document.createElement("button");
    closeBtn.className = "bh-dialog-close";
    closeBtn.textContent = "×";
    closeBtn.type = "button";
    closeBtn.setAttribute("aria-label", "关闭激活弹窗");
    closeBtn.addEventListener("click", close);
    header.appendChild(closeBtn);

    const body = document.createElement("div");
    body.className = "bh-dialog-body";

    if (state.activation.isActivated) {
      const ok = document.createElement("div");
      ok.className = "bh-activate-ok";
      const key = state.activation.cardKey || "";
      const masked = key.length > 6 ? `${key.slice(0, 3)}***${key.slice(-3)}` : "***";
      ok.innerHTML = `<span class="bh-activate-ok-mark">✓</span><strong>插件已激活</strong><small>卡密：${masked}</small>`;
      body.appendChild(ok);
    } else {
      // 未激活：弹窗的同时打开购卡链接
      window.open("https://68n.cn/NH67b", "_blank");

      const tip = document.createElement("div");
      tip.className = "bh-activation-lead";
      tip.innerHTML = `<span class="bh-activation-lead-mark">✦</span><span><strong>高级能力已为你准备好</strong>激活后即可使用自动发送简历、连续搜索和精准筛选等功能。</span>`;
      body.appendChild(tip);

      const label = document.createElement("label");
      label.className = "bh-field-label";
      label.htmlFor = "bh-activation-key";
      label.textContent = "激活卡密";
      body.appendChild(label);

      const input = document.createElement("input");
      input.className = "bh-activate-input";
      input.id = "bh-activation-key";
      input.placeholder = "请输入 32 位激活卡密";
      input.maxLength = 32;
      body.appendChild(input);

      const error = document.createElement("div");
      error.className = "bh-activate-error";
      body.appendChild(error);

      const activateBtn = document.createElement("button");
      activateBtn.className = "bh-btn bh-btn-primary bh-activation-submit";
      activateBtn.type = "button";
      activateBtn.textContent = "立即激活";
      activateBtn.addEventListener("click", () => {
        const cardKey = input.value.trim();
        error.textContent = "";
        activateBtn.disabled = true;
        activateBtn.textContent = "验证中…";
        chrome.runtime.sendMessage({ type: "verify_card_key", card_key: cardKey }, (resp) => {
          activateBtn.disabled = false;
          activateBtn.textContent = "立即激活";
          if (chrome.runtime.lastError) {
            error.textContent = chrome.runtime.lastError.message;
            return;
          }
          if (resp && resp.success) {
            alert("激活成功！");
            location.reload();
          } else {
            error.textContent = (resp && resp.message) || "激活失败，请重试";
          }
        });
      });
      body.appendChild(activateBtn);

      const buyTip = document.createElement("p");
      buyTip.className = "bh-buy-tip";
      buyTip.textContent = "购买页面已在新标签页打开";
      body.appendChild(buyTip);
    }

    dialog.append(header, body);
    mask.appendChild(dialog);
    mask.addEventListener("click", (e) => {
      if (e.target === mask) close();
    });
    document.body.appendChild(mask);
    activationDialog = mask;
    (body.querySelector("input") || closeBtn).focus();
    document.addEventListener("keydown", onKeydown);

    function onKeydown(e) {
      if (e.key === "Escape") close();
    }

    function close() {
      document.removeEventListener("keydown", onKeydown);
      mask.remove();
      activationDialog = null;
    }
  }

  /* ---------------- 激活状态管理 ---------------- */
  BH.activation = {
    async load() {
      return new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: "get_activate_info" }, (resp) => {
          if (!chrome.runtime.lastError && resp) {
            state.activation.isActivated = !!resp.active_status;
            state.activation.cardKey = resp.card_key || null;
          }
          resolve(state.activation);
        });
      });
    },
  };

  BH.dialogs = { openSettings, openActivation };
})();
