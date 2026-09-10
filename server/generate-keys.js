/**
 * 卡密生成 CLI
 * 用法：node generate-keys.js <数量> [备注]
 * 示例：node generate-keys.js 10 "第一批测试"
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const KEYS_FILE = path.join(__dirname, "keys.json");
const count = Math.min(parseInt(process.argv[2] || "1", 10) || 1, 1000);
const note = process.argv[3] || "";

function generateKey() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let key = "";
  const bytes = crypto.randomBytes(32);
  for (let i = 0; i < 32; i++) key += chars[bytes[i] % chars.length];
  return key;
}

let data;
try {
  data = JSON.parse(fs.readFileSync(KEYS_FILE, "utf8"));
} catch {
  data = { keys: [] };
}

const created = [];
for (let i = 0; i < count; i++) {
  let key = generateKey();
  while (data.keys.some((k) => k.key === key)) key = generateKey();
  data.keys.push({ key, note, disabled: false, createdAt: new Date().toISOString() });
  created.push(key);
}

fs.writeFileSync(KEYS_FILE, JSON.stringify(data, null, 2));
console.log(`已生成 ${created.length} 个卡密：`);
created.forEach((k) => console.log(k));
