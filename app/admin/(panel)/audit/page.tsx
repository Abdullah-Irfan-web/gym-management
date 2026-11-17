"use client";
import { Card, Empty, ErrorBox, Spinner, useFetch } from "@/components/ui";
import { Table } from "@/components/ui";
export default function Audit() {
  const { data, error, loading, reload } = useFetch<any>("/api/admin/audit");
  return <div className="space-y-5"><h1 className="text-2xl font-extrabold text-ink">Audit log</h1><Card>{loading && !data ? <Spinner /> : error ? <ErrorBox msg={error} retry={reload} /> : !data?.logs.length ? <Empty title="No activity recorded yet" /> :
    <Table head={["When", "By", "Action", "Entity", "Details"]}>{data.logs.map((l: any) => <tr key={l["Log ID"]} className="border-t align-top"><td className="py-2 pr-3 whitespace-nowrap">{l["Timestamp"].slice(0, 16).replace("T", " ")}</td><td className="pr-3">{l["Actor"]}</td><td className="pr-3 font-semibold">{l["Action"]}</td><td className="pr-3 font-mono text-xs">{l["Entity ID"]}</td><td className="max-w-xs break-words text-xs text-slate-600">{l["Details JSON"].slice(0, 200)}</td></tr>)}</Table>}</Card></div>;
}
