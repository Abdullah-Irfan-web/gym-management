"use client";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { api, Button, Card, Field, Input, Badge, Spinner, inr, cx } from "@/components/ui";
import { openCheckout } from "@/components/checkout";

interface Plan { id: string; name: string; durationValue: number; durationUnit: string; price: number; description: string }
interface Found { session: string; member: { name: string; id: string; plan: string; expiry: string; status: string }; plans: Plan[] }

function Renew() {
  const router = useRouter(), token = useSearchParams().get("t");
  const [email, setEmail] = useState(""), [phone, setPhone] = useState(""), [found, setFound] = useState<Found | null>(null);
  const [planId, setPlanId] = useState(""), [busy, setBusy] = useState(false), [err, setErr] = useState(""), [booting, setBooting] = useState(!!token);

  async function lookup(body: object) {
    setBusy(true); setErr("");
    try { const f = await api<Found>("/api/renew/lookup", { method: "POST", json: body }); setFound(f); setPlanId(f.plans.find((p) => p.name === f.member.plan)?.id ?? ""); }
    catch (e: any) { setErr(e.message); } finally { setBusy(false); setBooting(false); }
  }
  useEffect(() => { if (token) lookup({ token }); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [token]);

  async function pay() {
    if (!found || !planId) return; setBusy(true); setErr("");
    try {
      const order = await api("/api/renew/order", { method: "POST", json: { session: found.session, planId } });
      await openCheckout(order, (id) => router.push(`/payment/${id}`), () => { setBusy(false); setErr("Payment window closed. Press Pay to try again."); }, (m) => { setBusy(false); setErr(m); });
    } catch (e: any) { setBusy(false); setErr(e.message); }
  }
  const plan = found?.plans.find((p) => p.id === planId);
  if (booting) return <Spinner />;
  return <main className="mx-auto max-w-lg px-4 pb-16 pt-8 sm:pt-14">
    <h1 className="text-2xl font-extrabold text-ink">Renew your membership</h1>
    {!found ? <form className="mt-6 space-y-4" onSubmit={(e) => { e.preventDefault(); lookup({ email, phone }); }}>
      <p className="text-sm text-slate-600">Enter the email and mobile number you joined with.</p>
      <Field label="Email"><Input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
      <Field label="Mobile number"><Input type="tel" inputMode="tel" required autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
      {err && <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-800">{err}</p>}
      <Button type="submit" loading={busy} className="w-full">Find my membership</Button>
      <p className="text-center text-sm text-slate-600">New here? <Link href="/" className="font-semibold text-accent underline">Join the gym</Link></p>
    </form> : <div className="mt-6 space-y-5">
      <Card><div className="flex items-start justify-between gap-3"><div><p className="text-lg font-bold text-ink">{found.member.name}</p><p className="text-sm text-slate-600">{found.member.id}</p></div><Badge>{found.member.status}</Badge></div>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><dt className="text-slate-500">Current plan</dt><dd className="font-semibold">{found.member.plan}</dd></div><div><dt className="text-slate-500">{found.member.status === "Active" ? "Expires" : "Expired on"}</dt><dd className="font-semibold">{found.member.expiry}</dd></div></dl></Card>
      <div role="radiogroup" aria-label="Plan" className="space-y-2"><h2 className="font-bold text-ink">Choose a plan</h2>
        {found.plans.map((p) => <button key={p.id} role="radio" aria-checked={planId === p.id} onClick={() => setPlanId(p.id)} className={cx("flex w-full items-baseline justify-between rounded-xl border-2 bg-white p-4 text-left", planId === p.id ? "border-accent bg-accent-soft" : "border-slate-200")}>
          <span><span className="font-bold text-ink">{p.name}</span><span className="block text-xs text-slate-600">{p.durationValue} {p.durationUnit}{p.durationValue > 1 ? "s" : ""}</span></span><span className="font-extrabold text-accent">{inr(p.price)}</span></button>)}</div>
      {found.member.status === "Active" && <p className="text-sm text-slate-600">Your new plan starts the day after your current one ends — you won&apos;t lose any days.</p>}
      {err && <p role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-800">{err}</p>}
      <Button onClick={pay} loading={busy} disabled={!plan} className="w-full py-3 text-base">{plan ? `Pay ${inr(plan.price)}` : "Choose a plan"}</Button>
    </div>}
  </main>;
}
export default function Page() { return <Suspense fallback={<Spinner />}><Renew /></Suspense>; }
