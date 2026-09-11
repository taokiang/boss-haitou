const KEY_PATTERN = /^[A-Za-z0-9]{32}$/;
const DEVICE_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HASH_PATTERN = /^[0-9a-f]{64}$/;
const MAX_CREATE_COUNT = 100;
const MAX_NOTE_LENGTH = 200;
const CONTACT_EMAIL = "qiujiangtao1990@gmail.com";

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type, authorization",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
};

function json(status, payload) {
  return new Response(status === 204 ? null : JSON.stringify(payload), { status, headers: JSON_HEADERS });
}

function html(status, body) {
  return new Response(body, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=3600",
      "x-content-type-options": "nosniff",
      "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'",
    },
  });
}

async function readJson(request) {
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("application/json")) {
    throw new RequestError(415, "请求必须使用 application/json");
  }
  try {
    return await request.json();
  } catch {
    throw new RequestError(400, "JSON 请求体格式错误");
  }
}

class RequestError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export async function sha256(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function generateKey() {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  while (result.length < 32) {
    const bytes = new Uint8Array(48);
    crypto.getRandomValues(bytes);
    for (const byte of bytes) {
      if (byte >= 248) continue;
      result += alphabet[byte % alphabet.length];
      if (result.length === 32) break;
    }
  }
  return result;
}

function requireAdmin(request, adminToken) {
  if (!adminToken) throw new RequestError(503, "管理服务尚未配置");
  if (request.headers.get("authorization") !== `Bearer ${adminToken}`) {
    throw new RequestError(401, "未授权");
  }
}

async function verifyCard(request, store, { allowLegacyDevice }) {
  const body = await readJson(request);
  const key = typeof body.key === "string" ? body.key.trim() : "";
  const deviceId = typeof body.deviceId === "string" ? body.deviceId.trim() : "";
  if (!KEY_PATTERN.test(key)) throw new RequestError(400, "激活卡密格式有误");
  if (!deviceId && !allowLegacyDevice) throw new RequestError(400, "设备标识格式有误");
  if (deviceId && !DEVICE_ID_PATTERN.test(deviceId)) throw new RequestError(400, "设备标识格式有误");

  const digest = await sha256(key);
  const record = await store.get(digest);
  if (!record || record.disabled) return json(200, { code: 400, message: "激活卡密无效" });

  if (deviceId) {
    const deviceHash = await sha256(deviceId);
    if (record.deviceHash && record.deviceHash !== deviceHash) {
      return json(409, { code: 409, message: "该卡密已在其他设备激活" });
    }
    if (!record.deviceHash) {
      await store.put(digest, { ...record, deviceHash, activatedAt: new Date().toISOString() });
    }
  }

  return json(200, { code: 200, message: "success" });
}

async function createCards(request, store, adminToken) {
  requireAdmin(request, adminToken);
  const body = await readJson(request);
  const count = Number(body.count ?? 1);
  const note = typeof body.note === "string" ? body.note.trim() : "";
  if (!Number.isInteger(count) || count < 1 || count > MAX_CREATE_COUNT) {
    throw new RequestError(400, `count 必须是 1-${MAX_CREATE_COUNT} 的整数`);
  }
  if (note.length > MAX_NOTE_LENGTH) throw new RequestError(400, `note 最长 ${MAX_NOTE_LENGTH} 个字符`);

  const created = [];
  for (let index = 0; index < count; index += 1) {
    let key;
    let digest;
    do {
      key = generateKey();
      digest = await sha256(key);
    } while (await store.get(digest));
    await store.put(digest, {
      last4: key.slice(-4), note, disabled: false, createdAt: new Date().toISOString(),
    });
    created.push(key);
  }
  return json(200, { code: 200, message: "success", data: created });
}

function normalizeImportCard(item, defaultNote) {
  const key = typeof item?.key === "string" ? item.key.trim() : "";
  const note = typeof item?.note === "string" ? item.note.trim() : defaultNote;
  const createdAt = typeof item?.createdAt === "string" && !Number.isNaN(Date.parse(item.createdAt))
    ? new Date(item.createdAt).toISOString()
    : new Date().toISOString();
  const deviceHash = typeof item?.deviceHash === "string" ? item.deviceHash.toLowerCase() : undefined;
  if (!KEY_PATTERN.test(key)) throw new RequestError(400, "导入卡密格式有误");
  if (note.length > MAX_NOTE_LENGTH) throw new RequestError(400, `note 最长 ${MAX_NOTE_LENGTH} 个字符`);
  if (deviceHash && !HASH_PATTERN.test(deviceHash)) throw new RequestError(400, "设备哈希格式有误");
  return {
    key,
    record: {
      last4: key.slice(-4), note, disabled: Boolean(item?.disabled), createdAt,
      ...(deviceHash ? { deviceHash } : {}),
      ...(deviceHash && typeof item?.activatedAt === "string" ? { activatedAt: item.activatedAt } : {}),
    },
  };
}

async function importCards(request, store, adminToken) {
  requireAdmin(request, adminToken);
  const body = await readJson(request);
  const cards = Array.isArray(body.cards) ? body.cards : [];
  const defaultNote = typeof body.note === "string" ? body.note.trim() : "";
  if (cards.length < 1 || cards.length > MAX_CREATE_COUNT) {
    throw new RequestError(400, `cards 数量必须是 1-${MAX_CREATE_COUNT}`);
  }
  if (defaultNote.length > MAX_NOTE_LENGTH) throw new RequestError(400, `note 最长 ${MAX_NOTE_LENGTH} 个字符`);

  let imported = 0;
  let existing = 0;
  for (const item of cards) {
    const { key, record } = normalizeImportCard(item, defaultNote);
    const digest = await sha256(key);
    if (await store.get(digest)) {
      existing += 1;
      continue;
    }
    await store.put(digest, record);
    imported += 1;
  }
  return json(200, { code: 200, message: "success", data: { imported, existing } });
}

async function listCards(request, store, adminToken) {
  requireAdmin(request, adminToken);
  const records = await store.list();
  const result = records.map(({ digest, record }) => ({
    id: digest,
    maskedKey: `****************************${record.last4}`,
    note: record.note,
    disabled: Boolean(record.disabled),
    activated: Boolean(record.deviceHash),
    createdAt: record.createdAt,
    activatedAt: record.activatedAt || null,
  }));
  result.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return json(200, { code: 200, message: "success", data: result });
}

async function disableCard(request, store, adminToken) {
  requireAdmin(request, adminToken);
  const body = await readJson(request);
  const key = typeof body.key === "string" ? body.key.trim() : "";
  if (!KEY_PATTERN.test(key)) throw new RequestError(400, "卡密格式有误");
  const digest = await sha256(key);
  const record = await store.get(digest);
  if (!record) throw new RequestError(404, "卡密不存在");
  await store.put(digest, { ...record, disabled: true, disabledAt: new Date().toISOString() });
  return json(200, { code: 200, message: "success" });
}

function privacyPage() {
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>BOSS海投隐私政策</title><style>body{font:16px/1.75 system-ui,sans-serif;max-width:760px;margin:40px auto;padding:0 20px;color:#1f2937}h1,h2{line-height:1.3;color:#111827}small{color:#6b7280}</style></head>
<body><h1>BOSS海投隐私政策</h1><small>更新日期：2026年9月11日</small>
<p>BOSS海投重视用户隐私。本政策说明本扩展处理的数据、处理目的以及用户可采取的控制措施。</p>
<h2>处理的数据</h2><p>本扩展在用户设备本地处理并保存筛选条件、打招呼语、操作设置、已处理职位与沟通记录、用户主动选择的图片简历，以及激活状态、激活卡密和随机设备标识。本扩展会读取 BOSS 直聘网页中完成用户主动启用功能所必需的职位、招聘者和聊天界面信息。</p>
<h2>数据传输</h2><p>首次激活时，用户输入的卡密和随机设备标识会通过 HTTPS 发送到本扩展的验证服务，仅用于验证卡密并限制一卡一设备。服务仅保存卡密和设备标识的不可逆 SHA-256 哈希，不保存二者明文。除此之外，本扩展不会把用户设置、职位记录、聊天内容或图片简历发送给扩展运营者。</p>
<p>当用户启用发送功能时，相关打招呼语或简历会通过 BOSS 直聘网页发送给招聘者；该处理受 BOSS 直聘自身隐私政策和服务条款约束。</p>
<h2>保存与删除</h2><p>本地数据保存在浏览器存储中。用户可通过删除扩展或清除站点数据删除这些信息。清除随机设备标识后，已绑定卡密不能在新的设备标识下重新激活。</p>
<h2>数据使用承诺</h2><p>本扩展对通过 Chrome API 和网站权限获得的信息的使用，将遵守 Chrome Web Store 用户数据政策，包括 Limited Use（有限使用）要求。用户数据不会被出售，也不会用于广告、信用评估或与扩展核心功能无关的用途。</p>
<h2>联系方式</h2><p>隐私问题请联系：<a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a></p></body></html>`;
}

export async function handleCardRequest(request, { store, adminToken, allowLegacyDevice = false }) {
  if (request.method === "OPTIONS") return json(204, {});
  const { pathname } = new URL(request.url);
  try {
    if (request.method === "GET" && pathname === "/api/health") return json(200, { code: 200, message: "ok" });
    if (request.method === "GET" && pathname === "/privacy") return html(200, privacyPage());
    if (!store) return json(503, { code: 503, message: "存储服务尚未配置" });
    if (request.method === "POST" && pathname === "/api/public/card-keys/verify") {
      return await verifyCard(request, store, { allowLegacyDevice });
    }
    if (request.method === "POST" && pathname === "/api/admin/card-keys") return await createCards(request, store, adminToken);
    if (request.method === "POST" && pathname === "/api/admin/card-keys/import") return await importCards(request, store, adminToken);
    if (request.method === "GET" && pathname === "/api/admin/card-keys") return await listCards(request, store, adminToken);
    if (request.method === "POST" && pathname === "/api/admin/card-keys/disable") return await disableCard(request, store, adminToken);
    return json(404, { code: 404, message: "Not Found" });
  } catch (error) {
    if (error instanceof RequestError) return json(error.status, { code: error.status, message: error.message });
    console.error("Unhandled request error", error);
    return json(500, { code: 500, message: "Internal Server Error" });
  }
}

export function createCloudflareStore(kv) {
  const prefix = "card:";
  return {
    get: (digest) => kv.get(`${prefix}${digest}`, "json"),
    put: (digest, record) => kv.put(`${prefix}${digest}`, JSON.stringify(record)),
    async list() {
      const records = [];
      let cursor;
      do {
        const page = await kv.list({ prefix, cursor });
        const values = await Promise.all(page.keys.map(async ({ name }) => ({
          digest: name.slice(prefix.length), record: await kv.get(name, "json"),
        })));
        records.push(...values.filter(({ record }) => Boolean(record)));
        cursor = page.list_complete ? undefined : page.cursor;
      } while (cursor);
      return records;
    },
  };
}

export function createEdgeOneStore(kv) {
  const prefix = "card_";
  return {
    get: (digest) => kv.get(`${prefix}${digest}`, { type: "json" }),
    put: (digest, record) => kv.put(`${prefix}${digest}`, JSON.stringify(record)),
    async list() {
      const records = [];
      let cursor;
      do {
        const page = await kv.list({ prefix, limit: 256, cursor });
        const values = await Promise.all(page.keys.map(async ({ key }) => ({
          digest: key.slice(prefix.length), record: await kv.get(key, { type: "json" }),
        })));
        records.push(...values.filter(({ record }) => Boolean(record)));
        cursor = page.complete ? undefined : page.cursor;
      } while (cursor);
      return records;
    },
  };
}
