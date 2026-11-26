import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadSavedRecords, RecordsLoadError, type RecordsResult } from "@/lib/records/load";
import { recordViews, type RecordKind } from "@/lib/records/types";
import { AppShell } from "@/components/layout/app-shell";
import { Alert, LoadingSkeleton, PageHeading } from "@/components/ui/primitives";
import { RefreshRecords } from "./refresh-records";
import { recordsQuerySchema, type SearchParams } from "@/lib/records/query";
import { RecordList } from "./record-list";

async function Content({ kind, searchParams }: { kind: RecordKind; searchParams: SearchParams }) {
  await connection();
  const client = await createClient();
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) redirect("/login");
  const query = recordsQuerySchema.safeParse(await searchParams);
  if (!query.success) return <main className="workspace"><Alert tone="error">Invalid record filters. Open the list from the sidebar to reset them.</Alert></main>;
  let records: RecordsResult | null = null;
  let message = "Unable to load saved records. Please try again.";
  try {
    records = await loadSavedRecords(client, kind, query.data);
  } catch (error) { if (error instanceof RecordsLoadError) message = error.message; }
  if (!records) {
    return <main className="workspace space-y-6"><PageHeading eyebrow="Your saved records" title={recordViews[kind].title} description={recordViews[kind].description} /><Alert tone="error">{message}</Alert><RefreshRecords label="Try again" /></main>;
  }
  return <RecordList key={JSON.stringify(query.data)} kind={kind} result={records} query={query.data} />;
}

export function RecordsPage({ kind, searchParams }: { kind: RecordKind; searchParams: SearchParams }) {
  return <AppShell><Suspense fallback={<LoadingSkeleton label={`Loading ${recordViews[kind].title.toLowerCase()}…`} />}><Content kind={kind} searchParams={searchParams} /></Suspense></AppShell>;
}
