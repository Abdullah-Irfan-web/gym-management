import { createHash } from "crypto";
import { sheetRepo } from "@/lib/google-sheets/repository";
import { razorpay } from "@/lib/razorpay/client";
import { getPlan } from "./plans";
import { getSettings } from "./settings";
import { findDuplicate, getMember } from "./members";
import { admitMember, renewMember } from "./membership";
import { notify, memberCtx } from "./notifications";
import { templates } from "@/lib/email/templates";
import { audit } from "./audit";
import { newMemberId, newId } from "@/utils/ids";
import { HttpError, normEmail, normPhone, nowIso, num } from "@/utils/misc";
import { todayIn } from "@/utils/dates";

type Kind = "ADMISSION" | "RENEWAL";
const REUSE_WINDOW_MS = 30 * 60_000;

export interface CheckoutOrder { orderId: string; amount: number; currency: string; keyId: string; planName: string; gymName: string; prefill: { name: string; email: string; contact: string } }

/**
 * Creates (or reuses) a Razorpay order. Price ALWAYS comes from the Plans sheet.
 * Retrying with the same details within 30 min reuses the same order => no duplicate orders/records.
 */
export async function createCheckout(kind: Kind, input: { planId: string; details?: any; memberId?: string }): Promise<CheckoutOrder> {
  const plan = await getPlan(input.planId, { requireActive: true });
  const s = await getSettings();
  let details = input.details, memberId = input.memberId;

  if (kind === "ADMISSION") {
    const dup = await findDuplicate(details.email, details.phone);
    if (dup) throw new HttpError(409, "You already have a membership with these details. Please use the Renew page instead.");
  } else {
    const m = await getMember(memberId!);
    if (!m) throw new HttpError(404, "Member not found");
    details = { fullName: m.fullName, email: m.email, phone: m.phone };
  }
  const fingerprint = createHash("sha256").update([kind, memberId ?? "", normEmail(details.email), normPhone(details.phone), plan.id, plan.price].join("|")).digest("hex").slice(0, 32);

  const pending = await sheetRepo.search("PendingOrders", (r) => r["Fingerprint"] === fingerprint && r["Status"] === "CREATED" && Date.now() - Date.parse(r["Created At"]) < REUSE_WINDOW_MS, { fresh: true });
  const reuse = pending[0];
  const base = { amount: plan.price, currency: s.currency, keyId: process.env.RAZORPAY_KEY_ID ?? "", planName: plan.name, gymName: s.gymName, prefill: { name: details.fullName, email: details.email, contact: details.phone } };
  if (reuse) return { ...base, orderId: reuse["Razorpay Order ID"] };

  const newMember = kind === "ADMISSION" ? newMemberId() : (memberId as string);
  const order = await razorpay().orders.create({
    amount: Math.round(plan.price * 100), currency: s.currency, receipt: newId("RCPT"),
    notes: { kind, memberId: newMember, planId: plan.id },
  });
  await sheetRepo.append("PendingOrders", {
    "Razorpay Order ID": order.id, Kind: kind, "Payload JSON": JSON.stringify({ details, planId: plan.id }), Amount: plan.price, Status: "CREATED",
    "Member ID": newMember, Fingerprint: fingerprint, "Created At": nowIso(), "Updated At": nowIso(),
  });
  return { ...base, orderId: order.id };
}

/** Confirms with Razorpay itself that the payment is captured, belongs to this order, and matches the amount. */
async function confirmPayment(orderId: string, paymentId: string, expectedAmount: number) {
  let p: any = await razorpay().payments.fetch(paymentId);
  if (p.order_id !== orderId) throw new HttpError(400, "Payment does not belong to this order");
  if (p.status === "authorized") p = await razorpay().payments.capture(paymentId, p.amount, p.currency);
  if (p.status !== "captured") return { ok: false as const, status: p.status as string, method: p.method as string };
  if (Number(p.amount) !== Math.round(expectedAmount * 100)) throw new HttpError(400, "Payment amount mismatch");
  return { ok: true as const, status: "captured", method: String(p.method ?? "online") };
}

/**
 * THE only place that turns a Razorpay payment into membership state.
 * Called by /api/payments/verify, the webhook, and the recovery cron. Idempotent end to end.
 */
