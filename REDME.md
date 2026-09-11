# BOSS海投

面向 BOSS 直聘网页版的浏览器扩展，提供职位筛选、批量发起沟通、聊天处理和简历发送功能，配套一个基于 Node.js 的卡密验证服务。

## 功能

- 按职位关键词、城市、招聘者活跃状态筛选，可排除猎头。
- 自动遍历职位、发起沟通、滚动加载，并支持投递完成后继续搜索。
- 配置打招呼语，可选自动发送附件简历和图片简历。
- 保存用户设置和 HR 交互记录，通过容量受限的记录集合减少重复发送。
- 提供卡密激活，以及卡密生成、查询和禁用接口。

## 项目结构

```text
extension/
  manifest.json             # Manifest V3 扩展配置与脚本加载顺序
  background.js             # 卡密验证、激活凭证保存、请求代理
  content/
    00-config.js            # 全局配置、工具函数和运行状态
    01-storage.js           # 设置持久化与去重记录
    02-image-store.js       # 图片存储
    03-ui.js                # 操作面板
    04-dialogs.js           # 设置及激活等弹窗
    05-chat.js              # 聊天交互与简历发送
    06-core.js              # 职位与聊天处理主流程
    07-main.js              # 初始化与页面路由适配
  _locales/                 # 扩展名称和描述的本地化
  assets/                   # 图标资源
server/
  index.js                  # HTTP 卡密服务
  generate-keys.js          # 卡密生成命令行工具
  keys.json                 # 卡密数据文件
```

## 本地启动

需要安装 Node.js，以及支持 Manifest V3 的 Chrome 或 Edge。当前项目使用原生 JavaScript 和 Node.js 内置模块，无需安装 npm 依赖或执行构建。

以下命令均在项目根目录执行。

### 1. 生成卡密

```bash
node server/generate-keys.js 1 "本地测试"
```

命令会输出生成的 32 位字母数字卡密，并写入 `server/keys.json`。第一个参数为数量（默认 1，最多 1000），第二个参数为可选备注。

### 2. 启动验证服务

```bash
ADMIN_TOKEN='替换为自己的管理令牌' node server/index.js
```

默认服务地址为 `http://localhost:8788`。可通过 `PORT` 环境变量修改端口：

```bash
PORT=8788 ADMIN_TOKEN='替换为自己的管理令牌' node server/index.js
```

`ADMIN_TOKEN` 用于管理接口认证；未设置时使用代码中的默认值 `admin123`。

### 3. 加载扩展

1. 在 Chrome 打开 `chrome://extensions`，或在 Edge 打开 `edge://extensions`。
2. 开启「开发者模式」。
3. 点击「加载已解压的扩展程序」，选择项目中的 `extension` 目录。
4. 打开并登录 BOSS 直聘网页版，进入职位列表页。已打开的页面需要刷新。
5. 在插件面板中输入生成的卡密完成激活。

### 4. 使用

在职位列表页配置职位关键词、城市和其他筛选条件，按需设置打招呼语及简历发送选项，然后启动海投。需要处理聊天时，按页面引导打开消息页，并保持职位列表页运行。

聊天页不显示操作面板；检测到列表页正在海投时会自动启动聊天处理，列表页运行心跳过期后会停止聊天处理。运行情况可查看列表页面板日志及浏览器开发者工具控制台。

## 服务配置

调整服务端口或部署地址时，需要同步修改以下两个文件中的 `API_BASE`，并保留 `/api` 后缀：

- `extension/background.js`
- `extension/content/00-config.js`

如果改为远程域名，还需在 `extension/manifest.json` 的 `host_permissions` 中添加对应地址权限。修改扩展后，在扩展管理页重新加载，并刷新 BOSS 直聘页面。

## 卡密接口

以下路径以 `http://localhost:8788` 为基址。管理接口均需请求头 `Authorization: Bearer <ADMIN_TOKEN>`；带请求体的接口使用 JSON。

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/public/card-keys/verify/:key` | 公开验证卡密 |
| POST | `/api/admin/card-keys` | 生成卡密，请求体为 `{"count":1,"note":"备注"}`，单次最多 100 个 |
| GET | `/api/admin/card-keys` | 查询全部卡密记录 |
| POST | `/api/admin/card-keys/disable` | 禁用卡密，请求体为 `{"key":"待禁用卡密"}` |

验证有效卡密时返回 `code: 200` 和 `message: "success"`；无效或已禁用卡密返回 HTTP 200，但响应体为 `code: 400`。客户端需要同时检查 HTTP 状态和业务字段。

卡密保存在本地 JSON 文件中。命令行工具和服务共用该文件，建议在启动服务前使用命令行生成卡密，运行期间通过管理接口生成，避免同时写入覆盖数据。

## 开发与排查

- **面板未显示**：确认扩展已启用，并访问 `https://www.zhipin.com/web/*` 下的职位列表页；聊天页不展示面板。
- **激活请求失败**：检查服务是否启动、两个 `API_BASE` 是否一致，以及扩展是否具备目标地址的访问权限。
- **修改代码未生效**：重新加载扩展后，再刷新目标网页。
- **职位或聊天操作失效**：处理流程依赖 BOSS 直聘页面 DOM，页面结构变化时需要检查相关选择器。

当前仓库未配置自动化测试或构建脚本。扩展交互需要在浏览器中手动验证；后端启动入口为 `server/index.js`。
