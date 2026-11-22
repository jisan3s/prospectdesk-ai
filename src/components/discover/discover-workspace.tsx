"use client";

import { useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Alert, Badge, EmptyState, PageHeading, LoadingSkeleton } from "@/components/ui/primitives";
import type { z } from "zod";
import type { companyInputSchema, researchResultSchema, researchSourceSchema } from "@/lib/validations/discovery";

type Company = z.infer<typeof companyInputSchema>;
type Research = z.infer<typeof researchResultSchema>;
type Source = z.infer<typeof researchSourceSchema>;
type Hit = { title: string; url: string; snippet: string };
type Report = { company: Company; sources: Source[]; research: Research; usage?: { input: number | null; output: number | null } };

class RequestError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

async function postJSON(url: string, data: unknown): Promise<Record<string, unknown>> {
  const response = await fetch(url, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const text = await response.text();
  let parsed: Record<string, unknown>;
  try { parsed = JSON.parse(text); } catch { throw new Error(`Unexpected response (${response.status}). Check Next.js terminal.`); }
  if (!response.ok) throw new RequestError(typeof parsed.error === "string" ? parsed.error : `Request failed (${response.status})`, response.status);
  return parsed;
}

export function DiscoverWorkspace() {
  const [industry, setIndustry] = useState("HVAC");
  const [location, setLocation] = useState("Texas, United States");
  const [hits, setHits] = useState<Hit[]>([]);
  const [company, setCompany] = useState<Company>({ name: "", website: "", industry: "HVAC", location: "Texas, United States" });
  const [report, setReport] = useState<Report | null>(null);
  const [busy, setBusy] = useState<"search" | "research" | "save" | null>(null);
  const [message, setMessage] = useState("");
  const [feedbackTone, setFeedbackTone] = useState<"info" | "error">("info");
  const [saved, setSaved] = useState(false);
  const [duplicate, setDuplicate] = useState(false);

  async function searchCompanies() {
    setBusy("search"); setMessage(""); setFeedbackTone("info"); setHits([]); setReport(null); setSaved(false); setDuplicate(false);
    try {
      const res = await postJSON("/api/discover/search", { industry, location });
      setHits((res.results as Hit[]) ?? []);
      if (!(res.results as Hit[])?.length) setMessage("No results returned. Try another industry or location.");
    } catch (error) { setFeedbackTone("error"); setMessage(error instanceof Error ? error.message : "Search failed"); }
    finally { setBusy(null); }
  }

  function chooseHit(hit: Hit) {
    let rootUrl = hit.url;
    try { rootUrl = new URL(hit.url).origin; } catch { /* user can edit */ }
    setCompany({ name: hit.title.slice(0, 120), website: rootUrl, industry, location });
    setReport(null); setSaved(false); setDuplicate(false);
    setMessage("Search results may be directories or articles. Confirm and correct the company's official name and website before researching.");
  }

  async function researchCompany() {
    setBusy("research"); setMessage(""); setFeedbackTone("info"); setReport(null); setSaved(false); setDuplicate(false);
    try {
      const result = await postJSON("/api/discover/research", company);
      setReport(result as unknown as Report);
    } catch (error) { setFeedbackTone("error"); setMessage(error instanceof Error ? error.message : "Research failed"); }
    finally { setBusy(null); }
  }

  async function saveCompany() {
  if (!report) return;

  setBusy("save");
  setMessage(""); setFeedbackTone("info");

  try {
    // Send only the fields accepted by the Save API.
    const payload = {
      company: report.company,
      sources: report.sources,
      research: report.research,
    };

    const result = await postJSON(
      "/api/discover/save",
      payload
    );

    setSaved(true);

    setMessage(
      `Company saved successfully (ID: ${result.companyId}). ` +
      `Refresh your dashboard to see the updated Companies count.`
    );
  } catch (error) { setFeedbackTone("error");
    if (error instanceof RequestError && error.status === 409) setDuplicate(true);
    setMessage(
      error instanceof Error
        ? error.message
        : "Unable to save company"
    );
  } finally {
    setBusy(null);
  }
}

  return (
    <AppShell><main className="workspace feature-content">
      <div className="mx-auto max-w-6xl space-y-8">
        <PageHeading eyebrow="Scout / Company research" title="Find your next great client." description="Search for companies, confirm the official website, and build a source-backed research brief with Scout." />

        <form onSubmit={event => { event.preventDefault(); void searchCompanies(); }} className="panel">
          <h2 className="font-semibold">1. Search for potential companies</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <label className="text-sm">Industry<input required minLength={2} disabled={!!busy} aria-label="Industry" className="field" value={industry} maxLength={80} onChange={e => setIndustry(e.target.value)} /></label>
            <label className="text-sm">Location<input required minLength={2} disabled={!!busy} aria-label="Location" className="field" value={location} maxLength={100} onChange={e => setLocation(e.target.value)} /></label>
          </div>
          <button disabled={!!busy} type="submit" className="mt-4 rounded-lg bg-indigo-600 px-5 py-3 text-white disabled:opacity-50">{busy === "search" ? "Searching..." : "Search companies"}</button>
          <p className="mt-2 text-xs text-slate-500">Search results are possible candidates, not verified businesses. Limit: 15 searches per UTC day.</p>
          {busy === "search" && <LoadingSkeleton compact label="Searching company sources…" />}
          {!hits.length && !busy && <div className="mt-5"><EmptyState title="Start with a focused search">Choose an industry and location to discover candidate companies. Review each source before researching.</EmptyState></div>}
          {hits.length > 0 && <div className="mt-5 space-y-3">{hits.map((hit, i) => <article key={`${hit.url}-${i}`} className="rounded-lg border p-4">
            <Badge>Discovered candidate</Badge><h3 className="mt-3 font-semibold">{hit.title}</h3><p className="mt-1 break-all text-xs text-slate-500">{hit.url}</p>
            <p className="mt-2 text-sm text-slate-600">{hit.snippet}</p>
            <div className="mt-3 flex flex-wrap gap-3 text-sm"><a className="text-indigo-700 underline" href={hit.url} target="_blank" rel="noopener noreferrer">Check source</a>
              <button className="rounded-lg border px-3 py-1 font-medium" disabled={!!busy} onClick={() => chooseHit(hit)}>Use as candidate</button></div>
          </article>)}</div>}
        </form>

        <section className="panel">
          <h2 className="font-semibold">2. Verify the company and research with Scout</h2>
          <p className="mt-1 text-sm text-slate-600">Correct the business name and enter its real corporate website, not a directory or LinkedIn URL.</p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {(["name", "website", "industry", "location"] as const).map(field => <label key={field} className="text-sm capitalize">{field}
              <input disabled={!!busy} className="field" value={company[field]} onChange={e => { setCompany(old => ({ ...old, [field]: e.target.value })); setReport(null); setSaved(false); setDuplicate(false); }} maxLength={field === "website" ? 2048 : 200}/>
            </label>)}
          </div>
          <button disabled={!!busy || !company.name || !company.website} onClick={researchCompany} className="mt-4 rounded-lg bg-indigo-600 px-5 py-3 text-white disabled:opacity-50">{busy === "research" ? "Scout is researching..." : "Research this company"}</button>
          <p className="mt-2 text-xs text-slate-500">Scout uses Tavily search snippets from the confirmed company domain and your saved profile. Limit: 5 research attempts per UTC day.</p>
        </section>

        {report && <section className="panel space-y-3">
           <Badge tone={saved || duplicate ? "success" : "scout"}>{duplicate ? "Previously saved company" : saved ? "Saved company" : "Research complete · Review required"}</Badge>
           <h2 className="text-lg font-semibold">
            3. Review Scout&apos;s research
          </h2>
          <p className="text-sm"><strong>Summary:</strong> {report.research.summary}</p>
          <p className="text-sm"><strong>Potential opportunity (hypothesis):</strong> {report.research.potential_opportunity}</p>
          <p className="text-sm"><strong>Fit with your skills:</strong> {report.research.relevance_to_profile}</p>
          <p className="text-sm"><strong>Confidence:</strong> {report.research.confidence}</p>
          <p className="text-sm"><strong>Caveats:</strong> {report.research.caveats.join("; ") || "None listed"}</p>
          <h3 className="font-medium">Supporting search sources</h3>
          <div className="space-y-2">{report.sources.map((source, i) => <div key={`${source.url}-${i}`} className="rounded-md bg-slate-50 p-3 text-sm">
            <span className="mr-2 font-semibold">{report.research.evidence_indexes.includes(i) ? "Used as evidence" : "Additional source"}</span>
            <a href={source.url} target="_blank" rel="noopener noreferrer" className="break-all text-indigo-700 underline">{source.title}</a>
            <p className="mt-1 text-slate-600">{source.finding}</p></div>)}</div>
          <p className="text-xs text-amber-800">Review the linked sources yourself. Search snippets and AI suggestions can be wrong or incomplete.</p>
          <button disabled={!!busy || saved || duplicate} onClick={saveCompany} className="rounded-lg bg-emerald-700 px-5 py-3 text-white disabled:opacity-50">{duplicate ? "Already saved" : saved ? "Saved" : busy === "save" ? "Saving..." : "Save company and evidence"}</button>
        </section>}
        {message && <Alert tone={feedbackTone}>{message}</Alert>}
      </div>
    </main></AppShell>
  );
}
