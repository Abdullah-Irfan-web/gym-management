import { sheetRepo } from "@/lib/google-sheets/repository";
import { sendEmail } from "@/lib/email/client";
import { templates, MemberCtx } from "@/lib/email/templates";
import { signToken, DAY } from "@/lib/auth/tokens";
import { getSettings } from "./settings";
import { getMember, renewalUrl } from "./members";
import { listPlans } from "./plans";
import { newId } from "@/utils/ids";
import { nowIso, num } from "@/utils/misc";
import type { NotificationType } from "@/types";

const MAX_ATTEMPTS = 5;

export async function memberCtx(memberId: string, extra: Partial<MemberCtx> = {}): Promise<MemberCtx | null> {
  const m = await getMember(memberId);
  if (!m) return null;
  const plans = await listPlans();
  const plan = plans.find((p) => p.name === m.plan);
  return {
    name: m.fullName, memberId: m.id, plan: m.plan, start: m.startDate, expiry: m.expiryDate,
    renewalUrl: renewalUrl(signToken("renew", m.id, 30 * DAY)), renewalAmount: plan?.price, ...extra,
  };
}

async function deliver(rowId: string, type: NotificationType, to: string, render: () => Promise<{ subject: string; html: string; attachments?: { filename: string; content: Buffer }[] }>, attempts: number) {
  try {
    const mail = await render();
    await sendEmail({ to, ...mail });
    await sheetRepo.updateById("Notifications", rowId, { "Notification Status": "SENT", "Sent Date": nowIso(), "Error Message": "", Attempts: String(attempts + 1) });
    return "SENT" as const;
  } catch (e: any) {
    await sheetRepo.updateById("Notifications", rowId, { "Notification Status": "FAILED", "Error Message": String(e?.message ?? e).slice(0, 300), Attempts: String(attempts + 1) });
    return "FAILED" as const;
  }
}

/**
 * Idempotent send. The row (unique on Idempotency Key) is created as PENDING first; only the
 * writer that created it sends. A second call with the same key is a no-op unless it FAILED.
 */
export async function notify(opts: {
  key: string; type: NotificationType; memberId: string; to: string; scheduledDate: string;
  render: () => Promise<{ subject: string; html: string; attachments?: { filename: string; content: Buffer }[] }>;
  resendFailed?: boolean;
}): Promise<"SENT" | "FAILED" | "SKIPPED"> {
  const id = newId("NTF");
  const { created } = await sheetRepo.appendUnique("Notifications", "Idempotency Key", {
    "Notification ID": id, "Member ID": opts.memberId, "Member Email": opts.to, "Notification Type": opts.type,
    "Scheduled Date": opts.scheduledDate, "Notification Status": "PENDING", "Idempotency Key": opts.key, Attempts: "0", "Updated At": nowIso(),
  });
  if (!created) {
    if (opts.resendFailed) {
      const ex = (await sheetRepo.search("Notifications", (r) => r["Idempotency Key"] === opts.key, { fresh: true }))[0];
      if (ex && ex["Notification Status"] === "FAILED" && num(ex["Attempts"]) < MAX_ATTEMPTS)
        return deliver(ex["Notification ID"], opts.type, opts.to, opts.render, num(ex["Attempts"]));
    }
    return "SKIPPED";
  }
  return deliver(id, opts.type, opts.to, opts.render, 0);
}

/** Re-send FAILED notifications (re-rendered from current data). Safe to run repeatedly. */
export async function retryFailed(): Promise<{ retried: number; sent: number }> {
  const rows = await sheetRepo.search("Notifications", (r) => r["Notification Status"] === "FAILED" && num(r["Attempts"]) < MAX_ATTEMPTS, { fresh: true });
  let sent = 0;
  for (const r of rows) {
    const type = r["Notification Type"] as NotificationType;
    const render = await renderFor(type, r["Member ID"], r["Idempotency Key"]);
    if (!render) { await sheetRepo.updateById("Notifications", r["Notification ID"], { "Notification Status": "ABANDONED", "Error Message": "Cannot re-render" }); continue; }
    const res = await deliver(r["Notification ID"], type, r["Member Email"], render, num(r["Attempts"]));
    if (res === "SENT") sent++;
  }
  return { retried: rows.length, sent };
}
export async function retryOne(notificationId: string) {
  const r = await sheetRepo.findById("Notifications", notificationId, { fresh: true });
  if (!r || r["Notification Status"] === "SENT") return "SKIPPED";
  const render = await renderFor(r["Notification Type"] as NotificationType, r["Member ID"], r["Idempotency Key"]);
  if (!render) return "FAILED";
  return deliver(r["Notification ID"], r["Notification Type"] as NotificationType, r["Member Email"], render, num(r["Attempts"]));
}

async function renderFor(type: NotificationType, memberId: string, key: string) {
  const g = await getSettings();
  if (type === "MONTHLY_REPORT") {
    return null; // owner report is re-sent by clearing its row and re-running the cron
  }
  const ctx = await memberCtx(memberId);
  if (!ctx) return null;
  if (type === "WELCOME" || type === "RENEWAL_CONFIRMATION") {
    const payId = key.split(":")[1] ?? "";
    const p = await sheetRepo.findById("Payments", payId, { fresh: true });
    ctx.amount = num(p?.["Payment Amount"]);
    return async () => (type === "WELCOME" ? templates.WELCOME(g, ctx) : templates.RENEWAL_CONFIRMATION(g, ctx));
  }
  return async () => templates[type as "PRE_EXPIRY" | "POST_EXPIRY" | "INACTIVE"](g, ctx);
}
