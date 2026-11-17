"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { LayoutDashboard, Users, CreditCard, Layers, Mail, FileSpreadsheet, History, Settings, LogOut, Menu, X } from "lucide-react";
import { api, cx } from "./ui";

const nav = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard }, { href: "/admin/members", label: "Members", icon: Users },
  { href: "/admin/payments", label: "Payments", icon: CreditCard }, { href: "/admin/plans", label: "Plans", icon: Layers },
  { href: "/admin/notifications", label: "Emails", icon: Mail }, { href: "/admin/reports", label: "Reports", icon: FileSpreadsheet },
  { href: "/admin/audit", label: "Audit log", icon: History }, { href: "/admin/settings", label: "Settings", icon: Settings },
];
export function Sidebar() {
  const path = usePathname(), router = useRouter(), [open, setOpen] = useState(false);
  const out = async () => { await api("/api/auth/logout", { method: "POST" }); router.push("/admin/login"); };
  const body = <nav className="flex h-full flex-col p-4">
    <p className="mb-6 px-2 text-lg font-extrabold text-white">Gym admin</p>
    <ul className="flex-1 space-y-1">{nav.map(({ href, label, icon: I }) => {
      const active = href === "/admin" ? path === href : path.startsWith(href);
      return <li key={href}><Link href={href} onClick={() => setOpen(false)} aria-current={active ? "page" : undefined}
        className={cx("flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium", active ? "bg-white/15 text-white" : "text-slate-300 hover:bg-white/10")}><I size={18} />{label}</Link></li>; })}</ul>
    <button onClick={out} className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm text-slate-300 hover:bg-white/10"><LogOut size={18} />Sign out</button></nav>;
  return <>
    <div className="sticky top-0 z-30 flex items-center justify-between bg-ink px-4 py-3 text-white lg:hidden"><span className="font-extrabold">Gym admin</span>
      <button aria-label={open ? "Close menu" : "Open menu"} onClick={() => setOpen(!open)}>{open ? <X /> : <Menu />}</button></div>
    {open && <div className="fixed inset-0 top-12 z-20 bg-ink lg:hidden">{body}</div>}
    <aside className="fixed inset-y-0 left-0 hidden w-60 bg-ink lg:block">{body}</aside></>;
}
