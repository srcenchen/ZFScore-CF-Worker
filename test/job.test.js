import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import test from "node:test";

import { run } from "../src/job.js";

test("HTTP view mode neither notifies nor writes KV", async (context) => {
  const { publicKey } = generateKeyPairSync("rsa", { modulusLength: 1024 });
  const jwk = publicKey.export({ format: "jwk" });
  const modulus = Buffer.concat([Buffer.from([0]), fromBase64Url(jwk.n)]).toString("base64");
  const exponent = fromBase64Url(jwk.e).toString("base64");
  let pushes = 0;
  let writes = 0;

  const originalFetch = globalThis.fetch;
  context.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async (input, init = {}) => {
    const url = String(input);
    if (url.includes("push.showdoc")) {
      pushes++;
      return Response.json({ error_code: 0 });
    }
    if (url.includes("login_getPublicKey")) {
      return Response.json({ modulus, exponent });
    }
    if (url.includes("login_slogin") && (init.method || "GET") === "GET") {
      return new Response('<input id="csrftoken" value="csrf">', {
        headers: { "Set-Cookie": "route=a; Path=/, JSESSIONID=b; Path=/jwglxt" },
      });
    }
    if (url.includes("login_slogin")) return new Response("<title>首页</title>");
    if (url.includes("index_cxYhxxIndex")) {
      return new Response(
        '<h4 class="media-heading">测试学生&nbsp;学生</h4>'
        + '<div class="media-body"><p>计算机学院 软件1班</p></div>',
      );
    }
    if (url.includes("cjcx_cxXsgrcj")) {
      return Response.json({
        items: [{
          jxb_id: "c1",
          kcmc: "测试课程",
          jsxm: "教师",
          xf: "2",
          cj: "90",
          bfzcj: "90",
          xfjd: "7",
          tjsj: "2026-06-30 10:00:00",
          tjrxm: "教师",
        }],
      });
    }
    if (url.includes("kscx_cxXsksxxIndex")) return Response.json({ items: [] });
    if (url.includes("xsxxwh_cxXsxkxx")) {
      return Response.json({ items: [{ jxb_id: "c1", kcmc: "测试课程" }] });
    }
    throw new Error(`Unexpected URL: ${url}`);
  };

  const values = new Map();
  const scoreHash = {
    get: (key) => Promise.resolve(values.get(key) ?? null),
    put: (key, value) => {
      writes++;
      values.set(key, value);
      return Promise.resolve();
    },
  };
  const result = await run(
    {
      URL: "https://school.example/jwglxt/",
      USERNAME: "123",
      PASSWORD: "password",
      score_hash: scoreHash,
    },
    { notify: false, commit: false },
  );

  assert.equal(result.ok, true);
  assert.equal(result.notified, false);
  assert.equal(result.committed, false);
  assert.equal(pushes, 0);
  assert.equal(writes, 0);
  assert.match(result.report, /测试学生/);
  assert.match(result.report, /测试课程/);
});

function fromBase64Url(value) {
  return Buffer.from(value.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}
