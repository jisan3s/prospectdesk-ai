import { AppShell } from "@/components/layout/app-shell";
import { Alert, LoadingSkeleton } from "@/components/ui/primitives";
import { z } from "zod";
import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { QualificationWorkspace } from "@/components/qualification/workspace";

type Query = Promise<{ company?: string | string[] }>;

async function Content({ searchParams }: { searchParams: Query }) {
  await connection();
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/login");
  const { data: companies, error: queryError } = await supabase.from("companies")
    .select("id, name, website").eq("owner_id", user.id).order("created_at", { ascending: false }).limit(100);
  if (queryError) return <main className="workspace"><Alert>Unable to load companies. Refresh the page to try again.</Alert></main>;
  const { company } = await searchParams;
  const requested = z.uuid().safeParse(company);
  const options = companies ?? [];
  if (requested.success && !options.some(row => row.id === requested.data)) {
    const selected = await supabase.from("companies").select("id, name, website")
      .eq("owner_id", user.id).eq("id", requested.data).maybeSingle();
    if (selected.error) return <main className="workspace"><Alert tone="error">Unable to load the selected company. Refresh the page to try again.</Alert></main>;
    if (selected.data) options.unshift(selected.data);
  }
  return <QualificationWorkspace companies={options} initialCompanyId={requested.success ? requested.data : undefined} />;
}

export default function QualificationPage({ searchParams }: { searchParams: Query }) {
  return <AppShell><Suspense fallback={<LoadingSkeleton label="Loading qualification..." />}><Content searchParams={searchParams} /></Suspense></AppShell>;
}
