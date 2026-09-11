# BOSS海投

面向 BOSS 直聘网页版的浏览器扩展，提供职位筛选、批量发起沟通、聊天处理和简历发送功能。当前生产扩展使用 Cloudflare Workers 验证卡密；EdgeOne Makers 适配已完成，但在取得可长期从中国大陆访问的域名并启用 KV 前不切换。两端都只在 KV 中保存卡密和设备标识的 SHA-256 哈希。

## 功能

- 按职位关键词、城市、招聘者活跃状态筛选，可排除猎头。
- 自动遍历职位、发起沟通、滚动加载，并支持投递完成后继续搜索。
- 配置打招呼语，可选自动发送附件简历和图片简历。
- 保存用户设置、已沟通岗位和 HR 交互记录，避免重复发送。
- 使用卡密激活；卡密仅以 SHA-256 哈希形式保存在云端。

## 项目结构

```text
extension/                 # Manifest V3 扩展
service/card-service.mjs  # 两个平台共用的卡密业务逻辑
worker/src/index.mjs      # Cloudflare Worker 入口（灾备）
edge-functions/           # EdgeOne Makers 入口（生产）
scripts/card-keys.mjs     # 两端同步生成、迁移卡密
scripts/build-edgeone.mjs # 生成安全的 EdgeOne 部署目录
tests/                     # Node.js 自动化测试
wrangler.jsonc             # Worker 与 KV 绑定配置
STORE_LISTING.md           # Chrome Web Store 上架文案
PRIVACY.md                 # 隐私政策源文件
```

## 本地加载扩展

1. 在 Chrome 打开 `chrome://extensions`。
2. 开启“开发者模式”，点击“加载已解压的扩展程序”。
3. 选择项目中的 `extension` 目录。
4. 打开并登录 BOSS 直聘网页版，进入职位列表页后刷新。
5. 在页面右侧面板输入有效卡密完成首次激活。

## Cloudflare 部署

当前生产 Worker：`https://boss-haitou-api.qiujiangtao1990.workers.dev`

```bash
npx wrangler login
npx wrangler secret put ADMIN_TOKEN
npx wrangler deploy
```

`ADMIN_TOKEN` 必须使用随机高强度值，并只能保存在 Cloudflare Secret 或本地私密存储中，禁止提交到 Git。

## EdgeOne 部署

候选 API：`https://boss-haitou-api.edgeone.cool`

注意：Global（不含中国大陆）项目的系统域名在中国大陆只能使用控制台生成的 3 小时预览链接，不能作为扩展的长期生产 API。当前候选地址直连会返回 401，因此扩展暂未切换；若要使用覆盖中国大陆的稳定自定义域名，需要完成 ICP 备案。

首次配置时，在 EdgeOne Makers 控制台启用 KV，创建命名空间并绑定到项目 `boss-haitou-api`，变量名必须为 `CARD_KEYS`。管理令牌通过项目的 Production 环境变量 `ADMIN_TOKEN` 配置，不写入代码或 Git。

```bash
npx edgeone switch --site global
npx edgeone makers link -n boss-haitou-api
node scripts/build-edgeone.mjs
npx edgeone makers deploy dist/edgeone-app -n boss-haitou-api -e production -a global
```

环境变量或 KV 绑定发生变化后要重新部署，旧部署不会自动获得新配置。

## 生成卡密

卡密只能通过受 `ADMIN_TOKEN` 保护的管理接口生成。接口一次可以生成 1–100 枚卡密；明文只在生成响应中返回一次，之后管理接口只能看到末四位，因此应立即把响应保存到 `private/` 目录。该目录已加入 `.gitignore`，保存文件前仍应设置仅当前用户可读写的权限。

### 本地调试

1. 生成一个仅供本地使用的管理令牌：

   ```bash
   openssl rand -hex 32
   ```

2. 在仓库根目录创建不会提交到 Git 的 `.dev.vars`，填入上一步的结果：

   ```dotenv
   ADMIN_TOKEN=替换为刚生成的本地令牌
   ```

3. 启动本地 Worker。默认使用 `.wrangler/state` 中的本地 KV，不会读写生产 KV：

   ```bash
   npx wrangler dev --local --port 8788
   ```

4. 另开终端，从 `.dev.vars` 读取令牌并生成测试卡密：

   ```bash
   mkdir -p private
   chmod 700 private
   LOCAL_ADMIN_TOKEN="$(sed -n 's/^ADMIN_TOKEN=//p' .dev.vars)"
   umask 077
   curl --fail-with-body \
     --request POST \
     --header "Authorization: Bearer ${LOCAL_ADMIN_TOKEN}" \
     --header "Content-Type: application/json" \
     --data '{"count":5,"note":"本地测试"}' \
     --output private/local-test-keys.json \
     http://127.0.0.1:8788/api/admin/card-keys
   unset LOCAL_ADMIN_TOKEN
   ```

