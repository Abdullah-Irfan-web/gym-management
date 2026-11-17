"use client";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { api, Badge, Button, Card, Empty, ErrorBox, Field, Input, Modal, Select, Spinner, toast, useDebounced, useFetch } from "@/components/ui";
import { Table } from "@/components/ui";

const methods = ["Cash", "UPI", "Bank Transfer", "Card", "Other"];
function Members() {
  const sp = useSearchParams();
  const [q, setQ] = useState(""), [status, setStatus] = useState("all"), [plan, setPlan] = useState("all"), [sort, setSort] = useState("expiry-asc"), [ef, setEf] = useState(""), [et, setEt] = useState("");
  const [add, setAdd] = useState(sp.get("add") === "1");
  const dq = useDebounced(q);
  const qs = new URLSearchParams({ q: dq, status, plan, sort, ...(ef && { expiryFrom: ef }), ...(et && { expiryTo: et }) }).toString();
  const { data, error, loading, reload } = useFetch<any>(`/api/admin/members?${qs}`);
  const { data: pl } = useFetch<any>("/api/admin/plans");
  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-2xl font-extrabold text-ink">Members</h1>
      <div className="flex gap-2"><a href={`/api/admin/export?type=members&${qs}`}><Button variant="outline">Export to Excel</Button></a><Button onClick={() => setAdd(true)}>Add member</Button></div></div>
    <Card className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
      <div className="lg:col-span-2"><Field label="Search"><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, phone, email, ID" /></Field></div>
      <Field label="Status"><Select value={status} onChange={(e) => setStatus(e.target.value)}><option value="all">All</option><option>Active</option><option>Expired</option><option>Inactive</option></Select></Field>
      <Field label="Plan"><Select value={plan} onChange={(e) => setPlan(e.target.value)}><option value="all">All</option>{pl?.plans.map((p: any) => <option key={p.id}>{p.name}</option>)}</Select></Field>
      <Field label="Expiry from"><Input type="date" value={ef} onChange={(e) => setEf(e.target.value)} /></Field><Field label="Expiry to"><Input type="date" value={et} onChange={(e) => setEt(e.target.value)} /></Field>
      <Field label="Sort"><Select value={sort} onChange={(e) => setSort(e.target.value)}><option value="expiry-asc">Expiry: soonest</option><option value="expiry-desc">Expiry: latest</option><option value="enrolled-desc">Enrolled: newest</option><option value="enrolled-asc">Enrolled: oldest</option></Select></Field></Card>
    <Card>{loading && !data ? <Spinner /> : error ? <ErrorBox msg={error} retry={reload} /> : !data?.members.length ? <Empty title="No members match" hint="Try clearing filters, or add a member." /> :
      <><p className="mb-2 text-xs text-slate-500">{data.members.length} member{data.members.length > 1 ? "s" : ""}</p>
        <Table head={["Member", "ID", "Phone", "Plan", "Enrolled", "Expiry", "Status", "Due"]}>{data.members.map((m: any) => <tr key={m.id} className="border-t"><td className="py-2 pr-3"><Link className="font-semibold text-accent" href={`/admin/members/${m.id}`}>{m.fullName}</Link></td><td className="pr-3 font-mono text-xs">{m.id}</td><td className="pr-3">{m.phone}</td><td className="pr-3">{m.plan}</td><td className="pr-3">{m.enrollmentDate}</td><td className="pr-3">{m.expiryDate}</td><td className="pr-3"><Badge>{m.status}</Badge></td><td>{m.due > 0 ? <Badge>Due</Badge> : ""}</td></tr>)}</Table></>}</Card>
    <AddMember open={add} onClose={() => setAdd(false)} plans={pl?.plans.filter((p: any) => p.isActive) ?? []} onDone={() => { setAdd(false); reload(); }} />
  </div>;
}
function AddMember({ open, onClose, plans, onDone }: { open: boolean; onClose: () => void; plans: any[]; onDone: () => void }) {
  const [f, setF] = useState<any>({ fullName: "", email: "", phone: "", address: "", gender: "", dateOfBirth: "", emergencyContact: "", planId: "", amountPaid: "", paymentMethod: "Cash", startDate: "" });
  const [busy, setBusy] = useState(false), [err, setErr] = useState("");
  const set = (k: string) => (e: any) => setF((x: any) => ({ ...x, [k]: e.target.value }));
  useEffect(() => { const p = plans.find((p) => p.id === f.planId); if (p && f.amountPaid === "") setF((x: any) => ({ ...x, amountPaid: String(p.price) })); }, [f.planId]); // eslint-disable-line
  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr("");
    try { const body = { ...f, startDate: f.startDate || undefined }; const r = await api<any>("/api/admin/members", { method: "POST", json: body }); toast(`Admitted — Member ID ${r.memberId}`); onDone(); }
    catch (x: any) { setErr(x.message); } finally { setBusy(false); }
  }
  return <Modal open={open} onClose={onClose} title="Admit a member (offline payment)"><form onSubmit={save} className="space-y-3">
    <Field label="Full name"><Input required value={f.fullName} onChange={set("fullName")} /></Field>
    <div className="grid gap-3 sm:grid-cols-2"><Field label="Mobile"><Input required type="tel" value={f.phone} onChange={set("phone")} /></Field><Field label="Email"><Input required type="email" value={f.email} onChange={set("email")} /></Field></div>
    <Field label="Address"><Input value={f.address} onChange={set("address")} /></Field>
    <div className="grid gap-3 sm:grid-cols-2"><Field label="Plan"><Select required value={f.planId} onChange={set("planId")}><option value="">Select…</option>{plans.map((p) => <option key={p.id} value={p.id}>{p.name} — {p.price}</option>)}</Select></Field>
      <Field label="Start date" hint="Blank = today"><Input type="date" value={f.startDate} onChange={set("startDate")} /></Field>
      <Field label="Amount received"><Input required type="number" min="0" step="0.01" value={f.amountPaid} onChange={set("amountPaid")} /></Field>
      <Field label="Paid via"><Select value={f.paymentMethod} onChange={set("paymentMethod")}>{methods.map((m) => <option key={m}>{m}</option>)}</Select></Field></div>
    {err && <p role="alert" className="text-sm text-red-700">{err}</p>}
    <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" loading={busy}>Admit member</Button></div></form></Modal>;
}
export default function Page() { return <Suspense fallback={<Spinner />}><Members /></Suspense>; }
