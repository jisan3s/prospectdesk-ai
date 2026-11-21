import { z } from "zod";

export const profileInputSchema = z.object({
  display_name: z.string().trim().max(120),
  headline: z.string().trim().max(200),
  linkedin_url: z.union([z.literal(""), z.url().max(2048)]),
  portfolio_url: z.union([z.literal(""), z.url().max(2048)]),
  summary: z.string().trim().max(2500),
  raw_profile_text: z.string().trim().max(6500),
  skills: z.array(z.string().trim().min(1).max(80)).max(20),
  services: z.array(z.string().trim().min(1).max(80)).max(20),
}).strict();

export type ProfileInput = z.infer<typeof profileInputSchema>;

// Avoid min/max constraints here: OpenAI's strict Structured Outputs
// supports a subset of JSON Schema, with model-dependent limitations.
export const scoutAnalysisSchema = z.object({
  positioning_statement: z.string(),
  verified_strengths: z.array(z.string()),
  suggested_services: z.array(z.string()),
  ideal_clients: z.array(z.object({
    industry: z.string(),
    buyer_role: z.string(),
    why_relevant: z.string(),
  })),
  missing_information: z.array(z.string()),
  cautions: z.array(z.string()),
}).strict();

export type ScoutAnalysis = z.infer<typeof scoutAnalysisSchema>;

export function hasEnoughProfileInformation(profile: ProfileInput): boolean {
  const combined = [
    profile.headline,
    profile.summary,
    profile.raw_profile_text,
    ...profile.skills,
    ...profile.services,
  ].join(" ").trim();
  return combined.length >= 40;
}
