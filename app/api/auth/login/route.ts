import { handle, ok } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { loginSchema } from "@/schemas";
import { createSession, verifyCredentials } from "@/lib/auth/session";
import { HttpError } from "@/utils/misc";
export const dynamic = "force-dynamic";
export const POST = handle(async (req: Request) => {
  rateLimit(req, "login", 5, 5 * 60_000);
  const i = loginSchema.parse(await req.json());
  if (!(await verifyCredentials(i.email, i.password))) throw new HttpError(401, "Incorrect email or password");
  await createSession(i.email);
  return ok();
});
