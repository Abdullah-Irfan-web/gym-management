import { handle, ok } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { verifySchema } from "@/schemas";
import { verifyCheckoutSignature } from "@/lib/razorpay/client";
import { finalizeOrder } from "@/services/payments";
import { HttpError } from "@/utils/misc";
export const dynamic = "force-dynamic";
export const POST = handle(async (req: Request) => {
  rateLimit(req, "verify", 20);
  const i = verifySchema.parse(await req.json());
  if (!verifyCheckoutSignature(i.razorpay_order_id, i.razorpay_payment_id, i.razorpay_signature)) throw new HttpError(400, "Payment could not be verified");
  // Signature only proves the browser callback is authentic; finalizeOrder re-checks with Razorpay's API.
  const r = await finalizeOrder(i.razorpay_order_id, i.razorpay_payment_id);
  return ok({ status: r.status });
});
