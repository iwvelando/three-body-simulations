import { expect, test, type Locator, type Page } from "@playwright/test";

async function open(page: Page, hash = "#/mozi") {
  const problems: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") problems.push(m.text());
  });
  page.on("pageerror", (e) => problems.push(String(e)));
  await page.goto("/" + hash);
  await expect(page.locator('html[data-engine="ready"]')).toBeAttached({
    timeout: 30_000,
  });
  return problems;
}
const verdict = (page: Page) => page.getByTestId("verdict");
const moment = (page: Page) => page.getByTestId("moment");
const machine = (page: Page) => page.getByTestId("machine");
// Playwright cannot fill a range input; set it the way a drag would.
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
// The panel is a sheet on phones; open it before using its controls.
async function panel(page: Page) {
  await expect(verdict(page)).toBeVisible();
  const toggle = page.getByRole("button", { name: "Settings" });
  if (await toggle.isVisible()) {
    if ((await toggle.getAttribute("aria-expanded")) !== "true")
      await toggle.click();
  }
}
const noWebGL = (page: Page) =>
  page.addInitScript(() => {
    const real = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      kind: string,
      ...rest: unknown[]
    ) {
      if (kind.startsWith("webgl")) return null;
      return (real as any).call(this, kind, ...rest);
    } as any;
  });

