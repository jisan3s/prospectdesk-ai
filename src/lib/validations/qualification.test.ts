import { describe, expect, it } from "vitest";
import { normalizeScore, referencedIndexes, verifiedContactInput, qualificationRequest, scoutQualification } from "./qualification";

describe("Stage 5 validation", () => {
  it("rejects forged ownership fields", () => {
    expect(qualificationRequest.safeParse({ companyId: "019aa0a0-aaaa-7aaa-8aaa-aaaaaaaaaaaa", owner_id: "other" }).success).toBe(false);
  });
  it("requires HTTPS evidence for contacts", () => {
    const base = { companyId: "019aa0a0-aaaa-7aaa-8aaa-aaaaaaaaaaaa", fullName: "Jane Smith", jobTitle: "Director", linkedinUrl: "" };
    expect(verifiedContactInput.safeParse({ ...base, sourceUrl: "http://example.com" }).success).toBe(false);
    expect(verifiedContactInput.safeParse({ ...base, sourceUrl: "https://example.com/team" }).success).toBe(true);
  });
  it("normalizes scores and removes fake citation indexes", () => {
    expect(normalizeScore(150)).toBe(100);
    expect(normalizeScore(-5)).toBe(0);
    expect(referencedIndexes([0, 0, 3, -1], 2)).toEqual([0]);
  });
  it("validates the Scout JSON response", () => {
    expect(scoutQualification.safeParse({ score: 65, confidence: "medium", reasoning: "Good fit", positive_signals: [], risks: [], evidence_indexes: [0], suggested_roles: [{ title: "Founder", rationale: "Small company" }] }).success).toBe(true);
  });
});
