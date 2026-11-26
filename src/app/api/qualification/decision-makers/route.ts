import { readJsonRequest, enforceRequestRate } from "@/lib/security/request-guard";
import { hasSameOrigin } from "@/lib/security/same-origin";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { searchWeb } from "@/lib/research/tavily";
import { qualificationRequest } from "@/lib/validations/qualification";

export async function POST(request: Request) {
  if (!hasSameOrigin(request)) return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rateError = await enforceRequestRate(supabase, "record_write");
  if (rateError) return rateError;
  const json = await readJsonRequest(request, 16000);
  if (json.error) return json.error;
  const parsed = qualificationRequest.safeParse(json.data);
  if (!parsed.success) return NextResponse.json({ error: "Invalid company" }, { status: 400 });
  const { data: company, error: companyError } = await supabase.from("companies").select("name, website")
    .eq("id", parsed.data.companyId).eq("owner_id", user.id).maybeSingle();
  if (companyError) return NextResponse.json({ error: "Unable to load company" }, { status: 500 });
  if (!company) return NextResponse.json({ error: "Company not found" }, { status: 404 });
  const burstError = await enforceRequestRate(supabase, "decision_search");
  if (burstError) return burstError;
  const { data: allowed, error: quotaError } = await supabase.rpc("claim_qualification_usage", { p_action: "roles" });
  if (quotaError) return NextResponse.json({ error: "Quota unavailable: check migration" }, { status: 503 });
  if (!allowed) return NextResponse.json({ error: "Daily limit reached: five searches" }, { status: 429 });
  try {
    // Tavily results are leads for human verification, NOT verified people.
    const results = await searchWeb(`"${company.name}" founder CEO owner CTO marketing director leadership team`);
    return NextResponse.json({ results, warning: "These are unverified web results. Open sources and confirm each person's current name and role manually." }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("Decision-maker search failed", err instanceof Error ? err.name : "unknown");
    return NextResponse.json({ error: "Search unavailable; verify Tavily credits" }, { status: 502 });
  }
}
