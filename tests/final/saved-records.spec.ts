import { test, expect, type Page, type APIRequestContext } from "@playwright/test";
import fs from "node:fs";
import { randomUUID } from "node:crypto";

const services = "http://127.0.0.1:54329";
const artifacts = process.env.FINAL_REVIEW_ARTIFACT_DIR || "artifacts/final";
const routes = ["companies", "contacts", "leads", "drafts"];
async function login(page: Page, email = "e2e-a@example.test") {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill("E2E-password-123");
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page).toHaveURL("http://127.0.0.1:3000/");
}
async function seed(request: APIRequestContext, count = 25) {
  const response = await request.post(`${services}/auth/v1/token`, { data: { email: "e2e-a@example.test", password: "E2E-password-123" } });
  const { access_token } = await response.json();
  async function insert(table: string, rows: object[]) {
    const result = await request.post(`${services}/rest/v1/${table}`, { headers: { authorization: `Bearer ${access_token}` }, data: rows });
    expect(result.ok()).toBe(true);
  }
  const companies = Array.from({ length: count }, (_, i) => ({ id: randomUUID(), name: `Company ${String(i).padStart(3, "0")}`, website: `https://example.com/${i}`, industry: "Consulting", location: "Texas", status: "new", research_summary: `Saved research ${i}`, created_at: new Date(Date.UTC(2026, 0, 1, 0, 0, i)).toISOString() }));
  await insert("companies", companies);
  await insert("contacts", [{ id: randomUUID(), company_id: companies[0].id, full_name: "Test Candidate", job_title: "Director", verification_source: "https://example.com/team", notes: "User-submitted candidate", linkedin_url: "javascript:alert(1)" }]);
  await insert("research_sources", [{ id: randomUUID(), company_id: companies[0].id, source_url: "https://example.com/source", finding: "Saved supporting evidence" }]);
  await insert("lead_scores", [
    { id: randomUUID(), company_id: companies[0].id, score: 88, reasoning: "Older strong fit", created_at: "2026-01-01T00:00:00Z" },
    { id: randomUUID(), company_id: companies[0].id, score: 32, reasoning: "New weak fit", created_at: "2026-02-01T00:00:00Z" },
    { id: randomUUID(), company_id: companies[1].id, score: 70, reasoning: "Current qualified assessment", confidence: "medium", evidence: [{ url: "https://example.com/evidence", finding: "Saved lead evidence" }], created_at: "2026-02-01T00:00:00Z" },
  ]);
  await insert("outreach_drafts", ["draft", "in_review", "approved", "rejected", "manually_sent"].map((status, i) => ({ id: randomUUID(), company_id: companies[0].id, contact_id: null, channel: i % 2 ? "linkedin" : "email", message_type: "initial", subject: `Message ${status}`, body: `Saved complete message ${status}`, status })));
  return companies;
}

test.beforeEach(async ({ request, page }) => {
  await request.post(`${services}/__test/reset`);
  await page.route("**/*", route => ["127.0.0.1", "localhost"].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort());
});

