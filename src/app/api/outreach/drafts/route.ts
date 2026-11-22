import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data, error: queryError } = await supabase.from("outreach_drafts")
    .select("id, company_id, contact_id, channel, message_type, subject, body, status, revision, created_at, approved_at, sent_at")
    .eq("owner_id", user.id).order("created_at", { ascending: false }).limit(100);
  if (queryError) return NextResponse.json({ error: "Could not load drafts" }, { status: 500 });
  return NextResponse.json({ drafts: data }, { headers: { "Cache-Control": "no-store" } });
}
