import { describe, expect, it } from "vitest";
import {
  profileInputSchema,
  scoutAnalysisSchema,
  hasEnoughProfileInformation,
} from "./profile";

const valid = {
  display_name: "Example Developer",
  headline: "Full-stack web developer",
  linkedin_url: "",
  portfolio_url: "https://example.com",
  summary: "I build professional websites and reliable application integrations.",
  raw_profile_text: "",
  skills: ["TypeScript", "React"],
  services: ["Website development"],
};

describe("profile validation", () => {
  it("accepts a normal profile", () => {
    expect(profileInputSchema.safeParse(valid).success).toBe(true);
    expect(hasEnoughProfileInformation(valid)).toBe(true);
  });
  it("rejects invalid URLs", () => {
    expect(profileInputSchema.safeParse({ ...valid, linkedin_url: "not-a-url" }).success).toBe(false);
  });
  it("rejects overly long profile text", () => {
    expect(profileInputSchema.safeParse({ ...valid, raw_profile_text: "x".repeat(6501) }).success).toBe(false);
  });
  it("rejects unsupported extra payload fields", () => {
    expect(profileInputSchema.safeParse({ ...valid, user_id: "victim-id" }).success).toBe(false);
  });
  it("validates a structured Scout result", () => {
    expect(scoutAnalysisSchema.safeParse({
      positioning_statement: "Developer for service businesses",
      verified_strengths: ["React"],
      suggested_services: [],
      ideal_clients: [{ industry: "Professional services", buyer_role: "Owner", why_relevant: "Web presence needs" }],
      missing_information: ["Project outcomes"], cautions: [],
    }).success).toBe(true);
  });
});
