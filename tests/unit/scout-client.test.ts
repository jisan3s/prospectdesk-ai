import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("openai", () => ({
  default: vi.fn(function (options: unknown) { return { options }; }),
}));

import OpenAI from "openai";
import { createScoutClient, scoutModel } from "../../src/lib/ai/client";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("Scout provider safeguards", () => {
  it("rejects missing credentials before constructing a provider client", () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    expect(() => createScoutClient()).toThrow("Missing OpenAI API key");
    expect(OpenAI).not.toHaveBeenCalled();
  });

  it("preserves no automatic retries and the research timeout", () => {
    vi.stubEnv("OPENAI_API_KEY", "synthetic-test-key");
    createScoutClient();
    expect(OpenAI).toHaveBeenCalledExactlyOnceWith({ apiKey: "synthetic-test-key", timeout: 25_000, maxRetries: 0 });
  });

  it("retains the longer profile timeout and the configured model", () => {
    vi.stubEnv("OPENAI_API_KEY", "synthetic-test-key");
    vi.stubEnv("OPENAI_MODEL", "configured-test-model");
    createScoutClient(30_000);
    expect(OpenAI).toHaveBeenCalledWith({ apiKey: "synthetic-test-key", timeout: 30_000, maxRetries: 0 });
    expect(scoutModel()).toBe("configured-test-model");
    vi.stubEnv("OPENAI_MODEL", "");
    expect(scoutModel()).toBe("gpt-4o-mini");
  });
});
