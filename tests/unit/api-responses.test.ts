import { describe, expect, it } from "vitest";
import {
  draftsResponseSchema, generatedDraftResponseSchema, searchResponseSchema,
  researchResponseSchema, qualificationResponseSchema,
} from "../../src/lib/validations/responses";

const draft = {
  id: "draft-1", company_id: "company-1", contact_id: null,
  channel: "linkedin", message_type: "connection", subject: null,
  body: "Hello", status: "draft", revision: 1, created_at: "2026-11-23T00:00:00Z",
};

describe("Consumed API response contracts", () => {
  it("accepts the generated draft shape without optional approval/sent timestamps", () => {
    const parsed = generatedDraftResponseSchema.parse({ draft, usage: { input: 12 } });
    expect(parsed.draft).toEqual(draft);
    expect(parsed.cautions).toEqual([]);
  });

  it("accepts saved draft timestamps and all existing workflow states", () => {
    for (const status of ["draft", "in_review", "rejected", "approved", "manually_sent"]) {
      expect(draftsResponseSchema.safeParse({ drafts: [{ ...draft, status, approved_at: null, sent_at: null }] }).success).toBe(true);
    }
  });

  it.each([{ status: "sent" }, { revision: 0 }, { body: null }, { channel: "sms" }])("rejects malformed draft data: %j", change => {
    expect(draftsResponseSchema.safeParse({ drafts: [{ ...draft, ...change }] }).success).toBe(false);
  });

  it("retains the empty-search fallback but rejects malformed result entries", () => {
    expect(searchResponseSchema.parse({})).toEqual({ results: [] });
    expect(searchResponseSchema.safeParse({ results: [{ title: "Incomplete" }] }).success).toBe(false);
  });

  it("requires research evidence and qualification fields before rendering them", () => {
    expect(researchResponseSchema.safeParse({ research: { summary: "Incomplete" } }).success).toBe(false);
    expect(qualificationResponseSchema.safeParse({ assessment: { score: 70 } }).success).toBe(false);
  });
});
