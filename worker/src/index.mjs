const KEY_PREFIX = "card:";
const KEY_PATTERN = /^[A-Za-z0-9]{32}$/;
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
  return new Response(status === 204 ? null : JSON.stringify(payload), {
    status,
    headers: JSON_HEADERS,
  });
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

async function sha256(value) {
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

function requireAdmin(request, env) {
  if (!env.ADMIN_TOKEN) throw new RequestError(503, "管理服务尚未配置");
  if (request.headers.get("authorization") !== `Bearer ${env.ADMIN_TOKEN}`) {
    throw new RequestError(401, "未授权");
  }
}

async function verifyCard(request, env) {
  const body = await readJson(request);
  const key = typeof body.key === "string" ? body.key.trim() : "";
  if (!KEY_PATTERN.test(key)) throw new RequestError(400, "激活卡密格式有误");

  const digest = await sha256(key);
  const record = await env.CARD_KEYS.get(`${KEY_PREFIX}${digest}`, "json");
  if (!record || record.disabled) {
    return json(200, { code: 400, message: "激活卡密无效" });
  }
  return json(200, { code: 200, message: "success" });
}

async function createCards(request, env) {
  requireAdmin(request, env);
  const body = await readJson(request);
  const count = Number(body.count ?? 1);
  const note = typeof body.note === "string" ? body.note.trim() : "";
  if (!Number.isInteger(count) || count < 1 || count > MAX_CREATE_COUNT) {
    throw new RequestError(400, `count 必须是 1-${MAX_CREATE_COUNT} 的整数`);
  }
  if (note.length > MAX_NOTE_LENGTH) {
    throw new RequestError(400, `note 最长 ${MAX_NOTE_LENGTH} 个字符`);
  }

  const created = [];
  for (let index = 0; index < count; index += 1) {
    let key;
    let digest;
    do {
      key = generateKey();
      digest = await sha256(key);
    } while (await env.CARD_KEYS.get(`${KEY_PREFIX}${digest}`));

    const record = {
      last4: key.slice(-4),
      note,
      disabled: false,
      createdAt: new Date().toISOString(),
    };
    await env.CARD_KEYS.put(`${KEY_PREFIX}${digest}`, JSON.stringify(record));
    created.push(key);
  }

  return json(200, { code: 200, message: "success", data: created });
}

async function listCards(request, env) {
  requireAdmin(request, env);
  const records = [];
  let cursor;
  do {
    const page = await env.CARD_KEYS.list({ prefix: KEY_PREFIX, cursor });
    const values = await Promise.all(
      page.keys.map(async ({ name }) => {
        const record = await env.CARD_KEYS.get(name, "json");
        return record
          ? {
              id: name.slice(KEY_PREFIX.length),
              maskedKey: `****************************${record.last4}`,
              note: record.note,
              disabled: Boolean(record.disabled),
              createdAt: record.createdAt,
            }
          : null;
      })
    );
    records.push(...values.filter(Boolean));
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);

  records.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return json(200, { code: 200, message: "success", data: records });
}

async function disableCard(request, env) {
  requireAdmin(request, env);
  const body = await readJson(request);
  const key = typeof body.key === "string" ? body.key.trim() : "";
  if (!KEY_PATTERN.test(key)) throw new RequestError(400, "卡密格式有误");

  const digest = await sha256(key);
  const storageKey = `${KEY_PREFIX}${digest}`;
  const record = await env.CARD_KEYS.get(storageKey, "json");
  if (!record) throw new RequestError(404, "卡密不存在");
  record.disabled = true;
  record.disabledAt = new Date().toISOString();
  await env.CARD_KEYS.put(storageKey, JSON.stringify(record));
  return json(200, { code: 200, message: "success" });
}

function privacyPage() {
  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>BOSS海投隐私政策</title><style>body{font:16px/1.75 system-ui,sans-serif;max-width:760px;margin:40px auto;padding:0 20px;color:#1f2937}h1,h2{line-height:1.3;color:#111827}small{color:#6b7280}</style></head>
<body><h1>BOSS海投隐私政策</h1><small>更新日期：2026年9月11日</small>
<p>BOSS海投重视用户隐私。本政策说明本扩展处理的数据、处理目的以及用户可采取的控制措施。</p>
<h2>处理的数据</h2><p>本扩展在用户设备本地处理并保存筛选条件、打招呼语、操作设置、已处理职位与沟通记录、用户主动选择的图片简历，以及激活状态和激活卡密。本扩展会读取 BOSS 直聘网页中完成用户主动启用功能所必需的职位、招聘者和聊天界面信息。</p>
<h2>数据传输</h2><p>首次激活时，用户输入的卡密会通过 HTTPS 发送到本扩展的验证服务，仅用于判断卡密是否有效。验证服务仅保存卡密的不可逆哈希和末四位，不保存明文。除此之外，本扩展不会把用户设置、职位记录、聊天内容或图片简历发送给扩展运营者。</p>
<p>当用户启用发送功能时，相关打招呼语或简历会通过 BOSS 直聘网页发送给招聘者；该处理受 BOSS 直聘自身隐私政策和服务条款约束。</p>
<h2>保存与删除</h2><p>本地数据保存在浏览器存储中。用户可通过删除扩展或清除站点数据删除这些信息。</p>
<h2>联系方式</h2><p>隐私问题请联系：<a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a></p></body></html>`;
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return json(204, {});
    const { pathname } = new URL(request.url);

    try {
      if (request.method === "GET" && pathname === "/api/health") {
        return json(200, { code: 200, message: "ok" });
      }
      if (request.method === "GET" && pathname === "/privacy") {
        return html(200, privacyPage());
      }
      if (request.method === "POST" && pathname === "/api/public/card-keys/verify") {
        return await verifyCard(request, env);
      }
      if (request.method === "POST" && pathname === "/api/admin/card-keys") {
        return await createCards(request, env);
      }
      if (request.method === "GET" && pathname === "/api/admin/card-keys") {
        return await listCards(request, env);
      }
      if (request.method === "POST" && pathname === "/api/admin/card-keys/disable") {
        return await disableCard(request, env);
      }
      return json(404, { code: 404, message: "Not Found" });
    } catch (error) {
      if (error instanceof RequestError) {
        return json(error.status, { code: error.status, message: error.message });
      }
      console.error("Unhandled request error", error);
      return json(500, { code: 500, message: "Internal Server Error" });
    }
  },
};
