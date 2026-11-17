import { handle, ok } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { renewLookupSchema } from "@/schemas";
import { signToken, verifyToken } from "@/lib/auth/tokens";
import { findByEmailAndPhone } from "@/services/members";
import { getMember } from "@/services/members";
import { listPlans } from "@/services/plans";
import { HttpError } from "@/utils/misc";
export const dynamic = "force-dynamic";
export const POST = handle(async (req: Request) => {
  rateLimit(req, "renew-lookup", 8);
  const i = renewLookupSchema.parse(await req.json());
  let memberId: string | null = null;
  if (i.token) { memberId = verifyToken("renew", i.token); if (!memberId) throw new HttpError(400, "This renewal link has expired. Enter your email and mobile number instead."); }
  else { const r = await findByEmailAndPhone(i.email!, i.phone!); memberId = r?.["Member ID"] ?? null; }
  // Same message for "not found" and "mismatch" so the endpoint can't be used to probe who is a member.
  const m = memberId ? await getMember(memberId) : null;
  if (!m) throw new HttpError(404, "We couldn't find a membership with those details. Check them and try again.");
  return ok({
    session: signToken("renew-session", m.id, 30 * 60),
    member: { name: m.fullName, id: m.id, plan: m.plan, expiry: m.expiryDate, status: m.status },
    plans: await listPlans(true),
  });
});
