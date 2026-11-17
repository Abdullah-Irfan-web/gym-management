/**
 * Core membership logic shared by online (Razorpay) and manual (owner) flows.
 * Every function here is idempotent, so a retry after a partial failure converges to the same state.
 */
import { sheetRepo } from "@/lib/google-sheets/repository";
import { getSettings } from "./settings";
import { Plan, durationLabel } from "./plans";
import { computeExpiry, addDaysStr, computeStatus, todayIn } from "@/utils/dates";
import { newId } from "@/utils/ids";
import { nowIso, num } from "@/utils/misc";
import type { PaymentType } from "@/types";

export interface PaymentInput {
  paymentId?: string; razorpayOrderId?: string; razorpayPaymentId?: string; amount: number; method: string; source: "Razorpay" | "Manual";
  type: PaymentType;
}
export interface ApplyResult { memberId: string; paymentId: string; start: string; expiry: string; reactivated: boolean; created: boolean }

/** Date rule: active -> starts the day after current expiry; expired/inactive -> starts today. */
export function renewalStart(currentExpiry: string, today: string): string {
  return currentExpiry && currentExpiry >= today ? addDaysStr(currentExpiry, 1) : today;
}

async function recordPayment(p: PaymentInput, memberId: string, name: string, start: string, expiry: string, planName: string) {
  const id = p.paymentId ?? newId("PAY");
  const key = p.razorpayPaymentId ? "Razorpay Payment ID" : "Payment ID";
  const { created } = await sheetRepo.appendUnique("Payments", key, {
    "Payment ID": id, "Member ID": memberId, "Member Name": name, "Payment Amount": p.amount, "Payment Date": todayIn((await getSettings()).timezone),
    "Payment Method": p.method, "Razorpay Order ID": p.razorpayOrderId ?? "", "Razorpay Payment ID": p.razorpayPaymentId ?? "",
    "Razorpay Signature Verification Status": p.source === "Razorpay" ? "Verified" : "N/A (manual)", "Payment Type": p.type,
    "Payment Status": "Success", "Membership Start Date": start, "Membership Expiry Date": expiry, Source: p.source, "Created At": nowIso(), "Plan Name": planName,
  } as any);
  if (created) return { row: null, id };
  // Lost a race / retry: use the winner's row so dates stay consistent.
  const existing = (await sheetRepo.search("Payments", (r) => r[key] === (p.razorpayPaymentId ?? id), { fresh: true }))[0]!;
  return { row: existing, id: existing["Payment ID"] };
}

export async function admitMember(args: {
  memberId: string; details: { fullName: string; email: string; phone: string; address: string; gender: string; dateOfBirth: string; emergencyContact: string };
  plan: Plan; payment: PaymentInput; startDate?: string; amountPaid?: number;
}): Promise<ApplyResult> {
  const s = await getSettings();
  const today = todayIn(s.timezone);
  let start = args.startDate ?? today;
  let expiry = computeExpiry(start, args.plan.durationValue, args.plan.durationUnit);
  const paid = args.amountPaid ?? args.payment.amount;
  const now = nowIso();
  const { created } = await sheetRepo.appendUnique("Members", "Member ID", {
    "Member ID": args.memberId, "Full Name": args.details.fullName, Email: args.details.email, "Phone Number": args.details.phone,
    Address: args.details.address, Gender: args.details.gender, "Date of Birth": args.details.dateOfBirth, "Emergency Contact": args.details.emergencyContact,
    "Enrollment Date": start, "Membership Start Date": start, "Membership Expiry Date": expiry, "Membership Plan": args.plan.name,
    "Membership Duration": durationLabel(args.plan), "Membership Amount": args.plan.price, "Amount Paid": paid,
    "Payment Status": paid >= args.plan.price ? "Paid" : "Due", "Membership Status": computeStatus(expiry, today, s.graceDays),
    "Last Payment Date": today, "Next Renewal Date": addDaysStr(expiry, 1), "Created At": now, "Updated At": now,
  });
  if (!created) { // retry: reuse the dates already stored on the member
    const m = (await sheetRepo.findById("Members", args.memberId, { fresh: true }))!;
    start = m["Membership Start Date"]; expiry = m["Membership Expiry Date"];
  }
  const pay = await recordPayment(args.payment, args.memberId, args.details.fullName, start, expiry, args.plan.name);
  return { memberId: args.memberId, paymentId: pay.id, start, expiry, reactivated: false, created };
}

export async function renewMember(args: { memberId: string; plan: Plan; payment: PaymentInput; amountPaid?: number }): Promise<ApplyResult> {
  const s = await getSettings();
  const today = todayIn(s.timezone);
  const member = await sheetRepo.findById("Members", args.memberId, { fresh: true });
  if (!member) throw new Error(`Member ${args.memberId} not found`);
  const wasInactive = computeStatus(member["Membership Expiry Date"], today, s.graceDays) === "Inactive";

  // 1. Payment row first (unique on the Razorpay payment id) — it fixes the dates for any retry.
  const start = renewalStart(member["Membership Expiry Date"], today);
  const expiry = computeExpiry(start, args.plan.durationValue, args.plan.durationUnit);
  const pay = await recordPayment(args.payment, args.memberId, member["Full Name"], start, expiry, args.plan.name);
  const fStart = pay.row?.["Membership Start Date"] ?? start, fExpiry = pay.row?.["Membership Expiry Date"] ?? expiry;

  // 2. Apply to member only if not already applied (idempotent: compare expiry).
  if (member["Membership Expiry Date"] < fExpiry) {
    const paid = args.amountPaid ?? args.payment.amount;
    await sheetRepo.updateById("Members", args.memberId, {
      "Membership Start Date": fStart, "Membership Expiry Date": fExpiry, "Membership Plan": args.plan.name, "Membership Duration": durationLabel(args.plan),
      "Membership Amount": args.plan.price, "Amount Paid": paid, "Payment Status": paid >= args.plan.price ? "Paid" : "Due",
      "Membership Status": "Active", "Last Payment Date": today, "Next Renewal Date": addDaysStr(fExpiry, 1),
    });
    return { memberId: args.memberId, paymentId: pay.id, start: fStart, expiry: fExpiry, reactivated: wasInactive, created: true };
  }
  return { memberId: args.memberId, paymentId: pay.id, start: fStart, expiry: fExpiry, reactivated: false, created: false };
}
export { num };