test("home lists both simulations and opens Mozi's machine", async ({
  page,
}) => {
  const problems = await open(page, "");
  await expect(
    page.getByRole("link", { name: /Earth without life/ }),
  ).toBeVisible();
  await page.getByRole("link", { name: /Mozi's machine/ }).click();
  await expect(page).toHaveURL(/#\/mozi/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Mozi's machine" }),
  ).toBeVisible();
  await expect(page).toHaveTitle(/Mozi's machine/);
  expect(problems).toEqual([]);
});

test("the default machine shows the sky, the shells, a forecast and its caveat", async ({
  page,
}) => {
  const problems = await open(page);
  await expect(verdict(page)).toContainText("11 Stable Eras");
  await expect(verdict(page)).toContainText("2,000 days");
  await expect(page.getByTestId("sky")).toBeVisible();
  await expect(page.getByTestId("sky")).toHaveAttribute(
    "aria-label",
    /sun is up/,
  );
  await expect(machine(page)).toBeVisible();
  await expect(machine(page)).toHaveAttribute(
    "data-layers",
    "fire outer light inner clerk",
  );
  // The run opens in a Chaotic Era that ends on day 166.
  await expect(moment(page)).toContainText("Chaotic Era");
  await expect(page.getByTestId("forecast")).toContainText(
    /Chaotic Era ends in 16\d days/,
  );
  await expect(page.getByTestId("forecast")).toContainText(
    /Stable Era of 47 days/,
  );
  await expect(page.getByTestId("speculative")).toContainText(/no numbers/i);
  expect(problems).toEqual([]);
});

test("perfect clockwork is one Stable Era without end", async ({ page }) => {
  await open(page);
  await panel(page);
  await page.getByRole("radio", { name: "Perfect clockwork" }).check();
  await expect(verdict(page)).toContainText(/one Stable Era/);
  await expect(moment(page)).toContainText("Stable Era");
  await expect(page.getByTestId("forecast")).toContainText(
    /end of the calendar/,
  );
});

test("each model says which objection it answers, and one sphere fails the first", async ({
  page,
}) => {
  await open(page);
  await panel(page);
  await expect(page.getByTestId("explains")).toContainText(
    /moves against the stars/,
  );
  await page.getByText("Models", { exact: true }).click();
  await page.getByLabel("Shells", { exact: true }).selectOption("one");
  await expect(page.getByTestId("explains")).toContainText(
    /never move against the stars/,
  );
  await expect(page).toHaveURL(/c=/);
  // One sphere has no second shell to show.
  await expect(machine(page)).toHaveAttribute(
    "data-layers",
    "fire outer clerk",
  );
  await expect(
    page.getByRole("checkbox", { name: "Inner shell" }),
  ).toBeDisabled();
});

test("layers of the machine can be peeled away and put back", async ({
  page,
}) => {
  await open(page);
  await expect(machine(page)).toBeVisible();
  const outer = page.getByRole("checkbox", { name: "Outer shell" });
  await expect(outer).toBeChecked();
  await outer.uncheck();
  await expect(machine(page)).toHaveAttribute(
    "data-layers",
    "fire light inner clerk",
  );
  await page.getByRole("checkbox", { name: "Sea of fire" }).uncheck();
  await expect(machine(page)).toHaveAttribute(
    "data-layers",
    "light inner clerk",
  );
  await outer.check();
  await expect(machine(page)).toHaveAttribute(
    "data-layers",
    "outer light inner clerk",
  );
});

test("scrubbing moves the moment, the sky and the forecast", async ({
  page,
}) => {
  await open(page);
  await expect(verdict(page)).toBeVisible();
  await slide(page.getByRole("slider", { name: "Time" }), 180.5);
  await expect(moment(page)).toContainText("Day 181");
  await expect(moment(page)).toContainText("Stable Era");
  await expect(page.getByTestId("forecast")).toContainText(
    /Stable Era ends in 3\d days/,
  );
  await expect(page.getByTestId("sky")).toHaveAttribute("data-day", "180.50");
});

test("the calendar lists the eras, jumps to one, and reads as a table", async ({
  page,
}) => {
  await open(page);
  await expect(verdict(page)).toBeVisible();
  const calendar = page.getByRole("region", { name: "The clerk's calendar" });
  await expect(
    calendar.getByRole("img", { name: /length of each day/i }),
  ).toBeVisible();
  await calendar.getByRole("button", { name: /Stable Era.*day 166/ }).click();
  await expect(moment(page)).toContainText(/Day 16[67]/);
  await expect(moment(page)).toContainText("Stable Era");
  await calendar.getByRole("button", { name: "Show as table" }).click();
  await expect(calendar.getByRole("table")).toBeVisible();
  await expect(calendar.getByRole("row")).toHaveCount(24);
  await expect(calendar.getByRole("row").nth(1)).toContainText("Chaotic");
});

test("play runs time forward and pause holds it", async ({ page }) => {
  await open(page);
  await expect(verdict(page)).toBeVisible();
  const day = async () =>
    Number(await page.getByTestId("sky").getAttribute("data-day"));
  const before = await day();
  await page.getByRole("button", { name: "Play" }).click();
  await expect.poll(day).toBeGreaterThan(before + 0.05);
  await page.getByRole("button", { name: "Pause" }).click();
  const held = await day();
  await page.waitForTimeout(400);
  expect(await day()).toBe(held);
});

test("a link carries the machine's settings", async ({ page }) => {
  await open(page);
  await panel(page);
  await page.getByRole("radio", { name: "Rough seas" }).check();
  await expect(page).toHaveURL(/c=/);
  await expect(verdict(page)).toContainText("2 Stable Eras");
  const url = page.url();
  await page.goto("about:blank");
  await page.goto(url);
  await expect(page.locator('html[data-engine="ready"]')).toBeAttached();
  await panel(page);
  await expect(page.getByRole("radio", { name: "Rough seas" })).toBeChecked();
  await expect(verdict(page)).toContainText("2 Stable Eras");
});

test("a damaged or out-of-range link falls back to the default with a notice", async ({
  page,
}) => {
  for (const c of [
    "not-base64!",
    btoa(JSON.stringify({ v: 1, p: { "gear.strength": 1e9 } })),
    btoa(JSON.stringify({ v: 1, m: { shells: "three" } })),
    btoa(JSON.stringify({ v: 1, l: 1 })),
  ]) {
    await page.goto("about:blank");
    await open(page, "#/mozi?c=" + encodeURIComponent(c));
    await expect(page.getByRole("status")).toContainText(/link/i);
    await expect(verdict(page)).toContainText("11 Stable Eras");
  }
});

test("nothing overflows sideways", async ({ page }) => {
  await open(page);
  await expect(verdict(page)).toBeVisible();
  const width = page.viewportSize()!.width;
  const overflow = () =>
    page.evaluate(() => document.documentElement.scrollWidth);
  expect(await overflow()).toBeLessThanOrEqual(width);
  await panel(page);
  await page.getByText("Models", { exact: true }).click();
  expect(await overflow()).toBeLessThanOrEqual(width);
});

test("without WebGL the machine is a cross-section", async ({ page }) => {
  await noWebGL(page);
  await open(page);
  await expect(page.getByTestId("machine-fallback")).toBeVisible();
  await expect(verdict(page)).toContainText("11 Stable Eras");
  await page.getByRole("checkbox", { name: "Outer shell" }).uncheck();
  await expect(
    page.getByTestId("machine-fallback").locator('[data-layer="outer"]'),
  ).toHaveCount(0);
});

test("with reduced motion nothing is drawn until something changes", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await open(page);
  await expect(verdict(page)).toBeVisible();
  // Off screen the machine is not drawn at all; on a phone it starts
  // below the sky.
  await machine(page).scrollIntoViewIfNeeded();
  const frames = async () =>
    Number(await machine(page).getAttribute("data-frames"));
  await expect.poll(frames).toBeGreaterThan(0);
  await page.waitForTimeout(500);
  const settled = await frames();
  await page.waitForTimeout(1000);
  expect(await frames()).toBe(settled);
  await slide(page.getByRole("slider", { name: "Time" }), 300);
  await expect.poll(frames).toBeGreaterThan(settled);
});

test("the science page credits the novel and says what is invented", async ({
  page,
}) => {
  await open(page);
  await page
    .getByRole("link", { name: "The scene and what is invented" })
    .click();
  await expect(page).toHaveURL(/#\/mozi\/science/);
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "The scene and what is invented",
    }),
  ).toBeVisible();
  const body = page.locator("main");
  await expect(body).toContainText("Liu Cixin");
  await expect(body).toContainText("The Three-Body Problem");
  await expect(body).toContainText(/unofficial/);
  await expect(body).toContainText(/speculative/i);
  // Every model the engine offers is described.
  await expect(body).toContainText("Three gear trains");
  await expect(body).toContainText("A cloud over the hole");
  await page.getByRole("link", { name: "Back to the simulation" }).click();
  await expect(verdict(page)).toBeVisible();
});

