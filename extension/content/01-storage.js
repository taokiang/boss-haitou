/**
 * 01-storage.js
 * localStorage 封装、去重集合管理（FIFO 容量上限）、设置持久化
 */
(function () {
  "use strict";

  const { CONFIG, state } = BH;

  BH.storage = {
    /**
     * 安全写 localStorage；失败时保留已有去重数据，并把结果返回给调用方。
     */
    setItem(key, value) {
      try {
        localStorage.setItem(key, value);
        return true;
      } catch (e) {
        if (e && e.name === "QuotaExceededError") {
          // 去重记录不能因其他数据占满空间而整体丢失，否则会重新发送。
          console.error("[BOSS海投] localStorage 已满，数据未写入；现有去重记录已保留");
        } else {
          console.error("[BOSS海投] 写入 localStorage 失败:", e);
        }
        return false;
      }
    },

    loadRecordSet(storageKey) {
      const records = BH.util.getStoredJSON(storageKey, []);
      return new Set(Array.isArray(records) ? records : []);
    },

    syncRecordSet(set, storageKey) {
      set.clear();
      this.loadRecordSet(storageKey).forEach((item) => set.add(item));
      return set;
    },

    /**
     * 向去重集合追加记录（带 FIFO 容量上限）
     * @param {Set} set 内存中的 Set
     * @param {string} storageKey 对应 localStorage key
     * @param {number} limit 容量上限
     * @param {string} record 记录值（hrKey）
     */
    addRecordWithLimit(set, storageKey, limit, record) {
      // 写入前合并最新持久化值，避免不同标签页用旧内存快照覆盖彼此记录。
      const merged = this.loadRecordSet(storageKey);
      set.forEach((item) => merged.add(item));
      if (merged.has(record)) {
        set.clear();
        merged.forEach((item) => set.add(item));
        return true;
      }
      let arr = Array.from(merged);
      if (arr.length >= limit) {
        arr = arr.slice(arr.length - limit + 1);
      }
      arr.push(record);
      set.clear();
      arr.forEach((item) => set.add(item));
      return this.setItem(storageKey, JSON.stringify(arr));
    },

    removeRecord(set, storageKey, record) {
      const current = this.loadRecordSet(storageKey);
      current.delete(record);
      set.clear();
      current.forEach((item) => set.add(item));
      return this.setItem(storageKey, JSON.stringify(Array.from(current)));
    },

    /**
     * 同源标签页互斥。Chrome 优先使用 Web Locks；旧环境用带令牌的短租约兜底。
     */
    async withCrossTabLock(name, callback) {
      const lockName = `boss-haitou:${name}`;
      if (navigator.locks && navigator.locks.request) {
        return navigator.locks.request(lockName, { mode: "exclusive" }, callback);
      }

      const leaseKey = `bh_lock_${name}`;
      const token = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const leaseMs = 120000;
      while (true) {
        const now = Date.now();
        let lease = null;
        try {
          lease = JSON.parse(localStorage.getItem(leaseKey) || "null");
        } catch (_) {}
        if (!lease || lease.expiresAt <= now) {
          localStorage.setItem(leaseKey, JSON.stringify({ token, expiresAt: now + leaseMs }));
          await BH.util.delay(60 + Math.floor(Math.random() * 80));
          try {
            const confirmed = JSON.parse(localStorage.getItem(leaseKey) || "null");
            if (confirmed && confirmed.token === token) break;
          } catch (_) {}
        }
        await BH.util.delay(150);
      }
      try {
        return await callback();
      } finally {
        try {
          const lease = JSON.parse(localStorage.getItem(leaseKey) || "null");
          if (lease && lease.token === token) localStorage.removeItem(leaseKey);
        } catch (_) {}
      }
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
      trim(state.jobInteractions.processedJobs, CONFIG.STORAGE_KEYS.PROCESSED_JOBS, CONFIG.STORAGE_LIMITS.PROCESSED_JOBS);
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
