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

  function injectDialogStyles() {
    if (document.getElementById("bh-dialog-styles")) return;
    const style = document.createElement("style");
    style.id = "bh-dialog-styles";
    style.textContent = `
      .bh-mask {
        position: fixed; inset: 0; background: rgba(15,23,42,.45);
        z-index: 2147483647; display: flex; align-items: center; justify-content: center;
        font-family: -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif;
      }
      .bh-dialog {
        width: 460px; max-height: 82vh; background: #fff; border-radius: 16px;
        display: flex; flex-direction: column; overflow: hidden;
        box-shadow: 0 20px 60px rgba(15,23,42,.3);
      }
      .bh-dialog * { box-sizing: border-box; margin: 0; padding: 0; }
      .bh-dialog-header {
        display: flex; align-items: center; justify-content: space-between;
        padding: 14px 18px; border-bottom: 1px solid #e2e8f0; font-size: 15px; font-weight: 600;
      }
      .bh-dialog-close { border: none; background: none; font-size: 20px; color: #94a3b8; cursor: pointer; }
      .bh-tabs { display: flex; border-bottom: 1px solid #e2e8f0; }
      .bh-tab {
        flex: 1; padding: 10px; text-align: center; font-size: 13px; color: #64748b;
        cursor: pointer; border-bottom: 2px solid transparent;
      }
      .bh-tab.bh-active { color: #2563eb; border-bottom-color: #2563eb; font-weight: 600; }
      .bh-dialog-body { padding: 16px 18px; overflow-y: auto; flex: 1; }
      .bh-dialog-footer {
        display: flex; justify-content: flex-end; gap: 10px;
        padding: 12px 18px; border-top: 1px solid #e2e8f0;
      }
      .bh-btn {
        padding: 8px 18px; border-radius: 8px; font-size: 13px; cursor: pointer; border: none;
      }
      .bh-btn-plain { background: #f1f5f9; color: #334155; }
      .bh-btn-primary { background: #2563eb; color: #fff; }
      .bh-btn-primary:disabled { opacity: .5; cursor: not-allowed; }

      .bh-setting-item {
        display: flex; align-items: center; justify-content: space-between;
        padding: 12px 0; border-bottom: 1px solid #f1f5f9; font-size: 13px; color: #1e293b;
      }
      .bh-setting-item small { display: block; color: #94a3b8; font-size: 11px; margin-top: 2px; }
      .bh-switch { position: relative; width: 40px; height: 22px; flex-shrink: 0; }
      .bh-switch input { opacity: 0; width: 0; height: 0; }
      .bh-slider {
        position: absolute; inset: 0; border-radius: 22px; background: #cbd5e1;
        transition: .2s; cursor: pointer;
      }
      .bh-slider::before {
        content: ""; position: absolute; width: 16px; height: 16px; border-radius: 50%;
        left: 3px; top: 3px; background: #fff; transition: .2s;
      }
      .bh-switch input:checked + .bh-slider { background: #2563eb; }
      .bh-switch input:checked + .bh-slider::before { transform: translateX(18px); }
      .bh-switch.bh-locked .bh-slider { opacity: .5; cursor: not-allowed; }

      .bh-greeting-item { display: flex; gap: 8px; margin-bottom: 10px; align-items: flex-start; }
      .bh-greeting-item textarea {
        flex: 1; min-height: 56px; padding: 8px 10px; border: 1px solid #e2e8f0;
        border-radius: 8px; font-size: 12px; resize: vertical; outline: none;
      }
      .bh-greeting-item textarea:focus { border-color: #2563eb; }
      .bh-greeting-del {
        border: none; background: #fee2e2; color: #ef4444; border-radius: 6px;
        width: 26px; height: 26px; cursor: pointer; flex-shrink: 0;
      }
      .bh-add-btn {
        width: 100%; padding: 9px; border: 1px dashed #cbd5e1; border-radius: 8px;
        background: #f8fafc; color: #64748b; font-size: 12px; cursor: pointer;
      }
      .bh-add-btn:hover { border-color: #2563eb; color: #2563eb; }

      .bh-img-item {
        display: flex; align-items: center; justify-content: space-between;
        padding: 8px 10px; background: #f8fafc; border-radius: 8px; margin-top: 8px;
        font-size: 12px; color: #334155;
      }
      .bh-img-del { border: none; background: none; color: #ef4444; cursor: pointer; font-size: 12px; }

      .bh-multi-select { position: relative; width: 220px; flex-shrink: 0; }
      .bh-multi-display {
        padding: 7px 10px; border: 1px solid #e2e8f0; border-radius: 8px;
        font-size: 12px; cursor: pointer; background: #fff;
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      }
      .bh-multi-display.bh-locked { opacity: .5; cursor: not-allowed; }
      .bh-multi-options {
        position: absolute; right: 0; top: calc(100% + 4px); width: 160px;
        background: #fff; border: 1px solid #e2e8f0; border-radius: 10px;
        box-shadow: 0 8px 24px rgba(15,23,42,.15); padding: 6px; display: none; z-index: 10;
      }
      .bh-multi-options.bh-open { display: block; }
      .bh-multi-option {
        display: flex; align-items: center; gap: 6px; padding: 7px 8px;
        font-size: 12px; border-radius: 6px; cursor: pointer; color: #334155;
      }
      .bh-multi-option:hover { background: #f1f5f9; }

      .bh-activate-input {
        width: 100%; padding: 10px 12px; border: 1px solid #e2e8f0; border-radius: 10px;
        font-size: 13px; letter-spacing: 1px; outline: none; margin: 12px 0 8px;
      }
      .bh-activate-input:focus { border-color: #2563eb; }
      .bh-activate-error { color: #ef4444; font-size: 12px; min-height: 16px; }
      .bh-activate-ok {
        text-align: center; color: #16a34a; font-size: 14px; padding: 20px 0 10px;
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

    const mask = document.createElement("div");
    mask.className = "bh-mask";

    const dialog = document.createElement("div");
    dialog.className = "bh-dialog";

    // header
    const header = document.createElement("div");
    header.className = "bh-dialog-header";
    header.innerHTML = `<span>设置</span>`;
    const closeBtn = document.createElement("button");
    closeBtn.className = "bh-dialog-close";
    closeBtn.textContent = "×";
    closeBtn.addEventListener("click", close);
    header.appendChild(closeBtn);

    // tabs
    const tabs = document.createElement("div");
    tabs.className = "bh-tabs";
    const tabChat = document.createElement("div");
    tabChat.className = "bh-tab bh-active";
    tabChat.textContent = "聊天设置";
    const tabAdvanced = document.createElement("div");
    tabAdvanced.className = "bh-tab";
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
    cancelBtn.textContent = "取消";
    cancelBtn.addEventListener("click", close);
    const saveBtn = document.createElement("button");
    saveBtn.className = "bh-btn bh-btn-primary";
    saveBtn.textContent = "保存设置";
    saveBtn.addEventListener("click", () => {
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

    function close() {
      mask.remove();
      settingsDialog = null;
    }
  }

  /* ----- 聊天设置 Tab：打招呼语列表 ----- */
  function buildChatPanel(draft) {
    const panel = document.createElement("div");

    const tip = document.createElement("p");
    tip.style.cssText = "font-size:12px;color:#94a3b8;margin-bottom:12px;";
    tip.textContent = "建议拆分多条发送，HR 不看小作文。逐条按顺序发送。";
    panel.appendChild(tip);

    const list = document.createElement("div");
    panel.appendChild(list);

    const renderList = () => {
      list.innerHTML = "";
      draft.greetingsList.forEach((text, idx) => {
        const row = document.createElement("div");
        row.className = "bh-greeting-item";

        const textarea = document.createElement("textarea");
        textarea.maxLength = 100;
        textarea.value = text;
        textarea.addEventListener("input", () => {
          draft.greetingsList[idx] = textarea.value;
        });
        textarea.addEventListener("blur", () => {
          if (!textarea.value.trim()) {
            draft.greetingsList.splice(idx, 1);
            renderList();
          }
        });

        const del = document.createElement("button");
        del.className = "bh-greeting-del";
        del.textContent = "×";
        del.title = "删除";
        del.addEventListener("click", () => {
          draft.greetingsList.splice(idx, 1);
          renderList();
        });

        row.append(textarea, del);
        list.appendChild(row);
      });
    };
    renderList();

    const addBtn = document.createElement("button");
    addBtn.className = "bh-add-btn";
    addBtn.textContent = "+ 添加自我介绍";
    addBtn.addEventListener("click", () => {
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

    // 1. 自动发送附件简历（付费）
    panel.appendChild(
      createToggle("自动发送附件简历", "打招呼后自动发送在线附件简历", draft.useAutoSendResume, (v) => (draft.useAutoSendResume = v), true)
    );

    // 2. 投递完成继续搜索（付费）
    panel.appendChild(
      createToggle("投递完成继续搜索", "当前列表投完后自动换关键词继续", draft.continueSearch, (v) => (draft.continueSearch = v), true)
    );

    // 3. 排除猎头（付费）
    panel.appendChild(
      createToggle("投递时排除猎头", "跳过猎头发布的职位", draft.excludeHeadhunters, (v) => (draft.excludeHeadhunters = v), true)
    );

    // 4. 发送图片简历
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
    imgManager.style.padding = "4px 0 8px";

    const renderImgList = () => {
      imgManager.querySelectorAll(".bh-img-item").forEach((n) => n.remove());
      draft.imageResumes.forEach((img, idx) => {
        const row = document.createElement("div");
        row.className = "bh-img-item";
        const name = document.createElement("span");
        name.textContent = img.path;
        const del = document.createElement("button");
        del.className = "bh-img-del";
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
    addImgBtn.style.marginTop = "8px";
    addImgBtn.textContent = "+ 添加图片简历（JPG）";
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

    // 5. 招聘者状态多选（付费）
    const statusItem = document.createElement("div");
    statusItem.className = "bh-setting-item";
    const statusLabel = document.createElement("div");
    statusLabel.innerHTML = `投递招聘者状态<small>仅向指定活跃状态的招聘者投递</small>`;
    statusItem.append(
      statusLabel,
      createStatusMultiSelect(draft.recruiterActivityStatus, (v) => (draft.recruiterActivityStatus = v))
    );
    panel.appendChild(statusItem);

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
    dialog.className = "bh-dialog";
    dialog.style.width = "380px";

    const header = document.createElement("div");
    header.className = "bh-dialog-header";
    header.innerHTML = `<span>激活插件</span>`;
    const closeBtn = document.createElement("button");
    closeBtn.className = "bh-dialog-close";
    closeBtn.textContent = "×";
    closeBtn.addEventListener("click", close);
    header.appendChild(closeBtn);

    const body = document.createElement("div");
    body.className = "bh-dialog-body";

    if (state.activation.isActivated) {
      const ok = document.createElement("div");
      ok.className = "bh-activate-ok";
      const key = state.activation.cardKey || "";
      const masked = key.length > 6 ? `${key.slice(0, 3)}***${key.slice(-3)}` : "***";
      ok.innerHTML = `✓ 插件已激活<br><small style="color:#94a3b8">卡密：${masked}</small>`;
      body.appendChild(ok);
    } else {
      const tip = document.createElement("p");
      tip.style.cssText = "font-size:13px;color:#475569;";
      tip.textContent = "请输入 32 位激活卡密：";
      body.appendChild(tip);

      const input = document.createElement("input");
      input.className = "bh-activate-input";
      input.placeholder = "XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX";
      input.maxLength = 32;
      body.appendChild(input);

      const error = document.createElement("div");
      error.className = "bh-activate-error";
      body.appendChild(error);

      const activateBtn = document.createElement("button");
      activateBtn.className = "bh-btn bh-btn-primary";
      activateBtn.style.cssText = "width:100%;padding:10px;margin-top:6px;";
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
    }

    dialog.append(header, body);
    mask.appendChild(dialog);
    mask.addEventListener("click", (e) => {
      if (e.target === mask) close();
    });
    document.body.appendChild(mask);
    activationDialog = mask;

    function close() {
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
