"use client";
import { useEffect, useState } from "react";
import { api, Button, Card, ErrorBox, Field, Input, Spinner, toast, useFetch } from "@/components/ui";
const map: [string, string, string][] = [["Gym Name", "gymName", "Gym name"], ["Gym Email", "gymEmail", "Contact email"], ["Gym Phone", "gymPhone", "Contact phone"], ["Gym Address", "gymAddress", "Address"], ["Owner Email", "ownerEmail", "Owner email (receives monthly report)"], ["Logo URL", "logoUrl", "Logo image URL"], ["Currency", "currency", "Currency code (e.g. INR)"], ["Timezone", "timezone", "Timezone (e.g. Asia/Kolkata)"], ["Grace Period Days", "graceDays", "Grace period (days after expiry before Inactive)"], ["Reminder Days Before", "remindBefore", "Send reminder this many days before expiry"], ["Reminder Days After", "remindAfter", "Send reminder this many days after expiry"]];
export default function SettingsPage() {
  const { data, error, loading, reload } = useFetch<any>("/api/admin/settings");
  const [f, setF] = useState<Record<string, string>>({}), [busy, setBusy] = useState(false), [err, setErr] = useState("");
  useEffect(() => { if (data) setF(Object.fromEntries(map.map(([k, p]) => [k, String(data[p] ?? "")]))); }, [data]);
  async function save(e: React.FormEvent) { e.preventDefault(); setBusy(true); setErr(""); try { await api("/api/admin/settings", { method: "PUT", json: f }); toast("Settings saved"); reload(); } catch (x: any) { setErr(x.message); } finally { setBusy(false); } }
  if (loading && !data) return <Spinner />; if (error) return <ErrorBox msg={error} retry={reload} />;
  return <div className="max-w-2xl space-y-5"><h1 className="text-2xl font-extrabold text-ink">Gym settings</h1><Card><form onSubmit={save} className="space-y-4">
    {map.map(([k, , label]) => <Field key={k} label={label}><Input value={f[k] ?? ""} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></Field>)}
    {err && <p role="alert" className="text-sm text-red-700">{err}</p>}<Button type="submit" loading={busy}>Save settings</Button></form></Card></div>;
}
