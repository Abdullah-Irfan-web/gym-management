"use client";
import { useState } from "react";
import Link from "next/link";
import { Input, Badge, useFetch, useDebounced } from "./ui";
export function MemberSearch() {
  const [q, setQ] = useState(""), dq = useDebounced(q);
  const { data } = useFetch<any>(dq.trim().length >= 2 ? `/api/admin/members?q=${encodeURIComponent(dq)}` : null);
  return <div className="relative"><Input placeholder="Quick search: name, phone, email or Member ID" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search members" />
    {dq.trim().length >= 2 && data && <ul className="absolute z-10 mt-1 max-h-72 w-full overflow-auto rounded-md border bg-white shadow-lg">
      {data.members.length === 0 ? <li className="p-3 text-sm text-slate-500">No member found</li> : data.members.slice(0, 8).map((m: any) =>
        <li key={m.id}><Link href={`/admin/members/${m.id}`} className="flex items-center justify-between gap-3 px-3 py-2 text-sm hover:bg-slate-50"><span><b>{m.fullName}</b> <span className="text-slate-500">{m.id} · {m.phone}</span></span><span className="flex items-center gap-2 text-xs text-slate-500">expires {m.expiryDate}<Badge>{m.status}</Badge></span></Link></li>)}</ul>}</div>;
}
