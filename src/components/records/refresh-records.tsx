"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

export function RefreshRecords({ label = "Refresh records" }: { label?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return <button type="button" className="button-secondary" disabled={pending} aria-busy={pending} onClick={() => startTransition(() => router.refresh())}><RefreshCw size={15} aria-hidden="true" />{pending ? "Refreshing…" : label}</button>;
}
