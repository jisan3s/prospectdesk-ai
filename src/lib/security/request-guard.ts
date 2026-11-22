import "server-only";
import { NextResponse } from "next/server";
import type { createClient } from "@/lib/supabase/server";

type Client = Awaited<ReturnType<typeof createClient>>;
export type CostlyAction = "profile_analyze" | "company_search" | "company_research" |
  "lead_score" | "decision_search" | "outreach_generate";

export function validateWriteRequest(request: Request, maxBytes = 16_000): NextResponse | null {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin)
    return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.toLowerCase().startsWith("application/json"))
    return NextResponse.json({ error: "Expected application/json" }, { status: 415 });
  const declaredSize = Number(request.headers.get("content-length") || "0");
  if (Number.isFinite(declaredSize) && declaredSize > maxBytes)
    return NextResponse.json({ error: "Request too large" }, { status: 413 });
  // Header size is only a precheck. Route body parsing must also enforce a hard byte limit.
  return null;
}

export async function enforceHourlyQuota(supabase: Client, action: CostlyAction): Promise<NextResponse | null> {
  const { data, error } = await supabase.rpc("claim_api_hourly_limit", { p_action: action });
  if (error) {
    console.error("Hourly quota failure", { code: error.code, action });
    return NextResponse.json({ error: "Usage safeguard unavailable" }, { status: 503 });
  }
  if (!data) return NextResponse.json({ error: "Hourly request limit reached" }, { status: 429 });
  return null;
}
