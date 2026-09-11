const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

function createSharedEnvironment() {
  const records = new Map();
  const lockTails = new Map();
  let sendCount = 0;

  function createTab() {
    const state = {
      isRunning: true,
      settings: {
        greetingsList: ["你好，我对这个职位很有兴趣"],
        clickDelay: 0,
        useAutoSendResume: false,
        useAutoSendImageResume: false,
        imageResumes: [],
      },
      hrInteractions: {
        sentGreetingsHRs: new Set(),
        sentResumeHRs: new Set(),
        sentImageResumeHRs: new Set(),
      },
    };
    const keys = {
      SENT_GREETINGS_HRS: "greetings",
      SENT_RESUME_HRS: "resumes",
      SENT_IMAGE_RESUME_HRS: "images",
    };
    const input = {
      textContent: "",
      focus() {},
      dispatchEvent() {},
    };
    const messageList = {
      textContent: "",
      querySelectorAll() {
        return [];
      },
    };
    const document = {
      execCommand() {},
      querySelector(selector) {
        if (selector === ".chat-message .im-list") return messageList;
        if (selector === "#chat-input") return input;
        if (selector === ".btn-send") return { click: () => (sendCount += 1) };
        return null;
      },
      querySelectorAll() {
        return [];
      },
    };
    const storage = {
      syncRecordSet(set, key) {
        set.clear();
        (records.get(key) || []).forEach((item) => set.add(item));
      },
      addRecordWithLimit(set, key, _limit, value) {
        const merged = new Set(records.get(key) || []);
        set.forEach((item) => merged.add(item));
        merged.add(value);
        records.set(key, Array.from(merged));
        set.clear();
        merged.forEach((item) => set.add(item));
        return true;
      },
      removeRecord(set, key, value) {
        const current = new Set(records.get(key) || []);
        current.delete(value);
        records.set(key, Array.from(current));
        set.clear();
        current.forEach((item) => set.add(item));
        return true;
      },
      withCrossTabLock(name, callback) {
        const previous = lockTails.get(name) || Promise.resolve();
        const current = previous.then(callback, callback);
        lockTails.set(name, current.catch(() => {}));
        return current;
      },
    };
    const BH = {
      state,
      CONFIG: {
        STORAGE_KEYS: keys,
        STORAGE_LIMITS: {
          SENT_GREETINGS_HRS: 100,
          SENT_RESUME_HRS: 100,
          SENT_IMAGE_RESUME_HRS: 100,
        },
        DELAYS: { MEDIUM_SHORT: 0 },
        OPERATION_INTERVAL: 0,
      },
      util: {
        delay: async () => {},
        smartDelay: async () => {},
        waitForElement: async (selector) => document.querySelector(selector),
        safeClick: (element) => (element.click(), true),
        extractTwoCharKeywords: () => [],
      },
      storage,
      imageStore: {},
      core: { getPositionName: () => "" },
      log() {},
    };
    const context = {
      BH,
      document,
      console,
      KeyboardEvent: class {},
      setTimeout,
    };
    const source = fs.readFileSync(
      path.join(__dirname, "../extension/content/05-chat.js"),
      "utf8"
    );
    vm.runInNewContext(source, context);
    return BH;
  }

  return { createTab, records, getSendCount: () => sendCount };
}

test("两个聊天标签页同时处理同一岗位时只发送一次", async () => {
  const env = createSharedEnvironment();
  const firstTab = env.createTab();
  const secondTab = env.createTab();

  await Promise.all([
    firstTab.storage.withCrossTabLock("chat-send", () =>
      firstTab.chat.handleHRInteraction("conversation:123", "张三-某公司")
    ),
    secondTab.storage.withCrossTabLock("chat-send", () =>
      secondTab.chat.handleHRInteraction("conversation:123", "张三-某公司")
    ),
  ]);

  assert.equal(env.getSendCount(), 1);
  assert.deepEqual(env.records.get("greetings"), ["conversation:123"]);
});

test("旧版姓名-公司记录可阻止升级后重新发送", async () => {
  const env = createSharedEnvironment();
  env.records.set("greetings", ["张三-某公司"]);
  const tab = env.createTab();

  await tab.chat.handleHRInteraction("conversation:456", "张三-某公司");

  assert.equal(env.getSendCount(), 0);
});
