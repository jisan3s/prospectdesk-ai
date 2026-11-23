import { hasSameOrigin } from "@/lib/security/same-origin";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { profileInputSchema } from "@/lib/validations/profile";

export async function POST(request: Request) {
  if (!hasSameOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  }

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let raw: string;
  try {
    raw = await request.text();
    if (raw.length > 24_000) {
      return NextResponse.json({ error: "Profile payload too large" }, { status: 413 });
    }
  } catch {
    return NextResponse.json({ error: "Unable to read request" }, { status: 400 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const result = profileInputSchema.safeParse(payload);
  if (!result.success) {
    return NextResponse.json({ error: "Invalid profile fields" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("profiles")
    .upsert({
      user_id: user.id,
      ...result.data,
      linkedin_url: result.data.linkedin_url || null,
      portfolio_url: result.data.portfolio_url || null,
      // Saved profile edits invalidate previous AI analysis.
      scout_analysis: null,
      analyzed_at: null,
      analysis_model: null,
      analysis_input_tokens: null,
      analysis_output_tokens: null,
    }, { onConflict: "user_id" })
    .select("user_id, updated_at")
    .single();

  if (error) {
    console.error("Profile upsert failed:", error.code);
    return NextResponse.json({ error: "Could not save profile" }, { status: 500 });
  }

  return NextResponse.json({ saved: true, updated_at: data.updated_at },
    { headers: { "Cache-Control": "no-store" } });
}
