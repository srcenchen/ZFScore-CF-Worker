import { errorMessage, escapeHtml, splitTelegram } from "./utils.js";

const TIMEOUT_MS = 20_000;

export async function notify(env, title, text) {
  const tasks = [];
  if (env.TOKEN) {
    tasks.push(sendShowDoc(env.TOKEN, title, text).then(() => "ShowDoc"));
  }
  if (env.TG_BOT_TOKEN && env.TG_CHAT_ID) {
    tasks.push(
      sendTelegram(env.TG_BOT_TOKEN, env.TG_CHAT_ID, `${title}\n\n${text}`)
        .then(() => "Telegram"),
    );
  }

  const results = await Promise.allSettled(tasks);
  const failures = results.filter((result) => result.status === "rejected");
  if (failures.length) {
    throw new Error(
      `通知失败：${failures.map((result) => errorMessage(result.reason)).join("；")}`,
    );
  }
  return results.map((result) => result.value);
}

async function sendShowDoc(token, title, text) {
  const response = await fetch(
    `https://push.showdoc.com.cn/server/api/push/${encodeURIComponent(token)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, content: `<pre>${escapeHtml(text)}</pre>` }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    },
  );
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`ShowDoc HTTP ${response.status}: ${body.slice(0, 160)}`);
  }
  try {
    const data = JSON.parse(body);
    if (data.error_code && data.error_code !== 0) {
      throw new Error(data.error_message || body);
    }
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
  }
}

async function sendTelegram(botToken, chatId, text) {
  for (const chunk of splitTelegram(text)) {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: chunk,
        disable_web_page_preview: true,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const body = await response.text();
    if (!response.ok) {
      throw new Error(`Telegram HTTP ${response.status}: ${body.slice(0, 200)}`);
    }
    const data = JSON.parse(body);
    if (!data.ok) throw new Error(`Telegram: ${data.description || "未知错误"}`);
  }
}
