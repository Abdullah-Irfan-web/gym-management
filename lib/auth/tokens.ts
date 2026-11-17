import { createHmac, timingSafeEqual } from "crypto";

/** Compact signed tokens: base64url(payload).base64url(hmac). Unguessable, expiring, tamper-proof. */
const secret = () => {
  const s = process.env.RENEWAL_LINK_SECRET;
  if (!s || s.length < 16) throw new Error("RENEWAL_LINK_SECRET is missing or too short");
  return s;
};
const b64 = (b: Buffer | string) => Buffer.from(b).toString("base64url");

export function signToken(kind: string, subject: string, ttlSeconds: number): string {
  const body = b64(JSON.stringify({ k: kind, s: subject, e: Math.floor(Date.now() / 1000) + ttlSeconds }));
  const sig = b64(createHmac("sha256", secret()).update(body).digest());
  return `${body}.${sig}`;
}
export function verifyToken(kind: string, token: string): string | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", secret()).update(body).digest();
  const given = Buffer.from(sig, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString());
    if (p.k !== kind || p.e < Date.now() / 1000) return null;
    return String(p.s);
  } catch { return null; }
}
export const DAY = 86400;
