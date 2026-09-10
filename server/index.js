/**
 * BOSS海投 卡密验证后端（Node 零依赖）
 *
 * 启动：node index.js          （默认端口 8788，PORT 环境变量可改）
 * 管理：请求头 Authorization: Bearer <ADMIN_TOKEN>（默认 admin123，务必修改）
 *
 * 接口：
 *   GET  /api/public/card-keys/verify/:key   插件激活验证（公开）
 *   POST /api/admin/card-keys                批量生成卡密 {count, note}
 *   GET  /api/admin/card-keys                卡密列表
 *   POST /api/admin/card-keys/disable        禁用卡密 {key}
 */
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = parseInt(process.env.PORT || "8788", 10);
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "admin123";
const KEYS_FILE = path.join(__dirname, "keys.json");

/* ---------- 存储 ---------- */
function loadKeys() {
  try {
    return JSON.parse(fs.readFileSync(KEYS_FILE, "utf8"));
  } catch {
    return { keys: [] };
  }
}

function saveKeys(data) {
  fs.writeFileSync(KEYS_FILE, JSON.stringify(data, null, 2));
}

function generateKey() {
  // 32 位字母数字卡密（与插件端 /^[A-Za-z0-9]{32}$/ 一致）
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let key = "";
  const bytes = crypto.randomBytes(32);
  for (let i = 0; i < 32; i++) key += chars[bytes[i] % chars.length];
  return key;
}

/* ---------- 工具 ---------- */
function json(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try {
        resolve(JSON.parse(body || "{}"));
      } catch {
        resolve({});
      }
    });
  });
}

function isAdmin(req) {
  const auth = req.headers.authorization || "";
  return auth === `Bearer ${ADMIN_TOKEN}`;
}

/* ---------- 路由 ---------- */
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const { pathname } = url;

  if (req.method === "OPTIONS") return json(res, 204, {});

  // 公开：验证卡密
  const verifyMatch = pathname.match(/^\/api\/public\/card-keys\/verify\/([A-Za-z0-9]{32})$/);
  if (req.method === "GET" && verifyMatch) {
    const key = verifyMatch[1];
    const data = loadKeys();
    const record = data.keys.find((k) => k.key === key);
    if (record && !record.disabled) {
      return json(res, 200, { code: 200, message: "success", data: { key } });
    }
    return json(res, 200, { code: 400, message: "激活卡密无效" });
  }

  // 管理接口
  if (pathname.startsWith("/api/admin/")) {
    if (!isAdmin(req)) {
      return json(res, 401, { code: 401, message: "未授权" });
    }

    if (req.method === "POST" && pathname === "/api/admin/card-keys") {
      const body = await readBody(req);
      const count = Math.min(parseInt(body.count || "1", 10) || 1, 100);
      const note = body.note || "";
      const data = loadKeys();
      const created = [];
      for (let i = 0; i < count; i++) {
        let key = generateKey();
        while (data.keys.some((k) => k.key === key)) key = generateKey();
        const record = { key, note, disabled: false, createdAt: new Date().toISOString() };
        data.keys.push(record);
        created.push(key);
      }
      saveKeys(data);
      return json(res, 200, { code: 200, message: "success", data: created });
    }

    if (req.method === "GET" && pathname === "/api/admin/card-keys") {
      const data = loadKeys();
      return json(res, 200, { code: 200, message: "success", data: data.keys });
    }

    if (req.method === "POST" && pathname === "/api/admin/card-keys/disable") {
      const body = await readBody(req);
      const data = loadKeys();
      const record = data.keys.find((k) => k.key === body.key);
      if (!record) return json(res, 404, { code: 404, message: "卡密不存在" });
      record.disabled = true;
      saveKeys(data);
      return json(res, 200, { code: 200, message: "success" });
    }
  }

  json(res, 404, { code: 404, message: "Not Found" });
});

server.listen(PORT, () => {
  console.log(`[卡密服务] 已启动: http://localhost:${PORT}`);
  console.log(`[卡密服务] 管理令牌: ${ADMIN_TOKEN}（请用 ADMIN_TOKEN 环境变量修改）`);
});
