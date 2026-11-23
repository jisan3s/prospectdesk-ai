import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const services = "http://127.0.0.1:54329";
const uuid = "019abbaa-1111-7111-8111-aaaaaaaaaaaa";
const profile = { display_name: "[E2E TEST] Developer", headline: "Website consultant", linkedin_url: "", portfolio_url: "", summary: "Accessible website development for professional service businesses.", raw_profile_text: "TypeScript website developer.", skills: ["TypeScript"], services: ["Website development"] };
const company = { name: "[E2E TEST] Sample Company", website: "https://example.com", industry: "Consulting", location: "Texas" };
async function signIn(page: Page, email = "e2e-a@example.test") {
  await page.goto("/login"); await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill("E2E-password-123");
  await page.getByRole("button", { name: "Sign In", exact: true }).click(); await expect(page).toHaveURL("http://127.0.0.1:3000/");
}
async function setup(page: Page) {
  await signIn(page); await expect(await page.request.post("/api/profile", { data: profile })).toBeOK();
  const result = await (await page.request.post("/api/discover/research", { data: company })).json();
  const saved = await page.request.post("/api/discover/save", { data: { company: result.company, sources: result.sources, research: result.research } });
  await expect(saved).toBeOK(); return (await saved.json()).companyId as string;
}
async function fault(page: Page, data: Record<string, unknown>) { await page.request.post(`${services}/__test/faults`, { data }); }
async function state(page: Page) { return (await page.request.get(`${services}/__test/state`)).json(); }
const dataRoutes: { url: string; methods: string[] }[] = [];
function inventory(dir: string) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) inventory(file);
    else if (entry.name === "route.ts") dataRoutes.push({ url: "/" + path.relative("src/app", dir).replaceAll(path.sep, "/").replace("[id]", uuid), methods: [...fs.readFileSync(file, "utf8").matchAll(/export async function (GET|POST|PATCH|PUT|DELETE)/g)].map(m => m[1]) });
  }
}
inventory("src/app/api");

test.beforeEach(async ({ request, page }) => {
  await expect(await request.post(`${services}/__test/reset`)).toBeOK();
  await page.route("**/*", r => ["127.0.0.1", "localhost"].includes(new URL(r.request().url()).hostname) ? r.continue() : r.abort("blockedbyclient"));
});

test("every inventoried API method rejects signed-out callers, and unsupported PUT methods return 405", async ({ request }) => {
  for (const route of dataRoutes) {
    for (const method of route.methods) {
      const response = await request.fetch(route.url, { method, ...(method === "GET" ? {} : { data: {} }) });
      expect(response.status(), `${method} ${route.url}`).toBe(401);
    }
    expect((await request.put(route.url, { data: {} })).status(), `PUT ${route.url}`).toBe(405);
  }
});

test("invalid payloads, forged ownership, invalid evidence, and request guards do not write records", async ({ page }) => {
  await signIn(page);
  for (const url of ["/api/profile", "/api/discover/search", "/api/discover/research", "/api/discover/save", "/api/qualification/contacts", "/api/qualification/score", "/api/qualification/decision-makers", "/api/outreach/generate"]) {
    expect((await page.request.post(url, { data: {} })).status(), url).toBe(400);
  }
  expect((await page.request.post("/api/profile", { data: { ...profile, user_id: uuid } })).status()).toBe(400);
  expect((await page.request.post("/api/companies", { data: { name: "A" } })).status()).toBe(400);
  expect((await page.request.post("/api/outreach/generate", { data: "not json", headers: { "content-type": "text/plain" } })).status()).toBe(415);
  expect((await page.request.post("/api/outreach/generate", { data: { text: "x".repeat(16001) } })).status()).toBe(413);
  expect((await page.request.post("/api/profile", { data: { text: "x".repeat(24001) } })).status()).toBe(413);
  expect((await page.request.post("/api/outreach/generate", { data: {}, headers: { origin: "https://evil.example" } })).status()).toBe(403);
  expect((await page.request.post("/api/profile", { data: "{", headers: { "content-type": "application/json" } })).status()).toBe(400);
  const stored = await state(page);
  expect(stored.tables.profiles).toHaveLength(0); expect(stored.tables.companies).toHaveLength(0); expect(stored.tables.outreach_drafts).toHaveLength(0);
});

