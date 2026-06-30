import assert from "node:assert/strict";
import test from "node:test";

import {
  createUserEnv,
  findUserByToken,
  loadUsers,
} from "../src/users.js";

test("USERS_JSON selects users by token and isolates KV keys", async () => {
  const operations = [];
  const rootEnv = {
    USERS_JSON: JSON.stringify([
      {
        id: "alice",
        token: "alice-secret-token",
        url: "https://school.example/jwglxt/",
        username: "1001",
        password: "alice-password",
      },
      {
        id: "bob",
        token: "bob-secret-token",
        url: "https://school.example/jwglxt/",
        username: "1002",
        password: "bob-password",
      },
    ]),
    score_hash: {
      get: (key) => { operations.push(["get", key]); return Promise.resolve(null); },
      put: (key, value) => { operations.push(["put", key, value]); return Promise.resolve(); },
    },
  };

  const users = loadUsers(rootEnv);
  const bob = findUserByToken(users, "bob-secret-token");
  assert.equal(bob.id, "bob");
  assert.equal(findUserByToken(users, "wrong-token"), null);

  const bobEnv = createUserEnv(rootEnv, bob);
  await bobEnv.score_hash.put("last_grade_hash", "hash");
  await bobEnv.score_hash.get("initialized");
  assert.deepEqual(operations, [
    ["put", "user:bob:last_grade_hash", "hash"],
    ["get", "user:bob:initialized"],
  ]);
});

test("USERS_JSON rejects duplicate ids and incomplete Telegram configuration", () => {
  const base = {
    id: "same",
    token: "token-1",
    url: "https://school.example/jwglxt/",
    username: "1001",
    password: "password",
  };
  assert.throws(
    () => loadUsers({
      USERS_JSON: JSON.stringify([base, { ...base, token: "token-2" }]),
    }),
    /重复的 id/,
  );
  assert.throws(
    () => loadUsers({
      USERS_JSON: JSON.stringify([{ ...base, telegramBotToken: "bot-only" }]),
    }),
    /必须同时配置/,
  );
});

test("legacy single-user configuration keeps the original unprefixed KV keys", async () => {
  const keys = [];
  const rootEnv = {
    URL: "https://school.example/jwglxt/",
    USERNAME: "1001",
    PASSWORD: "password",
    ADMIN_TOKEN: "legacy-token",
    score_hash: {
      get: (key) => { keys.push(key); return Promise.resolve(null); },
      put: () => Promise.resolve(),
    },
  };
  const [legacy] = loadUsers(rootEnv);
  await createUserEnv(rootEnv, legacy).score_hash.get("initialized");
  assert.deepEqual(keys, ["initialized"]);
});
