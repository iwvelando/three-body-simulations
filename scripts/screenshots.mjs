// Captures the pages for visual review: node scripts/screenshots.mjs <dir>
// A third argument, "flat", captures only the newest simulation's pages.
// Serves the built site itself on port 4198 and closes it when done.
import { chromium, devices } from "@playwright/test";
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";

const out = process.argv[2] ?? "work/screenshots";
const only = process.argv[3];
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
      await shot("home-warning");
      await page.getByRole("button", { name: /show the simulations/i }).click();
      await shot("home");
      for (const [name, hash, wait] of [
        ["flat-sun", "#/flat", "verdict"],
        ["flat-sun-touch", "#/flat?body=sun", "verdict"],
        ["flat-jupiter", "#/flat?body=jupiter", "verdict"],
        ["flat-saturn", "#/flat?body=saturn", "verdict"],
        ["flat-earth", "#/flat?body=earth", "verdict"],
        ["flat-mars", "#/flat?body=mars", "verdict"],
        [
          "flat-earth-snow",
          "#/flat?body=earth&c=eyJ2IjoxLCJiIjoic25vdyJ9",
          "snow",
        ],
        [
          "flat-neptune-spread",
          "#/flat?body=neptune&c=eyJ2IjoxLCJtIjp7ImxhbmRpbmciOiJzcHJlYWQifX0",
          "verdict",
        ],
        ["flat-painting", "#/flat/painting", "size"],
        [
          "flat-painting-face-down",
          "#/flat/painting?c=eyJ2IjoxLCJtIjp7ImVudHJ5IjoiZmxhdCJ9fQ",
          "size",
        ],
        ["flat-sky", "#/flat/sky", "verdict"],
        [
          "flat-sky-starry",
          "#/flat/sky?c=eyJ2IjoxLCJiIjoic3RhcnJ5In0",
          "verdict",
        ],
      ]) {
        await page.goto(base + hash);
        await page.getByTestId(wait).waitFor();
        if (name === "flat-earth-snow") await slide(page, "Time", 1.05);
        if (name === "flat-sun-touch") await slide(page, "Time", 0);
        if (/saturn|mars/.test(name)) await slide(page, "Time", 0.05);
        if (/jupiter|flat-earth$/.test(name)) await slide(page, "Time", 0.7);
        if (name === "flat-painting") {
          await page.getByRole("button", { name: "Restore it" }).click();
          await page.getByTestId("score").waitFor();
          await page.getByRole("button", { name: "Let it fall" }).click();
          await page.waitForTimeout(6500);
        }
        await page.waitForTimeout(700);
        await shot(name);
      }
      await page.goto(base + "#/flat/science");
      await page.getByRole("heading", { level: 1 }).waitFor();
      await shot("flat-science");
      if (only === "flat") {
        await context.close();
        continue;
      }
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
      for (const [name, hash, at] of [
        ["diaz-spiral", "#/diaz?look=inner", null],
        ["diaz-whole", "#/diaz", null],
        ["diaz-dive", "#/diaz?look=sun", 1.97],
        ["diaz-jupiter", "#/diaz", 6.5],
        ["diaz-jet", "#/diaz?look=inner&c=eyJ2IjoxLCJiIjoiZ3JhbnRlZCJ9", 2.5],
        ["diaz-published", "#/diaz?c=eyJ2IjoxLCJiIjoicHVibGlzaGVkIn0", null],
      ]) {
        await page.goto(base + hash);
        // The same page at another address is not a navigation.
        await page.reload();
        await page.getByTestId("verdict").waitFor();
        if (at !== null) await slide(page, "Time", at);
        await page.waitForTimeout(700);
        await shot(name);
      }
      await page.goto(base + "#/diaz/science");
      await page.getByRole("heading", { level: 1 }).waitFor();
      await shot("diaz-science");
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
