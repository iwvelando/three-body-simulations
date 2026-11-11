// Captures the pages for visual review: node scripts/screenshots.mjs <dir>
// Serves the built site itself on port 4198 and closes it when done.
import { chromium, devices } from "@playwright/test";
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";

const out = process.argv[2] ?? "work/screenshots";
mkdirSync(out, { recursive: true });
const server = spawn(
  "npx",
  ["vite", "preview", "--host", "127.0.0.1", "--port", "4198", "--strictPort"],
  { stdio: "ignore" },
);
const base = "http://127.0.0.1:4198/";
try {
  for (let i = 0; i < 50; i++) {
    try {
      if ((await fetch(base)).ok) break;
    } catch {
      await new Promise((r) => setTimeout(r, 200));
    }
  }
  const browser = await chromium.launch();
  const slide = (page, name, value) =>
    page.getByRole("slider", { name }).evaluate((el, v) => {
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      ).set.call(el, String(v));
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }, value);
  for (const [device, options] of [
    ["desktop", { viewport: { width: 1360, height: 900 } }],
    ["phone", { ...devices["iPhone 15"], defaultBrowserType: undefined }],
  ])
    for (const scheme of ["light", "dark"]) {
      const context = await browser.newContext({
        ...options,
        colorScheme: scheme,
      });
      const page = await context.newPage();
      const shot = (name, full = true) =>
        page.screenshot({
          path: `${out}/${device}-${scheme}-${name}.png`,
          fullPage: full,
        });
      await page.goto(base);
      await page.waitForSelector('html[data-engine="ready"]');
      await shot("home");
      await page.goto(base + "#/earth");
      await page.getByTestId("verdict").waitFor();
      await page.waitForTimeout(600);
      await shot("earth-lifeless-today");
      for (const [name, at] of [
        ["molten", 12],
        ["early", 150],
        ["middle", 380],
      ]) {
        await slide(page, "Time", at);
        await page.waitForTimeout(300);
        await shot(`earth-lifeless-${name}`, false);
      }
      await slide(page, "Time", 480);
      const settings = page.getByRole("button", { name: "Settings" });
      if (await settings.isVisible()) await settings.click();
      await page.getByRole("checkbox", { name: "Life" }).check();
      await page.getByText("Models", { exact: true }).click();
      await page.waitForTimeout(700);
      await shot("earth-living-models");
      for (const scene of ["Three mountains", "A crater's fate"]) {
        await page.goto(base + "#/earth/surface");
        await page.getByTestId("surface-outcome").waitFor();
        await page.getByRole("radio", { name: scene }).check();
        await page.waitForTimeout(1500);
        await shot(`surface-${scene.split(" ")[0].toLowerCase()}`);
      }
      await page.goto(base + "#/mozi");
      await page.getByTestId("verdict").waitFor();
      await page.waitForTimeout(600);
      await shot("mozi-day");
      for (const [name, at] of [
        ["night", 1.6],
        ["stable", 180.4],
        ["chaotic", 420.45],
      ]) {
        await slide(page, "Time", at);
        await page.waitForTimeout(400);
        await shot(`mozi-${name}`, false);
      }
      await page.goto(base + "#/mozi/science");
      await page.getByRole("heading", { level: 1 }).waitFor();
      await shot("mozi-science");
      await page.goto(base + "#/earth/science");
      await page.getByRole("heading", { level: 1 }).waitFor();
      await shot("science");
      await context.close();
    }
  await browser.close();
} finally {
  server.kill();
}
