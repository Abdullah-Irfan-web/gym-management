"use client";
import { useState } from "react";
import Link from "next/link";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Badge, Button, Card, Empty, ErrorBox, Input, Select, Spinner, Table, inr, useFetch, useDebounced } from "@/components/ui";
import { MemberSearch } from "@/components/member-search";

const COLORS = ["#0e7c86", "#d9a21b", "#8a98a0", "#2f6f4f", "#7a4e9c", "#b3261e"];
const ranges = [["month", "This month"], ["last-month", "Last month"], ["3m", "Last 3 months"], ["6m", "Last 6 months"], ["year", "This year"], ["custom", "Custom range"]];

export default function Dashboard() {
  const [range, setRange] = useState("month"), [from, setFrom] = useState(""), [to, setTo] = useState("");
  const dFrom = useDebounced(from), dTo = useDebounced(to);
  const { data: d, error, loading, reload } = useFetch<any>(`/api/admin/dashboard?range=${range}${range === "custom" && dFrom && dTo ? `&from=${dFrom}&to=${dTo}` : ""}`);
  const cur = d?.currency ?? "INR";
  const cards = d && [
    ["Total members", d.cards.total], ["Active", d.cards.active], ["Expired", d.cards.expired], ["Inactive", d.cards.inactive],
    ["New admissions", d.cards.newAdmissions], ["Renewals", d.cards.renewals], ["Revenue", inr(d.cards.revenue, cur)], ["Pending dues", `${d.cards.dueCount} · ${inr(d.cards.dueAmount, cur)}`],
  ];
  return <div className="space-y-6">
    <div className="flex flex-wrap items-end justify-between gap-3"><h1 className="text-2xl font-extrabold text-ink">Dashboard</h1>
      <div className="flex flex-wrap items-center gap-2"><Select value={range} onChange={(e) => setRange(e.target.value)} className="w-44" aria-label="Date range">{ranges.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select>
        {range === "custom" && <><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" aria-label="From" /><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" aria-label="To" /></>}</div></div>
    <MemberSearch />
    <div className="flex flex-wrap gap-2"><Link href="/admin/members?add=1"><Button>Add new member</Button></Link><Link href="/admin/members"><Button variant="outline">All members</Button></Link>
      <Link href="/admin/plans"><Button variant="outline">Manage plans</Button></Link><Link href="/admin/payments"><Button variant="outline">View payments</Button></Link><Link href="/admin/reports"><Button variant="outline">Download reports</Button></Link></div>
    {loading && !d ? <Spinner /> : error ? <ErrorBox msg={error} retry={reload} /> : d && <>
      <p className="text-sm text-slate-500">Showing {d.range.from} to {d.range.to}. Revenue counts verified successful payments only. Member counts are as of today ({d.today}).</p>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{cards!.map(([l, v]: any) => <Card key={l} className="p-4"><p className="text-xs font-medium text-slate-500">{l}</p><p className="mt-1 text-xl font-extrabold text-ink sm:text-2xl">{v}</p></Card>)}</div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Chart title="Monthly revenue"><BarChart data={d.byMonth}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="month" fontSize={12} /><YAxis fontSize={12} width={55} /><Tooltip formatter={(v: any) => inr(Number(v), cur)} /><Bar dataKey="revenue" fill="#0e7c86" radius={[4, 4, 0, 0]} /></BarChart></Chart>
        <Chart title="New admissions vs renewals"><BarChart data={d.byMonth}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="month" fontSize={12} /><YAxis allowDecimals={false} fontSize={12} width={35} /><Tooltip /><Legend /><Bar dataKey="admissions" name="New" fill="#0e7c86" /><Bar dataKey="renewals" name="Renewals" fill="#d9a21b" /></BarChart></Chart>
        <Chart title="Member status"><PieChart><Pie data={d.statusDist} dataKey="value" nameKey="name" outerRadius={85} label>{d.statusDist.map((_: any, i: number) => <Cell key={i} fill={["#2f6f4f", "#d9a21b", "#8a98a0"][i]} />)}</Pie><Tooltip /><Legend /></PieChart></Chart>
        <Chart title="Plan distribution"><PieChart><Pie data={d.planDist} dataKey="value" nameKey="name" outerRadius={85} label>{d.planDist.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip /><Legend /></PieChart></Chart>
        <div className="lg:col-span-2"><Chart title="Payment trends"><LineChart data={d.byMonth}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="month" fontSize={12} /><YAxis allowDecimals={false} fontSize={12} width={35} /><Tooltip /><Legend /><Line dataKey="success" name="Successful" stroke="#2f6f4f" strokeWidth={2} /><Line dataKey="failed" name="Failed" stroke="#b3261e" strokeWidth={2} /><Line dataKey="pending" name="Pending" stroke="#d9a21b" strokeWidth={2} /></LineChart></Chart></div>
      </div>
      <Card><h2 className="mb-3 font-bold text-ink">Expiring in the next 7 days</h2>{d.expiringSoon.length === 0 ? <Empty title="No memberships expiring this week" /> :
        <Table head={["Member", "Phone", "Email", "Plan", "Expiry", "Days left", "Status"]}>{d.expiringSoon.map((m: any) => <tr key={m.id} className="border-t"><td className="py-2 pr-3"><Link className="font-semibold text-accent" href={`/admin/members/${m.id}`}>{m.name}</Link></td><td className="pr-3">{m.phone}</td><td className="pr-3">{m.email}</td><td className="pr-3">{m.plan}</td><td className="pr-3">{m.expiry}</td><td className="pr-3">{m.daysRemaining}</td><td><Badge>{m.status}</Badge></td></tr>)}</Table>}</Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card><h2 className="mb-3 font-bold text-ink">Recent payments</h2>{d.recentPayments.length === 0 ? <Empty title="No payments yet" hint="Payments appear here after the first admission." /> :
          <Table head={["Member", "Date", "Amount", "Type", "Status"]}>{d.recentPayments.map((p: any) => <tr key={p.id} className="border-t"><td className="py-2 pr-3">{p.name}</td><td className="pr-3">{p.date}</td><td className="pr-3">{inr(p.amount, cur)}</td><td className="pr-3">{p.type}{p.source === "Manual" ? " (manual)" : ""}</td><td><Badge>{p.status}</Badge></td></tr>)}</Table>}</Card>
        <Card><h2 className="mb-3 font-bold text-ink">Recent activity</h2>{d.activity.length === 0 ? <Empty title="Nothing yet" /> : <ul className="space-y-2 text-sm">{d.activity.map((a: any, i: number) => <li key={i} className="flex justify-between gap-3 border-t pt-2 first:border-0 first:pt-0"><span>{a.text}</span><span className="shrink-0 text-xs text-slate-500">{a.at.slice(0, 10)}</span></li>)}</ul>}</Card></div>
    </>}
  </div>;
}
function Chart({ title, children }: { title: string; children: any }) { return <Card><h2 className="mb-3 font-bold text-ink">{title}</h2><div className="h-64"><ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer></div></Card>; }
