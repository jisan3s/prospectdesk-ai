import { test, expect, type Page } from "@playwright/test";

const services = "http://127.0.0.1:54329";
const password = "E2E-password-123";
async function login(page: Page, email = "e2e-a@example.test") {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page).toHaveURL("http://127.0.0.1:3000/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("possibility");
}

test.beforeEach(async ({ request, page }) => {
  await expect(await request.post(`${services}/__test/reset`)).toBeOK();
  await page.route("**/*", route => {
    const host = new URL(route.request().url()).hostname;
    return ["127.0.0.1", "localhost"].includes(host) ? route.continue() : route.abort("blockedbyclient");
  });
});

test("isolated sign-in, authenticated server rendering, session reload, and logout", async ({ page }) => {
  await login(page);
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("possibility");
  for (const route of ["/profile", "/discover", "/qualification", "/outreach"]) {
    await page.goto(route);
    await expect(page).toHaveURL(new RegExp(route + "$"));
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  }
  await page.getByRole("button", { name: "Sign Out", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/profile");
  await expect(page).toHaveURL(/\/login$/);
});

const profile = { display_name: "[E2E TEST] Developer", headline: "TypeScript consultant", linkedin_url: "", portfolio_url: "https://example.com", summary: "I build accessible websites for consulting and professional service businesses.", raw_profile_text: "TypeScript and React website development for professional services.", skills: ["TypeScript"], services: ["Website development"] };
async function seedCompany(page: Page) {
  await expect(await page.request.post("/api/profile", { data: profile })).toBeOK();
  const research = await page.request.post("/api/discover/research", { data: { name: "[E2E TEST] Sample Company", website: "https://example.com", industry: "Consulting", location: "Texas" } });
  await expect(research).toBeOK();
  const { company, sources, research: findings } = await research.json();
  const saved = await page.request.post("/api/discover/save", { data: { company, sources, research: findings } });
  await expect(saved).toBeOK();
  return (await saved.json()).companyId as string;
}
async function memory(page: Page) { return (await page.request.get(`${services}/__test/state`)).json(); }
async function fault(page: Page, values: Record<string, unknown>) { await page.request.post(`${services}/__test/faults`, { data: values }); }
async function draftButton(page: Page, channel: string) { return page.getByRole("button", { name: new RegExp(`Sample Company${channel}`) }).first(); }

test("profile save, reload, edit, analysis, invalid inputs, and provider failure recovery", async ({ page }) => {
  await login(page); await page.goto("/profile");
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Profile saved"); // An empty draft profile is allowed.
  await page.getByRole("button", { name: "Analyze with Scout" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("more professional information");
  await page.getByLabel("Display name", { exact: true }).fill(profile.display_name);
  await page.getByLabel("Professional headline").fill(profile.headline);
  await page.getByLabel("Professional summary").fill(profile.summary);
  await page.getByLabel("Services you actually offer (comma-separated)").fill("Website development");
  await page.getByLabel("Skills (comma-separated, max 20)").fill(Array.from({ length: 21 }, (_, i) => `Skill${i}`).join(","));
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Please check");
  await page.getByLabel("Skills (comma-separated, max 20)").fill("TypeScript, React");
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Profile saved");
  await page.reload(); await expect(page.getByLabel("Display name", { exact: true })).toHaveValue(profile.display_name);
  await page.getByLabel("Professional headline").fill("[E2E TEST] Updated consultant");
  await expect(page.getByRole("button", { name: "Analyze with Scout" })).toBeDisabled();
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await page.getByRole("button", { name: "Analyze with Scout" }).click();
  await expect(page.getByRole("heading", { name: "Your profile analysis" })).toBeVisible();
  await page.reload(); await expect(page.getByRole("heading", { name: "Your profile analysis" })).toBeVisible();
  await fault(page, { openai: true });
  await page.getByRole("button", { name: "Analyze with Scout" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("could not analyze");
  await expect(page.getByRole("button", { name: "Analyze with Scout" })).toBeEnabled();
  await fault(page, { openai: false });
  await page.route("**/api/profile/analyze", route => route.abort("timedout"));
  await page.getByRole("button", { name: "Analyze with Scout" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toBeVisible();
  await expect(page.getByRole("button", { name: "Analyze with Scout" })).toBeEnabled();
});

test("choosing a discovered candidate must not submit another paid search", async ({ page }) => {
  await login(page); await page.goto("/discover");
  await page.getByRole("button", { name: "Search companies", exact: true }).click();
  await expect(page.getByRole("button", { name: "Use as candidate" })).toBeVisible();
  const before = (await memory(page)).requests.filter((r: { path: string }) => r.path === "/tavily/search").length;
  await page.getByRole("button", { name: "Use as candidate" }).click();
  await expect(page.getByLabel("name", { exact: true })).toHaveValue("[E2E TEST] Sample Company");
  await expect(page.getByRole("button", { name: "Search companies", exact: true })).toBeEnabled();
  expect((await memory(page)).requests.filter((r: { path: string }) => r.path === "/tavily/search").length).toBe(before);
});

test("research, company persistence, duplicates, leadership contacts, scores, and dashboard counts", async ({ page }) => {
  await login(page); const id = await seedCompany(page);
  await page.goto("/qualification");
  await page.getByRole("button", { name: "Score company with Scout" }).click();
  await expect(page.getByText("Qualified lead", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Search leadership sources" }).click();
  await page.getByRole("button", { name: "Use source link below" }).click();
  await page.getByLabel("Full name", { exact: true }).fill("[E2E TEST] Test Person");
  await page.getByLabel("Current job title").fill("Operations Director");
  await page.getByRole("button", { name: "Save contact candidate" }).click();
  await expect(page.getByRole("status")).toContainText("Contact candidate saved");
  const stored = await memory(page); expect(stored.tables.contacts[0].verified_at).toBeNull();
  expect(stored.tables.contacts[0].company_id).toBe(id);
  await page.reload(); await expect(page.getByRole("combobox", { name: "Company", exact: true })).toContainText("[E2E TEST] Sample Company");
  await page.goto("/");
  const metrics = page.getByRole("region", { name: "Prospecting metrics" });
  await expect(metrics.getByRole("link", { name: /^Companies/ }).locator("p").nth(1)).toHaveText("1");
  await expect(metrics.getByRole("link", { name: /^Contacts/ }).locator("p").nth(1)).toHaveText("1");
  await expect(metrics.getByRole("link", { name: /^Qualified Leads/ }).locator("p").nth(1)).toHaveText("1");
  const res = await page.request.post("/api/discover/research", { data: { name: "[E2E TEST] Sample Company", website: "https://example.com", industry: "Consulting", location: "Texas" } });
  const { company, sources, research } = await res.json();
  expect((await page.request.post("/api/discover/save", { data: { company, sources, research } })).status()).toBe(409);
  await fault(page, { weakScore: true });
  const weak = await page.request.post("/api/qualification/score", { data: { companyId: id } }); expect((await weak.json()).assessment.score).toBe(32);
  await page.reload(); await expect(metrics.getByRole("link", { name: /^Qualified Leads/ }).locator("p").nth(1)).toHaveText("0");
  await fault(page, { invalidAI: true });
  expect((await page.request.post("/api/qualification/score", { data: { companyId: id } })).status()).toBe(502);
  expect((await memory(page)).tables.lead_scores).toHaveLength(2);
});

test("switching company clears contact information from the previous company", async ({ page }) => {
  await login(page); const firstId = await seedCompany(page);
  const second = await page.request.post("/api/companies", { data: { name: "[E2E TEST] Second Company", website: "https://second.example.com" } });
  await expect(second).toBeOK();
  await page.goto("/qualification");
  await page.getByRole("combobox", { name: "Company", exact: true }).selectOption(firstId);
  await page.getByLabel("Full name", { exact: true }).fill("[E2E TEST] First Company Person");
  await page.getByLabel("Source URL", { exact: true }).fill("https://example.com/team");
  await page.getByRole("combobox", { name: "Company", exact: true }).selectOption((await second.json()).company.id);
  await expect(page.getByLabel("Full name", { exact: true })).toHaveValue("");
  await expect(page.getByLabel("Source URL", { exact: true })).toHaveValue("");
});

test("invalid confirmation links show actionable authentication feedback", async ({ page }) => {
  await page.goto("/auth/confirm");
  await expect(page).toHaveURL(/error=confirmation_failed/);
  await expect(page.getByRole("main").getByRole("alert")).toContainText("confirmation");
});

test("LinkedIn and email generation, persistence, editing, rejection, approval, manual tracking, follow-up rules", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await login(page); const companyId = await seedCompany(page);
  await expect(await page.request.post("/api/qualification/contacts", { data: { companyId, fullName: "[E2E TEST] Test Person", jobTitle: "Operations Director", sourceUrl: "https://example.com/team", linkedinUrl: "" } })).toBeOK();
  await page.goto("/outreach");
  await page.getByLabel("Contact (optional)").selectOption({ label: "[E2E TEST] Test Person — Operations Director" });
  await page.getByRole("button", { name: "Generate draft with Scout" }).click();
  const body = page.getByRole("textbox", { name: "Message", exact: true }); await expect(body).toBeVisible();
  expect((await body.inputValue()).length).toBeLessThanOrEqual(280);
  const first = (await memory(page)).tables.outreach_drafts[0]; expect(first.status).toBe("draft");
  expect(first.generation_context.personalization_facts.length).toBeGreaterThan(0);
  await page.reload(); await (await draftButton(page, "linkedin")).click();
  await body.fill("[E2E TEST] Edited LinkedIn message.");
  await page.getByRole("button", { name: "Save edits", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("updated successfully");
  await page.reload(); await (await draftButton(page, "linkedin")).click(); await expect(body).toHaveValue("[E2E TEST] Edited LinkedIn message.");
  await page.getByRole("button", { name: "Submit for review" }).click();
  await page.getByRole("button", { name: "Reject", exact: true }).click();
  await page.getByRole("button", { name: "Revise rejected draft" }).click();
  await page.getByRole("button", { name: "Submit for review" }).click();
  await page.getByRole("button", { name: "Approve", exact: true }).click(); await expect(body).toBeDisabled();
  await page.getByRole("button", { name: "Copy approved message" }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain("Edited LinkedIn");
  page.once("dialog", dialog => dialog.dismiss()); await page.getByRole("button", { name: "Mark manually sent" }).click();
  expect((await memory(page)).tables.outreach_drafts[0].status).toBe("approved");
  page.once("dialog", dialog => dialog.accept()); await page.getByRole("button", { name: "Mark manually sent" }).click();
  await expect(page.getByRole("status")).toContainText("No message was transmitted");
  await page.getByRole("combobox", { name: "Channel", exact: true }).selectOption("email");
  await page.getByRole("combobox", { name: "Type", exact: true }).selectOption("follow_up");
  await page.getByRole("button", { name: "Generate draft with Scout" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("previous message");
  await page.getByRole("combobox", { name: "Type", exact: true }).selectOption("initial");
  await page.getByRole("button", { name: "Generate draft with Scout" }).click();
  await expect(page.getByLabel("Subject", { exact: true })).toHaveValue("A website conversation");
  await page.getByLabel("Subject", { exact: true }).fill("[E2E TEST] Edited subject");
  await body.fill("[E2E TEST] Edited email body."); await page.getByRole("button", { name: "Save edits", exact: true }).click();
  await page.reload(); await (await draftButton(page, "email")).click();
  await expect(page.getByLabel("Subject", { exact: true })).toHaveValue("[E2E TEST] Edited subject");
  await expect(body).toHaveValue("[E2E TEST] Edited email body.");
  await page.getByRole("combobox", { name: "Channel", exact: true }).selectOption("linkedin");
  await page.getByLabel("Contact (optional)").selectOption({ label: "[E2E TEST] Test Person — Operations Director" });
  await page.getByRole("combobox", { name: "Type", exact: true }).selectOption("follow_up");
  await page.getByRole("button", { name: "Generate draft with Scout" }).click();
  await expect(page.getByRole("status")).toContainText("Scout saved a new draft");
});

test("clicking the current draft preserves unsaved work", async ({ page }) => {
  await login(page); await seedCompany(page); await page.goto("/outreach");
  await page.getByRole("button", { name: "Generate draft with Scout" }).click();
  const body = page.getByRole("textbox", { name: "Message", exact: true });
  await expect(body).toBeVisible(); await body.fill("[E2E TEST] Unsaved edit must survive selection.");
  await (await draftButton(page, "linkedin")).click();
  await expect(body).toHaveValue("[E2E TEST] Unsaved edit must survive selection.");
});

test("empty/invalid login fields, invalid credentials, and synthetic registration feedback", async ({ page }) => {
  await page.goto("/login"); await page.getByRole("button", { name: "Sign In", exact: true }).click();
  expect((await memory(page)).requests.filter((r: { path: string }) => r.path.includes("/auth/v1/token"))).toHaveLength(0);
  await page.getByLabel("Email", { exact: true }).fill("bad-email");
  await page.getByLabel("Password", { exact: true }).fill("short");
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  expect((await memory(page)).requests.filter((r: { path: string }) => r.path.includes("/auth/v1/token"))).toHaveLength(0);
  await page.getByLabel("Email", { exact: true }).fill("e2e-a@example.test");
  await page.getByLabel("Password", { exact: true }).fill("wrong-password");
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Invalid login credentials");
  await expect(page.getByRole("button", { name: "Sign In", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Create a new account" }).click();
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Create Account", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Check your email");
});

test("discovery empty results, rate limits, provider failure, and dashboard database errors recover", async ({ page }) => {
  await login(page); await page.goto("/discover");
  await fault(page, { emptySearch: true }); await page.getByRole("button", { name: "Search companies", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("No results returned");
  await fault(page, { emptySearch: false, rateLimit: true }); await page.getByRole("button", { name: "Search companies", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("limit");
  await fault(page, { rateLimit: false, tavily: true }); await page.getByRole("button", { name: "Search companies", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("provider unavailable");
  await expect(page.getByRole("button", { name: "Search companies", exact: true })).toBeEnabled();
  await fault(page, { tavily: false }); await page.getByRole("button", { name: "Search companies", exact: true }).click();
  await expect(page.getByRole("button", { name: "Use as candidate" })).toBeVisible();
  await fault(page, { database: "contacts" }); await page.goto("/");
  await expect(page.getByRole("status")).toContainText("could not be loaded");
  await expect(page.getByRole("region", { name: "Prospecting metrics" }).getByRole("link", { name: /^Contacts/ })).toContainText("—");
  await fault(page, { database: false }); await page.reload();
  await expect(page.getByRole("region", { name: "Prospecting metrics" }).getByRole("link", { name: /^Contacts/ })).toContainText("0");
});

test("canceling generation or selecting another draft preserves unsaved edits", async ({ page }) => {
  await login(page); await seedCompany(page); await page.goto("/outreach");
  const generate = page.getByRole("button", { name: "Generate draft with Scout" });
  await generate.click(); await expect(page.getByRole("textbox", { name: "Message", exact: true })).toBeVisible();
  await generate.click();
  const body = page.getByRole("textbox", { name: "Message", exact: true }); await body.fill("[E2E TEST] Keep my work.");
  const draftCount = (await memory(page)).tables.outreach_drafts.length;
  page.once("dialog", d => d.dismiss()); await generate.click();
  expect((await memory(page)).tables.outreach_drafts).toHaveLength(draftCount);
  await expect(body).toHaveValue("[E2E TEST] Keep my work.");
  page.once("dialog", d => d.dismiss()); await page.getByRole("button", { name: /Sample Companylinkedin/ }).nth(1).click();
  await expect(body).toHaveValue("[E2E TEST] Keep my work.");
});

test("confirmation redirects preserve the incoming browser host", async ({ request }) => {
  const response = await request.get("/auth/confirm", { maxRedirects: 0 });
  expect(response.headers().location).toBe("http://127.0.0.1:3000/login?error=confirmation_failed");
});

test("successful synthetic email confirmation establishes a session on the original host", async ({ page }) => {
  await page.goto("/auth/confirm?token_hash=synthetic-confirmation&type=email");
  await expect(page).toHaveURL("http://127.0.0.1:3000/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("possibility");
  await page.reload(); await expect(page.getByRole("heading", { level: 1 })).toContainText("possibility");
});

test("pending searches and profile saves disable duplicate submissions and recover", async ({ page }) => {
  await login(page); await page.goto("/discover");
  let releaseSearch: (() => void) | undefined;
  await page.route("**/api/discover/search", async route => { await new Promise<void>(resolve => { releaseSearch = resolve; }); await route.continue(); });
  await page.getByRole("button", { name: "Search companies", exact: true }).click();
  const searching = page.getByRole("button", { name: "Searching...", exact: true });
  await expect(searching).toBeDisabled(); await searching.evaluate(el => (el as HTMLButtonElement).click());
  await expect(page.getByRole("status")).toContainText("Searching company sources");
  await expect.poll(() => typeof releaseSearch).toBe("function"); releaseSearch!();
  await expect(page.getByRole("button", { name: "Use as candidate" })).toBeVisible();
  expect((await memory(page)).requests.filter((r: { path: string }) => r.path === "/tavily/search")).toHaveLength(1);
  await page.goto("/profile"); await page.getByLabel("Display name", { exact: true }).fill("[E2E TEST] Pending save");
  let releaseSave: (() => void) | undefined;
  await page.route("**/api/profile", async route => { await new Promise<void>(resolve => { releaseSave = resolve; }); await route.continue(); });
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(page.getByRole("button", { name: "Saving...", exact: true })).toBeDisabled();
  await expect(page.getByLabel("Display name", { exact: true })).toBeDisabled();
  await expect.poll(() => typeof releaseSave).toBe("function"); releaseSave!();
  await expect(page.getByRole("status")).toContainText("Profile saved");
  await expect(page.getByLabel("Display name", { exact: true })).toBeEnabled();
  expect((await memory(page)).tables.profiles).toHaveLength(1);
});

test("unknown routes render a real not-found page", async ({ page }) => {
  const response = await page.goto("/e2e-route-that-does-not-exist");
  expect(response?.status()).toBe(404); await expect(page.getByText("This page could not be found.")).toBeVisible();
});

test("dashboard metrics reflect saved, scored, reviewed, approved, and manually sent records", async ({ page }) => {
  await login(page);
  const metrics = page.getByRole("region", { name: "Prospecting metrics" });
  const value = (label: string) => metrics.getByRole("link", { name: new RegExp(`^${label}`) }).locator("p").nth(1);
  for (const label of ["Companies", "Contacts", "Qualified Leads", "Outreach Drafts"]) await expect(value(label)).toHaveText("0");
  const id = await seedCompany(page);
  await expect(await page.request.post("/api/qualification/contacts", { data: { companyId: id, fullName: "[E2E TEST] Person", jobTitle: "Director", sourceUrl: "https://example.com/team", linkedinUrl: "" } })).toBeOK();
  await expect(await page.request.post("/api/qualification/score", { data: { companyId: id } })).toBeOK();
  const draft = (await (await page.request.post("/api/outreach/generate", { data: { companyId: id, contactId: null, channel: "email", messageType: "initial", angle: "" } })).json()).draft;
  await page.reload();
  for (const label of ["Companies", "Contacts", "Qualified Leads", "Outreach Drafts"]) await expect(value(label)).toHaveText("1");
  const url = `/api/outreach/drafts/${draft.id}`;
  await expect(await page.request.patch(url, { data: { action: "submit", revision: 1 } })).toBeOK(); await page.reload(); await expect(value("Outreach Drafts")).toHaveText("1");
  await expect(await page.request.patch(url, { data: { action: "approve", revision: 2 } })).toBeOK(); await page.reload(); await expect(value("Outreach Drafts")).toHaveText("0");
  await expect(await page.request.patch(url, { data: { action: "sent", revision: 3, confirmedManualSend: true } })).toBeOK(); await page.reload(); await expect(value("Outreach Drafts")).toHaveText("0");
  const rows = await memory(page); expect(rows.tables.companies).toHaveLength(1); expect(rows.tables.contacts).toHaveLength(1); expect(rows.tables.lead_scores[0].score).toBe(78);
});

test("complete discovery UI saves evidence once, survives reloads, and shows duplicates and weak-fit results", async ({ page }) => {
  await login(page); await page.request.post("/api/profile", { data: profile });
  await page.goto("/discover");
  await page.getByRole("button", { name: "Search companies", exact: true }).click();
  await page.getByRole("button", { name: "Use as candidate" }).click();
  await page.getByRole("button", { name: "Research this company" }).click();
  await expect(page.getByRole("link", { name: "[E2E TEST] Sample Company", exact: true })).toHaveAttribute("href", "https://example.com/services");
  await page.getByRole("button", { name: "Save company and evidence" }).click();
  await expect(page.getByRole("button", { name: "Saved", exact: true })).toBeDisabled();
  const saved = await memory(page); expect(saved.tables.companies).toHaveLength(1); expect(saved.tables.research_sources).toHaveLength(1);
  const id = saved.tables.companies[0].id;
  await page.getByRole("button", { name: "Research this company" }).click();
  await page.getByRole("button", { name: "Save company and evidence" }).click();
  await expect(page.getByText("Previously saved company", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Already saved", exact: true })).toBeDisabled();
  expect((await memory(page)).tables.companies).toHaveLength(1);
  await page.goto("/qualification"); await page.reload();
  await expect(page.getByRole("combobox", { name: "Company", exact: true })).toHaveValue(id);
  await fault(page, { weakScore: true }); await page.getByRole("button", { name: "Score company with Scout" }).click();
  await expect(page.getByText("Below qualification threshold", { exact: true })).toBeVisible();
  await expect(page.getByRole("meter", { name: "Lead score" })).toHaveAttribute("value", "32");
  await fault(page, { invalidAI: true }); await page.getByRole("button", { name: "Score company with Scout" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Unable to score company");
  await expect(page.getByRole("button", { name: "Score company with Scout" })).toBeEnabled();
});
