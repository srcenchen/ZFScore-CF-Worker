/**
 * RSAES-PKCS1-v1_5 encryption used by ZFSoft login pages.
 * Cloudflare Web Crypto does not expose RSAES-PKCS1-v1_5 encryption,
 * so this small implementation uses BigInt modular exponentiation.
 */
export function rsaPkcs1Encrypt(password, modulusB64, exponentB64) {
  if (!modulusB64 || !exponentB64) throw new Error("教务系统登录公钥格式错误");

  // ZFSoft serializes a Java BigInteger. A leading 00 is a sign byte, not
  // part of the modulus length. Python int() discarded it in the upstream app.
  const modulusBytes = trimLeadingZeros(base64Bytes(modulusB64));
  const exponentBytes = base64Bytes(exponentB64);
  const message = new TextEncoder().encode(password);
  const keyLength = modulusBytes.length;
  if (message.length > keyLength - 11) throw new Error("密码过长，无法进行 RSA 加密");

  const padded = new Uint8Array(keyLength);
  padded[0] = 0;
  padded[1] = 2;
  const paddingLength = keyLength - message.length - 3;
  for (let i = 0; i < paddingLength; i++) {
    let value = 0;
    while (value === 0) value = crypto.getRandomValues(new Uint8Array(1))[0];
    padded[2 + i] = value;
  }
  padded[2 + paddingLength] = 0;
  padded.set(message, 3 + paddingLength);

  const encrypted = modPow(
    bytesToBigInt(padded),
    bytesToBigInt(exponentBytes),
    bytesToBigInt(modulusBytes),
  );
  return bytesBase64(bigIntToBytes(encrypted, keyLength));
}

function trimLeadingZeros(bytes) {
  let offset = 0;
  while (offset < bytes.length - 1 && bytes[offset] === 0) offset++;
  return offset ? bytes.slice(offset) : bytes;
}

function modPow(base, exponent, modulus) {
  let result = 1n;
  base %= modulus;
  while (exponent > 0n) {
    if (exponent & 1n) result = (result * base) % modulus;
    exponent >>= 1n;
    base = (base * base) % modulus;
  }
  return result;
}

function bytesToBigInt(bytes) {
  let value = 0n;
  for (const byte of bytes) value = (value << 8n) | BigInt(byte);
  return value;
}

function bigIntToBytes(value, length) {
  const bytes = new Uint8Array(length);
  for (let i = length - 1; i >= 0; i--) {
    bytes[i] = Number(value & 255n);
    value >>= 8n;
  }
  return bytes;
}

function base64Bytes(value) {
  const raw = atob(value.replace(/\s/g, ""));
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

function bytesBase64(bytes) {
  let raw = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    raw += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(raw);
}