test("the sky fills its frame on a dense screen", async ({ page }) => {
  await open(page);
  await expect(verdict(page)).toBeVisible();
  // Alpha at the middle of each edge's inner side and at one corner: the
  // disc must reach every side and leave the corners clear.
  const alpha = await page
    .getByTestId("sky")
    .locator("canvas")
    .evaluate((el) => {
      const canvas = el as HTMLCanvasElement;
      const c = canvas.getContext("2d")!;
      const at = (x: number, y: number) =>
        c.getImageData(
          Math.round(x * canvas.width),
          Math.round(y * canvas.height),
          1,
          1,
        ).data[3];
      return [
        at(0.5, 0.5),
        at(0.88, 0.5),
        at(0.5, 0.88),
        at(0.12, 0.5),
        at(0.03, 0.03),
      ];
    });
  expect(alpha).toEqual([255, 255, 255, 255, 0]);
});

test("on a narrow screen the layer toggles line up in columns from the left", async ({
  page,
}) => {
  await open(page);
  await expect(verdict(page)).toBeVisible();
  test.skip(page.viewportSize()!.width >= 700, "a phone layout");
  const group = page.getByRole("group", { name: "Layers" });
  const boxes = await group
    .getByRole("checkbox")
    .evaluateAll((els) =>
      els.map((el) => Math.round(el.getBoundingClientRect().left)),
    );
  const edge = await group.evaluate((el) =>
    Math.round(el.getBoundingClientRect().left),
  );
  const columns = [...new Set(boxes)].sort((a, b) => a - b);
  expect(columns.length).toBeLessThanOrEqual(2);
  expect(columns[0]).toBe(edge);
});

