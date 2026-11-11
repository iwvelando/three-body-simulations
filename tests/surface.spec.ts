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
const outcome = (page: Page) => page.getByTestId("surface-outcome");
const meters = async (page: Page, id: string) =>
  Number((await page.getByTestId(id).innerText()).replace(/[^\d.]/g, ""));

test("the planet view zooms in to its own surface", async ({ page }) => {
  const problems = await open(page, "#/earth");
  await page.getByRole("link", { name: "Zoom in to this surface" }).click();
  await expect(page).toHaveURL(/#\/earth\/surface/);
  await expect(
    page.getByRole("heading", { level: 1, name: "The surface up close" }),
  ).toBeVisible();
  // The default planet is the dry, lifeless one: no rain, nothing growing.
  await expect(
    page.getByRole("radio", { name: "A crater's fate" }),
  ).toBeChecked();
  await expect(page.getByRole("slider", { name: "Rain" })).toHaveValue("0");
  await expect(
    page.getByRole("slider", { name: "Vegetation cover" }),
  ).toHaveValue("0");
  await expect(outcome(page)).toContainText(/crater/i);
  expect(problems).toEqual([]);
  expect(await page.evaluate(() => (window as any).__csp)).toEqual([]);
});

test("of three mountains the bare one is worn down first", async ({ page }) => {
  await open(page, "#/earth/surface");
  await page.getByRole("radio", { name: "Three mountains" }).check();
  await expect(outcome(page)).toContainText(/bare mountain/i);
  const covered = await meters(page, "peak-covered");
  const bare = await meters(page, "peak-bare");
  expect(covered).toBeGreaterThan(1200);
  expect(bare).toBeLessThan(0.7 * covered);
  // Stripping the cover from all three evens them out.
  await slide(page.getByRole("slider", { name: "Vegetation cover" }), 0);
  await expect
    .poll(async () =>
      Math.abs(
        (await meters(page, "peak-covered")) -
          (await meters(page, "peak-bare")),
      ),
    )
    .toBeLessThan(120);
});

test("the surface timeline scrubs back to the start", async ({ page }) => {
  await open(page, "#/earth/surface");
  await page.getByRole("radio", { name: "Three mountains" }).check();
  await expect(outcome(page)).toContainText(/bare mountain/i);
  const time = page.getByRole("slider", { name: "Time elapsed" });
  await slide(time, 0);
  await expect(page.getByTestId("surface-when")).toContainText(/start/i);
  expect(await meters(page, "peak-bare")).toBeGreaterThan(1400);
  await page.getByRole("button", { name: "Play" }).click();
  await expect
    .poll(async () => Number(await time.inputValue()))
    .toBeGreaterThan(2);
});

test("the surface page fits a phone and works without WebGL", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const real = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      kind: string,
      ...rest: unknown[]
    ) {
      if (kind.startsWith("webgl")) return null;
      return (real as any).call(this, kind, ...rest);
    } as any;
  });
  await open(page, "#/earth/surface");
  await expect(outcome(page)).toBeVisible();
  await expect(page.getByTestId("terrain-fallback")).toBeVisible();
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
});

test("a damaged surface link falls back to the defaults", async ({ page }) => {
  await open(page, "#/earth/surface?scene=moon&rain=99&cover=abc");
  await expect(
    page.getByRole("radio", { name: "A crater's fate" }),
  ).toBeChecked();
  await expect(outcome(page)).toBeVisible();
});

test("the land sits beside its settings on a wide screen and above them on a phone", async ({
  page,
}, info) => {
  await open(page, "#/earth/surface");
  await expect(outcome(page)).toBeVisible();
  const box = async (q: string) => (await page.locator(q).boundingBox())!;
  const stage = await box(".surface-grid .stage");
  const panel = await box(".surface-grid .panel");
  const width = page.viewportSize()!.width;
  if (info.project.name === "chromium") {
    expect(stage.x + stage.width).toBeLessThanOrEqual(panel.x);
    expect(Math.abs(stage.y - panel.y)).toBeLessThan(2);
    expect(stage.width).toBeGreaterThan(2 * panel.width);
  } else {
    expect(stage.width).toBeGreaterThan(0.85 * width);
    expect(panel.width).toBeGreaterThan(0.85 * width);
    expect(panel.y).toBeGreaterThan(stage.y + stage.height - 1);
  }
});