5. 使用生成结果中的某个 `key` 测试验证接口：

   ```bash
   curl --fail-with-body \
     --request POST \
     --header "Content-Type: application/json" \
     --data '{"key":"替换为本地测试卡密"}' \
     http://127.0.0.1:8788/api/public/card-keys/verify
   ```

停止并重新启动 `wrangler dev` 后，本地卡密仍保存在 `.wrangler/state`。删除该目录会清空本地 KV。当前正式扩展固定连接生产 Worker，且不声明 localhost 主机权限，因此本地生成的卡密只用于接口调试，不能直接激活正式扩展包。

### 当前生产环境（Cloudflare）

首次部署或轮换管理令牌时，通过 Wrangler 写入 Cloudflare Secret：

```bash
npx wrangler secret put ADMIN_TOKEN
npx wrangler deploy
```

在 EdgeOne KV 尚未启用时，新卡密继续通过 Cloudflare 管理接口生成：

```bash
PROD_ADMIN_TOKEN="$(tr -d '\r\n' < private/cloudflare-admin-token.txt)"
umask 077
curl --fail-with-body \
  --request POST \
  --header "Authorization: Bearer ${PROD_ADMIN_TOKEN}" \
  --header "Content-Type: application/json" \
  --data '{"count":100,"note":"第二批寄售"}' \
  --output private/production-keys-cloudflare.json \
  https://boss-haitou-api.qiujiangtao1990.workers.dev/api/admin/card-keys
unset PROD_ADMIN_TOKEN
chmod 600 private/production-keys-cloudflare.json
```

### EdgeOne 启用后的双端同步

EdgeOne KV 审核通过、命名空间绑定完成且正式域名通过大陆直连验收后，新卡密应通过项目脚本在两端写入同一批数据。先分别保存两个平台的管理令牌：

```bash
chmod 600 private/cloudflare-admin-token.txt private/edgeone-admin-token.txt
node scripts/card-keys.mjs migrate-existing \
  --edgeone-url https://替换为通过验收的正式域名

node scripts/card-keys.mjs generate \
  --count 100 \
  --note "第二批寄售" \
  --edgeone-url https://替换为通过验收的正式域名
```

脚本先把明文保存到权限为 `600` 的 `private/production-keys-<时间>.json`，再同步两端。若中途失败，不要再次生成一批新卡密；用输出文件重试同步：

```bash
node scripts/card-keys.mjs sync \
  --input private/production-keys-<时间>.json \
  --edgeone-url https://替换为通过验收的正式域名
```

首批 100 枚寄售卡密仍在 `private/production-keys-20260911.txt`，审核专用卡密在 `private/chrome-review-key.txt`。这些文件不会提交到 Git。不要重复执行生产生成命令，除非确实要创建新批次；KV 无法恢复卡密明文。

## 卡密接口

管理接口均需请求头 `Authorization: Bearer <ADMIN_TOKEN>`；带请求体的接口使用 JSON。

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/health` | 健康检查 |
| POST | `/api/public/card-keys/verify` | 验证卡密，请求体为 `{"key":"32位卡密","deviceId":"UUID"}` |
| POST | `/api/admin/card-keys` | 生成 1–100 枚卡密，请求体为 `{"count":1,"note":"备注"}` |
| POST | `/api/admin/card-keys/import` | 幂等导入 1–100 枚卡密，仅供同步脚本使用 |
| GET | `/api/admin/card-keys` | 查询遮罩后的卡密记录 |
| POST | `/api/admin/card-keys/disable` | 禁用未激活卡密，请求体为 `{"key":"待禁用卡密"}` |
| GET | `/privacy` | 公开隐私政策 |

生成接口仅在响应中返回一次明文卡密。KV 只保存不可逆卡密哈希、设备标识哈希、末四位、备注、状态和时间，不保存卡密或设备标识明文。本地调试 KV 与生产 KV 相互独立。

扩展采用“一卡一设备、首次激活后永久离线有效”策略。同一浏览器设备可重复验证，其他设备会被拒绝。由于 EdgeOne KV 是最终一致性存储，两个不同地区的设备若在极短时间内同时首次激活，理论上仍存在竞争窗口。禁用卡密只能阻止新设备继续激活，无法撤销已经保存在浏览器本地的激活状态。

## 测试

```bash
node --test tests/*.test.js tests/*.test.mjs
```

## 开发与排查

- 面板仅在 `https://www.zhipin.com/web/*` 页面显示，聊天页不显示面板。
- 激活失败时检查 Worker 健康接口、扩展网络权限以及卡密是否完整。
- 修改扩展代码后，需要在扩展管理页重新加载并刷新 BOSS 直聘页面。
- 页面自动化依赖 BOSS 直聘 DOM，页面结构变化时需要同步维护选择器。