test("basic company creation rejects a foreign browser origin", async ({ page }) => {
  await signIn(page);
  expect((await page.request.post("/api/companies", { data: company, headers: { origin: "https://evil.example" } })).status()).toBe(403);
  expect((await state(page)).tables.companies).toHaveLength(0);
});

for (const kind of ["decision-makers", "contacts", "draft"]) {
  test(`database failure is not misreported as a missing ${kind} record`, async ({ page }) => {
    const id = await setup(page);
    if (kind === "draft") {
      const generated = await page.request.post("/api/outreach/generate", { data: { companyId: id, contactId: null, channel: "linkedin", messageType: "connection", angle: "" } });
      await expect(generated).toBeOK(); const draftId = (await generated.json()).draft.id;
      await fault(page, { database: "outreach_drafts" });
      expect((await page.request.patch(`/api/outreach/drafts/${draftId}`, { data: { action: "submit", revision: 1 } })).status()).toBe(500);
    } else {
      await fault(page, { database: "companies" });
      const payload = kind === "contacts" ? { companyId: id, fullName: "[E2E TEST] Person", jobTitle: "Director", sourceUrl: "https://example.com/team", linkedinUrl: "" } : { companyId: id };
      expect((await page.request.post(`/api/qualification/${kind}`, { data: payload })).status()).toBe(500);
    }
  });
}

test("outreach quotas fail closed, transitions require approval/confirmation, and stale edits are rejected", async ({ page }) => {
  const id = await setup(page);
  const generate = { companyId: id, contactId: null, channel: "linkedin", messageType: "connection", angle: "" };
  const providerCount = async () => (await state(page)).requests.filter((r: { path: string }) => r.path === "/openai/v1/responses").length;
  const before = await providerCount();
  await fault(page, { rateLimit: true }); expect((await page.request.post("/api/outreach/generate", { data: generate })).status()).toBe(429);
  await fault(page, { rateLimit: false, quotaUnavailable: true }); expect((await page.request.post("/api/outreach/generate", { data: generate })).status()).toBe(503);
  expect(await providerCount()).toBe(before);
  await fault(page, { quotaUnavailable: false });
  const draft = (await (await page.request.post("/api/outreach/generate", { data: generate })).json()).draft;
  const url = `/api/outreach/drafts/${draft.id}`;
  for (const action of ["approve", "reject", "sent"]) expect((await page.request.patch(url, { data: { action, revision: 1, confirmedManualSend: true } })).status()).toBe(409);
  expect((await page.request.patch(url, { headers: { "x-outreach-action": "edit" }, data: { subject: "", body: "x".repeat(281), revision: 1 } })).status()).toBe(400);
  await expect(await page.request.patch(url, { headers: { "x-outreach-action": "edit" }, data: { subject: "", body: "[E2E TEST] Edited", revision: 1 } })).toBeOK();
  expect((await page.request.patch(url, { headers: { "x-outreach-action": "edit" }, data: { subject: "", body: "Stale", revision: 1 } })).status()).toBe(409);
  for (const [action, revision] of [["submit", 2], ["approve", 3]] as const) await expect(await page.request.patch(url, { data: { action, revision } })).toBeOK();
  expect((await page.request.patch(url, { data: { action: "sent", revision: 4 } })).status()).toBe(400);
  expect((await page.request.patch(url, { headers: { "x-outreach-action": "edit" }, data: { subject: "", body: "Forbidden edit", revision: 4 } })).status()).toBe(409);
  await expect(await page.request.patch(url, { data: { action: "sent", revision: 4, confirmedManualSend: true } })).toBeOK();
  expect((await page.request.patch(url, { data: { action: "revise", revision: 5 } })).status()).toBe(409);
  expect((await state(page)).tables.outreach_drafts[0].sent_at).toBeTruthy();
});

