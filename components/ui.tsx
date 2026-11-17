"use client";
import { useEffect, useState, type ReactNode, type ButtonHTMLAttributes, type InputHTMLAttributes, type SelectHTMLAttributes } from "react";

export const cx = (...a: (string | false | undefined | null)[]) => a.filter(Boolean).join(" ");
export const inr = (n: number, cur = "INR") => new Intl.NumberFormat("en-IN", { style: "currency", currency: cur, maximumFractionDigits: 0 }).format(n);

export async function api<T = any>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...init?.headers }, body: init?.json !== undefined ? JSON.stringify(init.json) : init?.body });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error ?? "Request failed"), { status: res.status, fields: data.fields });
  return data;
}

type Listener = (t: { id: number; msg: string; kind: "ok" | "err" }) => void;
const listeners = new Set<Listener>();
export const toast = (msg: string, kind: "ok" | "err" = "ok") => listeners.forEach((l) => l({ id: Date.now() + Math.random(), msg, kind }));
export function Toaster() {
  const [items, setItems] = useState<{ id: number; msg: string; kind: string }[]>([]);
  useEffect(() => {
    const l: Listener = (t) => { setItems((x) => [...x, t]); setTimeout(() => setItems((x) => x.filter((i) => i.id !== t.id)), 4500); };
    listeners.add(l); return () => { listeners.delete(l); };
  }, []);
  return <div className="fixed bottom-4 right-4 z-50 flex max-w-[calc(100vw-2rem)] flex-col gap-2" role="status" aria-live="polite">
    {items.map((t) => <div key={t.id} className={cx("rounded-md px-4 py-3 text-sm text-white shadow-lg", t.kind === "ok" ? "bg-emerald-700" : "bg-red-700")}>{t.msg}</div>)}
  </div>;
}

export function Button({ variant = "primary", loading, className, children, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "danger" | "outline"; loading?: boolean }) {
  const v = { primary: "bg-accent text-white hover:bg-accent-dark", ghost: "text-slate-700 hover:bg-slate-100", danger: "bg-red-700 text-white hover:bg-red-800", outline: "border border-slate-300 bg-white text-slate-800 hover:bg-slate-50" }[variant];
  return <button {...p} disabled={p.disabled || loading} className={cx("inline-flex min-h-[40px] items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60", v, className)}>
    {loading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />}{children}</button>;
}
export function Field({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: ReactNode }) {
  return <label className="block text-sm"><span className="mb-1 block font-medium text-slate-700">{label}</span>{children}
    {hint && !error && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}{error && <span className="mt-1 block text-xs text-red-700">{error}</span>}</label>;
}
const field = "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:border-accent";
export const Input = (p: InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={cx(field, p.className)} />;
export const Select = (p: SelectHTMLAttributes<HTMLSelectElement>) => <select {...p} className={cx(field, p.className)} />;
export const Card = ({ children, className }: { children: ReactNode; className?: string }) => <div className={cx("rounded-xl border border-slate-200 bg-white p-5 shadow-sm", className)}>{children}</div>;

const tone: Record<string, string> = {
  Active: "bg-emerald-100 text-emerald-800", Success: "bg-emerald-100 text-emerald-800", SENT: "bg-emerald-100 text-emerald-800", Paid: "bg-emerald-100 text-emerald-800",
  Expired: "bg-amber-100 text-amber-800", Pending: "bg-amber-100 text-amber-800", PENDING: "bg-amber-100 text-amber-800", Due: "bg-amber-100 text-amber-800",
  Inactive: "bg-slate-200 text-slate-700", Failed: "bg-red-100 text-red-800", FAILED: "bg-red-100 text-red-800", ABANDONED: "bg-slate-200 text-slate-700",
};
export const Badge = ({ children }: { children: string }) => <span className={cx("inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold", tone[children] ?? "bg-slate-100 text-slate-700")}>{children}</span>;
export const Spinner = () => <div className="flex justify-center py-16" role="status" aria-label="Loading"><div className="h-7 w-7 animate-spin rounded-full border-2 border-accent border-t-transparent" /></div>;
export const Empty = ({ title, hint }: { title: string; hint?: string }) => <div className="py-14 text-center"><p className="font-semibold text-slate-700">{title}</p>{hint && <p className="mt-1 text-sm text-slate-500">{hint}</p>}</div>;
export const ErrorBox = ({ msg, retry }: { msg: string; retry?: () => void }) => <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">{msg}{retry && <button onClick={retry} className="ml-3 font-semibold underline">Try again</button>}</div>;

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  useEffect(() => { if (!open) return; const h = (e: KeyboardEvent) => e.key === "Escape" && onClose(); window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h); }, [open, onClose]);
  if (!open) return null;
  return <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4" onClick={onClose}>
    <div role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()} className="max-h-[92vh] w-full overflow-y-auto rounded-t-xl bg-white p-6 shadow-xl sm:max-w-lg sm:rounded-xl">
      <h2 className="mb-4 text-lg font-bold text-ink">{title}</h2>{children}</div></div>;
}
export function Confirm({ open, title, body, confirmLabel, onConfirm, onClose, loading }: { open: boolean; title: string; body: ReactNode; confirmLabel: string; onConfirm: () => void; onClose: () => void; loading?: boolean }) {
  return <Modal open={open} onClose={onClose} title={title}><div className="text-sm text-slate-600">{body}</div>
    <div className="mt-6 flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={onConfirm} loading={loading}>{confirmLabel}</Button></div></Modal>;
}
export function useFetch<T>(url: string | null) {
  const [data, setData] = useState<T | null>(null), [error, setError] = useState(""), [loading, setLoading] = useState(!!url), [n, setN] = useState(0);
  useEffect(() => {
    if (!url) return; let live = true; setLoading(true); setError("");
    api<T>(url).then((d) => live && setData(d)).catch((e) => live && setError(e.message)).finally(() => live && setLoading(false));
    return () => { live = false; };
  }, [url, n]);
  return { data, error, loading, reload: () => setN((x) => x + 1) };
}
export const useDebounced = <T,>(v: T, ms = 300) => { const [d, setD] = useState(v); useEffect(() => { const t = setTimeout(() => setD(v), ms); return () => clearTimeout(t); }, [v, ms]); return d; };

export function Table({ head, children }: { head: string[]; children: any }) { return <div className="overflow-x-auto"><table className="w-full min-w-[520px] text-left text-sm"><thead><tr className="text-xs text-slate-500">{head.map((h) => <th key={h} className="pb-2 pr-3 font-medium">{h}</th>)}</tr></thead><tbody>{children}</tbody></table></div>; }
