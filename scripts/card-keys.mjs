#!/usr/bin/env node
import { createHash, randomInt } from "node:crypto";
import { mkdir, open, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const CLOUDFLARE_URL = "https://boss-haitou-api.qiujiangtao1990.workers.dev";
const PRIVATE_DIR = path.resolve("private");
const CLOUDFLARE_TOKEN_FILE = path.join(PRIVATE_DIR, "cloudflare-admin-token.txt");
const EDGEONE_TOKEN_FILE = path.join(PRIVATE_DIR, "edgeone-admin-token.txt");
const KEY_PATTERN = /^[A-Za-z0-9]{32}$/;

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function requiredArgument(name) {
  const value = argument(name);
  if (!value) throw new Error(`缺少参数 ${name}`);
  return value;
}

async function readSecret(file) {
  const value = (await readFile(file, "utf8")).trim();
  if (!value) throw new Error(`私密文件为空：${file}`);
  return value;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function generateKey() {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length: 32 }, () => alphabet[randomInt(alphabet.length)]).join("");
}

async function api(url, token, pathname, options = {}) {
  const response = await fetch(`${url}${pathname}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.code !== 200) {
    throw new Error(`${url}${pathname} 请求失败：HTTP ${response.status} ${payload?.message || "未知错误"}`);
  }
  return payload;
}

async function importBatches(url, token, cards) {
  let imported = 0;
  let existing = 0;
  for (let offset = 0; offset < cards.length; offset += 100) {
    const batch = cards.slice(offset, offset + 100);
    const payload = await api(url, token, "/api/admin/card-keys/import", {
      method: "POST",
      body: JSON.stringify({ cards: batch }),
    });
    imported += payload.data.imported;
    existing += payload.data.existing;
  }
  return { imported, existing };
}

async function syncBoth(cards, edgeoneUrl) {
  const [cloudflareToken, edgeoneToken] = await Promise.all([
    readSecret(CLOUDFLARE_TOKEN_FILE),
    readSecret(EDGEONE_TOKEN_FILE),
  ]);
  const edgeone = await importBatches(edgeoneUrl, edgeoneToken, cards);
  const cloudflare = await importBatches(CLOUDFLARE_URL, cloudflareToken, cards);
  console.log(JSON.stringify({ count: cards.length, edgeone, cloudflare }, null, 2));
}

async function migrateExisting(edgeoneUrl) {
  const cloudflareToken = await readSecret(CLOUDFLARE_TOKEN_FILE);
  const listing = await api(CLOUDFLARE_URL, cloudflareToken, "/api/admin/card-keys");
  const recordsByHash = new Map(listing.data.map((record) => [record.id, record]));
  const files = [
    path.join(PRIVATE_DIR, "production-keys-20260911.txt"),
    path.join(PRIVATE_DIR, "chrome-review-key.txt"),
  ];
  const keys = (await Promise.all(files.map((file) => readFile(file, "utf8"))))
    .flatMap((content) => content.split(/\r?\n/).map((line) => line.trim()).filter(Boolean));
  if (keys.length !== 101 || keys.some((key) => !KEY_PATTERN.test(key))) {
    throw new Error("现有私密文件必须恰好包含101枚有效卡密");
  }

  const cards = keys.map((key) => {
    const record = recordsByHash.get(sha256(key));
    if (!record) throw new Error(`Cloudflare 中缺少末四位为 ${key.slice(-4)} 的卡密记录`);
    return {
      key,
      note: record.note,
      disabled: record.disabled,
      createdAt: record.createdAt,
    };
  });
  await syncBoth(cards, edgeoneUrl);
}

async function saveBatch(keys, note) {
  await mkdir(PRIVATE_DIR, { recursive: true, mode: 0o700 });
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const file = path.join(PRIVATE_DIR, `production-keys-${stamp}.json`);
  const handle = await open(file, "wx", 0o600);
  try {
    await handle.writeFile(`${JSON.stringify({ note, createdAt: new Date().toISOString(), keys }, null, 2)}\n`);
  } finally {
    await handle.close();
  }
  return file;
}

async function generate(edgeoneUrl) {
  const count = Number(requiredArgument("--count"));
  const note = requiredArgument("--note").trim();
  if (!Number.isInteger(count) || count < 1 || count > 100) throw new Error("--count 必须是1-100的整数");
  if (!note || note.length > 200) throw new Error("--note 长度必须是1-200个字符");
  const keys = Array.from({ length: count }, generateKey);
  if (new Set(keys).size !== keys.length) throw new Error("生成了重复卡密，请重新执行");
  const file = await saveBatch(keys, note);
  console.log(`明文卡密已安全保存：${file}`);
  const createdAt = new Date().toISOString();
  await syncBoth(keys.map((key) => ({ key, note, createdAt })), edgeoneUrl);
}

async function syncFile(edgeoneUrl) {
  const file = path.resolve(requiredArgument("--input"));
  const parsed = JSON.parse(await readFile(file, "utf8"));
  if (!Array.isArray(parsed.keys) || parsed.keys.some((key) => !KEY_PATTERN.test(key))) {
    throw new Error("输入文件格式无效");
  }
  await syncBoth(parsed.keys.map((key) => ({
    key,
    note: parsed.note || "",
    createdAt: parsed.createdAt,
  })), edgeoneUrl);
}

async function main() {
  const command = process.argv[2];
  const edgeoneUrl = requiredArgument("--edgeone-url").replace(/\/$/, "");
  if (command === "migrate-existing") return migrateExisting(edgeoneUrl);
  if (command === "generate") return generate(edgeoneUrl);
  if (command === "sync") return syncFile(edgeoneUrl);
  throw new Error("用法：card-keys.mjs <migrate-existing|generate|sync> --edgeone-url <URL> [参数]");
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
