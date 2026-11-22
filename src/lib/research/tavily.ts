import "server-only";
import { z } from "zod";

const providerResponseSchema = z.object({
  results: z.array(z.object({
    title: z.string().default("Untitled"),
    url: z.string(),
    content: z.string().default(""),
  })).default([]),
});

export type SearchHit = { title: string; url: string; snippet: string };

export async function searchWeb(query: string, includeDomains?: string[]): Promise<SearchHit[]> {
  if (!process.env.TAVILY_API_KEY) throw new Error("Missing Tavily API key");
  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.TAVILY_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query,
      search_depth: "basic",
      max_results: 8,
      include_answer: false,
      include_raw_content: false,
      include_images: false,
      ...(includeDomains?.length ? { include_domains: includeDomains } : {}),
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error(`Tavily failed with status ${response.status}`);
  const parsed = providerResponseSchema.parse(await response.json());
  return parsed.results.slice(0, 8).map(item => ({
    title: item.title.slice(0, 300),
    url: item.url.slice(0, 2048),
    snippet: item.content.slice(0, 1200),
  })).filter(hit => /^https:\/\//i.test(hit.url));
}
