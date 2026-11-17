import { sheetRepo } from "@/lib/google-sheets/repository";
import { loadMembers } from "./members";
import { inRange, monthKey, resolveRange, parse, fmt } from "@/utils/dates";
import { num } from "@/utils/misc";
import { addMonths, format } from "date-fns";

export type PaymentRow = Awaited<ReturnType<typeof sheetRepo.list<"Payments">>>[number];
const isSuccess = (p: PaymentRow) => p["Payment Status"] === "Success";

function monthsBetween(from: string, to: string) {
  const out: string[] = []; let d = parse(`${from.slice(0, 7)}-01`); const end = to.slice(0, 7);
  while (format(d, "yyyy-MM") <= end && out.length < 24) { out.push(format(d, "yyyy-MM")); d = addMonths(d, 1); }
  return out;
}

export async function dashboard(range: string, from?: string, to?: string) {
  const { members, today, settings } = await loadMembers(true);
  const r = resolveRange(range, today, from, to);
  const payments = await sheetRepo.list("Payments", { fresh: true });
  const audits = await sheetRepo.list("AuditLogs", { fresh: true });
  const inR = payments.filter((p) => inRange(p["Payment Date"], r));
  const ok = inR.filter(isSuccess);

  const cards = {
    total: members.length,
    active: members.filter((m) => m.status === "Active").length,
    expired: members.filter((m) => m.status === "Expired").length,
    inactive: members.filter((m) => m.status === "Inactive").length,
    newAdmissions: ok.filter((p) => p["Payment Type"] === "New Admission").length,
    renewals: ok.filter((p) => p["Payment Type"] === "Renewal").length,
    revenue: ok.reduce((s, p) => s + num(p["Payment Amount"]), 0), // verified successful payments only
    dueCount: members.filter((m) => m.due > 0).length,
    dueAmount: members.reduce((s, m) => s + m.due, 0),
  };
  const months = monthsBetween(r.from, r.to);
  const byMonth = months.map((m) => {
    const ps = inR.filter((p) => monthKey(p["Payment Date"]) === m), s = ps.filter(isSuccess);
    return {
      month: m, revenue: s.reduce((a, p) => a + num(p["Payment Amount"]), 0),
      admissions: s.filter((p) => p["Payment Type"] === "New Admission").length, renewals: s.filter((p) => p["Payment Type"] === "Renewal").length,
      success: s.length, failed: ps.filter((p) => p["Payment Status"] === "Failed").length, pending: ps.filter((p) => p["Payment Status"] === "Pending").length,
    };
  });
  const planCounts = new Map<string, number>();
  members.forEach((m) => planCounts.set(m.plan, (planCounts.get(m.plan) ?? 0) + 1));

  const activity = [
    ...payments.map((p) => ({
      at: p["Created At"], kind: p["Payment Status"] === "Success" ? (p["Payment Type"] === "Renewal" ? "renewal" : "admission") : p["Payment Status"] === "Failed" ? "failed" : "pending",
      text: `${p["Member Name"] || p["Member ID"]} — ${p["Payment Status"] === "Success" ? `${p["Payment Type"]} payment of ${p["Payment Amount"]}` : `${p["Payment Status"]} payment of ${p["Payment Amount"]}`}`,
    })),
    ...audits.filter((a) => ["MEMBER_BECAME_INACTIVE", "MEMBER_REACTIVATED"].includes(a["Action"])).map((a) => ({
      at: a["Timestamp"], kind: "status", text: `${a["Entity ID"]} — ${a["Action"] === "MEMBER_REACTIVATED" ? "reactivated" : "became inactive"}`,
    })),
  ].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 12);

  return {
    range: r, today, currency: settings.currency, cards, byMonth,
    statusDist: [{ name: "Active", value: cards.active }, { name: "Expired", value: cards.expired }, { name: "Inactive", value: cards.inactive }],
    planDist: [...planCounts].map(([name, value]) => ({ name, value })),
    expiringSoon: members.filter((m) => m.daysRemaining >= 0 && m.daysRemaining <= 7).sort((a, b) => a.daysRemaining - b.daysRemaining)
      .map((m) => ({ id: m.id, name: m.fullName, phone: m.phone, email: m.email, plan: m.plan, expiry: m.expiryDate, daysRemaining: m.daysRemaining, status: m.status })),
    recentPayments: [...payments].sort((a, b) => b["Created At"].localeCompare(a["Created At"])).slice(0, 8).map((p) => ({
      id: p["Payment ID"], name: p["Member Name"], date: p["Payment Date"], amount: num(p["Payment Amount"]), type: p["Payment Type"], status: p["Payment Status"], source: p["Source"],
    })),
    activity,
  };
}
export { fmt };
