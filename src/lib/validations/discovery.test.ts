import { describe, it, expect } from "vitest";
import { discoverySearchSchema, normalizedCompanyUrl, isSourceForDomain, companyInputSchema, researchResultSchema } from "./discovery";

describe("Discovery validation", () => {
  it("rejects empty search inputs and extra fields", () => {
    expect(discoverySearchSchema.safeParse({ industry: "", location: "TX" }).success).toBe(false);
    expect(discoverySearchSchema.safeParse({ industry: "HVAC", location: "Texas", admin: true }).success).toBe(false);
  });
  it("normalizes a website root", () => {
    expect(normalizedCompanyUrl("https://www.Example.com/about?x=1")).toBe("https://example.com");
  });
  it("rejects local/private-style URL and credentials", () => {
    expect(normalizedCompanyUrl("http://localhost:3000/")).toBeNull();
    expect(normalizedCompanyUrl("ftp://example.com")).toBeNull();
    expect(normalizedCompanyUrl("https://admin:pass@example.com")).toBeNull();
  });
  it("allows same-domain sources but rejects unrelated sources", () => {
    expect(isSourceForDomain("https://blog.example.com/a", "example.com")).toBe(true);
    expect(isSourceForDomain("https://example.com.evil.org/a", "example.com")).toBe(false);
  });
  it("validates a company", () => {
    expect(companyInputSchema.safeParse({ name: "Example Co", website: "https://example.com", industry: "HVAC", location: "Texas" }).success).toBe(true);
  });
  it("requires structured evidence fields", () => {
    expect(researchResultSchema.safeParse({ summary: "Summary", potential_opportunity: "Possible redesign", relevance_to_profile: "Webflow", confidence: "low", evidence_indexes: [0], caveats: [] }).success).toBe(true);
    expect(researchResultSchema.safeParse({ summary: "Missing fields" }).success).toBe(false);
  });
});
