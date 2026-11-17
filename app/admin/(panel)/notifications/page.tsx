"use client";
import { useState } from "react";
import { api, Badge, Button, Card, Empty, ErrorBox, Select, Spinner, toast, useFetch } from "@/components/ui";
import { Table } from "@/components/ui";
export default function Notifications() {
  const [status, setStatus] = useState("all"), { data, error, loading, reload } = useFetch<any>(`/api/admin/notifications?status=${status}`), [busy, setBusy] = useState("");
  async function retry(id: string) { setBusy(id); try { const r = await api<any>("/api/admin/notifications", { method: "POST", json: { id } }); toast(r.result === "SENT" ? "Email sent" : "Retry did not succeed", r.result === "SENT" ? "ok" : "err"); reload(); } catch (e: any) { toast(e.message, "err"); } finally { setBusy(""); } }
  return <div className="space-y-5"><div className="flex items-center justify-between"><h1 className="text-2xl font-extrabold text-ink">Email history</h1>
    <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-40" aria-label="Status"><option value="all">All</option><option value="SENT">Sent</option><option value="PENDING">Pending</option><option value="FAILED">Failed</option></Select></div>
    <Card>{loading && !data ? <Spinner /> : error ? <ErrorBox msg={error} retry={reload} /> : !data?.notifications.length ? <Empty title="No emails yet" /> :
      <Table head={["Type", "To", "Member", "Scheduled", "Sent", "Status", "Error", ""]}>{data.notifications.map((n: any) => <tr key={n["Notification ID"]} className="border-t align-top"><td className="py-2 pr-3">{n["Notification Type"]}</td><td className="pr-3">{n["Member Email"]}</td><td className="pr-3 font-mono text-xs">{n["Member ID"]}</td><td className="pr-3">{n["Scheduled Date"]}</td><td className="pr-3">{n["Sent Date"].slice(0, 16).replace("T", " ")}</td><td className="pr-3"><Badge>{n["Notification Status"]}</Badge></td><td className="pr-3 text-xs text-red-700">{n["Error Message"]}</td><td>{["FAILED", "PENDING"].includes(n["Notification Status"]) && <Button variant="outline" loading={busy === n["Notification ID"]} onClick={() => retry(n["Notification ID"])}>Retry</Button>}</td></tr>)}</Table>}</Card></div>;
}
