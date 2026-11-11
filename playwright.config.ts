import { defineConfig, devices } from "@playwright/test";

// BASE_URL points the tests at a deployed site instead of a local preview build
// (CI's post-deploy `smoke` job runs the @smoke tests that way).
const remote = process.env.BASE_URL;

export default defineConfig({
  testDir: "tests",
  fullyParallel: true,
  use: {
    baseURL: remote ?? "http://127.0.0.1:4197",
    trace: "retain-on-failure",
  },
  webServer: remote
    ? undefined
    : {
        command: "npx vite preview --host 127.0.0.1 --port 4197 --strictPort",
        port: 4197,
        reuseExistingServer: false,
      },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    {
      name: "phone",
      use: { ...devices["iPhone 15"], defaultBrowserType: "chromium" },
    },
    { name: "webkit", use: { ...devices["iPhone 15"] } },
  ],
});
