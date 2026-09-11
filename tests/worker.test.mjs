import assert from "node:assert/strict";
import test from "node:test";
import worker from "../worker/src/index.mjs";

class MemoryKV {
  constructor() {
    this.values = new Map();
  }

  async get(key, type) {
    const value = this.values.get(key);
    if (value === undefined) return null;
    return type === "json" ? JSON.parse(value) : value;
  }

  async put(key, value) {
    this.values.set(key, String(value));
  }

  async list({ prefix = "" } = {}) {
    return {
      keys: Array.from(this.values.keys())
        .filter((key) => key.startsWith(prefix))
        .map((name) => ({ name })),
      list_complete: true,
    };
  }
}

function request(path, { method = "GET", token, body, contentType = "application/json" } = {}) {
  const headers = {};
  if (token) headers.authorization = `Bearer ${token}`;
  if (body !== undefined) headers["content-type"] = contentType;
  return new Request(`https://example.workers.dev${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function payload(response) {
  return response.json();
}

function environment() {
  return { CARD_KEYS: new MemoryKV(), ADMIN_TOKEN: "test-admin-token" };
}

test("健康检查与 CORS 预检", async () => {
  const env = environment();
  const health = await worker.fetch(request("/api/health"), env);
  assert.equal(health.status, 200);
  assert.deepEqual(await payload(health), { code: 200, message: "ok" });

  const preflight = await worker.fetch(request("/api/public/card-keys/verify", { method: "OPTIONS" }), env);
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get("access-control-allow-origin"), "*");
});

test("管理接口拒绝未授权请求和非法数量", async () => {
  const env = environment();
  const unauthorized = await worker.fetch(
    request("/api/admin/card-keys", { method: "POST", body: { count: 1 } }),
    env
  );
  assert.equal(unauthorized.status, 401);

  const invalid = await worker.fetch(
    request("/api/admin/card-keys", { method: "POST", token: "test-admin-token", body: { count: 101 } }),
    env
  );
  assert.equal(invalid.status, 400);
});

test("生成、验证、列出和禁用卡密且 KV 不保存明文", async () => {
  const env = environment();
  const createdResponse = await worker.fetch(
    request("/api/admin/card-keys", {
      method: "POST",
      token: "test-admin-token",
      body: { count: 2, note: "审核" },
    }),
    env
  );
  const created = await payload(createdResponse);
  assert.equal(created.data.length, 2);
  assert.match(created.data[0], /^[A-Za-z0-9]{32}$/);
  assert.equal(new Set(created.data).size, 2);
  const stored = Array.from(env.CARD_KEYS.values.values()).join("\n");
  assert.equal(stored.includes(created.data[0]), false);

  const valid = await worker.fetch(
    request("/api/public/card-keys/verify", { method: "POST", body: { key: created.data[0] } }),
    env
  );
  assert.deepEqual(await payload(valid), { code: 200, message: "success" });

  const listing = await worker.fetch(
    request("/api/admin/card-keys", { token: "test-admin-token" }),
    env
  );
  const listed = await payload(listing);
  assert.equal(listed.data.length, 2);
  assert.equal(JSON.stringify(listed).includes(created.data[0]), false);

  const disabled = await worker.fetch(
    request("/api/admin/card-keys/disable", {
      method: "POST",
      token: "test-admin-token",
      body: { key: created.data[0] },
    }),
    env
  );
  assert.equal(disabled.status, 200);
  const rejected = await worker.fetch(
    request("/api/public/card-keys/verify", { method: "POST", body: { key: created.data[0] } }),
    env
  );
  assert.deepEqual(await payload(rejected), { code: 400, message: "激活卡密无效" });
});

test("验证接口拒绝错误 JSON、Content-Type 和卡密格式", async () => {
  const env = environment();
  const wrongType = await worker.fetch(
    request("/api/public/card-keys/verify", {
      method: "POST",
      contentType: "text/plain",
      body: { key: "bad" },
    }),
    env
  );
  assert.equal(wrongType.status, 415);

  const malformed = new Request("https://example.workers.dev/api/public/card-keys/verify", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{",
  });
  assert.equal((await worker.fetch(malformed, env)).status, 400);

  const invalidKey = await worker.fetch(
    request("/api/public/card-keys/verify", { method: "POST", body: { key: "too-short" } }),
    env
  );
  assert.equal(invalidKey.status, 400);
});

test("并发生成的卡密保持唯一", async () => {
  const env = environment();
  const responses = await Promise.all(
    Array.from({ length: 5 }, () =>
      worker.fetch(
        request("/api/admin/card-keys", {
          method: "POST",
          token: "test-admin-token",
          body: { count: 10, note: "并发测试" },
        }),
        env
      )
    )
  );
  const keys = (await Promise.all(responses.map(payload))).flatMap((result) => result.data);
  assert.equal(keys.length, 50);
  assert.equal(new Set(keys).size, 50);
  assert.equal(env.CARD_KEYS.values.size, 50);
});
