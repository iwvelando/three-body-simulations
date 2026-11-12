import { expect, test, type Locator, type Page } from "@playwright/test";

async function open(page: Page, hash: string) {
  const problems: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") problems.push(m.text());
  });
  page.on("pageerror", (e) => problems.push(String(e)));
  await page.addInitScript(() => {
    (window as any).__csp = [];
    document.addEventListener("securitypolicyviolation", (e) =>
      (window as any).__csp.push(e.violatedDirective),
    );
  });
  await page.goto("/" + hash);
  await expect(page.locator('html[data-engine="ready"]')).toBeAttached({
    timeout: 30_000,
  });
  return problems;
}
async function slide(slider: Locator, value: number) {
  await slider.evaluate((el, v) => {
    const input = el as HTMLInputElement;
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(input, String(v));
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);
}
const done = (page: Page) =>
  expect(page.getByTestId("chance-status")).toHaveAttribute(
    "data-state",
    "done",
    {
      timeout: 60_000,
    },
  );
const share = async (page: Page, id: string) =>
  Number(await page.getByTestId(id).getAttribute("data-share"));

test("the planet view leads to the question of luck", async ({ page }) => {
  const problems = await open(page, "#/earth");
  await page.getByRole("link", { name: /Was it luck/ }).click();
  await expect(page).toHaveURL(/#\/earth\/chance/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Was it luck?" }),
  ).toBeVisible();
  await done(page);
  // Tyrrell found about 9% of random planets lasting at least once in
  // 100 tries; with fewer tries here, somewhat fewer.
  const alone = await share(page, "share-chance");
  expect(alone).toBeGreaterThan(0.02);
  expect(alone).toBeLessThan(0.15);
  expect(await share(page, "share-life")).toBeGreaterThan(1.5 * alone);
  await expect(page.getByTestId("share-chance")).toContainText(/%/);
  expect(problems).toEqual([]);
  expect(await page.evaluate(() => (window as any).__csp)).toEqual([]);
});

test("life's thermostat is marked as speculation and can be turned off", async ({
  page,
}) => {
  await open(page, "#/earth/chance");
  await done(page);
  const mark = page.locator(".chance .spec").first();
  await expect(mark).toContainText(/speculative/i);
  await slide(page.getByRole("slider", { name: "Life's thermostat" }), 0);
  // The rerun starts after a short pause; wait for its own result.
  await expect(page.getByTestId("share-life")).toContainText(
    /thermostat is off/,
  );
  await done(page);
  expect(await share(page, "share-life")).toBe(
    await share(page, "share-chance"),
  );
});

test("new planets can be drawn and a run can be stopped", async ({ page }) => {
  await open(page, "#/earth/chance");
  await done(page);
  const status = page.getByTestId("chance-status");
  const seed = await status.getAttribute("data-seed");
  await page.getByRole("button", { name: "Draw new planets" }).click();
  await expect(status).not.toHaveAttribute("data-seed", seed!);
  await done(page);
  // A long run, stopped partway.
  await page.getByRole("combobox", { name: "Planets" }).selectOption("5000");
  await page
    .getByRole("combobox", { name: "Tries for each" })
    .selectOption("100");
  await expect(status).toHaveAttribute("data-state", "running");
  await page.getByRole("button", { name: "Stop" }).click();
  await expect(status).toHaveAttribute("data-state", "stopped");
  await expect(status).toContainText(/Stopped after [\d,]+ of 5,000 planets/);
  await expect(page.getByRole("button", { name: "Run again" })).toBeVisible();
});

test("the luck page fits the screen and offers its numbers as a table", async ({
  page,
}) => {
  await open(page, "#/earth/chance");
  await done(page);
  const width = page.viewportSize()!.width;
  expect(
    await page.evaluate(
      (w) =>
        [...document.querySelectorAll("body *")].every(
          (el) => el.getBoundingClientRect().right <= w + 0.5,
        ),
      width,
    ),
  ).toBe(true);
  await expect(page.getByRole("table")).toBeVisible();
  await expect(page.getByRole("rowheader", { name: "Never" })).toBeVisible();
});

test("each field shows its planets as dots", async ({ page }) => {
  await open(page, "#/earth/chance");
  await done(page);
  const inked = (index: number) =>
    page
      .locator(".field-of-dots canvas")
      .nth(index)
      .evaluate((canvas: HTMLCanvasElement) => {
        const data = canvas
          .getContext("2d")!
          .getImageData(0, 0, canvas.width, canvas.height).data;
        let filled = 0;
        for (let i = 3; i < data.length; i += 4) if (data[i] > 0) filled++;
        return filled / (data.length / 4);
      });
  // Every planet leaves a mark, an outline at least.
  expect(await inked(0)).toBeGreaterThan(0.05);
  expect(await inked(1)).toBeGreaterThan(0.05);
  // And far more of them are filled in where life steadies the climate.
  const filled = async (index: number) =>
    Number(
      await page
        .locator(".field-of-dots canvas")
        .nth(index)
        .getAttribute("data-filled"),
    );
  expect(await filled(0)).toBeGreaterThan(10);
  expect(await filled(1)).toBeGreaterThan(1.5 * (await filled(0)));
});

test("a count is set and shown in whole numbers", async ({ page }) => {
  await open(page, "#/earth/chance");
  await done(page);
  await page.getByText("More settings", { exact: true }).click();
  const points = page.getByRole("slider", { name: "Most feedback points" });
  await slide(points, 12.26);
  await expect(
    page
      .locator(".field", { hasText: "Most feedback points" })
      .locator("output"),
  ).toHaveText("12");
  expect(await points.getAttribute("step")).toBe("1");
});
