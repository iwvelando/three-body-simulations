import { defineConfig, devices } from "@playwright/test";

// BASE_URL points the tests at a deployed site instead of a local preview build
// (CI's post-deploy `smoke` job runs the @smoke tests that way).
const remote = process.env.BASE_URL;

// SOFTWARE_GL=1 makes Chromium draw WebGL on the CPU, as CI's Linux runners
// do, to reproduce their speed on a machine with a GPU.
const software = process.env.SOFTWARE_GL
  ? {
      launchOptions: {
        args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
      },
    }
  : {};

export default defineConfig({
  testDir: "tests",
  fullyParallel: true,
  // CI's runners have two cores and draw WebGL on the CPU.
  timeout: process.env.CI ? 90_000 : 30_000,
  expect: { timeout: process.env.CI ? 15_000 : 5_000 },
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
    { name: "chromium", use: { ...devices["Desktop Chrome"], ...software } },
    {
      name: "phone",
      use: {
        ...devices["iPhone 15"],
        defaultBrowserType: "chromium",
        ...software,
      },
    },
    { name: "webkit", use: { ...devices["iPhone 15"] } },
  ],
});
