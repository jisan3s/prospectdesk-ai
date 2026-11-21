
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

  // 5. Prepare dashboard metrics
  const metrics = [
    {
      label: "Companies",
      value: countError ? "—" : String(count ?? 0),
      icon: Building2,
    },
    {
      label: "Contacts",
      value: "0",
      icon: Users,
    },
    {
      label: "Qualified Leads",
      value: "0",
      icon: Target,
    },
    {
      label: "Outreach Drafts",
      value: "0",
      icon: MessageSquare,
    },
  ];

  // 6. Display the dashboard
  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <h1 className="mb-6 text-3xl font-bold text-slate-900">
        ProspectDesk AI Dashboard
      </h1>

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