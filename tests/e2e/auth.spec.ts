import { test, expect } from "@playwright/test";

test("signed-out visitor is redirected to login", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login(?:\?|$)/);
});

test("protected outreach generator rejects signed-out requests", async ({ request }) => {
  const response = await request.post("/api/outreach/generate", {
    data: { companyId: "019abbaa-1111-7111-8111-aaaaaaaaaaaa", contactId: null, channel: "linkedin", messageType: "initial", angle: "" },
  });
  expect(response.status()).toBe(401);
});

test("company discovery rejects signed-out requests", async ({ request }) => {
  const response = await request.post("/api/discover/search", { data: { industry: "HVAC", location: "Texas" } });
  expect(response.status()).toBe(401);
});
