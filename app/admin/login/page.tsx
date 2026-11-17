"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, Button, Card, Field, Input } from "@/components/ui";
export default function Login() {
  const router = useRouter(), [email, setEmail] = useState(""), [password, setPassword] = useState(""), [err, setErr] = useState(""), [busy, setBusy] = useState(false);
  async function go(e: React.FormEvent) { e.preventDefault(); setBusy(true); setErr(""); try { await api("/api/auth/login", { method: "POST", json: { email, password } }); router.push("/admin"); router.refresh(); } catch (x: any) { setErr(x.message); setBusy(false); } }
  return <main className="flex min-h-screen items-center justify-center bg-ink px-4"><Card className="w-full max-w-sm">
    <h1 className="mb-1 text-xl font-extrabold text-ink">Owner sign in</h1><p className="mb-5 text-sm text-slate-600">Manage members, payments and reminders.</p>
    <form onSubmit={go} className="space-y-4"><Field label="Email"><Input type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
      <Field label="Password"><Input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
      {err && <p role="alert" className="text-sm text-red-700">{err}</p>}<Button type="submit" loading={busy} className="w-full">Sign in</Button></form>
    <p className="mt-4 text-xs text-slate-500">Forgot your password? Generate a new hash with <code>npm run hash-password</code> and update ADMIN_PASSWORD_HASH in Vercel.</p></Card></main>;
}
