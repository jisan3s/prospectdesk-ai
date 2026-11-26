import { readJsonRequest, enforceRequestRate } from "@/lib/security/request-guard";
import { hasSameOrigin } from "@/lib/security/same-origin";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { verifiedContactInput } from "@/lib/validations/qualification";

export async function POST(request: Request) {
  if (!hasSameOrigin(request)) return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rateError = await enforceRequestRate(supabase, "record_write");
  if (rateError) return rateError;
  const json = await readJsonRequest(request, 32000);
  if (json.error) return json.error;
  const input = verifiedContactInput.safeParse(json.data);
  if (!input.success) return NextResponse.json({ error: "Invalid contact fields" }, { status: 400 });
  const { data: company, error: companyError } = await supabase.from("companies").select("id").eq("id", input.data.companyId).eq("owner_id", user.id).maybeSingle();
  if (companyError) return NextResponse.json({ error: "Unable to load company" }, { status: 500 });
  if (!company) return NextResponse.json({ error: "Company not found" }, { status: 404 });
  const { data, error: dbError } = await supabase.from("contacts").insert({
    owner_id: user.id, company_id: company.id, full_name: input.data.fullName,
    job_title: input.data.jobTitle, linkedin_url: input.data.linkedinUrl || null,
    verification_source: input.data.sourceUrl,
    // A URL provided by the user is not independently verified by Scout.
    verified_at: null,
    notes: "User-submitted contact candidate; independently verify before outreach.",
  }).select("id, full_name, job_title").single();
  if (dbError) return NextResponse.json({ error: "Unable to save contact" }, { status: 500 });
  return NextResponse.json({ contact: data }, { status: 201 });
}
