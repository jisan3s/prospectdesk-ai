import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DiscoverWorkspace } from "@/components/discover/discover-workspace";

async function DiscoverContent() {
  await connection(); // Required for user-specific rendering with Cache Components.
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/login");
  return <DiscoverWorkspace />;
}

export default function DiscoverPage() {
  return <Suspense fallback={<main className="p-8">Loading company discovery...</main>}><DiscoverContent /></Suspense>;
}