export async function finalizeOrder(orderId: string, paymentId: string): Promise<{ status: "FINALIZED" | "NOT_CAPTURED"; memberId?: string; paymentId?: string }> {
  const order = await sheetRepo.findById("PendingOrders", orderId, { fresh: true });
  if (!order) throw new HttpError(404, "Unknown order");
  if (order["Status"] === "FINALIZED") return { status: "FINALIZED", memberId: order["Member ID"], paymentId: order["Payment ID"] };

  const check = await confirmPayment(orderId, paymentId, num(order["Amount"]));
  if (!check.ok) return { status: "NOT_CAPTURED" };

  // Money is confirmed. Persist that fact FIRST so a crash below can be recovered by the cron.
  await sheetRepo.updateById("PendingOrders", orderId, { Status: "PAID_UNFINALIZED", "Payment ID": paymentId });

  const payload = JSON.parse(order["Payload JSON"]);
  const plan = await getPlan(payload.planId);
  const memberId = order["Member ID"];
  const pay = { razorpayOrderId: orderId, razorpayPaymentId: paymentId, amount: num(order["Amount"]), method: check.method, source: "Razorpay" as const };
  const g = await getSettings();

  if (order["Kind"] === "ADMISSION") {
    const r = await admitMember({ memberId, details: { address: "", gender: "", dateOfBirth: "", emergencyContact: "", ...payload.details }, plan, payment: { ...pay, type: "New Admission" } });
    await sheetRepo.updateById("PendingOrders", orderId, { Status: "FINALIZED", "Payment ID": r.paymentId });
    await audit("system", "MEMBER_CREATED", "Member", memberId, { orderId, paymentId });
    const ctx = await memberCtx(memberId, { amount: pay.amount });
    if (ctx) await notify({ key: `WELCOME:${r.paymentId}`, type: "WELCOME", memberId, to: payload.details.email, scheduledDate: todayIn(g.timezone), render: async () => templates.WELCOME(g, ctx) });
    return { status: "FINALIZED", memberId, paymentId: r.paymentId };
  }
  const r = await renewMember({ memberId, plan, payment: { ...pay, type: "Renewal" } });
  await sheetRepo.updateById("PendingOrders", orderId, { Status: "FINALIZED", "Payment ID": r.paymentId });
  await audit("system", r.reactivated ? "MEMBER_REACTIVATED" : "MEMBER_RENEWED", "Member", memberId, { orderId, paymentId, expiry: r.expiry });
  const ctx = await memberCtx(memberId, { amount: pay.amount });
  if (ctx) await notify({ key: `RENEWAL_CONFIRMATION:${r.paymentId}`, type: "RENEWAL_CONFIRMATION", memberId, to: ctx ? (await getMember(memberId))!.email : "", scheduledDate: todayIn(g.timezone), render: async () => templates.RENEWAL_CONFIRMATION(g, { ...ctx, reactivated: r.reactivated }) });
  return { status: "FINALIZED", memberId, paymentId: r.paymentId };
}

/** Records a failed attempt (from webhook). Never affects membership. */
export async function recordFailure(orderId: string, paymentId: string, method: string, reason: string) {
  const order = await sheetRepo.findById("PendingOrders", orderId, { fresh: true });
  if (!order || order["Status"] === "FINALIZED") return;
  const payload = JSON.parse(order["Payload JSON"]);
  const g = await getSettings();
  await sheetRepo.appendUnique("Payments", "Razorpay Payment ID", {
    "Payment ID": newId("PAY"), "Member ID": order["Member ID"], "Member Name": payload.details?.fullName ?? "", "Payment Amount": num(order["Amount"]),
    "Payment Date": todayIn(g.timezone), "Payment Method": method, "Razorpay Order ID": orderId, "Razorpay Payment ID": paymentId,
    "Razorpay Signature Verification Status": "Webhook verified", "Payment Type": order["Kind"] === "ADMISSION" ? "New Admission" : "Renewal",
    "Payment Status": "Failed", Source: "Razorpay", "Created At": nowIso(),
  });
  void reason;
}

/** Recovery: finalize paid-but-unfinalized orders and orders whose webhook never arrived. */
export async function recoverOrders(): Promise<{ checked: number; finalized: number }> {
  const orders = await sheetRepo.search("PendingOrders", (r) =>
    (r["Status"] === "PAID_UNFINALIZED") || (r["Status"] === "CREATED" && Date.now() - Date.parse(r["Created At"]) > 3 * 60_000 && Date.now() - Date.parse(r["Created At"]) < 48 * 3600_000), { fresh: true });
  let finalized = 0;
  for (const o of orders) {
    try {
      let payId = o["Payment ID"];
      if (!payId) {
        const list: any = await razorpay().orders.fetchPayments(o["Razorpay Order ID"]);
        payId = list.items?.find((p: any) => p.status === "captured" || p.status === "authorized")?.id;
      }
      if (!payId) continue;
      const r = await finalizeOrder(o["Razorpay Order ID"], payId);
      if (r.status === "FINALIZED") finalized++;
    } catch (e) { console.error("[recover]", o["Razorpay Order ID"], e); }
  }
  return { checked: orders.length, finalized };
}
