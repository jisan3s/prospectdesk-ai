import { describe, expect, it } from "vitest";
import { scoutAnalysisSchema } from "../../src/lib/validations/profile";
import { researchResultSchema } from "../../src/lib/validations/discovery";
import { scoutQualification } from "../../src/lib/validations/qualification";
import { generatedOutreach } from "../../src/lib/validations/outreach";

// Offline regression fixtures: no API usage or personal information.
describe("Scout structured output contracts", () => {
  it("requires complete profile analysis", () => {
    expect(scoutAnalysisSchema.safeParse({ positioning_statement: "Developer" }).success).toBe(false);
  });
  it("requires cited research indexes and caveats fields", () => {
    expect(researchResultSchema.safeParse({ summary: "Potential match", potential_opportunity: "Maybe", relevance_to_profile: "Web development", confidence: "low", evidence_indexes: [0], caveats: ["Search snippet only"] }).success).toBe(true);
  });
  it("rejects unsupported score confidence", () => {
    expect(scoutQualification.safeParse({ score: 100, confidence: "certain", reasoning: "Guess", positive_signals: [], risks: [], evidence_indexes: [], suggested_roles: [] }).success).toBe(false);
  });
  it("requires outreach personalization provenance fields", () => {
    expect(generatedOutreach.safeParse({ subject: "Hello", body: "Hi", personalization_facts: [], cautions: [] }).success).toBe(true);
    expect(generatedOutreach.safeParse({ subject: "Hello", body: "Hi" }).success).toBe(false);
  });
});
