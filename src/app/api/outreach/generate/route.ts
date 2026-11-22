
import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { draftWithScout } from "@/lib/ai/outreach";

import {
  generateOutreachInput,
  validLength,
} from "@/lib/validations/outreach";

import {
  validateWriteRequest,
  enforceHourlyQuota,
} from "@/lib/security/request-guard";

import { readBoundedJson } from "@/lib/security/safe-json";

export async function POST(request: Request) {
  // STEP 1: Validate request origin, content type and declared size
  const rejected = validateWriteRequest(request);

  if (rejected) {
    return rejected;
  }

  // STEP 2: Connect to Supabase
  const supabase = await createClient();

  // STEP 3: Verify authentication
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  // STEP 4: Safely read the JSON payload
  let body: unknown;

  try {
    body = await readBoundedJson(request);
  } catch (error) {
    const oversized =
      error instanceof Error &&
      error.message === "Request body too large";

    return NextResponse.json(
      {
        error: oversized
          ? "Request body too large"
          : "Invalid JSON request",
      },
      { status: oversized ? 413 : 400 }
    );
  }

  // STEP 5: Validate the request using Zod
  const input = generateOutreachInput.safeParse(body);

  if (!input.success) {
    return NextResponse.json(
      { error: "Invalid draft request" },
      { status: 400 }
    );
  }

  const {
    companyId,
    contactId,
    channel,
    messageType,
    angle,
  } = input.data;

  // STEP 6: Load user-owned research data
  const [
    { data: profile, error: profileError },
    { data: company, error: companyError },
    { data: sources, error: sourcesError },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "display_name, headline, summary, services, portfolio_url, linkedin_url"
      )
      .eq("user_id", user.id)
      .maybeSingle(),

    supabase
      .from("companies")
      .select(
        "name, industry, website, research_summary"
      )
      .eq("id", companyId)
      .eq("owner_id", user.id)
      .maybeSingle(),

    supabase
      .from("research_sources")
      .select("source_title, source_url, finding")
      .eq("company_id", companyId)
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  if (profileError || companyError || sourcesError) {
    console.error("Outreach data query failed", {
      profileCode: profileError?.code,
      companyCode: companyError?.code,
      sourcesCode: sourcesError?.code,
    });

    return NextResponse.json(
      { error: "Unable to load outreach data" },
      { status: 500 }
    );
  }

  if (!profile?.services?.length || !company) {
    return NextResponse.json(
      {
        error:
          "Save your profile and select a company you own",
      },
      { status: 400 }
    );
  }

  if (!sources?.length) {
    return NextResponse.json(
      { error: "Research company in Stage 4 first" },
      { status: 400 }
    );
  }

  // STEP 7: Load an optional sourced contact
  let contact: {
    full_name: string;
    job_title: string | null;
    verification_source: string | null;
  } | null = null;

  if (contactId) {
    const { data, error } = await supabase
      .from("contacts")
      .select("full_name, job_title, verification_source")
      .eq("id", contactId)
      .eq("company_id", companyId)
      .eq("owner_id", user.id)
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { error: "Unable to load contact" },
        { status: 500 }
      );
    }

    if (!data || !data.verification_source) {
      return NextResponse.json(
        {
          error:
            "Contact must belong to company and have a source",
        },
        { status: 400 }
      );
    }

    contact = data;
  }

  // STEP 8: Validate follow-up eligibility
  let previousMessage: string | null = null;

  if (messageType === "follow_up") {
    let query = supabase
      .from("outreach_drafts")
      .select("body")
      .eq("owner_id", user.id)
      .eq("company_id", companyId)
      .eq("channel", channel)
      .eq("status", "manually_sent");

    query = contactId
      ? query.eq("contact_id", contactId)
      : query.is("contact_id", null);

    const { data, error } = await query
      .order("sent_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { error: "Unable to check previous outreach" },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        {
          error:
            "Mark a previous message to this recipient as manually sent before drafting a follow-up",
        },
        { status: 400 }
      );
    }

    previousMessage = data.body;
  }

  // STEP 9: Enforce Stage 7 hourly quota
  const limited = await enforceHourlyQuota(
    supabase,
    "outreach_generate"
  );

  if (limited) {
    return limited;
  }

  // STEP 10: Enforce existing Stage 6 daily quota
  const {
    data: allowed,
    error: quotaError,
  } = await supabase.rpc("claim_outreach_generation");

  if (quotaError) {
    console.error(
      "Outreach daily quota failed:",
      quotaError.code
    );

    return NextResponse.json(
      {
        error:
          "Daily quota unavailable; check Stage 6 migration",
      },
      { status: 503 }
    );
  }

  if (!allowed) {
    return NextResponse.json(
      {
        error: "Daily limit: 10 generation attempts",
      },
      { status: 429 }
    );
  }

  // STEP 11: Generate and save the outreach draft
  try {
    const result = await draftWithScout({
      channel,
      messageType,
      angle,
      profile,
      company,
      contact,
      previousMessage,
      sources: sources.map((source) => ({
        title: source.source_title,
        url: source.source_url,
        finding: source.finding,
      })),
    });

    // STEP 12: Validate generated message limits
    const isValidBody = validLength(
      channel,
      messageType,
      result.body
    );

    const isValidSubject =
      channel !== "email" ||
      (
        result.subject.trim().length > 0 &&
        result.subject.length <= 120
      );

    if (!isValidBody || !isValidSubject) {
      return NextResponse.json(
        {
          error:
            "Scout draft exceeded channel limits; try again",
        },
        { status: 422 }
      );
    }

    // STEP 13: Save as a draft requiring human review
    const {
      data: saved,
      error: saveError,
    } = await supabase
      .from("outreach_drafts")
      .insert({
        owner_id: user.id,
        company_id: companyId,
        contact_id: contactId,

        channel,
        message_type: messageType,

        subject:
          channel === "email"
            ? result.subject
            : null,

        body: result.body,
        status: "draft",

        generation_context: {
          sources: sources.map(
            (source) => source.source_url
          ),
          personalization_facts:
            result.personalization_facts,
          cautions: result.cautions,
          generated_from: "scout_stage6_v1",
        },
      })
      .select(
        "id, revision, status, subject, body, channel, message_type, company_id, contact_id, created_at"
      )
      .single();

    if (saveError) {
      console.error(
        "Save generated draft failed:",
        saveError.code
      );

      return NextResponse.json(
        { error: "Could not save draft" },
        { status: 500 }
      );
    }

    // STEP 14: Return saved draft
    return NextResponse.json(
      {
        draft: saved,
        cautions: result.cautions,
      },
      {
        status: 201,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error(
      "Scout outreach generation failed:",
      error instanceof Error
        ? error.name
        : "unknown"
    );

    return NextResponse.json(
      {
        error:
          "Generation failed; check OpenAI model access or quota",
      },
      { status: 502 }
    );
  }
}
