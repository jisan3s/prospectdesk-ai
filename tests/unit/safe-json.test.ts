import { describe, expect, it } from "vitest";
import { readBoundedJson } from "../../src/lib/security/safe-json";

describe("Request body limits", () => {
  it("accepts valid bounded JSON", async () => {
    const request = new Request("https://example.com/api", { method: "POST", body: JSON.stringify({ action: "test" }) });
    expect(await readBoundedJson(request, 1000)).toEqual({ action: "test" });
  });
  it("rejects oversized payloads regardless of Content-Length", async () => {
    const request = new Request("https://example.com/api", { method: "POST", body: JSON.stringify({ text: "x".repeat(1000) }) });
    await expect(readBoundedJson(request, 100)).rejects.toThrow("Request body too large");
  });
  it("rejects invalid JSON", async () => {
    const request = new Request("https://example.com/api", { method: "POST", body: "not json" });
    await expect(readBoundedJson(request)).rejects.toThrow();
  });
});
