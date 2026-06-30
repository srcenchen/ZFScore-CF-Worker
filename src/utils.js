export function form(data) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(data)) params.set(key, String(value));
  return params;
}

export async function sha256(text) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function attrById(html, id, attr) {
  const tag = html.match(new RegExp(`<[^>]+\\bid=["']${escapeRegExp(id)}["'][^>]*>`, "i"))?.[0] || "";
  return decodeHtml(tag.match(new RegExp(`\\b${attr}=["']([^"']*)["']`, "i"))?.[1] || "");
}

export function extractTips(html) {
  const match = html.match(/<p\b[^>]*\bid=["']tips["'][^>]*>([\s\S]*?)<\/p>/i);
  return match ? stripTags(match[1]).trim() : "";
}

export function textFromClass(html, tag, className) {
  const match = html.match(
    new RegExp(
      `<${tag}\\b[^>]*\\bclass=["'][^"']*\\b${escapeRegExp(className)}\\b[^"']*["'][^>]*>([\\s\\S]*?)<\\/${tag}>`,
      "i",
    ),
  );
  return match ? stripTags(match[1]).trim() : "";
}

export function textFromMediaBody(html) {
  const start = html.search(/<div\b[^>]*class=["'][^"']*\bmedia-body\b/i);
  if (start < 0) return "";
  const match = html.slice(start, start + 3000).match(/<p\b[^>]*>([\s\S]*?)<\/p>/i);
  return match ? stripTags(match[1]).trim() : "";
}

export function isLoginPage(html) {
  return /<h5\b[^>]*>\s*用户登录\s*<\/h5>/i.test(html)
    || /<title\b[^>]*>\s*用户登录\s*<\/title>/i.test(html);
}

export function stripTags(html) {
  return decodeHtml(
    String(html)
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " "),
  );
}

export function decodeHtml(text) {
  const named = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
  return String(text).replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (_, entity) => {
    if (entity[0] === "#") {
      const hex = entity[1].toLowerCase() === "x";
      return String.fromCodePoint(parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10));
    }
    return named[entity.toLowerCase()] ?? `&${entity};`;
  });
}

export function normalizeTitle(value) {
  return String(value || "").replace(/（/g, "(").replace(/）/g, ")");
}

export function splitTelegram(text, limit = 3900) {
  const chunks = [];
  let rest = text;
  while (rest.length > limit) {
    let cut = rest.lastIndexOf("\n", limit);
    if (cut < limit * 0.6) cut = limit;
    chunks.push(rest.slice(0, cut));
    rest = rest.slice(cut).replace(/^\n/, "");
  }
  if (rest) chunks.push(rest);
  return chunks;
}

export function beijingDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function beijingDateTime() {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    dateStyle: "medium",
    timeStyle: "medium",
    hour12: false,
  }).format(new Date());
}

export function number(value) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function isTrue(value) {
  return /^(1|true|yes|on)$/i.test(String(value || ""));
}

export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function errorMessage(error) {
  if (error?.name === "TimeoutError") return "请求超时";
  return error?.message || String(error);
}

export async function parseJsonResponse(response, name) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${name}返回格式错误：${text.slice(0, 100)}`);
  }
}

export function json(value, status = 200) {
  return new Response(JSON.stringify(value, null, 2), {
    status,
    headers: { "Content-Type": "application/json;charset=UTF-8" },
  });
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
