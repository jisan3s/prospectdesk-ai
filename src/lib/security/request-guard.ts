import { hasSameOrigin } from "@/lib/security/same-origin";
import "server-only";
import { readBoundedJson, RequestBodyError } from "./safe-json";
import { NextResponse } from "next/server";
import type { createClient } from "@/lib/supabase/server";

type Client = Awaited<ReturnType<typeof createClient>>;
export type CostlyAction = "profile_analyze" | "company_search" | "company_research" |
  "lead_score" | "decision_search" | "outreach_generate";

export function validateWriteRequest(request: Request, maxBytes = 16_000): NextResponse | null {
  if (!hasSameOrigin(request))
    return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  const contentType = request.headers.get("content-type") || "";
  if (contentType.split(";")[0].trim().toLowerCase() !== "application/json")
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

export async function readJsonRequest(request: Request, maxBytes = 16_000, allowEmpty = false): Promise<{ data: unknown; error: null } | { data: null; error: NextResponse }> {
  const rejected = validateWriteRequest(request, maxBytes);
  const optionalMissingType = allowEmpty && !request.headers.get("content-type") && rejected?.status === 415;
  if (rejected && !optionalMissingType) return { data: null, error: rejected };
  try {
    const data = await readBoundedJson(request, maxBytes, 10_000, allowEmpty);
    if (data === undefined && allowEmpty) return { data: {}, error: null };
    if (rejected) return { data: null, error: rejected };
    return { data, error: null };
  }
  catch (error) {
    const status = error instanceof RequestBodyError ? error.status : 400;
    return { data: null, error: NextResponse.json({ error: status === 413 ? "Request body too large" : status === 408 ? "Request body timed out" : "Invalid JSON request" }, { status }) };
  }
}

export async function enforceRequestRate(supabase: Client, action: CostlyAction | "record_write" | "record_list"): Promise<NextResponse | null> {
  const { data, error } = await supabase.rpc("claim_security_rate_limit", { p_action: action });
  if (error || typeof data !== "boolean") return NextResponse.json({ error: "Usage safeguard unavailable" }, { status: 503 });
  if (!data) return NextResponse.json({ error: "Request limit reached. Please try again later." }, { status: 429, headers: { "Retry-After": "60" } });
  return null;
}
