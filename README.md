# BOSS海投

面向 BOSS 直聘网页版的浏览器扩展，提供职位筛选、批量发起沟通、聊天处理和简历发送功能。卡密验证服务部署在 Cloudflare Workers，数据使用 Workers KV 持久化。

## 功能

- 按职位关键词、城市、招聘者活跃状态筛选，可排除猎头。
- 自动遍历职位、发起沟通、滚动加载，并支持投递完成后继续搜索。
- 配置打招呼语，可选自动发送附件简历和图片简历。
- 保存用户设置、已沟通岗位和 HR 交互记录，避免重复发送。
- 使用卡密激活；卡密仅以 SHA-256 哈希形式保存在云端。

## 项目结构

```text
extension/                 # Manifest V3 扩展
worker/src/index.mjs       # Cloudflare Worker 卡密 API 与隐私政策页
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

生产 Worker：`https://boss-haitou-api.qiujiangtao1990.workers.dev`

```bash
npx wrangler login
npx wrangler secret put ADMIN_TOKEN
npx wrangler deploy
```

`ADMIN_TOKEN` 必须使用随机高强度值，并只能保存在 Cloudflare Secret 或本地私密存储中，禁止提交到 Git。

## 卡密接口

管理接口均需请求头 `Authorization: Bearer <ADMIN_TOKEN>`；带请求体的接口使用 JSON。

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/health` | 健康检查 |
| POST | `/api/public/card-keys/verify` | 验证卡密，请求体为 `{"key":"32位卡密"}` |
| POST | `/api/admin/card-keys` | 生成 1–100 枚卡密，请求体为 `{"count":1,"note":"备注"}` |
| GET | `/api/admin/card-keys` | 查询遮罩后的卡密记录 |
| POST | `/api/admin/card-keys/disable` | 禁用未激活卡密，请求体为 `{"key":"待禁用卡密"}` |
| GET | `/privacy` | 公开隐私政策 |

生成接口仅在响应中返回一次明文卡密。KV 只保存不可逆哈希、末四位、备注和状态，无法从管理接口恢复遗失的明文卡密。

扩展采用“一次激活、永久离线有效”策略：禁用卡密只能阻止新设备继续激活，无法撤销已经保存在浏览器本地的激活状态。

## 测试

```bash
node --test tests/*.test.js tests/*.test.mjs
```

## 开发与排查

- 面板仅在 `https://www.zhipin.com/web/*` 页面显示，聊天页不显示面板。
- 激活失败时检查 Worker 健康接口、扩展网络权限以及卡密是否完整。
- 修改扩展代码后，需要在扩展管理页重新加载并刷新 BOSS 直聘页面。
- 页面自动化依赖 BOSS 直聘 DOM，页面结构变化时需要同步维护选择器。
