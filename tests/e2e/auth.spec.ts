import { test, expect } from "@playwright/test";

test("signed-out visitor is redirected to login", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login(?:\?|$)/);
});

const protectedMethods = [
  ["GET", "/api/companies"],
  ["POST", "/api/companies"],
  ["POST", "/api/profile"],
  ["POST", "/api/profile/analyze"],
  ["POST", "/api/discover/search"],
  ["POST", "/api/discover/research"],
  ["POST", "/api/discover/save"],
  ["POST", "/api/qualification/contacts"],
  ["POST", "/api/qualification/decision-makers"],
  ["POST", "/api/qualification/score"],
  ["POST", "/api/outreach/generate"],
  ["GET", "/api/outreach/drafts"],
  ["PATCH", "/api/outreach/drafts/019abbaa-1111-7111-8111-aaaaaaaaaaaa"],
] as const;

for (const [method, path] of protectedMethods) {
  test(`${method} ${path} rejects signed-out requests`, async ({ request }) => {
    const response = await request.fetch(path, {
      method,
      ...(method === "GET" ? {} : { data: {} }),
    });
    expect(response.status()).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
  });
}

test("login response includes application security headers", async ({ request }) => {
  const response = await request.get("/login");
  expect(response.status()).toBe(200);
  const headers = response.headers();
  expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  if (new URL(response.url()).protocol === "https:") {
    expect(headers["strict-transport-security"]).toContain("max-age=");
  }
});