test("playback moves the land continuously, not frame by frame", async ({
  page,
}) => {
  await open(page, "#/earth/surface");
  await page.getByRole("radio", { name: "Three mountains" }).check();
  await expect(outcome(page)).toContainText(/bare mountain/i);
  await slide(page.getByRole("slider", { name: "Time elapsed" }), 0);
  // Count the distinct summit heights shown while sixteen stored moments
  // go by. Stepping would show seventeen at most; blending shows several
  // for each, even on a machine too busy to draw every frame.
  await page.evaluate(() => {
    const seen = new Set<string>();
    (window as any).__seen = seen;
    const read = () => {
      const el = document.querySelector('[data-testid="peak-bare"]');
      if (el) seen.add(el.textContent ?? "");
      requestAnimationFrame(read);
    };
    read();
  });
  await page.getByRole("button", { name: "Play" }).click();
  await expect
    .poll(
      async () =>
        Number(
          await page.getByRole("slider", { name: "Time elapsed" }).inputValue(),
        ),
      { timeout: 15_000 },
    )
    .toBeGreaterThanOrEqual(16);
  expect(
    await page.evaluate(() => (window as any).__seen.size),
  ).toBeGreaterThan(24);
});

test("dragging a setting does not queue a run for every position", async ({
  page,
}) => {
  await page.addInitScript(() => {
    (window as any).__runs = 0;
    const post = Worker.prototype.postMessage;
    Worker.prototype.postMessage = function (message: any, ...rest: any[]) {
      if (message?.request?.action === "terrain") (window as any).__runs++;
      return (post as any).call(this, message, ...rest);
    };
  });
  await open(page, "#/earth/surface?scene=crater&rain=1&duration=20");
  await expect(outcome(page)).toBeVisible();
  const before = await page.evaluate(() => (window as any).__runs);
  // Twelve positions in quick succession, each a run of a second or more.
  for (let k = 1; k <= 12; k++) {
    await slide(page.getByRole("slider", { name: "Rain" }), 0.5 + k * 0.1);
    await page.waitForTimeout(300);
  }
  await expect(page.getByRole("slider", { name: "Rain" })).toHaveValue("1.7");
  await expect(page.locator(".surface-grid .stage")).toHaveAttribute(
    "aria-busy",
    "false",
    { timeout: 20_000 },
  );
  const runs = (await page.evaluate(() => (window as any).__runs)) - before;
  expect(runs).toBeGreaterThanOrEqual(1);
  expect(runs).toBeLessThanOrEqual(5);
  // And the land shown is for the last position, not an earlier one.
  await expect(page.getByTestId("surface-outcome")).toHaveAttribute(
    "data-rain",
    "1.7",
  );
});

test("the elapsed time keeps its width while playing", async ({ page }) => {
  await open(page, "#/earth/surface");
  await page.getByRole("radio", { name: "Three mountains" }).check();
  await expect(outcome(page)).toContainText(/bare mountain/i);
  await slide(page.getByRole("slider", { name: "Time elapsed" }), 1);
  await page.evaluate(() => {
    const seen = new Set<number>();
    (window as any).__lengths = seen;
    const read = () => {
      const el = document.querySelector('[data-testid="surface-when"]');
      if (el) seen.add((el.textContent ?? "").length);
      requestAnimationFrame(read);
    };
    read();
  });
  await page.getByRole("button", { name: "Play" }).click();
  await expect
    .poll(
      async () =>
        Number(
          await page.getByRole("slider", { name: "Time elapsed" }).inputValue(),
        ),
      { timeout: 15_000 },
    )
    .toBeGreaterThanOrEqual(12);
  expect(
    await page.evaluate(() => [...(window as any).__lengths]),
  ).toHaveLength(1);
});
