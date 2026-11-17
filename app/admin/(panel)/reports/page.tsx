"use client";
import { useState } from "react";
import { Button, Card, Field, Input } from "@/components/ui";
const reports: [string, string, string][] = [["members", "All members", "Everyone, with status and dues"], ["active", "Active members", ""], ["expired", "Expired members", "Within the grace period"], ["inactive", "Inactive members", "Past the grace period"], ["new-admissions", "New admissions", "Verified payments only"], ["renewals", "Renewals", "Verified payments only"], ["payments", "Payment history", "Success, failed and pending"], ["monthly-revenue", "Monthly revenue", "Successful payments grouped by month"], ["outstanding", "Outstanding dues", "Members who paid less than the plan price"]];
export default function Reports() {
  const [from, setFrom] = useState(""), [to, setTo] = useState("");
  return <div className="space-y-5"><h1 className="text-2xl font-extrabold text-ink">Reports</h1>
    <Card className="grid gap-3 sm:grid-cols-2 sm:max-w-lg"><Field label="From (optional)"><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field><Field label="To (optional)"><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field></Card>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{reports.map(([t, l, h]) => <Card key={t}><h2 className="font-bold text-ink">{l}</h2><p className="mb-3 min-h-[1.25rem] text-xs text-slate-500">{h}</p>
      <a href={`/api/admin/export?type=${t}${from ? `&from=${from}` : ""}${to ? `&to=${to}` : ""}`}><Button variant="outline">Download Excel</Button></a></Card>)}</div></div>;
}
