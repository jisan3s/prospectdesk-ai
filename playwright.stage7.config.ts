import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 25_000,
  use: { baseURL: "http://localhost:3000", ...devices["Desktop Chrome"] },
  reporter: "list",
  retries: 0,
});
