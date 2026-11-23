import { hasSameOrigin } from "@/lib/security/same-origin";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { qualifyCompany } from "@/lib/ai/qualify";
import { qualificationRequest } from "@/lib/validations/qualification";

export async function POST(request: Request) {
  if (!hasSameOrigin(request)) return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const input = qualificationRequest.safeParse(await request.json().catch(() => null));
  if (!input.success) return NextResponse.json({ error: "Invalid company ID" }, { status: 400 });
  const id = input.data.companyId;

  const [companyResponse, profileResponse, sourceResponse] = await Promise.all([
    supabase.from("companies").select("id, name, industry, location, research_summary").eq("id", id).eq("owner_id", user.id).maybeSingle(),
    supabase.from("profiles").select("headline, summary, skills, services").eq("user_id", user.id).maybeSingle(),
    supabase.from("research_sources").select("id, source_url, finding").eq("company_id", id).eq("owner_id", user.id).order("created_at", { ascending: false }).limit(8),
  ]);
  if (companyResponse.error || profileResponse.error || sourceResponse.error) return NextResponse.json({ error: "Database query failed" }, { status: 500 });
  if (!companyResponse.data) return NextResponse.json({ error: "Company not found" }, { status: 404 });
  if (!profileResponse.data?.services?.length) return NextResponse.json({ error: "Save your real services in Profile first" }, { status: 400 });
  const sources = (sourceResponse.data ?? []).map(s => ({ id: s.id, url: s.source_url, finding: s.finding }));
  if (!sources.length) return NextResponse.json({ error: "Research this company in Stage 4 before scoring" }, { status: 400 });
  const { data: allowed, error: quotaError } = await supabase.rpc("claim_qualification_usage", { p_action: "score" });
  if (quotaError) { console.error("Qualification quota error", quotaError.code); return NextResponse.json({ error: "Quota function unavailable; check Stage 5 migration" }, { status: 503 }); }
  if (!allowed) return NextResponse.json({ error: "Daily limit: five qualification attempts" }, { status: 429 });

  const { data: run } = await supabase.from("agent_runs").insert({ owner_id: user.id, task_type: "lead_scoring", status: "running", started_at: new Date().toISOString() }).select("id").single();
  try {
    const assessment = await qualifyCompany(companyResponse.data, profileResponse.data, sources);
    const evidence = assessment.evidence_indexes.map(index => sources[index]);
    const reasoning = [assessment.reasoning, `Positive signals: ${assessment.positive_signals.join("; ")}`, `Risks: ${assessment.risks.join("; ")}`].join("\n");
    const { data: saved, error: saveError } = await supabase.from("lead_scores").insert({
      owner_id: user.id, company_id: id, score: assessment.score,
      confidence: assessment.confidence, reasoning,
      rubric_version: "stage5_v1", scoring_version: "stage5_v1", evidence,
    }).select("id, score, created_at").single();
    if (saveError) throw new Error(`Save failed: ${saveError.code}`);
    if (run) await supabase.from("agent_runs").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", run.id).eq("owner_id", user.id);
    return NextResponse.json({ assessment, sources: evidence, saved }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Lead scoring failed", error instanceof Error ? error.name : "unknown");
    if (run) await supabase.from("agent_runs").update({ status: "failed", completed_at: new Date().toISOString(), error_message: "Scoring failed" }).eq("id", run.id).eq("owner_id", user.id);
    return NextResponse.json({ error: "Unable to score company; check model access and logs" }, { status: 502 });
  }
}
