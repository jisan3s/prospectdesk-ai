"use client";

import { useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { Alert, Badge, EmptyState, PageHeading } from "@/components/ui/primitives";
import type { Qualification } from "@/lib/validations/qualification";

import { postJson } from "@/lib/http/client";
import {
  acknowledgementSchema, leadershipResponseSchema, qualificationResponseSchema,
  type Evidence, type SearchHit,
} from "@/lib/validations/responses";

type Company = { id: string; name: string; website: string | null };
export function QualificationWorkspace({ companies }: { companies: Company[] }) {
  const [companyId, setCompanyId] = useState(companies[0]?.id ?? "");
  const [assessment, setAssessment] = useState<Qualification | null>(null);
  const [sources, setSources] = useState<Evidence[]>([]);
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [fullName, setFullName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [feedbackTone, setFeedbackTone] = useState<"info" | "error">("info");

  async function action(kind: "score" | "decision-makers" | "contact") {
    setBusy(true); setNotice(""); setFeedbackTone("info");
    try {
      if (kind === "score") {
        const result = await postJson("/api/qualification/score", qualificationResponseSchema, { companyId });
        setAssessment(result.assessment); setSources(result.sources);
        setNotice("Score saved. Suggested roles are hypotheses, not named contacts.");
      } else if (kind === "decision-makers") {
        const result = await postJson("/api/qualification/decision-makers", leadershipResponseSchema, { companyId });
        setHits(result.results);
        setNotice(result.warning);
      } else {
        await postJson("/api/qualification/contacts", acknowledgementSchema, { companyId, fullName, jobTitle, sourceUrl, linkedinUrl });
        setNotice("Contact candidate saved. Verify source and current employment before outreach.");
        setFullName(""); setJobTitle(""); setSourceUrl(""); setLinkedinUrl("");
      }
    } catch (error) { setFeedbackTone("error"); setNotice(error instanceof Error ? error.message : "Request failed"); }
    finally { setBusy(false); }
  }

  return <AppShell><main className="workspace feature-content">
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeading eyebrow="Scout / Lead intelligence" title="Turn evidence into opportunity." description="Evaluate saved companies, explore buyer roles, and record contact candidates with supporting sources." />
      {!companies.length && <EmptyState title="Your prospect list starts here"><Link href="/discover" className="font-medium text-indigo-700 underline">Discover and research a company</Link> before scoring leads or finding decision-makers.</EmptyState>}
      <section id="companies" className="space-y-4 panel">
        <h2 className="text-lg font-semibold">1. Choose a company</h2>
        <select disabled={!!busy} aria-label="Company" className="field" value={companyId} onChange={event => { setCompanyId(event.target.value); setAssessment(null); setSources([]); setHits([]); }}>
          {companies.map(c => <option key={c.id} value={c.id}>{c.name} — {c.website}</option>)}
        </select>
        <button disabled={busy || !companyId} className="button-primary" onClick={() => action("score")}>Score company with Scout</button>
        <p className="text-xs text-slate-500">Needs Stage 4 research evidence and your saved Stage 3 services. Up to 5 attempts per UTC day.</p>
      </section>
      {assessment && <section className="space-y-3 panel">
        <h2 className="text-xl font-semibold">2. Evidence-based assessment</h2>
        <div className="flex flex-wrap items-center gap-4"><p className="text-4xl font-semibold tracking-tight">{assessment.score}<span className="text-base font-normal text-slate-500"> / 100</span></p><Badge tone={assessment.score >= 70 ? "success" : "neutral"}>{assessment.score >= 70 ? "Qualified lead" : "Below qualification threshold"}</Badge><Badge>Confidence: {assessment.confidence}</Badge></div>
        <meter className="h-3 w-full accent-indigo-600" min={0} max={100} value={assessment.score} aria-label="Lead score">{assessment.score} out of 100</meter>
        <p>{assessment.reasoning}</p>
        <h3 className="font-semibold">Positive signals</h3><ul className="list-inside list-disc">{assessment.positive_signals.map((s, i) => <li key={i}>{s}</li>)}</ul>
        <h3 className="font-semibold">Risks and unknowns</h3><ul className="list-inside list-disc">{assessment.risks.map((s, i) => <li key={i}>{s}</li>)}</ul>
        <h3 className="font-semibold">Suggested decision-maker roles</h3><ul className="space-y-2">{assessment.suggested_roles.map((r, i) => <li key={i}><strong>{r.title}</strong>: {r.rationale}</li>)}</ul>
        <h3 className="font-semibold">Sources cited</h3><ul className="space-y-2">{sources.map(s => <li key={s.id}><a href={s.url} target="_blank" rel="noopener noreferrer" className="break-all text-indigo-700 underline">{s.url}</a><p className="text-sm text-slate-600">{s.finding}</p></li>)}</ul>
      </section>}
      <section className="space-y-3 panel">
        <h2 id="decision-makers" className="text-lg font-semibold">3. Find decision-maker candidates</h2>
        <p className="text-sm text-slate-600">Tavily returns web search results. Scout does not assert that any specific person currently holds a role.</p>
        <button disabled={busy || !companyId} className="button-primary" onClick={() => action("decision-makers")}>Search leadership sources</button>
        {hits.map((hit, i) => <article className="rounded-lg border p-3" key={`${hit.url}-${i}`}><a className="text-indigo-700 underline" href={hit.url} target="_blank" rel="noopener noreferrer">{hit.title}</a><p className="text-sm text-slate-600">{hit.snippet}</p><button className="mt-2 text-sm text-indigo-700" disabled={busy} onClick={() => setSourceUrl(hit.url)}>Use source link below</button></article>)}
      </section>
      <section className="space-y-3 panel">
        <h2 className="text-lg font-semibold">4. Add a verified-by-you contact candidate</h2>
        <p className="text-sm text-amber-800">Open the original source and confirm the person, employer, and current job title. Saving does not mark them independently verified.</p>
        <label className="block text-sm">Full name<input disabled={!!busy} className="field" value={fullName} onChange={e => setFullName(e.target.value)} /></label>
        <label className="block text-sm">Current job title<input disabled={!!busy} className="field" value={jobTitle} onChange={e => setJobTitle(e.target.value)} /></label>
        <label className="block text-sm">Source URL<input disabled={!!busy} type="url" className="field" value={sourceUrl} onChange={e => setSourceUrl(e.target.value)} /></label>
        <label className="block text-sm">LinkedIn URL (optional)<input disabled={!!busy} type="url" className="field" value={linkedinUrl} onChange={e => setLinkedinUrl(e.target.value)} /></label>
        <button disabled={busy || !companyId} className="rounded-lg bg-emerald-700 px-4 py-2 text-white disabled:opacity-50" onClick={() => action("contact")}>Save contact candidate</button>
      </section>
      {notice && <Alert tone={feedbackTone}>{notice}</Alert>}
    </div>
  </main></AppShell>;
}
