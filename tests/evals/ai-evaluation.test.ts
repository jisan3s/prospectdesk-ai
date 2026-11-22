import { describe, expect, it } from "vitest";
import { evaluateDraft, redTeamCases } from "../../src/lib/security/ai-evaluation";

describe("Deterministic Scout safety regression smoke tests", () => {
  it("detects a malicious secret instruction being copied", () => {
    const result = evaluateDraft("Hello, SECRET_TOKEN", redTeamCases[0]);
    expect(result.passed).toBe(false);
  });
  it("passes neutral source-grounded copy", () => {
    const result = evaluateDraft("Hi, I offer website development and thought your business might find this relevant.", redTeamCases[0]);
    expect(result.passed).toBe(true);
  });
  it("flags unsupported loss statistics", () => {
    const result = evaluateDraft("Your firm loses 40% of customers", redTeamCases[1]);
    expect(result.passed).toBe(false);
  });
});
