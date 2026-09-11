const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

function createStorageModule({ useWebLocks = true } = {}) {
  const values = new Map();
  const localStorage = {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    },
  };

  const lockTails = new Map();
  const locks = {
    request(name, _options, callback) {
      const previous = lockTails.get(name) || Promise.resolve();
      const current = previous.then(callback, callback);
      lockTails.set(name, current.catch(() => {}));
      return current;
    },
  };

  const config = {
    STORAGE_KEYS: {
      PROCESSED_JOBS: "jobs",
      SENT_GREETINGS_HRS: "greetings",
      SENT_RESUME_HRS: "resumes",
      SENT_IMAGE_RESUME_HRS: "images",
    },
    STORAGE_LIMITS: {
      PROCESSED_JOBS: 10,
      SENT_GREETINGS_HRS: 10,
      SENT_RESUME_HRS: 10,
      SENT_IMAGE_RESUME_HRS: 10,
    },
  };
  const state = {
    hrInteractions: {
      sentGreetingsHRs: new Set(),
      sentResumeHRs: new Set(),
      sentImageResumeHRs: new Set(),
    },
    jobInteractions: { processedJobs: new Set() },
    settings: {},
  };
  const BH = {
    CONFIG: config,
    state,
    util: {
      delay: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
      getStoredJSON(key, fallback) {
        const value = localStorage.getItem(key);
        return value ? JSON.parse(value) : fallback;
      },
    },
  };

  const context = {
    BH,
    console,
    localStorage,
    navigator: useWebLocks ? { locks } : {},
    setTimeout,
  };
  const source = fs.readFileSync(
    path.join(__dirname, "../extension/content/01-storage.js"),
    "utf8"
  );
  vm.runInNewContext(source, context);
  return { storage: BH.storage, localStorage };
}

test("追加记录时合并持久化数据，不覆盖其他标签页记录", () => {
  const { storage, localStorage } = createStorageModule();
  localStorage.setItem("jobs", JSON.stringify(["job-a"]));
  const staleSet = new Set(["job-b"]);

  assert.equal(storage.addRecordWithLimit(staleSet, "jobs", 10, "job-c"), true);
  assert.deepEqual(JSON.parse(localStorage.getItem("jobs")), ["job-a", "job-b", "job-c"]);
});

test("同名跨标签页锁会串行执行检查与发送", async () => {
  const { storage } = createStorageModule();
  let active = 0;
  let maxActive = 0;
  const run = () =>
    storage.withCrossTabLock("chat-send", async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 15));
      active -= 1;
    });

  await Promise.all([run(), run(), run()]);
  assert.equal(maxActive, 1);
});

test("旧 Chrome 的 localStorage 租约兜底也会阻止并发", async () => {
  const { storage } = createStorageModule({ useWebLocks: false });
  let active = 0;
  let maxActive = 0;
  const run = () =>
    storage.withCrossTabLock("job-processing", async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 10));
      active -= 1;
    });

  await Promise.all([run(), run()]);
  assert.equal(maxActive, 1);
});
