# ZFCheckScores Worker

正方教务系统成绩与考试安排查询工具的 Cloudflare Workers 版本。支持 Cron 定时检查、Workers KV 状态记录、ShowDoc/Telegram 通知，以及带鉴权的 HTTP 只读查看。

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
└── utils.js       通用工具
test/              Node.js 单元测试
wrangler.jsonc     Cloudflare 部署配置
```

## 部署前配置

### 1. 填写已有 KV 的 Namespace ID

打开 Cloudflare 控制台的 `Workers KV -> score_hash -> 设置`，复制 Namespace ID。将 `wrangler.jsonc` 中：

```jsonc
"id": "REPLACE_WITH_YOUR_SCORE_HASH_NAMESPACE_ID"
```

替换为真实 ID。绑定名称必须保持为 `score_hash`。

Namespace ID 不是密码，可以提交进 Git；账号、密码和通知 Token 绝不能提交。

### 2. 添加 Worker Secrets

在 Cloudflare Worker 的 `设置 -> 变量和机密` 中添加：

| 名称 | 必需 | 说明 |
| --- | --- | --- |
| `URL` | 是 | 教务系统根地址，通常以 `/jwglxt/` 结尾 |
| `USERNAME` | 是 | 教务系统用户名/学号 |
| `PASSWORD` | 是 | 教务系统本地密码 |
| `ADMIN_TOKEN` | HTTP 查看时 | 建议使用足够长的随机值 |
| `TOKEN` | 通知二选一 | ShowDoc Push Token |
| `TG_BOT_TOKEN` | 通知二选一 | Telegram Bot Token |
| `TG_CHAT_ID` | 使用 TG 时 | Telegram 接收方 Chat ID |
| `FORCE_PUSH_MESSAGE` | 否 | `true` 表示每次 Cron 都推送 |

也可以在已登录 Wrangler 后执行：

```bash
npx wrangler secret put URL
npx wrangler secret put USERNAME
npx wrangler secret put PASSWORD
npx wrangler secret put ADMIN_TOKEN
```

通知配置可以只选一套；两套都配置时会同时发送。

### 3. 本地检查与部署

```bash
npm install
npm test
npm run deploy
```

`wrangler.jsonc` 默认每小时第 17、47 分钟运行。Cloudflare Cron 使用 UTC，但纯分钟表达式不受时区影响。

## HTTP 查看

HTTP 查看不会发送通知，也不会更新 KV，因此不会“吃掉”下一次定时更新通知。

推荐使用 Authorization Header：

```bash
curl -H "Authorization: Bearer YOUR_ADMIN_TOKEN" https://YOUR_WORKER.workers.dev/
```

浏览器也可以访问：

```text
https://YOUR_WORKER.workers.dev/?token=YOUR_ADMIN_TOKEN
```

查询参数可能进入浏览器历史和访问日志；日常使用更推荐 Header。健康检查 `/health` 不含个人数据，无需鉴权。

## 连接 GitHub / GitLab

1. 将本仓库推送到 GitHub 或 GitLab，确保 Secrets 没有进入提交。
2. Cloudflare 控制台进入 `Workers 和 Pages`，选择 Worker 后连接 Git 仓库。
3. Build command 可留空，Deploy command 使用 `npx wrangler deploy`。
4. 生产分支选择仓库默认分支。
5. 首次部署后核对 `score_hash` KV Binding 和 Worker Secrets。

Cloudflare 会在每次推送后自动构建并部署。`wrangler.jsonc` 应作为 Worker 配置的真源。

## 安全说明

- 不要把 `.dev.vars`、密码、Cookie、Bot Token 或 `ADMIN_TOKEN` 提交到 Git。
- HTTP 返回包含姓名、学号和成绩，因此必须配置 `ADMIN_TOKEN`。
- 若教务系统要求验证码，定时 Worker 会停止并报告错误，不会尝试绕过。
- 通知成功后才更新 KV，避免通知失败导致成绩变化永久漏报。

## License

Apache License 2.0。详情见 [LICENSE](LICENSE) 和 [NOTICE](NOTICE)。
