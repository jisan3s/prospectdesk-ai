"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { RecordsResult } from "@/lib/records/load";
import type { RecordsQuery } from "@/lib/records/query";
import { ArrowRight, ExternalLink } from "lucide-react";
import { RefreshRecords } from "./refresh-records";
import { Badge, EmptyState, PageHeading } from "@/components/ui/primitives";
import { recordViews, type RecordKind } from "@/lib/records/types";

function display(value: string) { return value.replaceAll("_", " "); }
function date(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "Date unavailable" : parsed.toLocaleDateString("en-US", { timeZone: "UTC", year: "numeric", month: "short", day: "numeric" });
}
function safeUrl(value: string): string | null {
  try { const url = new URL(value); return ["https:", "http:"].includes(url.protocol) ? url.href : null; } catch { return null; }
}
function SourceLink({ url, label }: { url: string; label: string }) {
  const href = safeUrl(url);
  return href ? <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 break-all text-sm font-medium text-indigo-700 underline"><span>{label}</span><ExternalLink size={14} className="shrink-0" aria-hidden="true" /></a> : <span className="break-all text-sm text-slate-600">{label}</span>;
}

export function RecordList({ kind, result, query }: { kind: RecordKind; result: RecordsResult; query: RecordsQuery }) {
  const view = recordViews[kind];
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState(query.search);
  const { records: rows, total, savedTotal, companies, statuses } = result;
  const pages = Math.max(1, Math.ceil(total / 20));
  const current = result.page;
  const start = (current - 1) * 20;
  const status = query.status, company = query.company, channel = query.channel, sort = query.sort;
  function navigate(changes: Partial<RecordsQuery>) {
    const next = { ...query, page: 1, ...changes };
    const params = new URLSearchParams();
    for (const [key,value] of Object.entries(next)) if (value !== "") params.set(key,String(value));
    startTransition(() => router.push(`/${kind}?${params}`));
  }
  function clear() { setSearch(""); navigate({ search: "", status: "", company: "", channel: "", sort: "newest" }); }

  return <main className="workspace space-y-6">
    <PageHeading eyebrow="Your saved records" title={view.title} description={view.description}>
      <Link className="button-primary" href={view.href}>{view.action}<ArrowRight size={16} aria-hidden="true" /></Link>
    </PageHeading>
    <form aria-label="Record filters" className="panel space-y-4" onSubmit={event => { event.preventDefault(); navigate({ search }); }}><fieldset disabled={pending} className="min-w-0 space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <label className="min-w-0 text-sm font-medium">Search records<input type="search" className="field" placeholder="Search names, companies, or content" value={search} maxLength={200} onChange={event => setSearch(event.target.value)} /></label>
        {kind !== "companies" && <label className="min-w-0 text-sm font-medium">Company<select aria-label="Company" className="field" value={company} onChange={event => navigate({ company: event.target.value, search })}><option value="">All companies</option>{companies.map(({id,name}) => <option key={id} value={id}>{name}</option>)}</select></label>}
        {(kind === "companies" || kind === "drafts") && <label className="min-w-0 text-sm font-medium">Status<select aria-label="Status" className="field" value={status} onChange={event => navigate({ status: event.target.value as RecordsQuery["status"], search })}><option value="">All statuses</option>{statuses.map(value => <option key={value} value={value}>{display(value)}</option>)}</select></label>}
        {kind === "drafts" && <label className="min-w-0 text-sm font-medium">Channel<select aria-label="Channel" className="field" value={channel} onChange={event => navigate({ channel: event.target.value as RecordsQuery["channel"], search })}><option value="">All channels</option><option value="email">Email</option><option value="linkedin">LinkedIn</option></select></label>}
        <label className="min-w-0 text-sm font-medium">Sort by<select aria-label="Sort by" className="field" value={sort} onChange={event => navigate({ sort: event.target.value as RecordsQuery["sort"], search })}><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="name">Name A–Z</option>{kind === "leads" && <option value="score">Highest score</option>}</select></label>
      </div>
      {kind !== "companies" && companies.length === 100 && <p className="text-xs text-slate-600">Use search to find a company outside the first 100 filter choices.</p>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p role="status" className="text-sm text-slate-600">{total ? `${start + 1}–${Math.min(start + 20, total)} of ${total}` : "0"} records{total !== savedTotal ? ` · ${savedTotal} saved in total` : ""}</p>
        <div className="flex flex-wrap gap-2"><button type="submit" className="button-primary">Search</button><button type="button" className="button-secondary" onClick={clear}>Clear filters</button><RefreshRecords /></div>
      </div>
    </fieldset></form>
    {pending && <p role="status" className="text-sm text-slate-600">Loading records…</p>}
    {!rows.length ? <EmptyState title={savedTotal ? "No matching records" : `No ${kind === "leads" ? "qualified leads" : "saved " + kind} yet`}>{savedTotal ? "Try a different search or clear the filters." : <Link className="text-indigo-700 underline" href={view.href}>{view.action} to get started.</Link>}</EmptyState> : <section aria-label={view.title} className="grid min-w-0 gap-4 lg:grid-cols-2">
      {rows.map(row => <article key={row.id} className="panel min-w-0 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0 flex-1"><h2 className="text-lg font-semibold text-slate-950">{row.title}</h2><p className="mt-1 text-sm text-slate-600">{kind !== "companies" && row.company !== row.title ? `${row.company} · ` : ""}{row.subtitle}</p></div>{row.score !== undefined && <p className="text-2xl font-semibold text-indigo-700">{row.score}<span className="text-sm font-normal text-slate-500"> / 100</span></p>}</div>
        <div className="flex flex-wrap gap-2"><Badge tone={row.status === "Qualified lead" || row.status === "approved" || row.status === "manually_sent" ? "success" : row.status === "Contact candidate" || row.status === "rejected" ? "warning" : "neutral"}>{display(row.status)}</Badge>{row.channel && <Badge>{row.channel === "linkedin" ? "LinkedIn" : "Email"}</Badge>}{row.messageType && <Badge>{display(row.messageType)}</Badge>}{row.confidence && <Badge>Confidence: {row.confidence}</Badge>}</div>
        <p className="line-clamp-3 whitespace-pre-wrap text-sm leading-6 text-slate-600">{row.description}</p>
        <p className="text-xs text-slate-500">{kind === "leads" ? "Assessed" : "Saved"} {date(row.date)} (UTC)</p>
        <details className="rounded-xl border border-slate-200 p-3"><summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold text-slate-800">View full record</summary><div className="mt-3 min-w-0 space-y-4">
          <p className="whitespace-pre-wrap break-words text-sm leading-6">{row.description}</p>
          {row.links.map(link => <div key={link.url}><SourceLink {...link} /></div>)}
          {row.details.map((detail, index) => <div key={index}><h3 className="text-sm font-semibold">{safeUrl(detail.label) ? <SourceLink url={detail.label} label="Supporting source" /> : detail.label}</h3><p className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-600">{detail.text}</p></div>)}
          <p className="break-all text-xs text-slate-500">Record ID: {row.id}</p>
        </div></details>
        <Link className="button-secondary" href={kind === "drafts" ? "/outreach" : `/qualification?company=${encodeURIComponent(row.companyId)}`}>{kind === "drafts" ? "Open Outreach Studio" : "Open lead research"}<ArrowRight size={15} aria-hidden="true" /></Link>
      </article>)}
    </section>}
    <nav aria-label="Record pagination" className="flex flex-wrap items-center justify-between gap-3"><button disabled={pending || current <= 1} onClick={() => navigate({ page: current - 1 })} className="button-secondary">Previous page</button><p className="text-sm text-slate-600">Page {current} of {pages}</p><button disabled={pending || current >= pages} onClick={() => navigate({ page: current + 1 })} className="button-secondary">Next page</button></nav>
  </main>;
}
