import type { ReactNode } from "react";
import { Compass, Inbox } from "lucide-react";

export function Brand() {
  return <span className="flex items-center gap-3"><span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white"><Compass size={21} aria-hidden="true" /></span><span className="text-base font-semibold tracking-tight text-slate-900">ProspectDesk <span className="text-indigo-600">AI</span></span></span>;
}
export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "success" | "warning" | "scout" }) {
  const tones = { neutral: "bg-slate-100 text-slate-700", success: "bg-emerald-50 text-emerald-800", warning: "bg-amber-50 text-amber-900", scout: "bg-indigo-50 text-indigo-700" };
  return <span className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-semibold ${tones[tone]}`}>{children}</span>;
}
export function PageHeading({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children?: ReactNode }) {
  return <header className="flex flex-wrap items-start justify-between gap-4"><div className="max-w-2xl"><p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-teal-700">{eyebrow}</p><h1 className="text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">{title}</h1><p className="mt-2 text-sm leading-6 text-slate-600">{description}</p></div>{children}</header>;
}
export function Alert({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "error" | "success" }) {
  const tones = { info: "border-indigo-100 bg-indigo-50 text-indigo-900", error: "border-red-200 bg-red-50 text-red-800", success: "border-emerald-200 bg-emerald-50 text-emerald-900" };
  return <div role={tone === "error" ? "alert" : "status"} className={`rounded-xl border px-4 py-3 text-sm leading-6 ${tones[tone]}`}>{children}</div>;
}
export function EmptyState({ title, children }: { title: string; children: ReactNode }) {
  return <div className="flex flex-col items-center rounded-xl border border-dashed border-slate-300 bg-slate-50/70 px-5 py-8 text-center"><Inbox className="mb-3 text-slate-400" size={25} aria-hidden="true" /><h3 className="text-sm font-semibold text-slate-800">{title}</h3><div className="mt-2 max-w-sm text-sm leading-6 text-slate-500">{children}</div></div>;
}
export function LoadingSkeleton({ label = "Loading workspace…", compact = false }: { label?: string; compact?: boolean }) {
  const Container = compact ? "div" : "main";
  return <Container className={compact ? "mt-5" : "workspace"} aria-busy="true"><p role="status" className="text-sm text-slate-600">{label}</p><div aria-hidden="true" className="mt-6 grid gap-4 sm:grid-cols-2">{[0,1,2,3].map(n => <div key={n} className="h-36 animate-pulse rounded-2xl border border-slate-200 bg-white p-6"><div className="h-3 w-1/3 rounded bg-slate-100"/><div className="mt-6 h-7 w-1/2 rounded bg-slate-100"/></div>)}</div></Container>;
}
