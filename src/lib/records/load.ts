import "server-only";
import { z } from "zod";
import type { createClient } from "@/lib/supabase/server";
import { type RecordKind, type SavedRecord } from "./types";

const text = z.string().nullable().optional();
const base = z.object({ id: z.string(), created_at: z.string() });
const companySchema = base.extend({ name: z.string(), website: text, industry: text, location: text, status: text, research_summary: text });
const contactSchema = base.extend({ company_id: z.string(), full_name: z.string(), job_title: text, verification_source: text, linkedin_url: text, notes: text });
const scoreSchema = base.extend({ company_id: z.string(), score: z.number(), confidence: text, reasoning: text, evidence: z.unknown().optional() });
const draftSchema = base.extend({ company_id: z.string(), contact_id: text, channel: z.string(), message_type: z.string(), subject: text, body: z.string(), status: z.string(), approved_at: text, sent_at: text });

type Client = Awaited<ReturnType<typeof createClient>>;
import { enforceRequestRate } from "@/lib/security/request-guard";
import type { RecordsQuery } from "./query";

const resultSchema = z.object({
  total: z.number().int().nonnegative(), savedTotal: z.number().int().nonnegative(),
  companies: z.array(z.object({ id: z.string(), name: z.string() })).max(100),
  statuses: z.array(z.string()).max(50),
  rows: z.array(z.record(z.string(), z.unknown())).max(20),
});
export type RecordsResult = { records: SavedRecord[]; total: number; savedTotal: number; companies: { id: string; name: string }[]; statuses: string[]; page: number };
export class RecordsLoadError extends Error {
  constructor(readonly status: number) { super(status === 429 ? "Record refresh limit reached. Please try again shortly." : "Unable to load saved records. Please try again later."); }
}

export async function loadSavedRecords(client: Client, kind: RecordKind, query: RecordsQuery): Promise<RecordsResult> {
  const rateError = await enforceRequestRate(client, "record_list");
  if (rateError) throw new RecordsLoadError(rateError.status);
  async function fetchPage(page: number) {
    const { data, error } = await client.rpc("list_saved_records", { p_kind: kind, p_search: query.search, p_status: query.status, p_company: query.company, p_channel: query.channel, p_sort: query.sort, p_page: page });
    if (error) throw new RecordsLoadError(503);
    return resultSchema.parse(data);
  }
  let page = query.page;
  let data = await fetchPage(page);
  const lastPage = Math.max(1, Math.ceil(data.total / 20));
  if (page > lastPage) { page = lastPage; data = await fetchPage(page); }
  const records = data.rows.map(raw => {
    const company = typeof raw._company === "string" ? raw._company : "Company unavailable";
    const contact = typeof raw._contact === "string" ? raw._contact : "Contact unavailable";
    const base = (id: string, companyId: string, date: string): SavedRecord => ({ id, companyId, company, date, title: "", status: "", subtitle: "", description: "", links: [], details: [] });
    if (kind === "companies") {
      const row = companySchema.parse(raw);
      const sources = z.array(z.object({ source_url: z.string(), finding: text })).max(50).parse(raw._sources ?? []);
      return { ...base(row.id,row.id,row.created_at), title: row.name, subtitle: [row.industry,row.location].filter(Boolean).join(" · "), status: row.status || "Not recorded", description: row.research_summary || "No saved research summary.", links: row.website ? [{ label: "Company website", url: row.website }] : [], details: sources.map(source => ({ label: source.source_url, text: source.finding || "No finding recorded." })) };
    }
    if (kind === "contacts") {
      const row = contactSchema.parse(raw);
      return { ...base(row.id,row.company_id,row.created_at), title: row.full_name, subtitle: row.job_title || "Role not recorded", status: "Contact candidate", description: row.notes || "Verify source and current employment before outreach.", links: [{ label: "Review contact source", url: row.verification_source },{ label: "LinkedIn profile", url: row.linkedin_url }].filter((link): link is { label: string; url: string } => !!link.url) };
    }
    if (kind === "leads") {
      const row = scoreSchema.parse(raw);
      return { ...base(row.id,row.company_id,row.created_at), title: company, subtitle: "Latest saved assessment", status: "Qualified lead", score: row.score, confidence: row.confidence || "Not recorded", description: row.reasoning || "No explanation recorded.", details: z.array(z.object({ url: z.string(), finding: z.string() })).safeParse(row.evidence).data?.slice(0,50).map(item => ({ label: item.url, text: item.finding })) ?? [] };
    }
    const row = draftSchema.parse(raw);
    return { ...base(row.id,row.company_id,row.created_at), title: row.subject || `${company} · ${row.message_type.replaceAll("_"," ")}`, subtitle: row.contact_id ? contact : "Company-level message", status: row.status, channel: row.channel, messageType: row.message_type, description: row.body, details: [{ label: "Approved", text: row.approved_at || "Not approved" },{ label: "Manually sent", text: row.sent_at || "Not marked as manually sent" }] };
  });
  return { records, total: data.total, savedTotal: data.savedTotal, companies: data.companies, statuses: data.statuses, page };
}
