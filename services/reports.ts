import ExcelJS from "exceljs";
import { sheetRepo } from "@/lib/google-sheets/repository";
import { loadMembers, Member } from "./members";
import { filterMembers, MemberQuery } from "./query";
import { getSettings } from "./settings";
import { notify } from "./notifications";
import { templates } from "@/lib/email/templates";
import { addDaysStr, inRange, monthRange, previousMonthKey, parse, todayIn } from "@/utils/dates";
import { money, num } from "@/utils/misc";
import { HttpError } from "@/utils/misc";

type Col = { header: string; key: string; kind?: "date" | "money" | "text" };
const d = (s: string) => (s ? parse(s) : null);

function addSheet(wb: ExcelJS.Workbook, name: string, cols: Col[], rows: Record<string, any>[]) {
  const ws = wb.addWorksheet(name, { views: [{ state: "frozen", ySplit: 1 }] });
  ws.columns = cols.map((c) => ({ header: c.header, key: c.key }));
  rows.forEach((r) => ws.addRow(Object.fromEntries(cols.map((c) => [c.key, c.kind === "date" ? d(r[c.key]) : r[c.key]]))));
  const head = ws.getRow(1); head.font = { bold: true, color: { argb: "FFFFFFFF" } };
  head.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF12303A" } };
  cols.forEach((c, i) => {
    const col = ws.getColumn(i + 1);
    if (c.kind === "date") col.numFmt = "dd-mmm-yyyy"; if (c.kind === "money") col.numFmt = '"Rs." #,##0.00';
    let w = c.header.length; col.eachCell({ includeEmpty: false }, (cell) => { w = Math.max(w, String(cell.value instanceof Date ? "00-Mmm-0000" : cell.value ?? "").length); });
    col.width = Math.min(48, w + 3);
  });
  if (cols.length) ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cols.length } };
  return ws;
}
const memberCols: Col[] = [
  { header: "Member ID", key: "id" }, { header: "Name", key: "fullName" }, { header: "Email", key: "email" }, { header: "Phone", key: "phone" },
  { header: "Plan", key: "plan" }, { header: "Enrolled", key: "enrollmentDate", kind: "date" }, { header: "Start", key: "startDate", kind: "date" },
  { header: "Expiry", key: "expiryDate", kind: "date" }, { header: "Status", key: "status" }, { header: "Amount", key: "amount", kind: "money" },
  { header: "Paid", key: "amountPaid", kind: "money" }, { header: "Due", key: "due", kind: "money" },
];
const payCols: Col[] = [
  { header: "Payment ID", key: "Payment ID" }, { header: "Member ID", key: "Member ID" }, { header: "Member", key: "Member Name" },
  { header: "Amount", key: "Payment Amount", kind: "money" }, { header: "Date", key: "Payment Date", kind: "date" }, { header: "Method", key: "Payment Method" },
  { header: "Type", key: "Payment Type" }, { header: "Status", key: "Payment Status" }, { header: "Source", key: "Source" },
  { header: "Razorpay Order", key: "Razorpay Order ID" }, { header: "Razorpay Payment", key: "Razorpay Payment ID" }, { header: "Plan", key: "Plan Name" },
];

export interface ExportQuery extends MemberQuery { type: string; from?: string; to?: string }
export async function buildExport(q: ExportQuery): Promise<{ buffer: Buffer; filename: string }> {
  const wb = new ExcelJS.Workbook();
  const { members } = await loadMembers(true);
  const payments = await sheetRepo.list("Payments", { fresh: true });
  const range = { from: q.from || "0000-01-01", to: q.to || "9999-12-31" };
  const ok = payments.filter((p) => p["Payment Status"] === "Success" && inRange(p["Payment Date"], range));
  const mem = (list: Member[]) => list.map((m) => ({ ...m }));

  switch (q.type) {
    case "members": addSheet(wb, "Members", memberCols, mem(filterMembers(members, q).filter((m) => (!q.from && !q.to) || inRange(m.enrollmentDate, range)))); break;
    case "active": case "expired": case "inactive": {
      const st = q.type[0]!.toUpperCase() + q.type.slice(1);
      addSheet(wb, `${st} members`, memberCols, mem(filterMembers(members.filter((m) => m.status === st), q))); break;
    }
    case "new-admissions": addSheet(wb, "New admissions", payCols, ok.filter((p) => p["Payment Type"] === "New Admission")); break;
    case "renewals": addSheet(wb, "Renewals", payCols, ok.filter((p) => p["Payment Type"] === "Renewal")); break;
    case "payments": addSheet(wb, "Payments", payCols, payments.filter((p) => inRange(p["Payment Date"], range))); break;
    case "monthly-revenue": {
      const by = new Map<string, { month: string; revenue: number; admissions: number; renewals: number }>();
      ok.forEach((p) => { const k = p["Payment Date"].slice(0, 7); const e = by.get(k) ?? { month: k, revenue: 0, admissions: 0, renewals: 0 };
        e.revenue += num(p["Payment Amount"]); p["Payment Type"] === "Renewal" ? e.renewals++ : e.admissions++; by.set(k, e); });
      addSheet(wb, "Monthly revenue", [{ header: "Month", key: "month" }, { header: "Revenue", key: "revenue", kind: "money" }, { header: "New admissions", key: "admissions" }, { header: "Renewals", key: "renewals" }],
        [...by.values()].sort((a, b) => a.month.localeCompare(b.month))); break;
    }
    case "outstanding": addSheet(wb, "Outstanding", memberCols, mem(members.filter((m) => m.due > 0))); break;
    default: throw new HttpError(400, "Unknown report type");
  }
  return { buffer: Buffer.from(await wb.xlsx.writeBuffer()), filename: `${q.type}-${new Date().toISOString().slice(0, 10)}.xlsx` };
}

