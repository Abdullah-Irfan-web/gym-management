import type { Member } from "./members";

export interface MemberQuery { q?: string; status?: string; plan?: string; expiryFrom?: string; expiryTo?: string; sort?: string }
export function filterMembers(list: Member[], f: MemberQuery): Member[] {
  const q = (f.q ?? "").trim().toLowerCase();
  const qd = q.replace(/\D/g, "");
  let out = list.filter((m) =>
    (!q || m.fullName.toLowerCase().includes(q) || m.email.toLowerCase().includes(q) || m.id.toLowerCase() === q || m.id.toLowerCase().includes(q) || (qd.length >= 3 && m.phone.replace(/\D/g, "").includes(qd))) &&
    (!f.status || f.status === "all" || m.status === f.status) && (!f.plan || f.plan === "all" || m.plan === f.plan) &&
    (!f.expiryFrom || m.expiryDate >= f.expiryFrom) && (!f.expiryTo || m.expiryDate <= f.expiryTo));
  const key = f.sort ?? "expiry-asc";
  const cmp: Record<string, (a: Member, b: Member) => number> = {
    "expiry-asc": (a, b) => a.expiryDate.localeCompare(b.expiryDate), "expiry-desc": (a, b) => b.expiryDate.localeCompare(a.expiryDate),
    "enrolled-asc": (a, b) => a.enrollmentDate.localeCompare(b.enrollmentDate), "enrolled-desc": (a, b) => b.enrollmentDate.localeCompare(a.enrollmentDate),
  };
  return out.sort(cmp[key] ?? cmp["expiry-asc"]!);
}
