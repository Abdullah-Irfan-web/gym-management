"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api, Card } from "@/components/ui";

/** Safe to refresh: status is read from the server (the sheet), never from browser state. */
export default function PaymentStatus({ params }: { params: { orderId: string } }) {
  const [s, setS] = useState<{ status: string; memberId?: string; receiptUrl?: string } | null>(null), [tries, setTries] = useState(0), [err, setErr] = useState("");
  useEffect(() => {
    let live = true;
    api(`/api/payments/status?orderId=${encodeURIComponent(params.orderId)}`).then((d) => { if (!live) return; setS(d); if (d.status !== "FINALIZED" && tries < 20) setTimeout(() => setTries((t) => t + 1), 3000); }).catch((e) => live && setErr(e.message));
    return () => { live = false; };
  }, [params.orderId, tries]);
  return <main className="mx-auto max-w-md px-4 py-14"><Card className="text-center">
    {err ? <p className="text-red-700">{err}</p> : !s ? <p>Checking your payment…</p> : s.status === "FINALIZED" ? <>
      <h1 className="text-2xl font-extrabold text-ink">You&apos;re in!</h1>
      <p className="mt-2 text-slate-600">Your membership is active. We&apos;ve emailed your confirmation.</p>
      <p className="mt-4 rounded-md bg-accent-soft p-3 font-mono text-lg font-bold text-ink">{s.memberId}</p><p className="mt-1 text-xs text-slate-500">Your Member ID</p>
      {s.receiptUrl && <a href={s.receiptUrl} className="mt-5 inline-block font-semibold text-accent underline">Download receipt (PDF)</a>}
    </> : tries < 20 ? <><h1 className="text-xl font-bold text-ink">Confirming your payment…</h1><p className="mt-2 text-sm text-slate-600">This usually takes a few seconds. You can safely refresh this page.</p></> :
      <><h1 className="text-xl font-bold text-ink">We haven&apos;t received confirmation yet</h1><p className="mt-2 text-sm text-slate-600">If money left your account it will be matched automatically and you&apos;ll get an email. Otherwise no payment was taken. Order reference: <span className="font-mono">{params.orderId}</span></p></>}
    <Link href="/" className="mt-6 block text-sm text-slate-500 underline">Back to home</Link></Card></main>;
}