test("cross-user company/draft ownership and expired-session protection", async ({ page, browser }) => {
  const id = await setup(page);
  const draft = (await (await page.request.post("/api/outreach/generate", { data: { companyId: id, contactId: null, channel: "linkedin", messageType: "connection", angle: "" } })).json()).draft;
  const context = await browser.newContext({ baseURL: "http://127.0.0.1:3000" }); const other = await context.newPage();
  await signIn(other, "e2e-b@example.test");
  expect((await (await other.request.get("/api/companies")).json()).companies).toHaveLength(0);
  expect((await other.request.post("/api/qualification/score", { data: { companyId: id } })).status()).toBe(404);
  expect((await other.request.patch(`/api/outreach/drafts/${draft.id}`, { data: { action: "submit", revision: 1 } })).status()).toBe(404);
  const queries = (await state(page)).requests.filter((r: { path: string; query: string }) => r.path === "/rest/v1/outreach_drafts" && r.query.includes(draft.id));
  expect(new URLSearchParams(queries.at(-1).query).get("owner_id")).toBe("eq.019abbaa-bbbb-7bbb-8bbb-bbbbbbbbbbbb");
  await context.close();
  await page.request.post(`${services}/__test/revoke`, { data: { id: "019abbaa-aaaa-7aaa-8aaa-aaaaaaaaaaaa" } });
  await page.goto("/profile"); await expect(page).toHaveURL(/\/login$/);
  expect((await page.request.get("/api/companies")).status()).toBe(401);
});

test("empty research, invalid citations, provider outages, and invalid structured output do not persist false results", async ({ page }) => {
  await signIn(page); await page.request.post("/api/profile", { data: profile });
  await fault(page, { emptySearch: true });
  expect((await page.request.post("/api/discover/research", { data: company })).status()).toBe(422);
  expect((await state(page)).tables.companies).toHaveLength(0);
  await fault(page, { emptySearch: false, tavily: true });
  expect((await page.request.post("/api/discover/search", { data: { industry: "HVAC", location: "Texas" } })).status()).toBe(502);
  await fault(page, { tavily: false, invalidAI: true });
  expect((await page.request.post("/api/discover/research", { data: company })).status()).toBe(502);
  await fault(page, { invalidAI: false });
  const result = await (await page.request.post("/api/discover/research", { data: company })).json();
  expect((await page.request.post("/api/discover/save", { data: { company: result.company, research: { ...result.research, evidence_indexes: [999] }, sources: result.sources } })).status()).toBe(400);
  expect((await page.request.post("/api/discover/save", { data: { company: result.company, research: result.research, sources: [{ ...result.sources[0], url: "https://other.example/source" }] } })).status()).toBe(400);
  expect((await state(page)).tables.companies).toHaveLength(0);
});

test("provider diagnostics stay out of API responses and application logs", async ({ page }) => {
  const id = await setup(page);
  const marker = "E2E_PRIVATE_PROVIDER_DIAGNOSTIC";
  await fault(page, { openai: true, providerDiagnostic: marker });
  const offset = fs.readFileSync("artifacts/final/development.log", "utf8").length;
  const response = await page.request.post("/api/qualification/score", { data: { companyId: id } });
  expect(response.status()).toBe(502); expect(await response.text()).not.toContain(marker);
  await expect.poll(() => fs.readFileSync("artifacts/final/development.log", "utf8").slice(offset)).toContain("Lead scoring failed");
  expect(fs.readFileSync("artifacts/final/development.log", "utf8").slice(offset)).not.toContain(marker);
});

test("all six costly actions fail closed on exhausted or unavailable quotas before provider calls", async ({ page }) => {
  const id = await setup(page);
  const cases = [
    { url: "/api/profile/analyze" },
    { url: "/api/discover/search", data: { industry: "HVAC", location: "Texas" } },
    { url: "/api/discover/research", data: company },
    { url: "/api/qualification/score", data: { companyId: id } },
    { url: "/api/qualification/decision-makers", data: { companyId: id } },
    { url: "/api/outreach/generate", data: { companyId: id, contactId: null, channel: "linkedin", messageType: "connection", angle: "" } },
  ];
  const count = async () => (await state(page)).requests.filter((r: { path: string }) => ["/tavily/search", "/openai/v1/responses"].includes(r.path)).length;
  const before = await count();
  for (const unavailable of [false, true]) {
    await fault(page, { rateLimit: !unavailable, quotaUnavailable: unavailable });
    for (const row of cases) expect((await page.request.post(row.url, row.data ? { data: row.data } : {})).status(), row.url).toBe(unavailable ? 503 : 429);
  }
  expect(await count()).toBe(before);
});
