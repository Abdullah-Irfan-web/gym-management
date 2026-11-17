"use client";
import { useState } from "react";
import Link from "next/link";
import { api, Badge, Button, Card, Confirm, Empty, ErrorBox, Field, Input, Modal, Select, Spinner, inr, toast, useFetch } from "@/components/ui";
import { Table } from "@/components/ui";

export default function MemberPage({ params }: { params: { id: string } }) {
  const { data, error, loading, reload } = useFetch<any>(`/api/admin/members/${params.id}`);
  const { data: pl } = useFetch<any>("/api/admin/plans");
  const [edit, setEdit] = useState(false), [renew, setRenew] = useState(false);
  if (loading && !data) return <Spinner />;
  if (error || !data) return <ErrorBox msg={error} retry={reload} />;
  const m = data.member;
  const ok = data.payments.filter((p: any) => p["Payment Status"] === "Success");
  return <div className="space-y-5">
    <Link href="/admin/members" className="text-sm text-accent underline">← All members</Link>
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-2xl font-extrabold text-ink">{m.fullName}</h1><p className="font-mono text-sm text-slate-500">{m.id}</p></div>
      <div className="flex gap-2"><Button variant="outline" onClick={() => setEdit(true)}>Edit details</Button><Button onClick={() => setRenew(true)}>Renew / record payment</Button></div></div>
    <div className="grid gap-4 lg:grid-cols-2">
      <Card><h2 className="mb-3 font-bold text-ink">Membership</h2><dl className="grid grid-cols-2 gap-3 text-sm">
        {[["Status", <Badge key="s">{m.status}</Badge>], ["Plan", m.plan], ["Start", m.startDate], ["Expiry", m.expiryDate], ["Days remaining", m.daysRemaining], ["Amount / paid", `${inr(m.amount)} / ${inr(m.amountPaid)}`], ["Last payment", m.lastPaymentDate], ["Enrolled", m.enrollmentDate]].map(([k, v]: any) => <div key={k}><dt className="text-slate-500">{k}</dt><dd className="font-semibold">{v}</dd></div>)}</dl></Card>
      <Card><h2 className="mb-3 font-bold text-ink">Personal</h2><dl className="grid grid-cols-2 gap-3 text-sm">
        {[["Phone", m.phone], ["Email", m.email], ["Address", m.address || "—"], ["Gender", m.gender || "—"], ["Date of birth", m.dateOfBirth || "—"], ["Emergency contact", m.emergencyContact || "—"]].map(([k, v]) => <div key={k}><dt className="text-slate-500">{k}</dt><dd className="font-semibold break-words">{v}</dd></div>)}</dl></Card></div>
    <Card><h2 className="mb-3 font-bold text-ink">Membership & renewal history</h2>{ok.length === 0 ? <Empty title="No completed payments yet" /> :
      <Table head={["Plan", "From", "To", "Type", "Amount"]}>{ok.map((p: any) => <tr key={p["Payment ID"]} className="border-t"><td className="py-2 pr-3">{p["Plan Name"] || "—"}</td><td className="pr-3">{p["Membership Start Date"]}</td><td className="pr-3">{p["Membership Expiry Date"]}</td><td className="pr-3">{p["Payment Type"]}</td><td>{inr(Number(p["Payment Amount"]))}</td></tr>)}</Table>}</Card>
    <Card><h2 className="mb-3 font-bold text-ink">Payments</h2>{data.payments.length === 0 ? <Empty title="No payments" /> :
      <Table head={["Date", "Amount", "Method", "Source", "Status", "Razorpay ID", "Receipt"]}>{data.payments.map((p: any) => <tr key={p["Payment ID"]} className="border-t"><td className="py-2 pr-3">{p["Payment Date"]}</td><td className="pr-3">{inr(Number(p["Payment Amount"]))}</td><td className="pr-3">{p["Payment Method"]}</td><td className="pr-3">{p["Source"]}</td><td className="pr-3"><Badge>{p["Payment Status"]}</Badge></td><td className="pr-3 font-mono text-xs">{p["Razorpay Payment ID"] || "—"}</td><td>{p["Payment Status"] === "Success" && <a className="text-accent underline" href={`/api/receipt/${p["Payment ID"]}`}>PDF</a>}</td></tr>)}</Table>}</Card>
    <div className="grid gap-4 lg:grid-cols-2">
      <Card><h2 className="mb-3 font-bold text-ink">Emails</h2>{data.notifications.length === 0 ? <Empty title="No emails yet" /> : <ul className="space-y-2 text-sm">{data.notifications.map((n: any) => <li key={n["Notification ID"]} className="flex items-center justify-between gap-2 border-t pt-2 first:border-0 first:pt-0"><span>{n["Notification Type"]}<span className="block text-xs text-slate-500">{(n["Sent Date"] || n["Scheduled Date"]).slice(0, 10)}</span></span><Badge>{n["Notification Status"]}</Badge></li>)}</ul>}</Card>
      <Card><h2 className="mb-3 font-bold text-ink">Audit trail</h2>{data.audits.length === 0 ? <Empty title="No changes recorded" /> : <ul className="space-y-2 text-sm">{data.audits.map((a: any) => <li key={a["Log ID"]} className="border-t pt-2 first:border-0 first:pt-0"><b>{a["Action"]}</b> <span className="text-xs text-slate-500">by {a["Actor"]} · {a["Timestamp"].slice(0, 16).replace("T", " ")}</span></li>)}</ul>}</Card></div>
    <EditModal open={edit} onClose={() => setEdit(false)} m={m} onDone={() => { setEdit(false); reload(); }} />
    <RenewModal open={renew} onClose={() => setRenew(false)} m={m} plans={pl?.plans.filter((p: any) => p.isActive) ?? []} onDone={() => { setRenew(false); reload(); }} />
  </div>;
}
function EditModal({ open, onClose, m, onDone }: any) {
  const [f, setF] = useState<any>({ fullName: m.fullName, email: m.email, phone: m.phone, address: m.address, emergencyContact: m.emergencyContact, membershipStartDate: m.startDate, membershipExpiryDate: m.expiryDate, reason: "" });
  const [busy, setBusy] = useState(false), [err, setErr] = useState("");
  const set = (k: string) => (e: any) => setF((x: any) => ({ ...x, [k]: e.target.value }));
  const dates = f.membershipStartDate !== m.startDate || f.membershipExpiryDate !== m.expiryDate;
  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr("");
    try { await api(`/api/admin/members/${m.id}`, { method: "PATCH", json: { ...f, reason: f.reason || undefined } }); toast("Member updated"); onDone(); } catch (x: any) { setErr(x.message); } finally { setBusy(false); }
  }
  return <Modal open={open} onClose={onClose} title="Edit member"><form onSubmit={save} className="space-y-3">
    <Field label="Full name"><Input required value={f.fullName} onChange={set("fullName")} /></Field>
    <div className="grid gap-3 sm:grid-cols-2"><Field label="Mobile"><Input required value={f.phone} onChange={set("phone")} /></Field><Field label="Email"><Input required type="email" value={f.email} onChange={set("email")} /></Field></div>
    <Field label="Address"><Input value={f.address} onChange={set("address")} /></Field><Field label="Emergency contact"><Input value={f.emergencyContact} onChange={set("emergencyContact")} /></Field>
    <div className="grid gap-3 sm:grid-cols-2"><Field label="Membership start"><Input type="date" value={f.membershipStartDate} onChange={set("membershipStartDate")} /></Field><Field label="Membership expiry"><Input type="date" value={f.membershipExpiryDate} onChange={set("membershipExpiryDate")} /></Field></div>
    {dates && <Field label="Reason for changing dates" hint="Saved in the audit log"><Input required value={f.reason} onChange={set("reason")} /></Field>}
    {err && <p role="alert" className="text-sm text-red-700">{err}</p>}
    <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button type="submit" loading={busy}>Save changes</Button></div></form></Modal>;
}
function RenewModal({ open, onClose, m, plans, onDone }: any) {
  const [planId, setPlanId] = useState(""), [amt, setAmt] = useState(""), [method, setMethod] = useState("Cash"), [busy, setBusy] = useState(false), [confirm, setConfirm] = useState(false), [err, setErr] = useState("");
  const plan = plans.find((p: any) => p.id === planId);
  async function go() {
    setBusy(true); setErr("");
    try { const r = await api<any>(`/api/admin/members/${m.id}/renew`, { method: "POST", json: { planId, amountPaid: amt, paymentMethod: method } }); toast(`Renewed until ${r.expiry}`); setConfirm(false); onDone(); }
    catch (x: any) { setErr(x.message); setConfirm(false); } finally { setBusy(false); }
  }
  return <><Modal open={open && !confirm} onClose={onClose} title="Manual renewal (offline payment)"><div className="space-y-3">
    <Field label="Plan"><Select value={planId} onChange={(e) => { setPlanId(e.target.value); setAmt(String(plans.find((p: any) => p.id === e.target.value)?.price ?? "")); }}><option value="">Select…</option>{plans.map((p: any) => <option key={p.id} value={p.id}>{p.name} — {p.price}</option>)}</Select></Field>
    <div className="grid gap-3 sm:grid-cols-2"><Field label="Amount received"><Input type="number" min="0" step="0.01" value={amt} onChange={(e) => setAmt(e.target.value)} /></Field><Field label="Paid via"><Select value={method} onChange={(e) => setMethod(e.target.value)}>{methods.map((x) => <option key={x}>{x}</option>)}</Select></Field></div>
    <p className="text-xs text-slate-500">Recorded as a manual payment, separate from verified Razorpay transactions.</p>
    {err && <p role="alert" className="text-sm text-red-700">{err}</p>}
    <div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button disabled={!planId || amt === ""} onClick={() => setConfirm(true)}>Review</Button></div></div></Modal>
    <Confirm open={open && confirm} onClose={() => setConfirm(false)} title="Confirm renewal" confirmLabel="Renew membership" loading={busy} onConfirm={go} body={<>Renew <b>{m.fullName}</b> on <b>{plan?.name}</b> and record <b>{inr(Number(amt) || 0)}</b> received via {method}?</>} /></>;
}
const methods = ["Cash", "UPI", "Bank Transfer", "Card", "Other"];
