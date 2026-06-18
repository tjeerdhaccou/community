import { defineConfig, devices } from "@playwright/test";

// Smoke-test config voor de community-app (buuur.nl). Dev-server op poort 5190.
// Draaien:  npm run test:e2e          (headless)
//           npm run test:e2e -- --ui  (interactief)
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:5190",
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    // Mobiel — de community-app is mobile-first; loont om te smoke-testen.
    { name: "mobile", use: { ...devices["iPhone 13"] } },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "npm run dev",
        url: "http://localhost:5190",
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
