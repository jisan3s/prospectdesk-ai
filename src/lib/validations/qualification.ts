import { z } from "zod";

export const qualificationRequest = z.object({
  companyId: z.uuid(),
}).strict();

export const verifiedContactInput = z.object({
  companyId: z.uuid(),
  fullName: z.string().trim().min(2).max(150),
  jobTitle: z.string().trim().min(2).max(150),
  sourceUrl: z.url().max(2048).refine(v => v.startsWith("https://")),
  linkedinUrl: z.union([z.literal(""), z.url().max(2048)]),
}).strict();

export const scoutQualification = z.object({
  score: z.number().int(),
  confidence: z.enum(["low", "medium", "high"]),
  reasoning: z.string(),
  positive_signals: z.array(z.string()),
  risks: z.array(z.string()),
  evidence_indexes: z.array(z.number().int()),
  suggested_roles: z.array(z.object({
    title: z.string(),
    rationale: z.string(),
  })),
}).strict();

export type Qualification = z.infer<typeof scoutQualification>;

export function normalizeScore(value: number) {
  return Math.max(0, Math.min(100, value));
}

export function referencedIndexes(indexes: number[], sourceCount: number) {
  return [...new Set(indexes)].filter(n => n >= 0 && n < sourceCount);
}
