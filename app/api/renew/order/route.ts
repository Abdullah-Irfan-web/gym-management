import { handle, ok } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { renewOrderSchema } from "@/schemas";
import { verifyToken } from "@/lib/auth/tokens";
import { createCheckout } from "@/services/payments";
import { HttpError } from "@/utils/misc";
export const dynamic = "force-dynamic";
export const POST = handle(async (req: Request) => {
  rateLimit(req, "renew-order", 10);
  const i = renewOrderSchema.parse(await req.json());
  const memberId = verifyToken("renew-session", i.session);
  if (!memberId) throw new HttpError(401, "Your session expired. Please look up your membership again.");
  return ok(await createCheckout("RENEWAL", { planId: i.planId, memberId }));
});
