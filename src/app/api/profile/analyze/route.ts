import { hasSameOrigin } from "@/lib/security/same-origin";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { analyzeProfile } from "@/lib/ai/scout";
import {
  profileInputSchema,
  hasEnoughProfileInformation,
} from "@/lib/validations/profile";

export async function POST(request: Request) {
  if (!hasSameOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  }

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("display_name, headline, linkedin_url, portfolio_url, summary, raw_profile_text, skills, services")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profileError) {
    console.error("Profile query failed:", profileError.code);
    return NextResponse.json({ error: "Could not load profile" }, { status: 500 });
  }
  if (!profile) {
    return NextResponse.json({ error: "Save your profile first" }, { status: 400 });
  }

  const parsed = profileInputSchema.safeParse({
    display_name: profile.display_name ?? "",
    headline: profile.headline ?? "",
    linkedin_url: profile.linkedin_url ?? "",
    portfolio_url: profile.portfolio_url ?? "",
    summary: profile.summary ?? "",
    raw_profile_text: profile.raw_profile_text ?? "",
    skills: profile.skills ?? [],
    services: profile.services ?? [],
  });
  if (!parsed.success || !hasEnoughProfileInformation(parsed.data)) {
    return NextResponse.json({ error: "Add more professional information before analyzing" }, { status: 400 });
  }

  // Atomic 3-per-UTC-day usage ceiling. Claimed attempts are charged even if the API fails.
  const { data: allowed, error: quotaError } = await supabase
    .rpc("claim_profile_analysis_quota");
  if (quotaError) {
    console.error("Quota check failed:", quotaError.code);
    return NextResponse.json({ error: "Usage limit temporarily unavailable" }, { status: 503 });
  }
  if (!allowed) {
    return NextResponse.json({ error: "Daily limit reached: 3 analyses per UTC day" }, { status: 429 });
  }

  const { data: run } = await supabase.from("agent_runs")
    .insert({ owner_id: user.id, task_type: "profile_analysis", status: "running", started_at: new Date().toISOString() })
    .select("id").single();

  try {
    const result = await analyzeProfile(parsed.data);
    const { error: saveError } = await supabase.from("profiles")
      .update({
        scout_analysis: result.analysis,
        analyzed_at: new Date().toISOString(),
        analysis_model: result.model,
        analysis_input_tokens: result.inputTokens,
        analysis_output_tokens: result.outputTokens,
      })
      .eq("user_id", user.id);

    if (saveError) {
      console.error("Analysis save failed:", saveError.code);
      throw new Error("Unable to persist analysis");
    }

    if (run) {
      await supabase.from("agent_runs")
        .update({ status: "completed", completed_at: new Date().toISOString(), output_summary: "Profile analysis saved" })
        .eq("id", run.id).eq("owner_id", user.id);
    }

    return NextResponse.json({
      analysis: result.analysis,
      usage: { input_tokens: result.inputTokens, output_tokens: result.outputTokens },
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    // Do not log raw profile text or OpenAI request payloads.
    console.error("Scout analysis failed:", error instanceof Error ? error.name : "unknown");
    if (run) {
      await supabase.from("agent_runs")
        .update({ status: "failed", completed_at: new Date().toISOString(), error_message: "Analysis failed" })
        .eq("id", run.id).eq("owner_id", user.id);
    }
    return NextResponse.json({ error: "Scout could not analyze the profile. Check model access and server logs." }, { status: 502 });
  }
}
