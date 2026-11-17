import { NextResponse } from "next/server";
import { verifyWebhookSignature } from "@/lib/razorpay/client";
import { sheetRepo } from "@/lib/google-sheets/repository";
import { finalizeOrder, recordFailure } from "@/services/payments";
import { nowIso } from "@/utils/misc";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const raw = await req.text(); // signature is computed over the exact raw body
  const sig = req.headers.get("x-razorpay-signature") ?? "";
  if (!sig || !verifyWebhookSignature(raw, sig)) return NextResponse.json({ error: "bad signature" }, { status: 400 });
  const eventId = req.headers.get("x-razorpay-event-id") ?? "";
  try {
    if (eventId && (await sheetRepo.findById("WebhookEvents", eventId, { fresh: true }))) return NextResponse.json({ ok: true, duplicate: true });
    const ev = JSON.parse(raw);
    const pay = ev.payload?.payment?.entity;
    if (pay?.order_id && (ev.event === "payment.captured" || ev.event === "order.paid" || ev.event === "payment.authorized")) await finalizeOrder(pay.order_id, pay.id);
    else if (pay?.order_id && ev.event === "payment.failed") await recordFailure(pay.order_id, pay.id, pay.method ?? "", pay.error_description ?? "");
    if (eventId) await sheetRepo.appendUnique("WebhookEvents", "Event ID", { "Event ID": eventId, "Event Type": ev.event, "Received At": nowIso(), Result: "done" });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[webhook]", e);
    return NextResponse.json({ error: "retry" }, { status: 500 }); // non-2xx => Razorpay retries; finalize is idempotent
  }
}
