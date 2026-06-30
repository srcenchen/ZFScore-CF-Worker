import { run } from "./job.js";
import { htmlResponse, loadingPage } from "./ui.js";
import { errorMessage, json } from "./utils.js";
import {
  createUserEnv,
  findUserByToken,
  hasNotifier,
  loadUsers,
} from "./users.js";

export default {
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(runScheduledUsers(env));
  },

  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/health") {
      return json({ ok: true, service: "ZFCheckScores Worker" });
    }
    if (url.pathname === "/" && request.method === "GET") {
      return htmlResponse(loadingPage());
    }
    const isReport = url.pathname === "/api/report";
    const isNotify = url.pathname === "/notify";
    if (!isReport && !isNotify) {
      return json({ ok: false, error: "Not Found" }, 404);
    }
    if (request.method !== "GET" && request.method !== "POST") {
      return json({ ok: false, error: "Method Not Allowed" }, 405);
    }

    try {
      const users = loadUsers(env);
      const token = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "")
        || url.searchParams.get("token");
      const user = findUserByToken(users, token);
      if (!user) return json({ ok: false, error: "Unauthorized" }, 401);

      if (isNotify) {
        if (!hasNotifier(user)) {
          return json({ ok: false, error: "该用户尚未配置 ShowDoc 或 Telegram 通知" }, 400);
        }
        const userEnv = createUserEnv(env, user);
        userEnv.FORCE_PUSH_MESSAGE = "true";
        const result = await run(userEnv, { notify: true, commit: true });
        const { report: _report, ...summary } = result;
        return json({ userId: user.id, ...summary });
      }

      // HTTP viewing is read-only: no notification and no KV update.
      const result = await run(createUserEnv(env, user), {
        notify: false,
        commit: false,
      });
      return new Response(result.report, {
        headers: {
          "Content-Type": "text/plain;charset=UTF-8",
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    } catch (error) {
      console.error(error?.stack || error);
      return json({ ok: false, error: errorMessage(error) }, 500);
    }
  },
};

async function runScheduledUsers(env) {
  const users = loadUsers(env);
  const failures = [];

  // Sequential execution avoids sending a burst of logins to the school.
  for (const user of users) {
    try {
      const notifyEnabled = hasNotifier(user);
      const result = await run(createUserEnv(env, user), {
        notify: notifyEnabled,
        commit: true,
      });
      const { report: _report, ...summary } = result;
      console.log(JSON.stringify({ userId: user.id, ...summary }));
    } catch (error) {
      failures.push({ userId: user.id, error: errorMessage(error) });
      console.error(JSON.stringify(failures.at(-1)));
    }
  }

  if (failures.length) {
    throw new Error(`部分用户执行失败：${failures.map((item) => item.userId).join(", ")}`);
  }
}
