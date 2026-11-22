"use client";

import { useState } from "react";
import Link from "next/link";
import type { Qualification } from "@/lib/validations/qualification";

type Company = { id: string; name: string; website: string | null };
type Hit = { title: string; url: string; snippet: string };
type Source = { id: string; url: string; finding: string };

async function submit(url: string, payload: unknown) {
  const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}

export function QualificationWorkspace({ companies }: { companies: Company[] }) {
  const [companyId, setCompanyId] = useState(companies[0]?.id ?? "");
  const [assessment, setAssessment] = useState<Qualification | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [hits, setHits] = useState<Hit[]>([]);
  const [fullName, setFullName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  async function action(kind: "score" | "decision-makers" | "contact") {
    setBusy(true); setNotice("");
    try {
      if (kind === "score") {
        const result = await submit("/api/qualification/score", { companyId });
        setAssessment(result.assessment); setSources(result.sources);
        setNotice("Score saved. Suggested roles are hypotheses, not named contacts.");
      } else if (kind === "decision-makers") {
        const result = await submit("/api/qualification/decision-makers", { companyId });
        setHits(result.results);
        setNotice(result.warning);
      } else {
        await submit("/api/qualification/contacts", { companyId, fullName, jobTitle, sourceUrl, linkedinUrl });
        setNotice("Contact candidate saved. Verify source and current employment before outreach.");
        setFullName(""); setJobTitle(""); setSourceUrl(""); setLinkedinUrl("");
      }
    } catch (error) { setNotice(error instanceof Error ? error.message : "Request failed"); }
    finally { setBusy(false); }
  }

  const inputClass = "w-full rounded-lg border border-slate-300 bg-white p-3 text-slate-900";
  return <main className="min-h-screen bg-slate-50 p-6 text-slate-900">
    <div className="mx-auto max-w-4xl space-y-6">
      <nav className="flex gap-4 text-sm text-indigo-700"><Link href="/">Dashboard</Link><Link href="/discover">Discover</Link><Link href="/profile">Profile</Link></nav>
      <header><h1 className="text-3xl font-bold">Scout — Lead Qualification</h1><p className="mt-2 text-slate-600">Score researched companies, discover possible buyer roles, and record source-backed contact candidates.</p></header>
      <section className="space-y-4 rounded-xl border bg-white p-5">
        <h2 className="text-lg font-semibold">1. Choose a company</h2>
        <select aria-label="Company" className={inputClass} value={companyId} onChange={event => { setCompanyId(event.target.value); setAssessment(null); setSources([]); setHits([]); }}>
          {companies.map(c => <option key={c.id} value={c.id}>{c.name} — {c.website}</option>)}
        </select>
        <button disabled={busy || !companyId} className="rounded-lg bg-indigo-700 px-4 py-2 text-white disabled:opacity-50" onClick={() => action("score")}>Score company with Scout</button>
        <p className="text-xs text-slate-500">Needs Stage 4 research evidence and your saved Stage 3 services. Up to 5 attempts per UTC day.</p>
      </section>
      {assessment && <section className="space-y-3 rounded-xl border bg-white p-5">
        <h2 className="text-xl font-semibold">2. Evidence-based assessment</h2>
        <p className="text-3xl font-bold">{assessment.score}/100 <span className="text-sm font-normal">Confidence: {assessment.confidence}</span></p>
        <p>{assessment.reasoning}</p>
        <h3 className="font-semibold">Positive signals</h3><ul className="list-inside list-disc">{assessment.positive_signals.map((s, i) => <li key={i}>{s}</li>)}</ul>
        <h3 className="font-semibold">Risks and unknowns</h3><ul className="list-inside list-disc">{assessment.risks.map((s, i) => <li key={i}>{s}</li>)}</ul>
        <h3 className="font-semibold">Suggested decision-maker roles</h3><ul className="space-y-2">{assessment.suggested_roles.map((r, i) => <li key={i}><strong>{r.title}</strong>: {r.rationale}</li>)}</ul>
        <h3 className="font-semibold">Sources cited</h3><ul className="space-y-2">{sources.map(s => <li key={s.id}><a href={s.url} target="_blank" rel="noopener noreferrer" className="break-all text-indigo-700 underline">{s.url}</a><p className="text-sm text-slate-600">{s.finding}</p></li>)}</ul>
      </section>}
      <section className="space-y-3 rounded-xl border bg-white p-5">
        <h2 className="text-lg font-semibold">3. Find decision-maker candidates</h2>
        <p className="text-sm text-slate-600">Tavily returns web search results. Scout does not assert that any specific person currently holds a role.</p>
        <button disabled={busy || !companyId} className="rounded-lg bg-indigo-700 px-4 py-2 text-white disabled:opacity-50" onClick={() => action("decision-makers")}>Search leadership sources</button>
        {hits.map((hit, i) => <article className="rounded-lg border p-3" key={`${hit.url}-${i}`}><a className="text-indigo-700 underline" href={hit.url} target="_blank" rel="noopener noreferrer">{hit.title}</a><p className="text-sm text-slate-600">{hit.snippet}</p><button className="mt-2 text-sm text-indigo-700" onClick={() => setSourceUrl(hit.url)}>Use source link below</button></article>)}
      </section>
      <section className="space-y-3 rounded-xl border bg-white p-5">
        <h2 className="text-lg font-semibold">4. Add a verified-by-you contact candidate</h2>
        <p className="text-sm text-amber-800">Open the original source and confirm the person, employer, and current job title. Saving does not mark them independently verified.</p>
        <label className="block text-sm">Full name<input className={inputClass} value={fullName} onChange={e => setFullName(e.target.value)} /></label>
        <label className="block text-sm">Current job title<input className={inputClass} value={jobTitle} onChange={e => setJobTitle(e.target.value)} /></label>
        <label className="block text-sm">Source URL<input type="url" className={inputClass} value={sourceUrl} onChange={e => setSourceUrl(e.target.value)} /></label>
        <label className="block text-sm">LinkedIn URL (optional)<input type="url" className={inputClass} value={linkedinUrl} onChange={e => setLinkedinUrl(e.target.value)} /></label>
        <button disabled={busy || !companyId} className="rounded-lg bg-emerald-700 px-4 py-2 text-white disabled:opacity-50" onClick={() => action("contact")}>Save contact candidate</button>
      </section>
      {notice && <p role="status" className="rounded-lg border bg-white p-4 text-sm">{notice}</p>}
    </div>
  </main>;
}
