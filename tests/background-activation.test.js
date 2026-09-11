const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

function loadBackground(fetchImpl) {
  let messageListener;
  const values = {};
  const chrome = {
    storage: {
      local: {
        async set(next) {
          Object.assign(values, next);
        },
        async get(keys) {
          return Object.fromEntries(keys.map((key) => [key, values[key]]));
        },
      },
    },
    runtime: {
      onStartup: { addListener() {} },
      onInstalled: { addListener() {} },
      onMessage: {
        addListener(listener) {
          messageListener = listener;
        },
      },
    },
  };
  const source = fs.readFileSync(path.join(__dirname, "../extension/background.js"), "utf8");
  vm.runInNewContext(source, { chrome, console, fetch: fetchImpl, JSON });
  return { messageListener, values };
}

function send(listener, request) {
  return new Promise((resolve) => listener(request, {}, resolve));
}

test("激活请求使用生产 HTTPS 地址和 POST JSON，成功后保存在本地", async () => {
  let captured;
  const { messageListener, values } = loadBackground(async (url, options) => {
    captured = { url, options };
    return { status: 200, text: async () => JSON.stringify({ code: 200, message: "success" }) };
  });
  const key = "A".repeat(32);
  const result = await send(messageListener, { type: "verify_card_key", card_key: key });

  assert.equal(result.success, true);
  assert.equal(captured.url, "https://boss-haitou-api.qiujiangtao1990.workers.dev/api/public/card-keys/verify");
  assert.equal(captured.options.method, "POST");
  assert.equal(captured.options.headers["Content-Type"], "application/json");
  assert.equal(JSON.parse(captured.options.body).key, key);
  assert.equal(values.active_status, true);
  assert.equal(values.card_key, key);
});

test("错误卡密和网络失败不会写入激活状态", async () => {
  const invalid = loadBackground(async () => ({
    status: 200,
    text: async () => JSON.stringify({ code: 400, message: "激活卡密无效" }),
  }));
  const invalidResult = await send(invalid.messageListener, {
    type: "verify_card_key",
    card_key: "B".repeat(32),
  });
  assert.equal(invalidResult.success, false);
  assert.equal(invalidResult.message, "激活卡密无效");
  assert.equal(invalid.values.active_status, undefined);

  const offline = loadBackground(async () => {
    throw new Error("offline");
  });
  const result = await send(offline.messageListener, {
    type: "verify_card_key",
    card_key: "C".repeat(32),
  });
  assert.match(result.message, /网络请求失败/);
  assert.equal(offline.values.active_status, undefined);
});