test("dragging the machine turns it and never scrolls the page", async ({
  page,
}) => {
  await open(page);
  await expect(machine(page)).toBeVisible();
  // A browser scrolls on a touch drag unless the element forbids it.
  expect(
    await machine(page).evaluate((el) => getComputedStyle(el).touchAction),
  ).toBe("none");
  expect(
    await machine(page)
      .locator("canvas")
      .evaluate((el) => getComputedStyle(el).touchAction),
  ).toBe("none");
});

test("on a phone, Play snaps to the clerk's sky and docks the playback controls until a paused scroll", async ({
  page,
}) => {
  await open(page);
  await expect(verdict(page)).toBeVisible();
  test.skip(page.viewportSize()!.width >= 700, "a phone layout");
  const tall = page.viewportSize()!.height;
  const dock = page.getByTestId("timeline");
  const box = (l: Locator) =>
    l.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom };
    });
  const position = () => dock.evaluate((el) => getComputedStyle(el).position);
  const offset = () =>
    verdict(page).evaluate(
      (el) => el.getBoundingClientRect().top + window.scrollY,
    );
  expect(await position()).not.toBe("fixed");
  const before = await offset();

  await page.getByRole("button", { name: "Play" }).click();
  await expect.poll(position).toBe("fixed");
  // The sky is whole, at the top, clear of the dock at the bottom.
  await expect
    .poll(async () => Math.abs((await box(page.getByTestId("sky"))).top - 12))
    .toBeLessThan(8);
  const sky = await box(page.getByTestId("sky"));
  const docked = await box(dock);
  expect(Math.abs(docked.bottom - tall)).toBeLessThan(2);
  expect(sky.bottom).toBeLessThanOrEqual(docked.top);
  // The machine comes next, already showing.
  expect((await box(machine(page))).top).toBeLessThan(docked.top);
  for (const part of [
    page.getByRole("button", { name: "Pause" }),
    page.getByRole("slider", { name: "Time" }),
    dock.locator(".eras"),
    dock.getByTestId("dock-when"),
  ])
    await expect(part).toBeInViewport();
  await expect(dock.getByTestId("dock-when")).toContainText(/Day \d+, hour/);
  // Docking takes nothing out of the page: what follows does not move.
  expect(await offset()).toBe(before);

  // It stays put wherever the visitor scrolls, and the scroll is theirs.
  await page.evaluate(() => window.scrollTo(0, 1600));
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(1000);
  expect(Math.abs((await box(dock)).bottom - tall)).toBeLessThan(2);

  // Scrubbing pauses, and pausing leaves the dock where it is.
  await slide(page.getByRole("slider", { name: "Time" }), 180.5);
  await expect(page.getByRole("button", { name: "Play" })).toBeVisible();
  await expect(dock.getByTestId("dock-when")).toContainText("Day 181");
  await page.waitForTimeout(300);
  expect(await position()).toBe("fixed");
  // Playing again and pausing by the button: still docked.
  await page.getByRole("button", { name: "Play" }).click();
  await expect(page.getByRole("button", { name: "Pause" })).toBeVisible();
  await page.waitForTimeout(900);
  await page.getByRole("button", { name: "Pause" }).click();
  await page.waitForTimeout(300);
  expect(await position()).toBe("fixed");
  // Once paused, the first scroll puts it away, and nothing has moved.
  await page.evaluate(() => window.scrollBy(0, 200));
  await expect.poll(position).not.toBe("fixed");
  expect(await offset()).toBe(before);
});

test("on a wide screen, Play leaves the page where it is", async ({ page }) => {
  await open(page);
  await expect(verdict(page)).toBeVisible();
  test.skip(page.viewportSize()!.width < 700, "a wide layout");
  // Clicking scrolls the button into view by itself; measure after that.
  await page.getByRole("button", { name: "Play" }).scrollIntoViewIfNeeded();
  const at = await page.evaluate(() => window.scrollY);
  await page.getByRole("button", { name: "Play" }).click();
  await expect(page.getByRole("button", { name: "Pause" })).toBeVisible();
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => window.scrollY)).toBe(at);
  expect(
    await page
      .getByTestId("timeline")
      .evaluate((el) => getComputedStyle(el).position),
  ).not.toBe("fixed");
  await expect(page.getByTestId("dock-when")).toBeHidden();
});