test("saved-record routes remain protected and empty lists have useful actions", async ({ page }) => {
  for (const route of routes) { await page.goto(`/${route}`); await expect(page).toHaveURL(/\/login$/); }
  await login(page);
  for (const route of routes) {
    await page.goto(`/${route}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByText("0 records", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Next page" })).toBeDisabled();
  }
});

test("companies load beyond the first server batch, search all records, paginate and open the selected company", async ({ page, request }) => {
  const companies = await seed(request, 520);
  await login(page);
  await page.locator('main a[href="/companies"]').click();
  await expect(page).toHaveURL(/\/companies$/);
  await expect(page.getByText("1–20 of 520 records", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Next page" }).click();
  await expect(page.getByText("Page 2 of 26")).toBeVisible();
  await page.getByRole("searchbox", { name: "Search records" }).fill("Company 000");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page.locator("article")).toHaveCount(1);
  await page.getByText("View full record", { exact: true }).click();
  await expect(page.getByText("Saved supporting evidence")).toBeVisible();
  await expect(page.getByRole("link", { name: "Supporting source" })).toHaveAttribute("href", "https://example.com/source");
  await page.getByRole("link", { name: "Open lead research", exact: true }).click();
  await expect(page.getByLabel("Company", { exact: true })).toHaveValue(companies[0].id);
  await page.goto("/companies");
  await expect(page.getByText("1–20 of 520 records", { exact: true })).toBeVisible();
});

test("contacts, latest qualified scores, all draft statuses, filters and full message details", async ({ page, request }) => {
  await seed(request); await login(page);
  await page.goto("/contacts");
  await expect(page.getByRole("heading", { name: "Test Candidate", exact: true })).toBeVisible();
  await expect(page.getByText("Contact candidate", { exact: true })).toBeVisible();
  await page.getByText("View full record", { exact: true }).click();
  await expect(page.getByRole("link", { name: "Review contact source" })).toHaveAttribute("href", "https://example.com/team");
  await expect(page.locator('a[href^="javascript:"]')).toHaveCount(0);
  await page.goto("/leads");
  await expect(page.locator("article")).toHaveCount(1);
  await expect(page.locator("article").getByRole("heading", { level: 2 })).toHaveText("Company 001");
  await page.getByText("View full record", { exact: true }).click();
  await expect(page.getByText("Saved lead evidence")).toBeVisible();
  await page.goto("/drafts");
  await expect(page.locator("article")).toHaveCount(5);
  await page.getByLabel("Status", { exact: true }).selectOption("approved");
  await expect(page.locator("article")).toHaveCount(1);
  await page.getByText("View full record", { exact: true }).click();
  await expect(page.locator("details").getByText("Saved complete message approved", { exact: true })).toBeVisible();
  await page.getByLabel("Channel", { exact: true }).selectOption("linkedin");
  await expect(page.getByText("No matching records", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(page.locator("article")).toHaveCount(5);
  await page.reload(); await expect(page.locator("article")).toHaveCount(5);
});

test("foreign records remain hidden and database errors are not empty successes", async ({ page, request }) => {
  await seed(request); await login(page, "e2e-b@example.test");
  for (const route of routes) { await page.goto(`/${route}`); await expect(page.getByText("0 records", { exact: true })).toBeVisible(); }
  await request.post(`${services}/__test/faults`, { data: { database: "companies" } });
  await page.goto("/companies");
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Unable to load saved records");
  await expect(page.getByText("0 records", { exact: true })).toHaveCount(0);
  await request.post(`${services}/__test/faults`, { data: { database: false } });
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(page.getByText("0 records", { exact: true })).toBeVisible();
});

for (const width of [375, 768, 1024, 1440]) {
  test(`saved lists and navigation fit ${width}px`, async ({ page, request }) => {
    await seed(request); await page.setViewportSize({ width, height: 900 }); await login(page);
    const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
    fs.mkdirSync(`${artifacts}/screenshots`, { recursive: true });
    for (const route of routes) {
      await page.goto(`/${route}`); await expect(page.locator("article").first()).toBeVisible();
      await page.getByText("View full record", { exact: true }).first().click();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.addStyleTag({ content: "nextjs-portal {display:none !important}" });
      await page.screenshot({ path: `${artifacts}/screenshots/saved-${route}-${width}.png`, fullPage: true });
    }
    if (width < 1024) {
      await page.getByRole("button", { name: "Open navigation" }).click();
      await page.getByRole("dialog").getByRole("link", { name: "Saved Companies", exact: true }).click();
      await expect(page).toHaveURL(/\/companies$/); await expect(page.getByRole("dialog")).not.toBeVisible();
    } else await expect(page.getByRole("link", { name: "Saved Drafts", exact: true })).toBeInViewport();
    expect(errors).toEqual([]);
  });
}
