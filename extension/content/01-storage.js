/**
 * 01-storage.js
 * localStorage 封装、去重集合管理（FIFO 容量上限）、设置持久化
 */
(function () {
  "use strict";

  const { CONFIG, state } = BH;

  BH.storage = {
    /**
     * 安全写 localStorage，超限时清空去重集合后重试
     */
    setItem(key, value) {
      try {
        localStorage.setItem(key, value);
      } catch (e) {
        if (e && e.name === "QuotaExceededError") {
          console.warn("[BOSS海投] localStorage 已满，清空去重集合后重试");
          Object.values(CONFIG.STORAGE_KEYS).forEach((k) => localStorage.removeItem(k));
          try {
            localStorage.setItem(key, value);
          } catch (retryError) {
            console.error("[BOSS海投] 重试写入仍失败:", retryError);
          }
        } else {
          console.error("[BOSS海投] 写入 localStorage 失败:", e);
        }
      }
    },

    /**
     * 向去重集合追加记录（带 FIFO 容量上限）
     * @param {Set} set 内存中的 Set
     * @param {string} storageKey 对应 localStorage key
     * @param {number} limit 容量上限
     * @param {string} record 记录值（hrKey）
     */
    addRecordWithLimit(set, storageKey, limit, record) {
      if (set.has(record)) return;
      let arr = Array.from(set);
      if (arr.length >= limit) {
        arr = arr.slice(arr.length - limit + 1);
      }
      arr.push(record);
      set.clear();
      arr.forEach((item) => set.add(item));
      this.setItem(storageKey, JSON.stringify(arr));
    },

    /**
     * 加载时裁剪超限集合，保持容量健康
     */
    ensureLimits() {
      const trim = (set, storageKey, limit) => {
        const arr = Array.from(set);
        if (arr.length > limit) {
          const trimmed = arr.slice(arr.length - limit);
          set.clear();
          trimmed.forEach((item) => set.add(item));
          this.setItem(storageKey, JSON.stringify(trimmed));
        }
      };
      trim(state.hrInteractions.sentGreetingsHRs, CONFIG.STORAGE_KEYS.SENT_GREETINGS_HRS, CONFIG.STORAGE_LIMITS.SENT_GREETINGS_HRS);
      trim(state.hrInteractions.sentResumeHRs, CONFIG.STORAGE_KEYS.SENT_RESUME_HRS, CONFIG.STORAGE_LIMITS.SENT_RESUME_HRS);
      trim(state.hrInteractions.sentImageResumeHRs, CONFIG.STORAGE_KEYS.SENT_IMAGE_RESUME_HRS, CONFIG.STORAGE_LIMITS.SENT_IMAGE_RESUME_HRS);
    },

    /**
     * 持久化用户设置（单一数据源 state.settings）
     */
    saveSettings() {
      const s = state.settings;
      this.setItem("bh_useAutoSendResume", JSON.stringify(s.useAutoSendResume));
      this.setItem("bh_useAutoSendImageResume", JSON.stringify(s.useAutoSendImageResume));
      this.setItem("bh_excludeHeadhunters", JSON.stringify(s.excludeHeadhunters));
      this.setItem("bh_continueSearch", JSON.stringify(s.continueSearch));
      this.setItem("bh_recruiterActivityStatus", JSON.stringify(s.recruiterActivityStatus));
      this.setItem("bh_clickDelay", String(s.clickDelay));
      this.setItem("bh_greetingsList", JSON.stringify(s.greetingsList));
      this.setItem("bh_imageResumes", JSON.stringify(s.imageResumes));
    },
  };
})();
