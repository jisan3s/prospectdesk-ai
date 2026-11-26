import { RecordsPage } from "@/components/records/records-page";

import type { SearchParams } from "@/lib/records/query";

export default function Page({ searchParams }: { searchParams: SearchParams }) {
  return <RecordsPage kind="leads" searchParams={searchParams} />;
}
