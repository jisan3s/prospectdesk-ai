import { Suspense } from "react";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { LoadingSkeleton } from "@/components/ui/primitives";
import { DashboardOverview, type DashboardMetric } from "@/components/dashboard/overview";

// Render the authenticated dashboard for each request.
async function DashboardContent() {
  // 1. Wait for an incoming request
  await connection();

  // 2. Connect to Supabase
  const supabase = await createClient();

  // 3. Verify that the user exists
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/login");
  }

  // 4. Get the current user's company count
  const { count, error: countError } = await supabase
    .from("companies")
    .select("*", {
      count: "exact",
      head: true,
    })
    .eq("owner_id", user.id);

  if (countError) {
    console.error("Company count error:", countError.code);
  }

  const [
    { count: contactsCount, error: contactsError },
    { data: scoreRows, error: scoresError },
  ] = await Promise.all([
    supabase
      .from("contacts")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", user.id),

    supabase
      .from("lead_scores")
      .select("company_id, score, created_at")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1000),
  ]);

  // Keep the latest score for each company.
  const latestScores = new Map<string, number>();

  for (const row of scoreRows ?? []) {
    if (!latestScores.has(row.company_id)) {
      latestScores.set(row.company_id, row.score);
    }
  }

  // Scores of 70 or higher count as qualified.
  const qualifiedLeadsCount = [...latestScores.values()]
    .filter((score) => score >= 70).length;

  const {
    count: outreachDraftsCount,
    error: draftsCountError,
  } = await supabase
    .from("outreach_drafts")
    .select("id", {
      count: "exact",
      head: true,
    })
    .eq("owner_id", user.id)
    .in("status", ["draft", "in_review"]);

  if (draftsCountError) {
    console.error(
      "Outreach count failed:",
      draftsCountError.code
    );
  }

  // 5. Prepare dashboard metrics
  const metrics: DashboardMetric[] = [
    {
      label: "Companies",
      value: countError ? "—" : String(count ?? 0),
    },
    { label: "Contacts", value: contactsError ? "—" : String(contactsCount ?? 0) },
    { label: "Qualified Leads", value: scoresError ? "—" : String(qualifiedLeadsCount) },
    {
      label: "Outreach Drafts",
      value: draftsCountError
        ? "—"
        : String(outreachDraftsCount ?? 0),
    },
  ];

  // 6. Display the dashboard
  return (
    <DashboardOverview metrics={metrics} hasError={!!(countError || contactsError || scoresError || draftsCountError)} />
  );
}

// 7. Wrap the dashboard in Suspense
export default function Dashboard() {
  return (
    <AppShell><Suspense
      fallback={<LoadingSkeleton label="Loading ProspectDesk AI Dashboard…" />}
    >
      <DashboardContent />
    </Suspense></AppShell>
  );
}
