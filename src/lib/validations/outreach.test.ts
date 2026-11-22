import { describe, expect, it } from "vitest";
import { editOutreachInput, generateOutreachInput, generatedOutreach, transitionInput, validLength } from "./outreach";

const uuid = "019abbaa-1111-7111-8111-aaaaaaaaaaaa";

describe("Stage 6 outreach validation", () => {
  it("rejects forged ownership fields", () => {
    expect(generateOutreachInput.safeParse({ companyId: uuid, contactId: null, channel: "linkedin", messageType: "initial", angle: "", owner_id: uuid }).success).toBe(false);
  });
  it("rejects email connection requests", () => {
    expect(generateOutreachInput.safeParse({ companyId: uuid, contactId: null, channel: "email", messageType: "connection", angle: "" }).success).toBe(false);
  });
  it("limits LinkedIn connection messages", () => {
    expect(validLength("linkedin", "connection", "a".repeat(280))).toBe(true);
    expect(validLength("linkedin", "connection", "a".repeat(281))).toBe(false);
  });
  it("requires revision for concurrency safety", () => {
    expect(editOutreachInput.safeParse({ subject: "", body: "Hello" }).success).toBe(false);
    expect(transitionInput.safeParse({ action: "approve", revision: 1 }).success).toBe(true);
  });
  it("checks structured outputs", () => {
    expect(generatedOutreach.safeParse({ subject: "", body: "Hello!", personalization_facts: [], cautions: [] }).success).toBe(true);
  });
});
