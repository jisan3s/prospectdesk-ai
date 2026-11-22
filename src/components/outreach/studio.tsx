"use client";

import Link from "next/link";
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
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [selected, setSelected] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [cautions, setCautions] = useState<string[]>([]);
  const active = drafts.find(d => d.id === selected);
  const matchingContacts = contacts.filter(c => c.company_id === companyId);
  const edited = !!active && (subject !== (active.subject ?? "") || body !== active.body);

  async function load() {
    try { const data = await api("/api/outreach/drafts"); setDrafts(data.drafts); }
    catch (err) { setNotice(err instanceof Error ? err.message : "Unable to load drafts"); }
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
    });

  return () => {
    cancelled = true;
  };
}, []);

  function pick(draft: Draft) {
    setSelected(draft.id); setSubject(draft.subject ?? ""); setBody(draft.body); setCautions([]); setNotice("");
  }

  async function generate() {
    setBusy(true); setNotice("");
    try {
      const data = await api("/api/outreach/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, contactId: contactId || null, channel, messageType, angle }),
      });
      await load(); pick(data.draft);
      setCautions(data.cautions ?? []);
      setNotice("Scout saved a new draft. Review every factual claim before submitting it for approval.");
    } catch (err) { setNotice(err instanceof Error ? err.message : "Generation failed"); }
    finally { setBusy(false); }
  }

  async function update(action: "edit" | "submit" | "approve" | "reject" | "revise" | "sent") {
    if (!active) return;
    if (action === "sent" && !window.confirm("Confirm that you already sent this exact approved message manually outside ProspectDesk AI?")) return;
    setBusy(true); setNotice("");
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
    } catch (err) { setNotice(err instanceof Error ? err.message : "Update failed"); }
    finally { setBusy(false); }
  }

  const inputClass = "mt-1 w-full rounded-lg border border-slate-300 bg-white p-3 text-slate-900";
  return <main className="min-h-screen bg-slate-50 p-6 text-slate-900">
    <div className="mx-auto max-w-5xl space-y-6">
      <nav className="flex gap-4 text-sm text-indigo-700"><Link href="/">Dashboard</Link><Link href="/profile">Profile</Link><Link href="/discover">Discover</Link><Link href="/qualification">Qualification</Link></nav>
      <header><h1 className="text-3xl font-bold">Scout — Outreach Studio</h1><p className="mt-2 text-slate-600">Generate, edit, approve, and track personal outreach. Messages are never sent automatically.</p></header>

      <section className="space-y-4 rounded-xl border bg-white p-5">
        <h2 className="text-lg font-semibold">1. Generate an outreach draft</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <label>Company<select className={inputClass} value={companyId} onChange={e => { setCompanyId(e.target.value); setContactId(""); }}><option value="">Choose company</option>{companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          <label>Contact (optional)<select className={inputClass} value={contactId} onChange={e => setContactId(e.target.value)}><option value="">Company-level message</option>{matchingContacts.map(c => <option value={c.id} key={c.id}>{c.full_name} — {c.job_title}</option>)}</select></label>
          <label>Channel<select className={inputClass} value={channel} onChange={e => { const c = e.target.value as "linkedin" | "email"; setChannel(c); if (c === "email" && messageType === "connection") setMessageType("initial"); }}><option value="linkedin">LinkedIn</option><option value="email">Email</option></select></label>
          <label>Type<select className={inputClass} value={messageType} onChange={e => setMessageType(e.target.value as typeof messageType)}>{channel === "linkedin" && <option value="connection">Connection request</option>}<option value="initial">Initial message</option><option value="follow_up">Follow-up</option></select></label>
        </div>
        <label className="block">Personalization angle (optional)<textarea rows={2} maxLength={350} className={inputClass} value={angle} onChange={e => setAngle(e.target.value)} placeholder="A truthful, relevant angle to consider—not an instruction to invent claims" /></label>
        <p className="text-sm text-slate-500">Follow-up requires an earlier message to the same recipient/channel marked manually sent. Ten generations per UTC day.</p>
        <button disabled={busy || !companyId} onClick={generate} className="rounded-lg bg-indigo-700 px-5 py-3 text-white disabled:opacity-50">{busy ? "Working..." : "Generate draft with Scout"}</button>
      </section>

      <section className="grid gap-5 md:grid-cols-[1fr_2fr]">
        <div className="rounded-xl border bg-white p-4"><h2 className="mb-3 font-semibold">2. Saved outreach</h2><div className="space-y-2">
          {drafts.map(d => <button key={d.id} onClick={() => pick(d)} className={`w-full rounded-lg border p-3 text-left text-sm ${d.id === selected ? "border-indigo-600 bg-indigo-50" : "bg-white"}`}>
            <strong>{companies.find(c => c.id === d.company_id)?.name ?? "Company"}</strong><span className="ml-2 text-slate-500">{d.channel}</span>
            <p>{d.message_type.replace("_", " ")} · {d.status.replace("_", " ")}</p>
          </button>)}
          {!drafts.length && <p className="text-sm text-slate-500">No drafts yet.</p>}
        </div></div>
        <div className="space-y-4 rounded-xl border bg-white p-5">
          <h2 className="font-semibold">3. Review selected draft</h2>
          {!active ? <p className="text-sm text-slate-500">Select a draft to review.</p> : <>
            <p className="text-sm">Status: <strong>{active.status.replace("_", " ")}</strong> · Revision {active.revision}</p>
            {active.channel === "email" && <label className="block">Subject<input className={inputClass} value={subject} disabled={["approved","manually_sent"].includes(active.status)} maxLength={120} onChange={e => setSubject(e.target.value)} /></label>}
            <label className="block">Message<textarea rows={10} className={inputClass} value={body} disabled={["approved","manually_sent"].includes(active.status)} onChange={e => setBody(e.target.value)} /></label>
            <p className="text-xs text-slate-500">{body.length} characters. Check the evidence and accuracy before approval.</p>
            {cautions.length > 0 && <div className="rounded-md bg-amber-50 p-3 text-sm">Cautions: {cautions.join("; ")}</div>}
            <div className="flex flex-wrap gap-2">
              {!["approved","manually_sent"].includes(active.status) && <button disabled={busy || !edited} className="rounded-lg border px-3 py-2 disabled:opacity-50" onClick={() => update("edit")}>Save edits</button>}
              {active.status === "draft" && <button disabled={busy || edited} className="rounded-lg bg-indigo-700 px-3 py-2 text-white disabled:opacity-50" onClick={() => update("submit")}>Submit for review</button>}
              {active.status === "in_review" && <><button disabled={busy || edited} className="rounded-lg bg-emerald-700 px-3 py-2 text-white disabled:opacity-50" onClick={() => update("approve")}>Approve</button><button disabled={busy} className="rounded-lg border px-3 py-2" onClick={() => update("reject")}>Reject</button><button disabled={busy} className="rounded-lg border px-3 py-2" onClick={() => update("revise")}>Return to draft</button></>}
              {active.status === "rejected" && <button disabled={busy || edited} className="rounded-lg border px-3 py-2" onClick={() => update("revise")}>Revise rejected draft</button>}
              {active.status === "approved" && <><button disabled={busy} className="rounded-lg border px-3 py-2" onClick={() => navigator.clipboard.writeText(active.channel === "email" ? `${active.subject}\n\n${active.body}` : active.body)}>Copy approved message</button><button disabled={busy} className="rounded-lg bg-indigo-700 px-3 py-2 text-white" onClick={() => update("sent")}>Mark manually sent</button></>}
            </div>
          </>}
        </div>
      </section>
      {notice && <p role="status" className="rounded-lg border bg-white p-4 text-sm">{notice}</p>}
    </div>
  </main>;
}
