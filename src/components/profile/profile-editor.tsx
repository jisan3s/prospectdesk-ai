"use client";

import { useState, type FormEvent } from "react";
import {
  profileInputSchema,
  type ProfileInput,
  type ScoutAnalysis,
} from "@/lib/validations/profile";
import Link from "next/link";

type Props = {
  initial: ProfileInput;
  initialAnalysis: ScoutAnalysis | null;
  lastAnalyzedAt: string | null;
};

export function ProfileEditor({ initial, initialAnalysis, lastAnalyzedAt }: Props) {
  const [form, setForm] = useState<ProfileInput>(initial);
  const [skillsText, setSkillsText] = useState(initial.skills.join(", "));
  const [servicesText, setServicesText] = useState(initial.services.join(", "));
  const [analysis, setAnalysis] = useState(initialAnalysis);
  const [analyzedAt, setAnalyzedAt] = useState(lastAnalyzedAt);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState<"save" | "analyze" | null>(null);
  const [notice, setNotice] = useState("");

  function change(key: keyof ProfileInput, value: string) {
    setForm(old => ({ ...old, [key]: value }));
    setDirty(true);
  }
  function csvToArray(value: string) {
    return value.split(",").map(x => x.trim()).filter(Boolean);
  }
  function collect(): ProfileInput {
    return {
      ...form,
      skills: csvToArray(skillsText),
      services: csvToArray(servicesText),
    };
  }
  async function save(event?: FormEvent<HTMLFormElement>): Promise<boolean> {
    event?.preventDefault();
    const parsed = profileInputSchema.safeParse(collect());
    if (!parsed.success) {
      setNotice("Please check field lengths, URLs, and comma-separated skills/services.");
      return false;
    }
    setBusy("save");
    setNotice("");
    try {
      const response = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Save failed");
      setForm(parsed.data);
      setAnalysis(null);
      setAnalyzedAt(null);
      setDirty(false);
      setNotice("Profile saved. You can now run Scout analysis.");
      return true;
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to save");
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function analyze() {
    if (dirty) {
      setNotice("Save your latest changes before running Scout.");
      return;
    }
    setBusy("analyze");
    setNotice("");
    try {
      const response = await fetch("/api/profile/analyze", { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Analysis failed");
      setAnalysis(data.analysis);
      setAnalyzedAt(new Date().toISOString());
      setNotice("Scout analysis completed and saved.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to analyze");
    } finally {
      setBusy(null);
    }
  }

  const inputClass = "mt-1 w-full rounded-lg border border-slate-300 bg-white p-3 text-slate-900";
  return (
    <main className="min-h-screen bg-slate-50 p-6 text-slate-900">
      <div className="mx-auto max-w-4xl space-y-8">
        <div>
          <Link href="/" className="text-sm text-indigo-600">
            Back to Dashboard
          </Link>
          <h1 className="mt-3 text-3xl font-bold">Your Professional Profile</h1>
          <p className="mt-2 text-slate-600">Supply your own LinkedIn/CV content. Scout does not scrape LinkedIn or fetch these URLs.</p>
        </div>

        <form onSubmit={save} className="space-y-5 rounded-xl border bg-white p-6">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-sm font-medium">Display name
              <input className={inputClass} maxLength={120} value={form.display_name} onChange={e => change("display_name", e.target.value)} />
            </label>
            <label className="text-sm font-medium">Professional headline
              <input className={inputClass} maxLength={200} value={form.headline} onChange={e => change("headline", e.target.value)} />
            </label>
            <label className="text-sm font-medium">LinkedIn profile URL
              <input type="url" className={inputClass} value={form.linkedin_url} onChange={e => change("linkedin_url", e.target.value)} placeholder="https://www.linkedin.com/in/..." />
            </label>
            <label className="text-sm font-medium">Portfolio URL
              <input type="url" className={inputClass} value={form.portfolio_url} onChange={e => change("portfolio_url", e.target.value)} placeholder="https://your-portfolio.com" />
            </label>
          </div>
          <label className="block text-sm font-medium">Professional summary
            <textarea className={inputClass} rows={4} maxLength={2500} value={form.summary} onChange={e => change("summary", e.target.value)} />
          </label>
          <label className="block text-sm font-medium">Skills (comma-separated, max 20)
            <input className={inputClass} value={skillsText} onChange={e => { setSkillsText(e.target.value); setDirty(true); }} placeholder="React, TypeScript, Webflow" />
          </label>
          <label className="block text-sm font-medium">Services you actually offer (comma-separated)
            <input className={inputClass} value={servicesText} onChange={e => { setServicesText(e.target.value); setDirty(true); }} placeholder="Website development, API integration" />
          </label>
          <label className="block text-sm font-medium">LinkedIn About / Experience / selected CV text
            <textarea className={inputClass} rows={8} maxLength={6500} value={form.raw_profile_text} onChange={e => change("raw_profile_text", e.target.value)} placeholder="Paste relevant content you own or have permission to use..." />
          </label>
          <div className="flex flex-wrap gap-3">
            <button type="submit" disabled={busy !== null} className="rounded-lg bg-slate-900 px-5 py-3 font-medium text-white disabled:opacity-50">{busy === "save" ? "Saving..." : "Save profile"}</button>
            <button type="button" onClick={analyze} disabled={busy !== null || dirty} className="rounded-lg bg-indigo-600 px-5 py-3 font-medium text-white disabled:opacity-50">{busy === "analyze" ? "Scout is analyzing..." : "Analyze with Scout"}</button>
          </div>
          <p className="text-sm text-slate-500">Maximum 3 analysis attempts per UTC day. Save is free; analysis uses your OpenAI API credits.</p>
          {notice && <p role="status" className="text-sm text-indigo-800">{notice}</p>}
          {dirty && <p className="text-sm text-amber-700">You have unsaved changes.</p>}
        </form>

        {analysis && (
          <section className="space-y-5 rounded-xl border bg-white p-6">
            <h2 className="text-2xl font-bold">Scout Analysis</h2>
            {analyzedAt && <p className="text-sm text-slate-500">Last analyzed: {new Date(analyzedAt).toLocaleString()}</p>}
            {dirty && <p className="text-amber-700">This analysis reflects your last saved profile, not your unsaved edits.</p>}
            <p className="rounded-lg bg-indigo-50 p-4">{analysis.positioning_statement}</p>
            <ResultList title="Strengths supported by profile" items={analysis.verified_strengths} />
            <ResultList title="Suggested services (verify before offering)" items={analysis.suggested_services} />
            <div><h3 className="font-semibold">Potential ideal clients</h3>
              <ul className="mt-2 space-y-2">
                {analysis.ideal_clients.map((c, i) => <li className="rounded-lg border p-3" key={i}>
                  <strong>{c.industry}</strong> — {c.buyer_role}<p className="text-sm text-slate-600">{c.why_relevant}</p>
                </li>)}
              </ul>
            </div>
            <ResultList title="Information to add" items={analysis.missing_information} />
            <ResultList title="Cautions / uncertain claims" items={analysis.cautions} />
          </section>
        )}
      </div>
    </main>
  );
}

function ResultList({ title, items }: { title: string; items: string[] }) {
  return <div><h3 className="font-semibold">{title}</h3>
    {items.length ? <ul className="mt-2 list-inside list-disc space-y-1 text-slate-700">{items.map((item, i) => <li key={i}>{item}</li>)}</ul> : <p className="mt-2 text-sm text-slate-500">No entries reported.</p>}
  </div>;
}
