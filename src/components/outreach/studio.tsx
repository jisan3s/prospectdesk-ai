"use client";

import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { Alert, Badge, EmptyState, PageHeading } from "@/components/ui/primitives";
import { useEffect, useState } from "react";

type Company = { id: string; name: string };
type Contact = { id: string; company_id: string; full_name: string; job_title: string | null; verification_source: string | null };
type Draft = {
  id: string; company_id: string; contact_id: string | null; channel: "linkedin" | "email";
  message_type: "connection" | "initial" | "follow_up"; subject: string | null;
  body: string; status: string; revision: number; created_at: string; approved_at?: string | null; sent_at?: string | null;
};

async function api(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}

export function OutreachStudio({ companies, contacts }: { companies: Company[]; contacts: Contact[] }) {
  const [companyId, setCompanyId] = useState(companies[0]?.id ?? "");
  const [contactId, setContactId] = useState("");
  const [channel, setChannel] = useState<"linkedin" | "email">("linkedin");
  const [messageType, setMessageType] = useState<"connection" | "initial" | "follow_up">("connection");
  const [angle, setAngle] = useState("");
  const [draftsLoading, setDraftsLoading] = useState(true);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [selected, setSelected] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [feedbackTone, setFeedbackTone] = useState<"info" | "error">("info");
  const [cautions, setCautions] = useState<string[]>([]);
  const active = drafts.find(d => d.id === selected);
  const matchingContacts = contacts.filter(c => c.company_id === companyId);
  const edited = !!active && (subject !== (active.subject ?? "") || body !== active.body);

  async function load() {
    try { const data = await api("/api/outreach/drafts"); setDrafts(data.drafts); }
    catch (err) { setFeedbackTone("error"); setNotice(err instanceof Error ? err.message : "Unable to load drafts"); }
  }
  useEffect(() => {
  let cancelled = false;

  fetch("/api/outreach/drafts")
    .then(async (response) => {
      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Unable to load drafts"
        );
      }

      return data;
    })
    .then((data) => {
      if (!cancelled) {
        setDrafts(data.drafts);
      }
    })
    .catch((error) => {
      if (!cancelled) {
        setNotice(
          error instanceof Error
            ? error.message
            : "Unable to load drafts"
        );
      }
    }).finally(() => { if (!cancelled) setDraftsLoading(false); });

  return () => {
    cancelled = true;
  };
}, []);

  function pick(draft: Draft) {
    setSelected(draft.id); setSubject(draft.subject ?? ""); setBody(draft.body); setCautions([]); setNotice(""); setFeedbackTone("info");
  }

  async function generate() {
    setBusy(true); setNotice(""); setFeedbackTone("info");
    try {
      const data = await api("/api/outreach/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, contactId: contactId || null, channel, messageType, angle }),
      });
      await load(); pick(data.draft);
      setCautions(data.cautions ?? []);
      setNotice("Scout saved a new draft. Review every factual claim before submitting it for approval.");
    } catch (err) { setFeedbackTone("error"); setNotice(err instanceof Error ? err.message : "Generation failed"); }
    finally { setBusy(false); }
  }

  async function update(action: "edit" | "submit" | "approve" | "reject" | "revise" | "sent") {
    if (!active) return;
    if (action === "sent" && !window.confirm("Confirm that you already sent this exact approved message manually outside ProspectDesk AI?")) return;
    setBusy(true); setNotice(""); setFeedbackTone("info");
    const payload = action === "edit"
      ? { subject, body, revision: active.revision }
      : { action, revision: active.revision, confirmedManualSend: action === "sent" };
    try {
      await api(`/api/outreach/drafts/${active.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json", "x-outreach-action": action === "edit" ? "edit" : "transition" },
        body: JSON.stringify(payload),
      });
      const data = await api("/api/outreach/drafts");
      setDrafts(data.drafts);
      const updated = (data.drafts as Draft[]).find(d => d.id === active.id);
      if (updated) pick(updated);
      setNotice(action === "sent" ? "Marked as manually sent. No message was transmitted by this app." : "Draft updated successfully.");
    } catch (err) { setFeedbackTone("error"); setNotice(err instanceof Error ? err.message : "Update failed"); }
    finally { setBusy(false); }
  }

  const inputClass = "field";
  return <AppShell><main className="workspace feature-content">
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeading eyebrow="Scout / Outreach Studio" title="Better conversations start here." description="A focused workspace to draft, refine, and review personal outreach. Every message stays in your hands." ><Badge tone="scout">Human approval required</Badge></PageHeading>
      {!companies.length && <EmptyState title="Build your research context first"><Link className="font-medium text-indigo-700 underline" href="/discover">Discover a company</Link>, save its research, and return here to create a grounded draft.</EmptyState>}

      <section className="space-y-4 panel">
        <h2 className="text-lg font-semibold">1. Generate an outreach draft</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <label>Company<select disabled={!!busy} className={inputClass} value={companyId} onChange={e => { setCompanyId(e.target.value); setContactId(""); }}><option value="">Choose company</option>{companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          <label>Contact (optional)<select disabled={!!busy} className={inputClass} value={contactId} onChange={e => setContactId(e.target.value)}><option value="">Company-level message</option>{matchingContacts.map(c => <option value={c.id} key={c.id}>{c.full_name} — {c.job_title}</option>)}</select></label>
          <label>Channel<select disabled={!!busy} className={inputClass} value={channel} onChange={e => { const c = e.target.value as "linkedin" | "email"; setChannel(c); if (c === "email" && messageType === "connection") setMessageType("initial"); }}><option value="linkedin">LinkedIn</option><option value="email">Email</option></select></label>
          <label>Type<select disabled={!!busy} className={inputClass} value={messageType} onChange={e => setMessageType(e.target.value as typeof messageType)}>{channel === "linkedin" && <option value="connection">Connection request</option>}<option value="initial">Initial message</option><option value="follow_up">Follow-up</option></select></label>
        </div>
        <label className="block">Personalization angle (optional)<textarea disabled={busy} rows={2} maxLength={350} className={inputClass} value={angle} onChange={e => setAngle(e.target.value)} placeholder="A truthful, relevant angle to consider—not an instruction to invent claims" /></label>
        <p className="text-sm text-slate-500">Follow-up requires an earlier message to the same recipient/channel marked manually sent. Ten generations per UTC day.</p>
        <button disabled={busy || !companyId} onClick={generate} className="button-primary">{busy ? "Working..." : "Generate draft with Scout"}</button>
      </section>

      <section className="grid items-start gap-5 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,2fr)]">
        <div className="panel min-w-0 xl:sticky xl:top-6"><h2 className="mb-3 font-semibold">2. Saved outreach</h2><div className="space-y-2">
          {drafts.map(d => <button key={d.id} disabled={busy} aria-pressed={d.id === selected} onClick={() => pick(d)} className={`w-full rounded-lg border p-3 text-left text-sm ${d.id === selected ? "border-indigo-600 bg-indigo-50" : "bg-white"}`}>
            <strong>{companies.find(c => c.id === d.company_id)?.name ?? "Company"}</strong><span className="ml-2 text-slate-500">{d.channel}</span>
            <div className="mt-2 flex flex-wrap gap-2"><Badge tone={d.status === "approved" || d.status === "manually_sent" ? "success" : d.status === "rejected" ? "warning" : "neutral"}>{d.status.replaceAll("_", " ")}</Badge><span className="py-1 text-xs text-slate-500">{d.message_type.replaceAll("_", " ")}</span></div><p className="mt-2 text-xs text-slate-500">Created {new Date(d.created_at).toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" })}</p>
          </button>)}
          {draftsLoading ? <p role="status" className="text-sm text-slate-500">Loading saved drafts…</p> : !drafts.length && <EmptyState title="No drafts yet">Generate your first draft using the company and channel above.</EmptyState>}
        </div></div>
        <div className="space-y-4 panel">
          <h2 className="font-semibold">3. Review selected draft</h2>
          {!active ? <EmptyState title="Your next conversation, thoughtfully written">Select a saved draft to edit its message, review the details, and manage approval.</EmptyState> : <>
            <div className="flex flex-wrap gap-2"><Badge tone="scout">{active.channel === "email" ? "Email" : "LinkedIn"}</Badge><Badge tone={active.status === "approved" || active.status === "manually_sent" ? "success" : "neutral"}>{active.status.replaceAll("_", " ")}</Badge><Badge>Revision {active.revision}</Badge></div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm"><p className="font-semibold">{companies.find(c => c.id === active.company_id)?.name ?? "Company"}</p>{(() => { const contact = contacts.find(c => c.id === active.contact_id); return contact ? <div className="mt-1 space-y-2"><p>{contact.full_name} · {contact.job_title ?? "Role not recorded"}</p><Badge tone="warning">Contact candidate · Verify current role</Badge>{contact.verification_source && <a href={contact.verification_source} target="_blank" rel="noopener noreferrer" className="block text-indigo-700 underline">Review contact source</a>}</div> : <p className="mt-1 text-slate-500">Company-level message</p>; })()}<Link href="/qualification" className="mt-3 inline-block text-xs font-medium text-indigo-700 underline">Open lead research and evidence</Link></div>
            {active.channel === "email" && <label className="block">Subject<input className={inputClass} value={subject} disabled={busy || ["approved","manually_sent"].includes(active.status)} maxLength={120} onChange={e => setSubject(e.target.value)} /></label>}
            <label className="block">Message<textarea rows={14} className={inputClass} value={body} disabled={busy || ["approved","manually_sent"].includes(active.status)} onChange={e => setBody(e.target.value)} /></label>
            <p className="text-xs text-slate-500">{body.length} characters. {edited ? "Unsaved changes. Save before submitting or approving." : ""} Check the evidence and accuracy before approval.</p>
            {cautions.length > 0 && <div className="rounded-md bg-amber-50 p-3 text-sm">Cautions: {cautions.join("; ")}</div>}
            <div className="flex flex-wrap gap-2">
              {!["approved","manually_sent"].includes(active.status) && <button disabled={busy || !edited} className="button-secondary" onClick={() => update("edit")}>Save edits</button>}
              {active.status === "draft" && <button disabled={busy || edited} className="button-primary" onClick={() => update("submit")}>Submit for review</button>}
              {active.status === "in_review" && <><button disabled={busy || edited} className="rounded-lg bg-emerald-700 px-3 py-2 text-white disabled:opacity-50" onClick={() => update("approve")}>Approve</button><button disabled={busy} className="button-secondary" onClick={() => update("reject")}>Reject</button><button disabled={busy} className="button-secondary" onClick={() => update("revise")}>Return to draft</button></>}
              {active.status === "rejected" && <button disabled={busy || edited} className="button-secondary" onClick={() => update("revise")}>Revise rejected draft</button>}
              {active.status === "approved" && <><button disabled={busy} className="button-secondary" onClick={async () => { try { await navigator.clipboard.writeText(active.channel === "email" ? `${active.subject}\n\n${active.body}` : active.body); setNotice("Approved message copied. Send it manually in your chosen app."); } catch { setNotice("Unable to copy. Select and copy the message manually."); } }}>Copy approved message</button><button disabled={busy} className="rounded-lg bg-indigo-700 px-3 py-2 text-white" onClick={() => update("sent")}>Mark manually sent</button></>}
            </div>
          </>}
        </div>
      </section>
      {notice && <Alert tone={feedbackTone}>{notice}</Alert>}
    </div>
  </main></AppShell>;
}
