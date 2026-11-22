
import { Suspense } from "react";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import {
  Building2,
  Users,
  Target,
  MessageSquare,
} from "lucide-react";
import Link from "next/link";

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
    console.error("Company count error:", countError.message);
  }

  const [
    { count: contactsCount },
    { data: scoreRows },
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
  const metrics = [
    {
      label: "Companies",
      value: countError ? "—" : String(count ?? 0),
      icon: Building2,
    },
    { label: "Contacts", value: String(contactsCount ?? 0), icon: Users },
    { label: "Qualified Leads", value: String(qualifiedLeadsCount), icon: Target },
    {
      label: "Outreach Drafts",
      value: draftsCountError
        ? "—"
        : String(outreachDraftsCount ?? 0),
      icon: MessageSquare,
    },
  ];

  // 6. Display the dashboard
  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <h1 className="mb-6 text-3xl font-bold text-slate-900">
        ProspectDesk AI Dashboard
      </h1>

      <a
        href="/profile"
        className="mb-6 inline-block rounded-lg bg-indigo-600 px-5 py-3 text-sm font-medium text-white hover:bg-indigo-700"
      >
        Open Scout Profile Analyzer
      </a>

      <Link
        href="/qualification"
        className="text-indigo-600 hover:underline"
      >
        Lead Qualification
      </Link>

      <Link
        href="/outreach"
        className="text-indigo-600 hover:underline"
      >
        Outreach Studio
      </Link>

      <div className="grid gap-4 md:grid-cols-4">
        {metrics.map(({ label, value, icon: Icon }) => (
          <div
            key={label}
            className="rounded-xl border bg-white p-6"
          >
            <Icon className="mb-3 text-slate-600" />

            <p className="text-sm text-slate-600">
              {label}
            </p>

            <p className="text-3xl font-bold text-slate-900">
              {value}
            </p>
          </div>
        ))}
      </div>
    </main>
  );
}

// 7. Wrap the dashboard in Suspense
export default function Dashboard() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-slate-50 p-6">
          <p className="text-slate-600">
            Loading ProspectDesk AI Dashboard...
          </p>
        </main>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}