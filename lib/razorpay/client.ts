import Razorpay from "razorpay";
import { createHmac, timingSafeEqual } from "crypto";

let rz: Razorpay | null = null;
export function razorpay() {
  if (!rz) {
    const key_id = process.env.RAZORPAY_KEY_ID, key_secret = process.env.RAZORPAY_KEY_SECRET;
    if (!key_id || !key_secret) throw new Error("Razorpay keys are not configured");
    rz = new Razorpay({ key_id, key_secret });
  }
  return rz;
}
function safeEq(a: string, b: string) {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
export function verifyCheckoutSignature(orderId: string, paymentId: string, signature: string) {
  const exp = createHmac("sha256", process.env.RAZORPAY_KEY_SECRET ?? "").update(`${orderId}|${paymentId}`).digest("hex");
  return safeEq(exp, signature);
}
export function verifyWebhookSignature(rawBody: string, signature: string) {
  const exp = createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET ?? "").update(rawBody).digest("hex");
  return safeEq(exp, signature);
}