/** Month summary shared by the owner email and the Excel attachment. */
export async function monthSummary(ym: string) {
  const { members, settings } = await loadMembers(true);
  const r = monthRange(ym);
  const payments = await sheetRepo.list("Payments", { fresh: true });
  const inM = payments.filter((p) => inRange(p["Payment Date"], r));
  const ok = inM.filter((p) => p["Payment Status"] === "Success");
  const sum = (l: typeof ok) => l.reduce((s, p) => s + num(p["Payment Amount"]), 0);
  const newP = ok.filter((p) => p["Payment Type"] === "New Admission"), renP = ok.filter((p) => p["Payment Type"] === "Renewal");
  const plan = new Map<string, number>(); ok.forEach((p) => plan.set(p["Plan Name"] || "Unknown", (plan.get(p["Plan Name"] || "Unknown") ?? 0) + 1));
  const popular = [...plan].sort((a, b) => b[1] - a[1])[0];
  const expiredInMonth = members.filter((m) => inRange(m.expiryDate, r));
  const nextMonthStart = addDaysStr(r.to, 1), nextMonth = monthRange(nextMonthStart.slice(0, 7));
  const label = (m: Member) => `${m.fullName} (${m.id}) — ${m.expiryDate}`;
  const g = settings.graceDays;
  return {
    stats: {
      "m:Total members (end of month)": members.filter((m) => m.enrollmentDate <= r.to).length,
      "m:New admissions": newP.length, "m:Renewals": renP.length,
      "m:Active members (end of month)": members.filter((m) => m.enrollmentDate <= r.to && m.expiryDate >= r.to).length,
      "m:Memberships expired this month": expiredInMonth.length,
      "m:Members who became inactive": members.filter((m) => inRange(addDaysStr(m.expiryDate, g + 1), r)).length,
      "f:Total revenue": money(sum(ok), settings.currency), "f:From new admissions": money(sum(newP), settings.currency), "f:From renewals": money(sum(renP), settings.currency),
      "f:Failed payments": inM.filter((p) => p["Payment Status"] === "Failed").length, "f:Pending payments": inM.filter((p) => p["Payment Status"] === "Pending").length,
      "f:Most popular plan": popular ? `${popular[0]} (${popular[1]})` : "—",
    } as Record<string, string | number>,
    lists: {
      "Memberships that expired this month": expiredInMonth.map(label),
      "Expired and not renewed yet": expiredInMonth.filter((m) => m.status !== "Active").map(label),
      "Expiring next month": members.filter((m) => inRange(m.expiryDate, nextMonth)).map(label),
    } as Record<string, string[]>,
  };
}

export async function sendMonthlyReport(now = new Date()) {
  const g = await getSettings();
  const ym = previousMonthKey(todayIn(g.timezone, now));
  if (!g.ownerEmail) throw new HttpError(400, "Owner Email is not configured");
  const { stats, lists } = await monthSummary(ym);
  const r = monthRange(ym);
  return notify({
    key: `MONTHLY_REPORT:${ym}`, type: "MONTHLY_REPORT", memberId: "OWNER", to: g.ownerEmail, scheduledDate: r.to, resendFailed: true,
    render: async () => {
      const mail = templates.MONTHLY_REPORT(g, ym, stats, lists);
      const { buffer } = await buildExport({ type: "payments", from: r.from, to: r.to });
      return { ...mail, attachments: [{ filename: `payments-${ym}.xlsx`, content: buffer }] };
    },
  });
}
