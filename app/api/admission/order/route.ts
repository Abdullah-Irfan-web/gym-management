import { handle, ok } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { admissionSchema } from "@/schemas";
import { createCheckout } from "@/services/payments";
export const dynamic = "force-dynamic";
export const POST = handle(async (req: Request) => {
  rateLimit(req, "admission", 10);
  const { planId, ...details } = admissionSchema.parse(await req.json());
  return ok(await createCheckout("ADMISSION", { planId, details }));
});
