import { readJsonRequest, enforceRequestRate } from "@/lib/security/request-guard";
import { hasSameOrigin } from "@/lib/security/same-origin";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  companyInputSchema, domainFromUrl, isSourceForDomain, normalizedCompanyUrl,
} from "@/lib/validations/discovery";
import { searchWeb } from "@/lib/research/tavily";
import { analyzeCompany } from "@/lib/ai/company-research";

export async function POST(request: Request) {
  if (!hasSameOrigin(request))
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rateError = await enforceRequestRate(supabase, "record_write");
  if (rateError) return rateError;
  const json = await readJsonRequest(request, 16000);
  if (json.error) return json.error;
  const body = json.data;
  const parsed = companyInputSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid company fields" }, { status: 400 });
  const website = normalizedCompanyUrl(parsed.data.website);
  if (!website) return NextResponse.json({ error: "Enter a public business website" }, { status: 400 });
  const domain = domainFromUrl(website)!;
  const company = { ...parsed.data, website };
  const { data: profile, error: profileError } = await supabase.from("profiles")
    .select("headline, summary, skills, services")
    .eq("user_id", user.id).maybeSingle();
  if (profileError) return NextResponse.json({ error: "Could not read profile" }, { status: 500 });
  if (!profile || !(profile.summary || profile.services?.length))
    return NextResponse.json({ error: "Save your professional profile first" }, { status: 400 });

  const burstError = await enforceRequestRate(supabase, "company_research");
  if (burstError) return burstError;
  const { data: allowed, error: quotaError } = await supabase.rpc("claim_discovery_usage", { p_action: "research" });
  if (quotaError) return NextResponse.json({ error: "Research quota unavailable. Check migration." }, { status: 503 });
  if (!allowed) return NextResponse.json({ error: "Daily research limit reached (5 per UTC day)" }, { status: 429 });

  const { data: run } = await supabase.from("agent_runs").insert({
    owner_id: user.id, task_type: "company_research", status: "running", started_at: new Date().toISOString(),
    input_summary: `Company research: ${domain}`,
  }).select("id").single();
  try {
    const results = await searchWeb(`site:${domain} ${company.name} business services about projects`, [domain]);
    const sources = results.filter(s => isSourceForDomain(s.url, domain)).slice(0, 5)
      .map(s => ({ title: s.title, url: s.url, finding: s.snippet }));
    if (!sources.length) return NextResponse.json({ error: "No company-owned sources found. Verify the official website." }, { status: 422 });
    const { tokens, ...research } = await analyzeCompany(company, sources, profile);
    if (run) await supabase.from("agent_runs").update({ status: "completed", completed_at: new Date().toISOString(), output_summary: `Research completed: ${domain}` }).eq("id", run.id).eq("owner_id", user.id);
    return NextResponse.json({ company, sources, research, usage: tokens }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("Company research failed", err instanceof Error ? err.name : "unknown");
    return NextResponse.json({ error: "Research failed. Check API keys, credits, provider availability or model access." }, { status: 502 });
  } finally {
    // On failure, mark any run that is still running. Completed runs remain unchanged.
    if (run) await supabase.from("agent_runs").update({ status: "failed", completed_at: new Date().toISOString(), error_message: "Research did not finish" }).eq("id", run.id).eq("owner_id", user.id).eq("status", "running");
  }
}
