import { hasSameOrigin } from "@/lib/security/same-origin";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const companySchema = z.object({
  name: z.string().trim().min(2).max(200),
  website: z.url().max(2048).optional(),
  industry: z.string().trim().max(120).optional(),
});

export async function GET() {
  const supabase = await createClient();

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

  const { data, error } = await supabase
    .from("companies")
    .select(
      "id, name, website, industry, status, created_at"
    )
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Company query failed:", error.code);

    return NextResponse.json(
      { error: "Unable to fetch companies" },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { companies: data },
    { status: 200 }
  );
}

export async function POST(request: Request) {
  if (!hasSameOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  }
  const supabase = await createClient();

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

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON" },
      { status: 400 }
    );
  }

  const parsed = companySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid company data" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("companies")
    .insert({
      name: parsed.data.name,
      website: parsed.data.website ?? null,
      industry: parsed.data.industry ?? null,

      // Assign company to authenticated user
      owner_id: user.id,
    })
    .select(
      "id, name, website, industry, status"
    )
    .single();

  if (error) {
    console.error("Company insert failed:", error.code);

    return NextResponse.json(
      { error: "Unable to save company" },
      { status: 500 }
    );
  }

  return NextResponse.json({ company: data }, { status: 201 });
}