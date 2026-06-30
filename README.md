# ZFCheckScores Worker

正方教务系统成绩与考试安排查询工具的 Cloudflare Workers 版本。支持多用户、Cron 定时检查、Workers KV 独立状态、ShowDoc/Telegram 通知，以及带加载动画和鉴权的 HTTP 只读查看。

本项目改写自 [NianBroken/ZFCheckScores](https://github.com/NianBroken/ZFCheckScores)，按 Apache License 2.0 保留署名和修改说明。

## 项目结构

```text
src/
├── index.js       Worker 的 fetch / scheduled 入口
├── job.js         查询、摘要对比和 KV 提交流程
├── zf-client.js   正方登录与接口客户端
├── rsa.js         RSAES-PKCS1-v1_5 密码加密
├── report.js      成绩、考试与 GPA 整理
├── notify.js      ShowDoc 和 Telegram 通知
├── users.js       多用户配置、鉴权和 KV 隔离
├── ui.js          浏览器加载页面
└── utils.js       通用工具
test/              Node.js 单元测试
wrangler.jsonc     Cloudflare 部署配置
```

## 部署前配置

### 1. 配置 KV Namespace ID

`wrangler.jsonc` 已绑定 `score_hash`。若部署到另一个 Cloudflare 账号，需要在 `Workers KV -> score_hash -> 设置` 中复制新 Namespace ID 并替换。绑定名称必须保持为 `score_hash`。

Namespace ID 不是密码，可以提交进 Git；账号、密码和通知 Token 绝不能提交。

### 2. 添加多用户 Secret

在 Cloudflare Worker 的 `设置 -> 变量和机密` 中添加一个加密 Secret：`USERS_JSON`。值是 JSON 数组，例如：

请添加到 Worker 的运行时“变量和机密”，不要只添加到 `构建 -> 变量和机密`；构建变量不会自动成为 `env.USERS_JSON`。仓库已启用 `keep_vars: true`，Git/Wrangler 后续部署会保留控制台中配置的运行时变量。加密 Secret 本身也会被 Wrangler 保留。

```json
[
  {
    "id": "student1",
    "token": "每位用户独立的长随机访问Token",
    "url": "https://jwgl.example.edu.cn/jwglxt/",
    "username": "学号",
    "password": "教务系统本地密码",
    "showdocToken": "可留空",
    "telegramBotToken": "可留空",
    "telegramChatId": "可留空",
    "forcePush": false
  },
  {
    "id": "student2",
    "token": "另一段不可重复的随机Token",
    "url": "https://jwgl.example.edu.cn/jwglxt/",
    "username": "另一学号",
    "password": "另一密码",
    "showdocToken": "ShowDoc Token",
    "telegramBotToken": "",
    "telegramChatId": "",
    "forcePush": false
  }
]
```

字段说明：

| 字段 | 必需 | 说明 |
| --- | --- | --- |
| `id` | 是 | 稳定且唯一，只能用字母、数字、`_`、`-`；用于隔离 KV |
| `token` | 是 | 用户查看自己成绩时使用的访问 Token，必须唯一 |
| `url` | 是 | 教务系统根地址，通常以 `/jwglxt/` 结尾 |
| `username` | 是 | 教务系统用户名/学号 |
| `password` | 是 | 教务系统本地密码 |
| `showdocToken` | 否 | ShowDoc Push Token |
| `telegramBotToken` | 否 | Telegram Bot Token，需和 Chat ID 同时填写 |
| `telegramChatId` | 否 | Telegram 接收方 Chat ID |
| `forcePush` | 否 | `true` 表示每次 Cron 都推送 |

通知字段都留空时仍可网页查询；定时任务会更新该用户的 KV，但不会通知。两套通知都配置时会同时发送。

每个用户的 KV 键以 `user:<id>:` 开头，所以账号之间不会互相覆盖。修改 `id` 会被视为一个新用户并触发首次运行逻辑。

使用 Wrangler 添加 Secret：

```bash
npx wrangler secret put USERS_JSON
```

未配置 `USERS_JSON` 时，旧版 `URL`、`USERNAME`、`PASSWORD`、`ADMIN_TOKEN` 等单用户变量仍然兼容。

### 3. 本地检查与部署

```bash
npm install
npm test
npm run deploy
```

`wrangler.jsonc` 当前每小时第 0、30 分钟运行。Cloudflare Cron 使用 UTC，但纯分钟表达式不受时区影响。

## HTTP 查看

打开 Worker 根目录会立即显示查询页面。提交 Token 后页面通过同源 `/api/report` 请求加载数据，并在等待期间显示动画。HTTP 查看不会发送通知，也不会更新 KV，因此不会“吃掉”下一次定时更新通知。

推荐使用 Authorization Header：

```bash
curl -H "Authorization: Bearer USER_ACCESS_TOKEN" https://YOUR_WORKER.workers.dev/api/report
```

浏览器也可以访问：

```text
https://YOUR_WORKER.workers.dev/
```

页面中输入用户自己的 `token` 即可。也兼容 `/?token=USER_ACCESS_TOKEN` 自动查询；查询参数可能进入访问日志，因此日常使用更推荐页面输入或 Authorization Header。健康检查 `/health` 不含个人数据，无需鉴权。

## 手动强制通知

为某个用户立即执行一次查询并强制推送，不论成绩摘要是否变化：

```text
https://YOUR_WORKER.workers.dev/notify?token=USER_ACCESS_TOKEN
```

也可以避免把 Token 放进 URL：

```bash
curl -X POST \
  -H "Authorization: Bearer USER_ACCESS_TOKEN" \
  https://YOUR_WORKER.workers.dev/notify
```

该接口只执行 Token 对应的用户，并在通知成功后更新其 KV。用户必须配置 ShowDoc 或完整的 Telegram 通知参数，否则返回 400。

## 连接 GitHub / GitLab

1. 将本仓库推送到 GitHub 或 GitLab，确保 Secrets 没有进入提交。
2. Cloudflare 控制台进入 `Workers 和 Pages`，选择 Worker 后连接 Git 仓库。
3. Build command 可留空，Deploy command 使用 `npx wrangler deploy`。
4. 生产分支选择仓库默认分支。
5. 首次部署后核对 `score_hash` KV Binding 和 Worker Secrets。

Cloudflare 会在每次推送后自动构建并部署。`wrangler.jsonc` 应作为 Worker 配置的真源。

## 安全说明

- 不要把 `.dev.vars`、`USERS_JSON`、密码、Cookie 或任何 Token 提交到 Git。
- HTTP 返回包含姓名、学号和成绩，每个用户必须使用独立且足够长的访问 Token。
- 若教务系统要求验证码，定时 Worker 会停止并报告错误，不会尝试绕过。
- 通知成功后才更新 KV，避免通知失败导致成绩变化永久漏报。

## License

Apache License 2.0。详情见 [LICENSE](LICENSE) 和 [NOTICE](NOTICE)。
