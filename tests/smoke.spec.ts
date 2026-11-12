import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";

// Runs locally against the preview and, with BASE_URL, against the live site
// after every deploy (CI's `smoke` job). Fast and read-only.
const live = Boolean(process.env.BASE_URL);
const CANONICAL = "https://three-body.isaacvelando.com/";

test("@smoke the engine arrives as WebAssembly and runs the Earth", async ({
  page,
  request,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() =>
    document.addEventListener("securitypolicyviolation", (e) => {
      throw new Error(`CSP violation: ${e.violatedDirective} ${e.blockedURI}`);
    }),
  );
  const wasm = await request.get("/engine.wasm", {
    headers: { "Accept-Encoding": "br, gzip" },
  });
  expect(wasm.ok()).toBe(true);
  expect(wasm.headers()["content-type"]).toBe("application/wasm");
  // CloudFront compresses the engine; `vite preview` never does.
  if (live) expect(wasm.headers()["content-encoding"]).toMatch(/^(br|gzip)$/);
  await page.goto("/#/earth");
  await expect(page.locator("html")).toHaveAttribute("data-engine", "ready", {
    timeout: 30_000,
  });
  await expect(page.getByTestId("verdict")).toContainText(
    /Lifeless Earth today/,
  );
  expect(errors).toEqual([]);
});

test("@smoke the engine runs Mozi's machine", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/#/mozi");
  await expect(page.locator("html")).toHaveAttribute("data-engine", "ready", {
    timeout: 30_000,
  });
  await expect(page.getByTestId("verdict")).toContainText(/Stable Era/);
  await expect(page.getByTestId("forecast")).toContainText(/Era/);
  expect(errors).toEqual([]);
});

test("@smoke the engine flattens the Sun", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/#/flat");
  await expect(page.locator("html")).toHaveAttribute("data-engine", "ready", {
    timeout: 30_000,
  });
  await expect(page.getByTestId("verdict")).toContainText(/flat Sun/);
  await expect(page.getByTestId("speculative")).toContainText("Speculative");
  expect(errors).toEqual([]);
});

test("@smoke the page is served under the committed content security policy", async ({
  request,
}) => {
  const page = await request.get("/");
  expect(page.headers()["content-security-policy"]).toBe(
    readFileSync("deploy/content-security-policy.txt", "utf8").trim(),
  );
});

test("@smoke robots and sitemap point search engines at the canonical page only", async ({
  request,
}) => {
  const robots = await request.get("/robots.txt");
  expect(robots.ok()).toBe(true);
  expect(robots.headers()["content-type"]).toContain("text/plain");
  expect(await robots.text()).toContain(`Sitemap: ${CANONICAL}sitemap.xml`);
  const sitemap = await request.get("/sitemap.xml");
  expect(sitemap.ok()).toBe(true);
  expect(sitemap.headers()["content-type"]).toMatch(/xml/);
  const xml = await sitemap.text();
  expect(xml).toMatch(/^<\?xml version="1.0" encoding="UTF-8"\?>/);
  // The simulations are hash views of one document: the root is the only page.
  expect([...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])).toEqual([
    CANONICAL,
  ]);
});

test("@smoke the engine drops Mercury into the Sun", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/#/diaz");
  await expect(page.locator("html")).toHaveAttribute("data-engine", "ready", {
    timeout: 30_000,
  });
  await expect(page.getByTestId("verdict")).toContainText(/reaches the Sun/);
  await expect(page.getByTestId("speculative")).toContainText("Speculative");
  expect(errors).toEqual([]);
});
