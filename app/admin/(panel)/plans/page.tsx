"use client";
import { useState } from "react";
import { api, Badge, Button, Card, Empty, ErrorBox, Field, Input, Modal, Select, Spinner, inr, toast, useFetch } from "@/components/ui";
const blank = { planId: "", name: "", durationValue: "1", durationUnit: "month", price: "", description: "", isActive: true };
export default function Plans() {
  const { data, error, loading, reload } = useFetch<any>("/api/admin/plans");
  const [f, setF] = useState<any>(null), [busy, setBusy] = useState(false), [err, setErr] = useState("");
  async function save(plan: any) {
    setBusy(true); setErr("");
    try { await api("/api/admin/plans", { method: "POST", json: plan }); toast("Plan saved"); setF(null); reload(); } catch (x: any) { setErr(x.message); } finally { setBusy(false); }
  }
  const edit = (p: any) => setF({ planId: p.id, name: p.name, durationValue: String(p.durationValue), durationUnit: p.durationUnit, price: String(p.price), description: p.description, isActive: p.isActive });
  return <div className="space-y-5"><div className="flex items-center justify-between"><h1 className="text-2xl font-extrabold text-ink">Membership plans</h1><Button onClick={() => { setErr(""); setF(blank); }}>Add plan</Button></div>
    <p className="text-sm text-slate-600">Changing a price affects new payments only. Deactivate a plan to hide it from sign-up without losing history.</p>
    {loading && !data ? <Spinner /> : error ? <ErrorBox msg={error} retry={reload} /> : !data?.plans.length ? <Card><Empty title="No plans yet" hint="Add your first plan so people can join." /></Card> :
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{data.plans.map((p: any) => <Card key={p.id}><div className="flex items-start justify-between"><h2 className="font-bold text-ink">{p.name}</h2><Badge>{p.isActive ? "Active" : "Inactive"}</Badge></div>
        <p className="mt-1 text-xl font-extrabold text-accent">{inr(p.price)}</p><p className="text-sm text-slate-600">{p.durationValue} {p.durationUnit}{p.durationValue > 1 ? "s" : ""}</p><p className="mt-1 min-h-[1.25rem] text-xs text-slate-500">{p.description}</p>
        <div className="mt-3 flex gap-2"><Button variant="outline" onClick={() => { setErr(""); edit(p); }}>Edit</Button><Button variant="ghost" onClick={() => save({ ...{ planId: p.id, name: p.name, durationValue: p.durationValue, durationUnit: p.durationUnit, price: p.price, description: p.description }, isActive: !p.isActive })}>{p.isActive ? "Deactivate" : "Activate"}</Button></div></Card>)}</div>}
    <Modal open={!!f} onClose={() => setF(null)} title={f?.planId ? "Edit plan" : "Add plan"}>{f && <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); save(f); }}>
      <Field label="Plan name"><Input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
      <div className="grid gap-3 sm:grid-cols-3"><Field label="Length"><Input required type="number" min="1" value={f.durationValue} onChange={(e) => setF({ ...f, durationValue: e.target.value })} /></Field>
        <Field label="Unit"><Select value={f.durationUnit} onChange={(e) => setF({ ...f, durationUnit: e.target.value })}><option value="month">Months</option><option value="day">Days</option></Select></Field>
        <Field label="Price"><Input required type="number" min="1" step="0.01" value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} /></Field></div>
      <Field label="Description"><Input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.isActive} onChange={(e) => setF({ ...f, isActive: e.target.checked })} />Available for sign-up</label>
      {err && <p role="alert" className="text-sm text-red-700">{err}</p>}<div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={() => setF(null)}>Cancel</Button><Button type="submit" loading={busy}>Save plan</Button></div></form>}</Modal></div>;
}
