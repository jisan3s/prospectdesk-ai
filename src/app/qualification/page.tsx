import { AppShell } from "@/components/layout/app-shell";
import { Alert, LoadingSkeleton } from "@/components/ui/primitives";
import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { QualificationWorkspace } from "@/components/qualification/workspace";

async function Content() {
  await connection();
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/login");
  const { data: companies, error: queryError } = await supabase.from("companies")
    .select("id, name, website").eq("owner_id", user.id).order("created_at", { ascending: false }).limit(100);
  if (queryError) return <AppShell><main className="workspace"><Alert>Unable to load companies. Refresh the page to try again.</Alert></main></AppShell>;
  return <QualificationWorkspace companies={companies ?? []} />;
}

export default function QualificationPage() {
  return <Suspense fallback={<AppShell><LoadingSkeleton label="Loading qualification..." /></AppShell>}><Content /></Suspense>;
}
