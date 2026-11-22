import { z } from "zod";
import { companyInputSchema, researchResultSchema, researchSourceSchema } from "./discovery";
import { outreachChannel, outreachType } from "./outreach";
import { scoutAnalysisSchema } from "./profile";
import { scoutQualification } from "./qualification";

// Validate fields consumed by the UI; additional server metadata remains compatible.
export const acknowledgementSchema = z.object({});
export const profileSavedSchema = z.object({ saved: z.literal(true) });
export const profileAnalysisResponseSchema = z.object({ analysis: scoutAnalysisSchema });

const searchHitSchema = z.object({ title: z.string(), url: z.string(), snippet: z.string() });
export type SearchHit = z.infer<typeof searchHitSchema>;
export const searchResponseSchema = z.object({ results: z.array(searchHitSchema).default([]) });
export const leadershipResponseSchema = searchResponseSchema.extend({ warning: z.string() });

export const researchResponseSchema = z.object({
  company: companyInputSchema,
  sources: z.array(researchSourceSchema),
  research: researchResultSchema,
});
export type ResearchReport = z.infer<typeof researchResponseSchema>;
export const companySavedSchema = z.object({ companyId: z.string() });

const evidenceSchema = z.object({ id: z.string(), url: z.string(), finding: z.string() });
export type Evidence = z.infer<typeof evidenceSchema>;
export const qualificationResponseSchema = z.object({
  assessment: scoutQualification,
  sources: z.array(evidenceSchema),
});

const draftSchema = z.object({
  id: z.string(),
  company_id: z.string(),
  contact_id: z.string().nullable(),
  channel: outreachChannel,
  message_type: outreachType,
  subject: z.string().nullable(),
  body: z.string(),
  status: z.enum(["draft", "in_review", "rejected", "approved", "manually_sent"]),
  revision: z.number().int().positive(),
  created_at: z.string(),
  approved_at: z.string().nullable().optional(),
  sent_at: z.string().nullable().optional(),
});
export type OutreachDraft = z.infer<typeof draftSchema>;
export const draftsResponseSchema = z.object({ drafts: z.array(draftSchema) });
export const generatedDraftResponseSchema = z.object({
  draft: draftSchema,
  cautions: z.array(z.string()).default([]),
});
