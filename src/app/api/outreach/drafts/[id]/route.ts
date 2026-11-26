import { readJsonRequest, enforceRequestRate } from "@/lib/security/request-guard";
import { hasSameOrigin } from "@/lib/security/same-origin";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { editOutreachInput, nextStatus, transitionInput, validLength } from "@/lib/validations/outreach";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  if (!hasSameOrigin(request)) return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return NextResponse.json({ error: "Invalid draft ID" }, { status: 400 });
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: existing, error: readError } = await supabase.from("outreach_drafts")
    .select("id, owner_id, status, channel, message_type, revision")
    .eq("id", id).eq("owner_id", user.id).maybeSingle();
  if (readError) return NextResponse.json({ error: "Unable to load draft" }, { status: 500 });
  if (!existing) return NextResponse.json({ error: "Draft not found" }, { status: 404 });
  const rateError = await enforceRequestRate(supabase, "record_write");
  if (rateError) return rateError;
  const json = await readJsonRequest(request, 16000);
  if (json.error) return json.error;
  const input = json.data;

  if (request.headers.get("x-outreach-action") === "edit") {
    const parsed = editOutreachInput.safeParse(input);
    if (!parsed.success) return NextResponse.json({ error: "Invalid edit" }, { status: 400 });
    if (!["draft", "in_review", "rejected"].includes(existing.status)) return NextResponse.json({ error: "Approved or sent drafts cannot be edited" }, { status: 409 });
    if (!validLength(existing.channel, existing.message_type, parsed.data.body)) return NextResponse.json({ error: "Message exceeds channel limit" }, { status: 400 });
    if (existing.channel === "email" && !parsed.data.subject) return NextResponse.json({ error: "Email subject required" }, { status: 400 });
    const { data, error } = await supabase.from("outreach_drafts").update({
      subject: existing.channel === "email" ? parsed.data.subject : null,
      body: parsed.data.body, status: "draft",
    }).eq("id", id).eq("owner_id", user.id).eq("revision", parsed.data.revision)
      .select("id, status, revision, subject, body").maybeSingle();
    if (error) return NextResponse.json({ error: "Edit rejected by database workflow" }, { status: 409 });
    if (!data) return NextResponse.json({ error: "Draft changed in another tab; refresh" }, { status: 409 });
    return NextResponse.json({ draft: data });
  }

  const parsed = transitionInput.safeParse(input);
  if (!parsed.success) return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  const { action, revision, confirmedManualSend } = parsed.data;
  if (action === "sent" && confirmedManualSend !== true) return NextResponse.json({ error: "Confirm you sent the message manually" }, { status: 400 });
  const allowed: Record<string, string[]> = {
    draft: ["submit"], in_review: ["approve", "reject", "revise"],
    rejected: ["revise"], approved: ["sent"], manually_sent: [],
  };
  if (!allowed[existing.status]?.includes(action)) return NextResponse.json({ error: "Invalid review transition" }, { status: 409 });
  const { data, error } = await supabase.from("outreach_drafts")
    .update({ status: nextStatus[action] }).eq("id", id).eq("owner_id", user.id).eq("revision", revision)
    .select("id, status, revision, approved_at, sent_at").maybeSingle();
  if (error) return NextResponse.json({ error: "Database rejected transition" }, { status: 409 });
  if (!data) return NextResponse.json({ error: "Draft changed in another tab; refresh" }, { status: 409 });
  return NextResponse.json({ draft: data });
}
