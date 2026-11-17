import { sheetRepo } from "@/lib/google-sheets/repository";
import { loadMembers } from "./members";
import { memberCtx, notify, retryFailed } from "./notifications";
import { templates } from "@/lib/email/templates";
import { audit } from "./audit";
import { daysBetween } from "@/utils/dates";

/** Writes derived status back to the sheet. Re-running is a no-op once statuses match. */
export async function updateStatuses() {
  const { members } = await loadMembers(true);
  const changed = members.filter((m) => m.storedStatus !== m.status);
  await sheetRepo.batchPatch("Members", changed.map((m) => ({ id: m.id, patch: { "Membership Status": m.status } })));
  for (const m of changed.filter((m) => m.status === "Inactive")) await audit("system", "MEMBER_BECAME_INACTIVE", "Member", m.id, { expiry: m.expiryDate });
  return { checked: members.length, updated: changed.length };
}

type Kind = "PRE_EXPIRY" | "POST_EXPIRY" | "INACTIVE";
/**
 * Idempotency key = TYPE:memberId:expiryDate. Renewing changes the expiry date, so
 * (a) members who already renewed no longer match the window and (b) the next cycle gets fresh keys.
 * A missed cron day is caught up because the windows are ranges, not single days.
 */
export async function sendReminders(kind: Kind) {
  const { members, settings: g, today } = await loadMembers(true);
  const eligible = members.filter((m) => {
    const toExpiry = daysBetween(today, m.expiryDate), past = -toExpiry;
    if (kind === "PRE_EXPIRY") return toExpiry >= 0 && toExpiry <= g.remindBefore;
    if (kind === "POST_EXPIRY") return past >= g.remindAfter && m.status === "Expired";
    return m.status === "Inactive" && past > g.graceDays && past <= g.graceDays + 7; // don't mass-mail long-lapsed members
  });
  let sent = 0, failed = 0, skipped = 0;
  for (const m of eligible) {
    const ctx = await memberCtx(m.id);
    if (!ctx) continue;
    const res = await notify({
      key: `${kind}:${m.id}:${m.expiryDate}`, type: kind, memberId: m.id, to: m.email, scheduledDate: today, resendFailed: true,
      render: async () => templates[kind](g, ctx),
    });
    res === "SENT" ? sent++ : res === "FAILED" ? failed++ : skipped++;
  }
  return { eligible: eligible.length, sent, failed, skipped };
}
export { retryFailed };
