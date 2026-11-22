import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OutreachStudio } from "@/components/outreach/studio";

async function Content() {
  await connection();
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/login");
  const [companies, contacts] = await Promise.all([
    supabase.from("companies").select("id, name").eq("owner_id", user.id).order("created_at", { ascending: false }).limit(200),
    supabase.from("contacts").select("id, company_id, full_name, job_title, verification_source")
      .eq("owner_id", user.id).order("created_at", { ascending: false }).limit(300),
  ]);
  if (companies.error || contacts.error) return <main className="p-8">Unable to load outreach workspace.</main>;
  return <OutreachStudio companies={companies.data ?? []} contacts={contacts.data ?? []} />;
}

export default function OutreachPage() {
  return <Suspense fallback={<main className="p-8">Loading Outreach Studio...</main>}><Content /></Suspense>;
}
