"use client";

import type { ReactNode } from "react";
import { useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, UserRound, Search, Target, PenLine, Menu, X, Sparkles, ArrowUpRight } from "lucide-react";
import { Brand } from "@/components/ui/primitives";
import { SignOutButton } from "./sign-out-button";

const navigation = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/profile", label: "Scout Profile", icon: UserRound },
  { href: "/discover", label: "Discover Companies", icon: Search },
  { href: "/qualification", label: "Leads & Decision-Makers", icon: Target },
  { href: "/outreach", label: "Outreach Studio", icon: PenLine },
];
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const drawer = useRef<HTMLDialogElement>(null);
  function links() {
    return <nav aria-label="Main navigation" className="space-y-1.5">{navigation.map(({ href, label, icon: Icon }) => <Link key={href} href={href} onClick={() => drawer.current?.close()} aria-current={pathname === href ? "page" : undefined} className={`flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${pathname === href ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"}`}><Icon size={18} aria-hidden="true" />{label}</Link>)}</nav>;
  }
  return <div className="min-h-screen bg-background">
    <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:p-3">Skip to content</a>
    <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 flex-col border-r border-slate-200 bg-white px-5 py-7 lg:flex">
      <Link href="/" aria-label="ProspectDesk AI dashboard"><Brand /></Link>
      <p className="mb-4 mt-10 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Workspace</p>
      {links()}
      <div className="mt-auto rounded-xl border border-teal-100 bg-teal-50/60 p-4"><Sparkles className="mb-3 text-teal-700" size={20} aria-hidden="true"/><p className="text-sm font-semibold text-slate-900">Meet Scout</p><p className="mt-2 text-xs leading-5 text-slate-600">Your research partner, from the first company to a thoughtful conversation.</p><Link href="/profile" className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-teal-800">Refine your profile <ArrowUpRight size={14}/></Link></div>
      <p className="mt-5 px-1 text-[11px] text-slate-500">Thoughtful research. Personal outreach.</p>
    </aside>
    <div className="min-w-0 lg:pl-64">
      <header className="flex min-h-18 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 sm:px-8">
        <div className="flex min-w-0 items-center gap-3"><button type="button" className="icon-button lg:hidden" aria-label="Open navigation" aria-haspopup="dialog" onClick={() => drawer.current?.showModal()}><Menu size={21}/></button><span className="hidden text-sm text-slate-500 sm:inline">Workspace <span className="mx-3 text-slate-300">/</span></span><span className="truncate text-sm font-medium text-slate-900">{navigation.find(n => n.href === pathname)?.label ?? "ProspectDesk AI"}</span></div>
        <div className="flex shrink-0 items-center gap-4"><span className="hidden items-center gap-2 text-xs font-medium text-teal-800 sm:flex"><Sparkles size={15} aria-hidden="true"/> Scout AI</span><SignOutButton/></div>
      </header>
      <div id="main-content" tabIndex={-1}>{children}</div>
    </div>
    <dialog ref={drawer} aria-labelledby="navigation-title" className="m-0 h-dvh max-h-dvh w-80 max-w-[90vw] border-r border-slate-200 bg-white p-5 backdrop:bg-slate-950/40" onClick={event => { if (event.target === event.currentTarget) drawer.current?.close(); }}>
      <div className="mb-8 flex items-center justify-between gap-2"><span id="navigation-title"><Brand/></span><button type="button" className="icon-button" aria-label="Close navigation" onClick={() => drawer.current?.close()}><X size={20}/></button></div>{links()}
    </dialog>
  </div>;
}
