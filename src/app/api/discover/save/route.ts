import { readJsonRequest, enforceRequestRate } from "@/lib/security/request-guard";
import { hasSameOrigin } from "@/lib/security/same-origin";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { domainFromUrl, isSourceForDomain, normalizedCompanyUrl, saveResearchSchema } from "@/lib/validations/discovery";

export async function POST(request: Request) {
  if (!hasSameOrigin(request))
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rateError = await enforceRequestRate(supabase, "record_write");
  if (rateError) return rateError;
  const json = await readJsonRequest(request, 64000);
  if (json.error) return json.error;
  const body = json.data;
  const parsed = saveResearchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid research payload" }, { status: 400 });
  const { company, research, sources } = parsed.data;
  const website = normalizedCompanyUrl(company.website);
  if (!website) return NextResponse.json({ error: "Website invalid" }, { status: 400 });
  const domain = domainFromUrl(website)!;
  if (sources.some(s => !isSourceForDomain(s.url, domain)))
    return NextResponse.json({ error: "Sources must belong to the company's confirmed website" }, { status: 400 });
  const evidence = research.evidence_indexes
    .filter(n => n >= 0 && n < sources.length)
    .map(n => sources[n]);
  if (!evidence.length) return NextResponse.json({ error: "No valid evidence" }, { status: 400 });
  const { data: existing, error: existingError } = await supabase.from("companies")
    .select("id").eq("owner_id", user.id).eq("website_host", domain).maybeSingle();
  if (existingError) return NextResponse.json({ error: "Duplicate check failed. Apply migration." }, { status: 503 });
  if (existing) return NextResponse.json({ error: "This company website is already saved", companyId: existing.id }, { status: 409 });
  const summary = [research.summary, `Potential opportunity (hypothesis): ${research.potential_opportunity}`, `Relevance: ${research.relevance_to_profile}`, `Confidence: ${research.confidence}`, research.caveats.length ? `Caveats: ${research.caveats.join("; ")}` : ""].filter(Boolean).join("\n").slice(0, 5000);
  const { data: savedId, error: saveError } = await supabase.rpc("save_discovered_company", {
    p_name: company.name, p_website: website, p_industry: company.industry,
    p_location: company.location, p_summary: summary,
    p_sources: evidence.map(s => ({ title: s.title, url: s.url, finding: s.finding })),
  });
  if (saveError) {
    if (saveError.code === "23505") return NextResponse.json({ error: "This company website is already saved" }, { status: 409 });
    console.error("Save company research failed", saveError.code);
    return NextResponse.json({ error: "Could not save company. Verify SQL migration and RLS." }, { status: 500 });
  }
  return NextResponse.json({ companyId: savedId }, { status: 201 });
}
