import assert from "node:assert/strict";
import test from "node:test";

import worker from "../src/index.js";

test("root returns an immediate loading UI", async () => {
  const response = await worker.fetch(new Request("https://worker.example/"), {});
  const html = await response.text();
  assert.match(response.headers.get("Content-Type"), /text\/html/);
  assert.match(html, /class="spinner"/);
  assert.match(html, /\/api\/report/);
  assert.match(html, /访问 Token/);
  assert.doesNotMatch(html, /history\.replaceState/);
});

test("report API rejects an unknown user token before querying school", async () => {
  const response = await worker.fetch(
    new Request("https://worker.example/api/report", {
      headers: { Authorization: "Bearer wrong" },
    }),
    {
      USERS_JSON: JSON.stringify([{
        id: "user1",
        token: "correct-token",
        url: "https://school.example/jwglxt/",
        username: "1001",
        password: "password",
      }]),
    },
  );
  assert.equal(response.status, 401);
  assert.match(await response.text(), /Unauthorized/);
});

test("manual notification requires a configured notification channel", async () => {
  const response = await worker.fetch(
    new Request("https://worker.example/notify?token=correct-token"),
    {
      USERS_JSON: JSON.stringify([{
        id: "user1",
        token: "correct-token",
        url: "https://school.example/jwglxt/",
        username: "1001",
        password: "password",
      }]),
    },
  );
  assert.equal(response.status, 400);
  assert.match(await response.text(), /尚未配置/);
});
