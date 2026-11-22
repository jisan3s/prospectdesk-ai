import { z } from "zod";

export const discoverySearchSchema = z.object({
  industry: z.string().trim().min(2).max(80),
  location: z.string().trim().min(2).max(100),
}).strict();

export const companyInputSchema = z.object({
  name: z.string().trim().min(2).max(200),
  website: z.url().max(2048),
  industry: z.string().trim().max(120),
  location: z.string().trim().max(150),
}).strict();

export const researchSourceSchema = z.object({
  title: z.string().max(300),
  url: z.url().max(2048),
  finding: z.string().max(1500),
});

export const researchResultSchema = z.object({
  summary: z.string(),
  potential_opportunity: z.string(),
  relevance_to_profile: z.string(),
  confidence: z.enum(["low", "medium", "high"]),
  evidence_indexes: z.array(z.number().int()),
  caveats: z.array(z.string()),
}).strict();

export const saveResearchSchema = z.object({
  company: companyInputSchema,
  research: researchResultSchema,
  sources: z.array(researchSourceSchema).min(1).max(5),
}).strict();

export function normalizedCompanyUrl(input: string): string | null {
  try {
    const url = new URL(input);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (url.username || url.password || url.port) return null;
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    if (!host.includes(".") || host.length > 253) return null;
    if (!/^[a-z0-9.-]+$/.test(host)) return null;
    if (host === "localhost" || host.endsWith(".local")) return null;
    // Normalize to domain root: we don't directly fetch user-supplied URLs.
    return `https://${host}`;
  } catch { return null; }
}

export function domainFromUrl(input: string): string | null {
  const normalized = normalizedCompanyUrl(input);
  return normalized ? new URL(normalized).hostname : null;
}

export function isSourceForDomain(sourceUrl: string, domain: string): boolean {
  const candidate = domainFromUrl(sourceUrl);
  return !!candidate && (candidate === domain || candidate.endsWith(`.${domain}`));
}
