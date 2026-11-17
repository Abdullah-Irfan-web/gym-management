import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { HttpError } from "@/utils/misc";

export const COOKIE = "gym_session";
const key = () => {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) throw new Error("AUTH_SECRET is missing or too short");
  return new TextEncoder().encode(s);
};

export async function verifyCredentials(email: string, password: string): Promise<boolean> {
  const adminEmail = (process.env.ADMIN_EMAIL ?? "").toLowerCase();
  const hash = (process.env.ADMIN_PASSWORD_HASH ?? "").replace(/\\\$/g, "$");
  // Always run bcrypt so response time doesn't reveal whether the email matched.
  const ok = await bcrypt.compare(password, hash || "$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvali");
  return !!hash && ok && email.toLowerCase() === adminEmail;
}
export async function createSession(email: string) {
  const jwt = await new SignJWT({ role: "owner", gymId: "default" }).setProtectedHeader({ alg: "HS256" })
    .setSubject(email).setIssuedAt().setExpirationTime("8h").sign(key());
  cookies().set(COOKIE, jwt, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 8 * 3600 });
}
export function destroySession() { cookies().delete(COOKIE); }
export async function getSession(): Promise<{ email: string; gymId: string } | null> {
  const t = cookies().get(COOKIE)?.value;
  if (!t) return null;
  try { const { payload } = await jwtVerify(t, key()); return { email: String(payload.sub), gymId: String(payload.gymId ?? "default") }; }
  catch { return null; }
}
/** Defence in depth: every admin route handler calls this even though middleware also guards /api/admin. */
export async function requireAdmin() {
  const s = await getSession();
  if (!s) throw new HttpError(401, "Not signed in");
  return s;
}
