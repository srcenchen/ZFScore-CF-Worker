import { run } from "./job.js";
import { errorMessage, json } from "./utils.js";

export default {
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(
      run(env, { notify: true, commit: true }).then(({ report: _report, ...summary }) => {
        console.log(JSON.stringify(summary));
      }),
    );
  },

  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/health") {
      return json({ ok: true, service: "ZFCheckScores Worker" });
    }

    if (!env.ADMIN_TOKEN) {
      return json({ ok: false, error: "请先配置 ADMIN_TOKEN，避免成绩被公开访问" }, 503);
    }
    const supplied = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "")
      || url.searchParams.get("token");
    if (supplied !== env.ADMIN_TOKEN) return json({ ok: false, error: "Unauthorized" }, 401);
    if (request.method !== "POST" && request.method !== "GET") {
      return json({ ok: false, error: "Method Not Allowed" }, 405);
    }

    try {
      // HTTP viewing is read-only: no notification and no KV update.
      const result = await run(env, { notify: false, commit: false });
      return new Response(result.report, {
        headers: {
          "Content-Type": "text/plain;charset=UTF-8",
          "Cache-Control": "no-store",
        },
      });
    } catch (error) {
      console.error(error?.stack || error);
      return json({ ok: false, error: errorMessage(error) }, 500);
    }
  },
};
