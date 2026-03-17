import { defineConfig, devices } from "@playwright/test";

const useLocalServer = process.env.PLAYWRIGHT_TEST_LOCAL === "1";
const baseURL = useLocalServer
  ? "http://127.0.0.1:3000"
  : process.env.PLAYWRIGHT_BASE_URL?.trim() || "https://tutool1.vercel.app";
const localServerCommand = process.env.PLAYWRIGHT_USE_PREBUILT === "1"
  ? "env -u NODE_OPTIONS npx next start -H 127.0.0.1 -p 3000"
  : "env -u NODE_OPTIONS npx next dev -H 127.0.0.1 -p 3000";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? [["html"], ["list"]] : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: useLocalServer
    ? {
        command: localServerCommand,
        url: baseURL,
        reuseExistingServer: true,
        stdout: "pipe",
        stderr: "pipe",
      }
    : undefined,
});
