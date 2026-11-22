import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { HttpError, postJson, requestJson } from "../../src/lib/http/client";

const schema = z.object({ value: z.string() });
afterEach(() => vi.unstubAllGlobals());

describe("Validated browser API responses", () => {
  it("returns validated data while tolerating extra server metadata", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ value: "saved", metadata: 1 })));
    expect(await requestJson("/api/example", schema)).toEqual({ value: "saved" });
  });

  it.each([409, 429, 503])("preserves HTTP %i and the API error without retrying", async status => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ error: "Please try later" }, { status }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(postJson("/api/example", schema, {})).rejects.toMatchObject({
      name: "HttpError", status, message: "Please try later",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not expose an HTML error page or a non-string error payload", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<html>private diagnostics</html>", { status: 502 })));
    await expect(requestJson("/api/example", schema)).rejects.toMatchObject({ status: 502, message: "Request failed (502)" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ error: { private: "diagnostics" } }, { status: 500 })));
    await expect(requestJson("/api/example", schema)).rejects.toMatchObject({ message: "Request failed (500)" });
  });

  it("keeps an empty API error from hiding failure feedback", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ error: "" }, { status: 500 })));
    await expect(requestJson("/api/example", schema)).rejects.toMatchObject({ message: "Request failed (500)" });
  });

  it.each([null, {}, { value: 12 }])("rejects a malformed successful response: %j", async payload => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(payload)));
    await expect(requestJson("/api/example", schema)).rejects.toBeInstanceOf(HttpError);
  });

  it("rejects a non-JSON success instead of passing unchecked data to a component", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("not JSON")));
    await expect(requestJson("/api/example", schema)).rejects.toMatchObject({ status: 200 });
  });

  it("propagates cancellation without retrying", async () => {
    const aborted = new DOMException("Aborted", "AbortError");
    const fetchMock = vi.fn().mockRejectedValue(aborted);
    vi.stubGlobal("fetch", fetchMock);
    const signal = new AbortController().signal;
    await expect(requestJson("/api/example", schema, { signal })).rejects.toBe(aborted);
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith("/api/example", { signal });
  });

  it("posts JSON with the existing request shape", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ value: "saved" }));
    vi.stubGlobal("fetch", fetchMock);
    await postJson("/api/example", schema, { companyId: "company-1" });
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith("/api/example", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId: "company-1" }),
    });
  });
});
