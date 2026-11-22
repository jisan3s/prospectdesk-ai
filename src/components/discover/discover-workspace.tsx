"use client";

import { useState } from "react";
import Link from "next/link";
import type { z } from "zod";
import type { companyInputSchema, researchResultSchema, researchSourceSchema } from "@/lib/validations/discovery";

type Company = z.infer<typeof companyInputSchema>;
type Research = z.infer<typeof researchResultSchema>;
type Source = z.infer<typeof researchSourceSchema>;
type Hit = { title: string; url: string; snippet: string };
type Report = { company: Company; sources: Source[]; research: Research; usage?: { input: number | null; output: number | null } };

async function postJSON(url: string, data: unknown): Promise<Record<string, unknown>> {
  const response = await fetch(url, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const text = await response.text();
  let parsed: Record<string, unknown>;
  try { parsed = JSON.parse(text); } catch { throw new Error(`Unexpected response (${response.status}). Check Next.js terminal.`); }
  if (!response.ok) throw new Error(typeof parsed.error === "string" ? parsed.error : `Request failed (${response.status})`);
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
  const [saved, setSaved] = useState(false);

  async function searchCompanies() {
    setBusy("search"); setMessage(""); setHits([]); setReport(null); setSaved(false);
    try {
      const res = await postJSON("/api/discover/search", { industry, location });
      setHits((res.results as Hit[]) ?? []);
      if (!(res.results as Hit[])?.length) setMessage("No results returned. Try another industry or location.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Search failed"); }
    finally { setBusy(null); }
  }

  function chooseHit(hit: Hit) {
    let rootUrl = hit.url;
    try { rootUrl = new URL(hit.url).origin; } catch { /* user can edit */ }
    setCompany({ name: hit.title.slice(0, 120), website: rootUrl, industry, location });
    setReport(null); setSaved(false);
    setMessage("Search results may be directories or articles. Confirm and correct the company's official name and website before researching.");
  }

  async function researchCompany() {
    setBusy("research"); setMessage(""); setReport(null); setSaved(false);
    try {
      const result = await postJSON("/api/discover/research", company);
      setReport(result as unknown as Report);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Research failed"); }
    finally { setBusy(null); }
  }

  async function saveCompany() {
  if (!report) return;

  setBusy("save");
  setMessage("");

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
  } catch (error) {
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
    <main className="min-h-screen bg-slate-50 px-5 py-10 text-slate-900">
      <div className="mx-auto max-w-5xl space-y-8">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div><p className="text-sm font-semibold text-indigo-600">ProspectDesk AI / Scout</p>
            <h1 className="mt-1 text-3xl font-bold">Company Discovery</h1>
            <p className="mt-2 text-sm text-slate-600">Find candidate companies, verify the official site, research with Scout, then save.</p></div>
          <nav className="flex gap-4 text-sm text-indigo-700"><Link href="/">Dashboard</Link><Link href="/profile">My Profile</Link></nav>
        </header>

        <section className="rounded-xl border bg-white p-5 shadow-sm">
          <h2 className="font-semibold">1. Search for potential companies</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <label className="text-sm">Industry<input aria-label="Industry" className="mt-1 w-full rounded-lg border p-3" value={industry} maxLength={80} onChange={e => setIndustry(e.target.value)} /></label>
            <label className="text-sm">Location<input aria-label="Location" className="mt-1 w-full rounded-lg border p-3" value={location} maxLength={100} onChange={e => setLocation(e.target.value)} /></label>
          </div>
          <button disabled={!!busy} onClick={searchCompanies} className="mt-4 rounded-lg bg-indigo-600 px-5 py-3 text-white disabled:opacity-50">{busy === "search" ? "Searching..." : "Search companies"}</button>
          <p className="mt-2 text-xs text-slate-500">Search results are possible candidates, not verified businesses. Limit: 15 searches per UTC day.</p>
          {hits.length > 0 && <div className="mt-5 space-y-3">{hits.map((hit, i) => <article key={`${hit.url}-${i}`} className="rounded-lg border p-4">
            <h3 className="font-medium">{hit.title}</h3><p className="mt-1 break-all text-xs text-slate-500">{hit.url}</p>
            <p className="mt-2 text-sm text-slate-600">{hit.snippet}</p>
            <div className="mt-3 flex flex-wrap gap-3 text-sm"><a className="text-indigo-700 underline" href={hit.url} target="_blank" rel="noopener noreferrer">Check source</a>
              <button className="rounded-lg border px-3 py-1 font-medium" onClick={() => chooseHit(hit)}>Use as candidate</button></div>
          </article>)}</div>}
        </section>

        <section className="rounded-xl border bg-white p-5 shadow-sm">
          <h2 className="font-semibold">2. Verify the company and research with Scout</h2>
          <p className="mt-1 text-sm text-slate-600">Correct the business name and enter its real corporate website, not a directory or LinkedIn URL.</p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {(["name", "website", "industry", "location"] as const).map(field => <label key={field} className="text-sm capitalize">{field}
              <input className="mt-1 w-full rounded-lg border p-3" value={company[field]} onChange={e => { setCompany(old => ({ ...old, [field]: e.target.value })); setReport(null); setSaved(false); }} maxLength={field === "website" ? 2048 : 200}/>
            </label>)}
          </div>
          <button disabled={!!busy || !company.name || !company.website} onClick={researchCompany} className="mt-4 rounded-lg bg-indigo-600 px-5 py-3 text-white disabled:opacity-50">{busy === "research" ? "Scout is researching..." : "Research this company"}</button>
          <p className="mt-2 text-xs text-slate-500">Scout uses Tavily search snippets from the confirmed company domain and your saved profile. Limit: 5 research attempts per UTC day.</p>
        </section>

        {report && <section className="rounded-xl border bg-white p-5 shadow-sm space-y-3">
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
          <button disabled={!!busy || saved} onClick={saveCompany} className="rounded-lg bg-emerald-700 px-5 py-3 text-white disabled:opacity-50">{saved ? "Saved" : busy === "save" ? "Saving..." : "Save company and evidence"}</button>
        </section>}
        {message && <p role="status" className="rounded-lg border bg-white p-4 text-sm text-slate-700">{message}</p>}
      </div>
    </main>
  );
}
