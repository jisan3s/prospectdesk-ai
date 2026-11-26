import { test, expect } from "@playwright/test";

for (const width of [375, 768, 1024, 1440]) {
  test(`login is accessible and fits ${width}px`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Welcome back." })).toBeVisible();
    await expect(page.getByLabel("Email", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute("autocomplete", "current-password");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.getByRole("button", { name: "Create a new account" }).click();
    await expect(page.getByRole("button", { name: "Create Account", exact: true })).toBeVisible();
    await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute("autocomplete", "new-password");
    expect(errors).toEqual([]);
  });
}
for (const route of ["/profile", "/discover", "/qualification", "/outreach", "/companies", "/contacts", "/leads", "/drafts"]) {
  test(`${route} remains protected`, async ({ page }) => {
    await page.goto(route);
    await expect(page).toHaveURL(/\/login(?:\?|$)/);
  });
}
