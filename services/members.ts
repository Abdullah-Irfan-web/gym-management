import { sheetRepo } from "@/lib/google-sheets/repository";
import { getSettings } from "./settings";
import { computeStatus, daysBetween, todayIn } from "@/utils/dates";
import { normEmail, normPhone, num } from "@/utils/misc";
import type { Row } from "@/lib/google-sheets/schema";
import type { MembershipStatus } from "@/types";

export type MemberRow = Row<"Members">;
export interface Member {
  id: string; fullName: string; email: string; phone: string; address: string; gender: string; dateOfBirth: string; emergencyContact: string;
  enrollmentDate: string; startDate: string; expiryDate: string; plan: string; duration: string; amount: number; amountPaid: number;
  paymentStatus: string; storedStatus: string; status: MembershipStatus; lastPaymentDate: string; nextRenewalDate: string;
  daysRemaining: number; due: number; createdAt: string; updatedAt: string;
}
export function toMember(r: MemberRow, today: string, grace: number): Member {
  const status = computeStatus(r["Membership Expiry Date"], today, grace); // derived, never trust stored value for display
  const amount = num(r["Membership Amount"]), paid = num(r["Amount Paid"]);
  return {
    id: r["Member ID"], fullName: r["Full Name"], email: r["Email"], phone: r["Phone Number"], address: r["Address"], gender: r["Gender"],
    dateOfBirth: r["Date of Birth"], emergencyContact: r["Emergency Contact"], enrollmentDate: r["Enrollment Date"],
    startDate: r["Membership Start Date"], expiryDate: r["Membership Expiry Date"], plan: r["Membership Plan"], duration: r["Membership Duration"],
    amount, amountPaid: paid, paymentStatus: r["Payment Status"], storedStatus: r["Membership Status"], status,
    lastPaymentDate: r["Last Payment Date"], nextRenewalDate: r["Next Renewal Date"],
    daysRemaining: daysBetween(today, r["Membership Expiry Date"]), due: Math.max(0, amount - paid),
    createdAt: r["Created At"], updatedAt: r["Updated At"],
  };
}
export async function loadMembers(fresh = false) {
  const s = await getSettings();
  const today = todayIn(s.timezone);
  const rows = await sheetRepo.list("Members", { fresh });
  return { members: rows.map((r) => toMember(r, today, s.graceDays)), today, settings: s };
}
export async function getMember(id: string, fresh = true): Promise<Member | null> {
  const s = await getSettings();
  const r = await sheetRepo.findById("Members", id, { fresh });
  return r ? toMember(r, todayIn(s.timezone), s.graceDays) : null;
}
/** Match on normalised email OR phone (used to block duplicates). */
export async function findDuplicate(email: string, phone: string, excludeId?: string) {
  const e = normEmail(email), p = normPhone(phone);
  const rows = await sheetRepo.search("Members", (r) => r["Member ID"] !== excludeId && (normEmail(r["Email"]) === e || normPhone(r["Phone Number"]) === p), { fresh: true });
  return rows[0] ?? null;
}
/** Renewal identity check: BOTH email and phone must match the same member. */
export async function findByEmailAndPhone(email: string, phone: string) {
  const e = normEmail(email), p = normPhone(phone);
  const rows = await sheetRepo.search("Members", (r) => normEmail(r["Email"]) === e && normPhone(r["Phone Number"]) === p, { fresh: true });
  return rows[0] ?? null;
}
export const renewalUrl = (token: string) => `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/renew?t=${encodeURIComponent(token)}`;
