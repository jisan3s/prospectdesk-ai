import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/final",
  workers: 1,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  use: { baseURL: "http://127.0.0.1:3000", ...devices["Desktop Chrome"], trace: "retain-on-failure", screenshot: "only-on-failure" },
  outputDir: "artifacts/final/playwright",
  reporter: [["list"], ["json", { outputFile: "artifacts/final/playwright-results.json" }]],
});
