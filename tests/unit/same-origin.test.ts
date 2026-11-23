import { describe, expect, it } from "vitest";
import { hasSameOrigin } from "../../src/lib/security/same-origin";

describe("Browser write origin checks", () => {
  it("accepts the incoming host when a framework internal URL uses localhost", () => {
    expect(hasSameOrigin(new Request("http://localhost:3000/api/profile", { headers: { host: "127.0.0.1:3000", origin: "http://127.0.0.1:3000" } }))).toBe(true);
  });
  it("does not trust a forwarded host or a different scheme/authority", () => {
    for (const origin of ["http://localhost:3000", "https://127.0.0.1:3000", "https://evil.example", "null"]) {
      expect(hasSameOrigin(new Request("http://localhost:3000/api/profile", { headers: { host: "127.0.0.1:3000", origin, "x-forwarded-host": "evil.example" } }))).toBe(false);
    }
  });
  it("retains non-browser clients and URL fallback when Host is absent", () => {
    expect(hasSameOrigin(new Request("https://app.example/api/profile"))).toBe(true);
    expect(hasSameOrigin(new Request("https://app.example/api/profile", { headers: { origin: "https://app.example" } }))).toBe(true);
  });
});
