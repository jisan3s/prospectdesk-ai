import { readJsonRequest, enforceRequestRate } from "@/lib/security/request-guard";
import { hasSameOrigin } from "@/lib/security/same-origin";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { discoverySearchSchema } from "@/lib/validations/discovery";
import { searchWeb } from "@/lib/research/tavily";

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
  const parsed = discoverySearchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid industry and location" }, { status: 400 });
  const burstError = await enforceRequestRate(supabase, "company_search");
  if (burstError) return burstError;
  const { data: allowed, error: quotaError } = await supabase.rpc("claim_discovery_usage", { p_action: "search" });
  if (quotaError) return NextResponse.json({ error: "Search quota unavailable. Check migration." }, { status: 503 });
  if (!allowed) return NextResponse.json({ error: "Daily search limit reached (15 per UTC day)" }, { status: 429 });
  try {
    const { industry, location } = parsed.data;
    const results = await searchWeb(`${industry} companies businesses ${location} official website -linkedin.com -facebook.com -yelp.com`);
    return NextResponse.json({ results }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("Discovery search failed", err instanceof Error ? err.name : "unknown");
    return NextResponse.json({ error: "Search provider unavailable or credits exhausted" }, { status: 502 });
  }
}
