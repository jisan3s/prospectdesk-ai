import { test, expect } from "@playwright/test";
import fs from "node:fs";

const artifacts = process.env.FINAL_REVIEW_ARTIFACT_DIR || "artifacts/final";
const services = "http://127.0.0.1:54329";
for (const width of [375, 768, 1024, 1440]) {
  test(`all six real pages, long content, keyboard navigation, and layout at ${width}px`, async ({ page, request }) => {
    await expect(await request.post(`${services}/__test/reset`)).toBeOK();
    await page.setViewportSize({ width, height: 1000 });
    const errors: string[] = [];
    page.on("pageerror", e => errors.push(e.message));
    page.on("console", m => { if (m.type() === "error" && !m.text().startsWith("Failed to load resource")) errors.push(m.text()); });
    await page.route("**/*", r => ["127.0.0.1", "localhost"].includes(new URL(r.request().url()).hostname) ? r.continue() : r.abort("blockedbyclient"));
    await page.goto("/login");
    await page.getByLabel("Email", { exact: true }).fill("e2e-a@example.test");
    await page.getByLabel("Password", { exact: true }).fill("E2E-password-123");
    await page.getByRole("button", { name: "Sign In", exact: true }).click();
    await expect(page).toHaveURL("http://127.0.0.1:3000/");
    await page.request.post("/api/profile", { data: { display_name: "[E2E TEST] Developer", headline: "Website consultant", linkedin_url: "", portfolio_url: "", summary: "Website development for professional service businesses.", raw_profile_text: "TypeScript experience", skills: ["TypeScript"], services: ["Website development"] } });
    await expect(await page.request.post("/api/profile/analyze")).toBeOK();
    const research = await (await page.request.post("/api/discover/research", { data: { name: "[E2E TEST] " + "LongCompany".repeat(14), website: "https://example.com", industry: "Consulting", location: "Texas" } })).json();
    const saved = await page.request.post("/api/discover/save", { data: { company: research.company, sources: research.sources, research: research.research } });
    await expect(saved).toBeOK(); const companyId = (await saved.json()).companyId;
    await expect(await page.request.post("/api/outreach/generate", { data: { companyId, contactId: null, channel: "email", messageType: "initial", angle: "" } })).toBeOK();
    fs.mkdirSync(`${artifacts}/screenshots`, { recursive: true });
    for (const route of ["/", "/profile", "/discover", "/qualification", "/outreach", "/login"]) {
      await page.goto(route); await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.getByRole("main")).toHaveCount(1);
      if (route === "/qualification") {
        await page.getByRole("button", { name: "Score company with Scout" }).click();
        await expect(page.getByRole("meter", { name: "Lead score" })).toHaveAttribute("value", "78");
      }
      if (route === "/outreach") {
        await page.getByRole("button", { name: /LongCompany.*email/ }).click();
        await expect(page.getByRole("textbox", { name: "Message", exact: true })).toBeVisible();
      }
      if (route === "/discover") {
        await page.getByRole("button", { name: "Search companies", exact: true }).click();
        await page.getByRole("button", { name: "Use as candidate" }).click();
        await page.getByRole("button", { name: "Research this company" }).click();
        await expect(page.getByText("Research complete · Review required")).toBeVisible();
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), route).toBe(true);
      const unlabelled = await page.locator("main input, main select, main textarea").evaluateAll(elements => elements.filter(el => !(el as HTMLInputElement).labels?.length && !el.getAttribute("aria-label") && !el.getAttribute("aria-labelledby")).length);
      expect(unlabelled, route).toBe(0);
      await page.addStyleTag({ content: "nextjs-portal {display:none !important}" });
      await page.screenshot({ path: `${artifacts}/screenshots/${route === "/" ? "dashboard" : route.slice(1)}-${width}.png`, fullPage: true });
    }
    await page.goto("/");
    if (width < 1024) {
      await page.getByRole("button", { name: "Open navigation" }).click();
      const dialog = page.getByRole("dialog"); await expect(dialog).toBeVisible();
      await page.keyboard.press("Tab"); expect(await dialog.evaluate(el => el.contains(document.activeElement))).toBe(true);
      await page.keyboard.press("Escape"); await expect(dialog).not.toBeVisible();
      await expect(page.getByRole("button", { name: "Open navigation" })).toBeFocused();
      await page.getByRole("button", { name: "Open navigation" }).click();
      await dialog.getByRole("link", { name: "Scout Profile", exact: true }).click();
      await expect(page).toHaveURL(/\/profile$/); await expect(dialog).not.toBeVisible();
    } else {
      await page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: "Scout Profile", exact: true }).click();
      await expect(page).toHaveURL(/\/profile$/);
      await expect(page.getByRole("link", { name: "Scout Profile", exact: true })).toHaveAttribute("aria-current", "page");
    }
    await page.emulateMedia({ reducedMotion: "reduce" });
    expect(await page.getByRole("button", { name: "Save profile", exact: true }).evaluate(el => getComputedStyle(el).transitionDuration)).toBe("0s");
    expect(errors).toEqual([]);
  });
}

test("desktop sidebar helper text has readable contrast", async ({ page, request }) => {
  await request.post(`${services}/__test/reset`);
  await page.goto("/login"); await page.getByLabel("Email", { exact: true }).fill("e2e-a@example.test");
  await page.getByLabel("Password", { exact: true }).fill("E2E-password-123");
  await page.getByRole("button", { name: "Sign In", exact: true }).click(); await expect(page).toHaveURL("http://127.0.0.1:3000/");
  const contrast = await page.locator("aside > p").last().evaluate(el => {
    const canvas = document.createElement("canvas"); canvas.width = canvas.height = 1;
    const ctx = canvas.getContext("2d")!;
    const luminance = (color: string) => {
      ctx.fillStyle = color; ctx.fillRect(0, 0, 1, 1);
      const rgb = [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3).map(v => { const n = v / 255; return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4; });
      return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
    };
    const fg = luminance(getComputedStyle(el).color), bg = luminance(getComputedStyle(el.parentElement!).backgroundColor);
    return (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05);
  });
  test.info().annotations.push({ type: "contrast-ratio", description: contrast.toFixed(2) });
  expect(contrast).toBeGreaterThanOrEqual(4.5);
});

test("mobile navigation remains open when loading content streams in", async ({ page, request }) => {
  await request.post(`${services}/__test/reset`); await page.setViewportSize({ width: 375, height: 900 });
  await page.goto("/login"); await page.getByLabel("Email", { exact: true }).fill("e2e-a@example.test");
  await page.getByLabel("Password", { exact: true }).fill("E2E-password-123");
  await page.getByRole("button", { name: "Sign In", exact: true }).click(); await expect(page).toHaveURL("http://127.0.0.1:3000/");
  await request.post(`${services}/__test/faults`, { data: { readDelay: 500 } });
  await page.goto("/"); await page.getByRole("button", { name: "Open navigation" }).click();
  const dialog = page.getByRole("dialog"); await expect(dialog).toBeVisible();
  await expect(page.locator("main h1")).toContainText("possibility");
  await expect(dialog).toBeVisible(); await page.screenshot({ path: `${artifacts}/screenshots/navigation-loading-375.png` }); await page.keyboard.press("Escape"); await expect(dialog).not.toBeVisible();
});
