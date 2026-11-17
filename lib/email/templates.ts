import { money } from "@/utils/misc";
import type { GymSettings } from "@/services/settings";

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

function layout(g: GymSettings, title: string, body: string, cta?: { label: string; url: string }) {
  return `<!doctype html><html><body style="margin:0;background:#f2f4f5;font-family:Arial,Helvetica,sans-serif;color:#1c2429">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table width="100%" style="max-width:560px;background:#fff;border-radius:10px;overflow:hidden" cellpadding="0" cellspacing="0">
<tr><td style="background:#12303a;color:#fff;padding:20px 28px;font-size:18px;font-weight:bold">${esc(g.gymName)}</td></tr>
<tr><td style="padding:28px"><h1 style="font-size:20px;margin:0 0 16px">${esc(title)}</h1>${body}
${cta ? `<p style="margin:28px 0 8px"><a href="${cta.url}" style="background:#0e7c86;color:#fff;text-decoration:none;padding:12px 22px;border-radius:6px;display:inline-block;font-weight:bold">${esc(cta.label)}</a></p><p style="font-size:12px;color:#6b777d;word-break:break-all">${cta.url}</p>` : ""}
</td></tr>
<tr><td style="padding:16px 28px;font-size:12px;color:#6b777d;background:#fafbfb">${esc(g.gymName)}${g.gymPhone ? ` · ${esc(g.gymPhone)}` : ""}${g.gymAddress ? `<br>${esc(g.gymAddress)}` : ""}</td></tr>
</table></td></tr></table></body></html>`;
}
const rows = (r: [string, string][]) => `<table width="100%" cellpadding="8" style="border-collapse:collapse;font-size:14px">${r.map(([k, v]) =>
  `<tr><td style="border-bottom:1px solid #e6eaec;color:#6b777d">${esc(k)}</td><td style="border-bottom:1px solid #e6eaec;text-align:right;font-weight:bold">${esc(v)}</td></tr>`).join("")}</table>`;

export interface MemberCtx { name: string; memberId: string; plan: string; start: string; expiry: string; amount?: number; renewalUrl: string; renewalAmount?: number }

export const templates = {
  WELCOME: (g: GymSettings, c: MemberCtx) => ({
    subject: `Welcome to ${g.gymName} — Member ID ${c.memberId}`,
    html: layout(g, `Welcome, ${c.name}!`, `<p>Your membership is active. Keep your Member ID handy.</p>${rows([
      ["Member ID", c.memberId], ["Plan", c.plan], ["Amount paid", money(c.amount ?? 0, g.currency)], ["Enrolled on", c.start], ["Valid until", c.expiry]])}`,
      { label: "Renew later", url: c.renewalUrl }),
  }),
  RENEWAL_CONFIRMATION: (g: GymSettings, c: MemberCtx & { reactivated?: boolean }) => ({
    subject: c.reactivated ? `Your ${g.gymName} membership is reactivated` : `Membership renewed — ${g.gymName}`,
    html: layout(g, c.reactivated ? `Welcome back, ${c.name}!` : `Thanks for renewing, ${c.name}`, `<p>${c.reactivated ? "Your membership has been reactivated with the same Member ID." : "Your renewal is confirmed."}</p>${rows([
      ["Member ID", c.memberId], ["Plan", c.plan], ["Amount paid", money(c.amount ?? 0, g.currency)], ["Starts", c.start], ["Valid until", c.expiry]])}`),
  }),
  PRE_EXPIRY: (g: GymSettings, c: MemberCtx) => ({
    subject: `Your ${g.gymName} membership expires on ${c.expiry}`,
    html: layout(g, `Hi ${c.name}, your membership ends soon`, `<p>Renew before it ends to keep training without a break.</p>${rows([
      ["Plan", c.plan], ["Expires on", c.expiry], ...(c.renewalAmount ? [["Renewal amount", money(c.renewalAmount, g.currency)] as [string, string]] : [])])}`,
      { label: "Renew now", url: c.renewalUrl }),
  }),
  POST_EXPIRY: (g: GymSettings, c: MemberCtx) => ({
    subject: `Your ${g.gymName} membership has expired`,
    html: layout(g, `Hi ${c.name}, your membership has expired`, `<p>Your membership ended on <b>${c.expiry}</b>. Renew with the secure link below — it takes about a minute and keeps your Member ID.</p>`,
      { label: "Renew membership", url: c.renewalUrl }),
  }),
  INACTIVE: (g: GymSettings, c: MemberCtx) => ({
    subject: `We miss you at ${g.gymName}`,
    html: layout(g, `Hi ${c.name}, your membership is now inactive`, `<p>Your membership expired on ${c.expiry} and is now inactive. You can reactivate any time with the same Member ID (${c.memberId}).</p>`,
      { label: "Reactivate membership", url: c.renewalUrl }),
  }),
  MONTHLY_REPORT: (g: GymSettings, month: string, s: Record<string, string | number>, lists: Record<string, string[]>) => ({
    subject: `${g.gymName} — monthly report for ${month}`,
    html: layout(g, `Monthly report: ${month}`,
      `<h3 style="margin:0 0 6px">Membership</h3>${rows(Object.entries(s).filter(([k]) => k.startsWith("m:")).map(([k, v]) => [k.slice(2), String(v)]))}
       <h3 style="margin:20px 0 6px">Finance (verified payments only)</h3>${rows(Object.entries(s).filter(([k]) => k.startsWith("f:")).map(([k, v]) => [k.slice(2), String(v)]))}
       ${Object.entries(lists).map(([t, l]) => `<h3 style="margin:20px 0 6px">${esc(t)}</h3>${l.length ? `<ul style="padding-left:18px;font-size:14px">${l.slice(0, 25).map((x) => `<li>${esc(x)}</li>`).join("")}</ul>${l.length > 25 ? `<p style="font-size:12px;color:#6b777d">…and ${l.length - 25} more (see attached Excel)</p>` : ""}` : `<p style="font-size:14px;color:#6b777d">None</p>`}`).join("")}`),
  }),
};
