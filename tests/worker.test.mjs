import assert from "node:assert/strict";
import test from "node:test";
import worker from "../worker/src/index.mjs";
import {
  createCloudflareStore,
  createEdgeOneStore,
  handleCardRequest,
} from "../service/card-service.mjs";

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

test("一卡只能绑定一个设备，同一设备可重复验证", async () => {
  const kv = new MemoryKV();
  const store = createCloudflareStore(kv);
  const options = { store, adminToken: "test-admin-token" };
  const created = await payload(await handleCardRequest(
    request("/api/admin/card-keys", {
      method: "POST", token: "test-admin-token", body: { count: 1, note: "单设备" },
    }),
    options
  ));
  const key = created.data[0];
  const deviceA = "11111111-1111-4111-8111-111111111111";
  const deviceB = "22222222-2222-4222-8222-222222222222";

  const first = await handleCardRequest(request("/api/public/card-keys/verify", {
    method: "POST", body: { key, deviceId: deviceA },
  }), options);
  assert.equal(first.status, 200);
  assert.equal((await payload(first)).code, 200);

  const repeated = await handleCardRequest(request("/api/public/card-keys/verify", {
    method: "POST", body: { key, deviceId: deviceA },
  }), options);
  assert.equal((await payload(repeated)).code, 200);

  const other = await handleCardRequest(request("/api/public/card-keys/verify", {
    method: "POST", body: { key, deviceId: deviceB },
  }), options);
  assert.equal(other.status, 409);
  assert.equal((await payload(other)).message, "该卡密已在其他设备激活");
});

test("导入接口幂等且不在 KV 保存明文", async () => {
  const kv = new MemoryKV();
  const options = { store: createCloudflareStore(kv), adminToken: "test-admin-token" };
  const key = "Z".repeat(32);
  const body = { cards: [{ key, note: "迁移", createdAt: "2026-09-11T00:00:00.000Z" }] };
  const first = await payload(await handleCardRequest(request("/api/admin/card-keys/import", {
    method: "POST", token: "test-admin-token", body,
  }), options));
  assert.deepEqual(first.data, { imported: 1, existing: 0 });
  const second = await payload(await handleCardRequest(request("/api/admin/card-keys/import", {
    method: "POST", token: "test-admin-token", body,
  }), options));
  assert.deepEqual(second.data, { imported: 0, existing: 1 });
  assert.equal(Array.from(kv.values.values()).join("\n").includes(key), false);
});

test("EdgeOne KV 适配器使用不含冒号的键名并兼容分页格式", async () => {
  class EdgeOneMemoryKV extends MemoryKV {
    async get(key, options) {
      assert.doesNotMatch(key, /:/);
      const value = this.values.get(key);
      if (value === undefined) return null;
      return options?.type === "json" ? JSON.parse(value) : value;
    }

    async put(key, value) {
      assert.match(key, /^card_[0-9a-f]{64}$/);
      this.values.set(key, String(value));
    }

    async list({ prefix = "" } = {}) {
      return {
        keys: Array.from(this.values.keys()).filter((key) => key.startsWith(prefix)).map((key) => ({ key })),
        complete: true,
        cursor: null,
      };
    }
  }

  const kv = new EdgeOneMemoryKV();
  const options = { store: createEdgeOneStore(kv), adminToken: "test-admin-token" };
  const key = "Y".repeat(32);
  const imported = await handleCardRequest(request("/api/admin/card-keys/import", {
    method: "POST", token: "test-admin-token", body: { cards: [{ key, note: "EdgeOne" }] },
  }), options);
  assert.equal(imported.status, 200);
  const listing = await payload(await handleCardRequest(
    request("/api/admin/card-keys", { token: "test-admin-token" }), options
  ));
  assert.equal(listing.data.length, 1);
  assert.equal(listing.data[0].note, "EdgeOne");
});

test("未绑定 KV 时健康检查可用，卡密接口返回 503", async () => {
  const options = { store: null, adminToken: "test-admin-token" };
  const health = await handleCardRequest(request("/api/health"), options);
  assert.equal(health.status, 200);
  assert.equal((await payload(health)).message, "ok");

  const verify = await handleCardRequest(request("/api/public/card-keys/verify", {
    method: "POST",
    body: { key: "A".repeat(32), deviceId: "11111111-1111-4111-8111-111111111111" },
  }), options);
  assert.equal(verify.status, 503);
  assert.equal((await payload(verify)).message, "存储服务尚未配置");
});
