"use client";
import { useState } from "react";
import Link from "next/link";
import { Badge, Button, Card, Empty, ErrorBox, Field, Input, Select, Spinner, inr, useDebounced, useFetch } from "@/components/ui";
import { Table } from "@/components/ui";
export default function Payments() {
  const [q, setQ] = useState(""), [status, setStatus] = useState("all"), [type, setType] = useState("all"), [from, setFrom] = useState(""), [to, setTo] = useState("");
  const dq = useDebounced(q);
  const qs = new URLSearchParams({ q: dq, status, type, ...(from && { from }), ...(to && { to }) }).toString();
  const { data, error, loading, reload } = useFetch<any>(`/api/admin/payments?${qs}`);
  return <div className="space-y-5"><div className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-2xl font-extrabold text-ink">Payments</h1>
    <a href={`/api/admin/export?type=payments${from ? `&from=${from}` : ""}${to ? `&to=${to}` : ""}`}><Button variant="outline">Download Excel</Button></a></div>
    <Card className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5"><Field label="Member ID or name"><Input value={q} onChange={(e) => setQ(e.target.value)} /></Field>
      <Field label="Status"><Select value={status} onChange={(e) => setStatus(e.target.value)}><option value="all">All</option><option>Success</option><option>Failed</option><option>Pending</option></Select></Field>
      <Field label="Type"><Select value={type} onChange={(e) => setType(e.target.value)}><option value="all">All</option><option>New Admission</option><option>Renewal</option></Select></Field>
      <Field label="From"><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field><Field label="To"><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field></Card>
    <Card>{loading && !data ? <Spinner /> : error ? <ErrorBox msg={error} retry={reload} /> : !data?.payments.length ? <Empty title="No payments found" /> :
      <Table head={["Date", "Member", "Amount", "Type", "Status", "Source", "Razorpay order / payment", "Receipt"]}>{data.payments.map((p: any) => <tr key={p["Payment ID"]} className="border-t align-top"><td className="py-2 pr-3">{p["Payment Date"]}</td><td className="pr-3"><Link className="font-semibold text-accent" href={`/admin/members/${p["Member ID"]}`}>{p["Member Name"] || p["Member ID"]}</Link></td><td className="pr-3">{inr(Number(p["Payment Amount"]))}</td><td className="pr-3">{p["Payment Type"]}</td><td className="pr-3"><Badge>{p["Payment Status"]}</Badge></td><td className="pr-3">{p["Source"] === "Manual" ? `Manual (${p["Payment Method"]})` : "Razorpay"}</td><td className="pr-3 font-mono text-xs">{p["Razorpay Order ID"]}<br />{p["Razorpay Payment ID"]}</td><td>{p["Payment Status"] === "Success" && <a className="text-accent underline" href={`/api/receipt/${p["Payment ID"]}`}>PDF</a>}</td></tr>)}</Table>}</Card></div>;
}
