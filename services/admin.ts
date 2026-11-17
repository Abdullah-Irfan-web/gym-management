import { sheetRepo } from "@/lib/google-sheets/repository";
import { getPlan } from "./plans";
import { getSettings } from "./settings";
import { findDuplicate, getMember } from "./members";
import { admitMember, renewMember } from "./membership";
import { memberCtx, notify } from "./notifications";
import { templates } from "@/lib/email/templates";
import { audit } from "./audit";
import { newMemberId } from "@/utils/ids";
import { HttpError, normPhone, nowIso } from "@/utils/misc";
import { addDaysStr, computeStatus, todayIn } from "@/utils/dates";

export async function manualAdmit(actor: string, i: any) {
  if (await findDuplicate(i.email, i.phone)) throw new HttpError(409, "A member with this email or mobile number already exists");
  const plan = await getPlan(i.planId);
  const g = await getSettings();
  const memberId = newMemberId();
  const r = await admitMember({
    memberId, details: { fullName: i.fullName, email: i.email, phone: i.phone, address: i.address ?? "", gender: i.gender ?? "", dateOfBirth: i.dateOfBirth ?? "", emergencyContact: i.emergencyContact ?? "" },
    plan, startDate: i.startDate, amountPaid: i.amountPaid, payment: { amount: i.amountPaid, method: i.paymentMethod, source: "Manual", type: "New Admission" },
  });
  await audit(actor, "MANUAL_ADMISSION", "Member", memberId, { plan: plan.name, amountPaid: i.amountPaid, method: i.paymentMethod });
  const ctx = await memberCtx(memberId, { amount: i.amountPaid });
  if (ctx) await notify({ key: `WELCOME:${r.paymentId}`, type: "WELCOME", memberId, to: i.email, scheduledDate: todayIn(g.timezone), render: async () => templates.WELCOME(g, ctx) }).catch(() => "FAILED");
  return r;
}

export async function manualRenew(actor: string, memberId: string, i: any) {
  const m = await getMember(memberId);
  if (!m) throw new HttpError(404, "Member not found");
  const plan = await getPlan(i.planId);
  const g = await getSettings();
  const r = await renewMember({ memberId, plan, amountPaid: i.amountPaid, payment: { amount: i.amountPaid, method: i.paymentMethod, source: "Manual", type: "Renewal" } });
  await audit(actor, "MANUAL_RENEWAL", "Member", memberId, { plan: plan.name, amountPaid: i.amountPaid, method: i.paymentMethod, expiry: r.expiry });
  const ctx = await memberCtx(memberId, { amount: i.amountPaid });
  if (ctx) await notify({ key: `RENEWAL_CONFIRMATION:${r.paymentId}`, type: "RENEWAL_CONFIRMATION", memberId, to: m.email, scheduledDate: todayIn(g.timezone), render: async () => templates.RENEWAL_CONFIRMATION(g, { ...ctx, reactivated: r.reactivated }) }).catch(() => "FAILED");
  return r;
}

const FIELD_MAP: Record<string, string> = {
  fullName: "Full Name", email: "Email", phone: "Phone Number", address: "Address", gender: "Gender", dateOfBirth: "Date of Birth",
  emergencyContact: "Emergency Contact", membershipStartDate: "Membership Start Date", membershipExpiryDate: "Membership Expiry Date", membershipPlan: "Membership Plan",
};
export async function updateMember(actor: string, id: string, patch: Record<string, string | undefined>) {
  const before = await sheetRepo.findById("Members", id, { fresh: true });
  if (!before) throw new HttpError(404, "Member not found");
  const { reason, ...fields } = patch;
  const membershipTouched = ["membershipStartDate", "membershipExpiryDate", "membershipPlan"].some((k) => fields[k] !== undefined);
  if (membershipTouched && !reason) throw new HttpError(400, "Give a reason when changing membership details");
  if ((fields.email && fields.email !== before["Email"]) || (fields.phone && normPhone(fields.phone) !== normPhone(before["Phone Number"]))) {
    const dup = await findDuplicate(fields.email ?? before["Email"], fields.phone ?? before["Phone Number"], id);
    if (dup) throw new HttpError(409, "Another member already uses that email or mobile number");
  }
  const rec: Record<string, string> = {}, changes: Record<string, [string, string]> = {};
  for (const [k, v] of Object.entries(fields)) {
    if (v === undefined) continue;
    const col = FIELD_MAP[k]!;
    if ((before as any)[col] !== v) { rec[col] = v; changes[col] = [(before as any)[col], v]; }
  }
  if (!Object.keys(rec).length) return before;
  if (rec["Membership Expiry Date"]) {
    const g = await getSettings();
    rec["Membership Status"] = computeStatus(rec["Membership Expiry Date"], todayIn(g.timezone), g.graceDays);
    rec["Next Renewal Date"] = addDaysStr(rec["Membership Expiry Date"], 1);
  }
  const after = await sheetRepo.updateById("Members", id, rec as any, { expectUpdatedAt: before["Updated At"] });
  await audit(actor, membershipTouched ? "MEMBERSHIP_MANUALLY_UPDATED" : "MEMBER_UPDATED", "Member", id, { changes, reason });
  return after;
}
export { nowIso };
