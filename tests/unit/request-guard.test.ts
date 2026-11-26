import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { readJsonRequest, validateWriteRequest, enforceRequestRate } from "../../src/lib/security/request-guard";

describe("consistent request hardening", () => {
  it("accepts charset JSON and rejects JSON-like MIME types", () => {
    expect(validateWriteRequest(new Request("https://app.test/api",{method:"POST",headers:{"content-type":"application/json; charset=utf-8"}}))).toBeNull();
    expect(validateWriteRequest(new Request("https://app.test/api",{method:"POST",headers:{"content-type":"application/json-evil"}}))?.status).toBe(415);
  });
  it("limits actual UTF-8 bytes rather than characters", async () => {
    const request=new Request("https://app.test/api",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({text:"😀".repeat(100)})});
    expect((await readJsonRequest(request,200)).error?.status).toBe(413);
  });
  it("returns safe parse errors without echoing content", async () => {
    const request=new Request("https://app.test/api",{method:"POST",headers:{"content-type":"application/json"},body:"PRIVATE-invalid-json"});
    const result=await readJsonRequest(request);
    expect(result.error?.status).toBe(400); expect(await result.error?.text()).not.toContain("PRIVATE");
  });
  it("preserves bodyless profile analysis while rejecting untyped nonempty bodies", async () => {
    for (const body of [undefined, ""]) {
      const request=new Request("https://app.test/api",{method:"POST",...(body===undefined?{}:{body})});
      request.headers.delete("content-type");
      const result=await readJsonRequest(request,1024,true);
      expect(result.error).toBeNull();expect(result.data).toEqual({});
    }
    const request=new Request("https://app.test/api",{method:"POST",body:"{}"});
    expect((await readJsonRequest(request,1024,true)).error?.status).toBe(415);
  });
  it("fails closed on missing or malformed database guards", async () => {
    for(const response of [{data:null,error:{}},{data:"yes",error:null},{data:null,error:null}]) {
      const client={rpc:vi.fn().mockResolvedValue(response)};
      expect((await enforceRequestRate(client as unknown as Parameters<typeof enforceRequestRate>[0],"company_search"))?.status).toBe(503);
    }
  });
  it("returns a retry hint when denied and permits an explicit true result", async () => {
    const rpc=vi.fn().mockResolvedValueOnce({data:false,error:null}).mockResolvedValueOnce({data:true,error:null});
    const client={rpc} as unknown as Parameters<typeof enforceRequestRate>[0];
    const denied=await enforceRequestRate(client,"record_list");
    expect(denied?.status).toBe(429);expect(denied?.headers.get("retry-after")).toBe("60");
    expect(await enforceRequestRate(client,"record_list")).toBeNull();
  });
});
