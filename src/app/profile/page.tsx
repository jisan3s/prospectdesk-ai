import { AppShell } from "@/components/layout/app-shell";
import { Alert, LoadingSkeleton } from "@/components/ui/primitives";
import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProfileEditor } from "@/components/profile/profile-editor";
import { scoutAnalysisSchema } from "@/lib/validations/profile";

async function ProfileContent() {
  // Needed for the user's Cache Components-enabled Next.js app.
  await connection();
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) redirect("/login");

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("display_name, headline, linkedin_url, portfolio_url, summary, raw_profile_text, skills, services, scout_analysis, analyzed_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profileError) {
    return <main className="workspace"><Alert>Unable to load your profile. Refresh the page to try again.</Alert></main>;
  }

  const previous = scoutAnalysisSchema.safeParse(profile?.scout_analysis);
  return (
    <ProfileEditor
      initial={{
        display_name: profile?.display_name ?? "",
        headline: profile?.headline ?? "",
        linkedin_url: profile?.linkedin_url ?? "",
        portfolio_url: profile?.portfolio_url ?? "",
        summary: profile?.summary ?? "",
        raw_profile_text: profile?.raw_profile_text ?? "",
        skills: profile?.skills ?? [],
        services: profile?.services ?? [],
      }}
      initialAnalysis={previous.success ? previous.data : null}
      lastAnalyzedAt={profile?.analyzed_at ?? null}
    />
  );
}

export default function ProfilePage() {
  return (
    <AppShell><Suspense fallback={<LoadingSkeleton label="Loading your profile..." />}>
      <ProfileContent />
    </Suspense></AppShell>
  );
}
