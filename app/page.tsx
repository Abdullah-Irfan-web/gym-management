"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, Button, Card, Field, Input, Select, Spinner, ErrorBox, inr, cx, useFetch } from "@/components/ui";
import { openCheckout } from "@/components/checkout";

interface Plan { id: string; name: string; durationValue: number; durationUnit: string; price: number; description: string }
const blank = { fullName: "", email: "", phone: "", address: "", gender: "", dateOfBirth: "", emergencyContact: "" };

export default function Home() {
  const router = useRouter();
  const { data, error, loading, reload } = useFetch<{ plans: Plan[]; gym: { name: string; logoUrl: string; phone: string; address: string } }>("/api/plans");
  const [form, setForm] = useState(blank), [planId, setPlanId] = useState(""), [busy, setBusy] = useState(false);
  const [err, setErr] = useState(""), [fields, setFields] = useState<Record<string, string[]>>({}), [existing, setExisting] = useState(false);
  const set = (k: keyof typeof blank) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const plan = data?.plans.find((p) => p.id === planId);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr(""); setFields({}); setExisting(false);
    if (!planId) return setErr("Choose a membership plan first.");
    setBusy(true);
    try {
      const order = await api("/api/admission/order", { method: "POST", json: { ...form, planId } });
      await openCheckout(order, (id) => router.push(`/payment/${id}`), () => { setBusy(false); setErr("Payment window closed. Your details are saved for 30 minutes — press Pay to try again."); }, (m) => { setBusy(false); setErr(m); });
    } catch (e: any) { setBusy(false); setErr(e.message); setFields(e.fields ?? {}); setExisting(e.status === 409); }
  }
  if (loading) return <Spinner />;
  if (error || !data) return <div className="mx-auto max-w-lg p-6"><ErrorBox msg={error || "Couldn't load plans"} retry={reload} /></div>;
  const fe = (k: string) => fields[k]?.[0];

  return <main className="mx-auto max-w-3xl px-4 pb-16 pt-8 sm:pt-14">
    <header className="mb-8 flex items-center gap-3">
      {data.gym.logoUrl && /* eslint-disable-next-line @next/next/no-img-element */ <img src={data.gym.logoUrl} alt="" className="h-12 w-12 rounded-lg object-cover" />}
      <div><h1 className="text-2xl font-extrabold text-ink sm:text-3xl">{data.gym.name}</h1><p className="text-sm text-slate-600">Join in two minutes. Pay online, start training today.</p></div>
    </header>

    <form onSubmit={submit} className="space-y-6" noValidate>
      <section aria-labelledby="plans"><h2 id="plans" className="mb-3 text-lg font-bold text-ink">Choose your plan</h2>
        {data.plans.length === 0 ? <Card><p className="text-sm text-slate-600">No plans are open for sign-up right now. Please contact the gym.</p></Card> :
          <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Membership plan">
            {data.plans.map((p) => <button type="button" key={p.id} role="radio" aria-checked={planId === p.id} onClick={() => setPlanId(p.id)}
              className={cx("rounded-xl border-2 bg-white p-4 text-left transition-colors", planId === p.id ? "border-accent bg-accent-soft" : "border-slate-200 hover:border-slate-300")}>
              <div className="flex items-baseline justify-between"><span className="font-bold text-ink">{p.name}</span><span className="text-lg font-extrabold text-accent">{inr(p.price)}</span></div>
              <p className="mt-1 text-xs text-slate-600">{p.durationValue} {p.durationUnit}{p.durationValue > 1 ? "s" : ""}{p.description ? ` · ${p.description}` : ""}</p></button>)}
          </div>}</section>

      <Card><h2 className="mb-4 text-lg font-bold text-ink">Your details</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" error={fe("fullName")}><Input autoComplete="name" required value={form.fullName} onChange={set("fullName")} /></Field>
          <Field label="Mobile number" error={fe("phone")}><Input type="tel" inputMode="tel" autoComplete="tel" required value={form.phone} onChange={set("phone")} /></Field>
          <div className="sm:col-span-2"><Field label="Email" hint="Your receipt and renewal reminders are sent here" error={fe("email")}><Input type="email" autoComplete="email" required value={form.email} onChange={set("email")} /></Field></div>
          <div className="sm:col-span-2"><Field label="Address (optional)"><Input autoComplete="street-address" value={form.address} onChange={set("address")} /></Field></div>
          <Field label="Gender (optional)"><Select value={form.gender} onChange={set("gender")}><option value="">Prefer not to say</option><option>Male</option><option>Female</option><option>Other</option></Select></Field>
          <Field label="Date of birth (optional)"><Input type="date" value={form.dateOfBirth} onChange={set("dateOfBirth")} /></Field>
          <div className="sm:col-span-2"><Field label="Emergency contact (optional)" hint="Name and phone number"><Input value={form.emergencyContact} onChange={set("emergencyContact")} /></Field></div>
        </div></Card>

      {plan && <Card className="border-accent/40 bg-accent-soft"><p className="text-sm text-slate-700">Summary</p>
        <div className="mt-1 flex items-baseline justify-between"><span className="font-bold text-ink">{plan.name} · {plan.durationValue} {plan.durationUnit}{plan.durationValue > 1 ? "s" : ""}</span><span className="text-xl font-extrabold text-accent">{inr(plan.price)}</span></div></Card>}

      {err && <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">{err}{existing && <> <Link href="/renew" className="font-semibold underline">Go to renewal</Link></>}</div>}
      <Button type="submit" loading={busy} className="w-full py-3 text-base" disabled={!plan}>{plan ? `Pay ${inr(plan.price)} and join` : "Choose a plan to continue"}</Button>
      <p className="text-center text-sm text-slate-600">Already a member? <Link href="/renew" className="font-semibold text-accent underline">Renew your membership</Link></p>
    </form>
  </main>;
}
