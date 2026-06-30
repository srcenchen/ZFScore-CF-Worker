const USER_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

export function loadUsers(env) {
  if (!env.USERS_JSON) return [legacyUser(env)];

  let input;
  try {
    input = JSON.parse(env.USERS_JSON);
  } catch (error) {
    throw new Error(`USERS_JSON 不是有效 JSON：${error.message}`);
  }
  if (!Array.isArray(input) || input.length === 0) {
    throw new Error("USERS_JSON 必须是非空数组");
  }

  const users = input.map(normalizeUser);
  assertUnique(users, "id");
  assertUnique(users, "token");
  return users;
}

export function findUserByToken(users, token) {
  if (!token) return null;
  return users.find((user) => timingSafeEqual(user.token, token)) || null;
}

export function createUserEnv(rootEnv, user) {
  const prefix = user.legacy ? "" : `user:${user.id}:`;
  return {
    URL: user.url,
    USERNAME: user.username,
    PASSWORD: user.password,
    TOKEN: user.showdocToken,
    TG_BOT_TOKEN: user.telegramBotToken,
    TG_CHAT_ID: user.telegramChatId,
    FORCE_PUSH_MESSAGE: user.forcePush ? "true" : "false",
    score_hash: rootEnv.score_hash
      ? new NamespacedKV(rootEnv.score_hash, prefix)
      : undefined,
  };
}

export function hasNotifier(user) {
  return Boolean(
    user.showdocToken
    || (user.telegramBotToken && user.telegramChatId),
  );
}

class NamespacedKV {
  constructor(kv, prefix) {
    this.kv = kv;
    this.prefix = prefix;
  }

  get(key, options) {
    return this.kv.get(`${this.prefix}${key}`, options);
  }

  put(key, value, options) {
    return this.kv.put(`${this.prefix}${key}`, value, options);
  }

  delete(key) {
    return this.kv.delete(`${this.prefix}${key}`);
  }
}

function normalizeUser(value, index) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`USERS_JSON[${index}] 必须是对象`);
  }
  const user = {
    id: requiredString(value.id, `USERS_JSON[${index}].id`),
    token: requiredString(value.token, `USERS_JSON[${index}].token`),
    url: requiredString(value.url, `USERS_JSON[${index}].url`),
    username: requiredString(value.username, `USERS_JSON[${index}].username`),
    password: requiredString(value.password, `USERS_JSON[${index}].password`, false),
    showdocToken: optionalString(value.showdocToken),
    telegramBotToken: optionalString(value.telegramBotToken),
    telegramChatId: optionalString(value.telegramChatId),
    forcePush: value.forcePush === true,
    legacy: false,
  };
  if (!USER_ID_PATTERN.test(user.id)) {
    throw new Error(`用户 id “${user.id}” 只能包含字母、数字、下划线和连字符，最长 64 位`);
  }
  if (Boolean(user.telegramBotToken) !== Boolean(user.telegramChatId)) {
    throw new Error(`用户 ${user.id} 的 Telegram Bot Token 和 Chat ID 必须同时配置`);
  }
  return user;
}

function legacyUser(env) {
  return {
    id: "default",
    token: env.ADMIN_TOKEN || "",
    url: env.URL || "",
    username: env.USERNAME || "",
    password: env.PASSWORD || "",
    showdocToken: env.TOKEN || "",
    telegramBotToken: env.TG_BOT_TOKEN || "",
    telegramChatId: env.TG_CHAT_ID || "",
    forcePush: /^(1|true|yes|on)$/i.test(String(env.FORCE_PUSH_MESSAGE || "")),
    legacy: true,
  };
}

function requiredString(value, path, trim = true) {
  if (typeof value !== "string" || (trim ? !value.trim() : value.length === 0)) {
    throw new Error(`${path} 必须是非空字符串`);
  }
  return trim ? value.trim() : value;
}

function optionalString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function assertUnique(users, field) {
  const seen = new Set();
  for (const user of users) {
    if (seen.has(user[field])) throw new Error(`USERS_JSON 中存在重复的 ${field}`);
    seen.add(user[field]);
  }
}

function timingSafeEqual(left, right) {
  if (typeof right !== "string" || left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index++) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}
