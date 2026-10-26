import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

// ── Mots de passe (scrypt) ────────────────────────────────────────────────────
export function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(pw, salt, 64);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}
export function verifyPassword(pw, stored) {
  try {
    const [, s, h] = stored.split("$");
    const calc = crypto.scryptSync(pw, Buffer.from(s, "hex"), 64);
    return crypto.timingSafeEqual(calc, Buffer.from(h, "hex"));
  } catch {
    return false;
  }
}

// ── Secret de signature ───────────────────────────────────────────────────────
export function loadSecret(dataDir) {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  const file = path.join(dataDir, ".secret");
  if (fs.existsSync(file)) return fs.readFileSync(file, "utf8").trim();
  const secret = crypto.randomBytes(48).toString("hex");
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(file, secret, { mode: 0o600 });
  return secret;
}

// ── Jetons signés (HS256 minimal) ─────────────────────────────────────────────
const b64u = (b) => Buffer.from(b).toString("base64url");
export function signToken(payload, secret, ttlSec) {
  const body = b64u(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + ttlSec }));
  const sig = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}
export function verifyToken(token, secret) {
  if (typeof token !== "string") return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  const a = Buffer.from(sig), b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString());
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export const sha256 = (s) => crypto.createHash("sha256").update(s).digest("hex");
export function randomDigits(n = 6) {
  let out = "";
  while (out.length < n) out += crypto.randomInt(0, 10);
  return out;
}
export const randomId = () => crypto.randomBytes(16).toString("hex");

// ── TOTP (RFC 6238) pour la 2FA administrateur ────────────────────────────────
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export function randomBase32(len = 32) {
  let s = "";
  for (let i = 0; i < len; i++) s += B32[crypto.randomInt(0, 32)];
  return s;
}
function base32Decode(str) {
  let bits = "";
  for (const c of str.replace(/=+$/, "").toUpperCase()) bits += B32.indexOf(c).toString(2).padStart(5, "0");
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}
export function totp(secret, atMs = Date.now(), step = 30, digits = 6) {
  const counter = Math.floor(atMs / 1000 / step);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const h = crypto.createHmac("sha1", base32Decode(secret)).update(buf).digest();
  const o = h[h.length - 1] & 0xf;
  return ((h.readUInt32BE(o) & 0x7fffffff) % 10 ** digits).toString().padStart(digits, "0");
}
export function verifyTotp(secret, code, window = 1) {
  const c = String(code).trim();
  if (!/^\d{6}$/.test(c)) return false;
  for (let w = -window; w <= window; w++) {
    const expected = totp(secret, Date.now() + w * 30_000);
    if (crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(c))) return true;
  }
  return false;
}
export const otpauthUrl = (username, secret) =>
  `otpauth://totp/Proximo%20CI:${encodeURIComponent(username)}?secret=${secret}&issuer=Proximo%20CI`;
