import assert from "node:assert/strict";
import { constants, generateKeyPairSync, privateDecrypt } from "node:crypto";
import test from "node:test";

import { rsaPkcs1Encrypt } from "../src/rsa.js";

test("RSA handles Java BigInteger leading sign byte", () => {
  const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 1024 });
  const jwk = publicKey.export({ format: "jwk" });
  const modulus = Buffer.concat([Buffer.from([0]), fromBase64Url(jwk.n)]).toString("base64");
  const exponent = fromBase64Url(jwk.e).toString("base64");

  const encrypted = Buffer.from(
    rsaPkcs1Encrypt("测试Password-123", modulus, exponent),
    "base64",
  );
  assert.equal(encrypted.length, 128);
  const decrypted = privateDecrypt(
    { key: privateKey, padding: constants.RSA_PKCS1_PADDING },
    encrypted,
  );
  assert.equal(decrypted.toString(), "测试Password-123");
});

function fromBase64Url(value) {
  return Buffer.from(value.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}
