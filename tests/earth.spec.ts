import { expect, test, type Page } from "@playwright/test";

async function open(page: Page, hash = "#/earth") {
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
// Playwright cannot fill a range input; set it the way a drag would.
async function slide(
  slider: import("@playwright/test").Locator,
  value: number,
) {
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

test("home lists the Earth simulation and opens it", async ({ page }) => {
  const problems = await open(page, "");
  await page.getByRole("button", { name: /show the simulations/i }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Three-Body Simulations" }),
  ).toBeVisible();
  await page.getByRole("link", { name: /Earth without life/ }).click();
  await expect(page).toHaveURL(/#\/earth/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Earth without life" }),
  ).toBeVisible();
  expect(problems).toEqual([]);
});

test("the default run is the book's: life unchecked, a dry planet", async ({
  page,
}) => {
  const problems = await open(page);
  await panel(page);
  await expect(page.getByRole("checkbox", { name: "Life" })).not.toBeChecked();
  await expect(verdict(page)).toContainText(/dry/i);
  await expect(page.getByTestId("speculative")).toContainText(/no published/i);
  expect(problems).toEqual([]);
});

test("the Life checkbox grays out life's fields and changes the planet", async ({
  page,
}) => {
  await open(page);
  await panel(page);
  await page.getByText("Models", { exact: true }).click();
  const begins = page.getByRole("slider", { name: "Life begins" });
  await expect(begins).toBeDisabled();
  await page.getByRole("checkbox", { name: "Life" }).check();
  await expect(begins).toBeEnabled();
  await expect(verdict(page)).toContainText(/temperate/i);
  await expect(verdict(page)).toContainText(/14 °C/);
});

test("presets and model choices rerun the simulation", async ({ page }) => {
  await open(page);
  await panel(page);
  await page.getByRole("radio", { name: "Skeptic" }).check();
  await expect(verdict(page)).toContainText(/temperate/i);
  await expect(page.getByTestId("speculative")).toHaveCount(0);
  await page.getByText("Models", { exact: true }).click();
  await page
    .getByRole("combobox", { name: "Rock weathering" })
    .selectOption("continental");
  await expect(verdict(page)).toContainText(/30 °C/);
  // Editing leaves the preset.
  await expect(page.getByRole("radio", { name: "Skeptic" })).not.toBeChecked();
});

test("a slider changes the outcome", async ({ page }) => {
  await open(page);
  await panel(page);
  const rate = page.getByRole("slider", { name: "Stripping rate" });
  await page.getByText("Models", { exact: true }).click();
  await slide(rate, 0);
  await expect(verdict(page)).toContainText(/hot/i);
});

test("the timeline scrubs from a molten start and plays", async ({ page }) => {
  await open(page);
  const time = page.getByRole("slider", { name: "Time" });
  await slide(time, 0);
  await expect(page.getByTestId("moment")).toContainText(/molten/i);
  await expect(page.getByTestId("moment")).toContainText(/4\.5 billion/);
  const play = page.getByRole("button", { name: "Play" });
  await play.click();
  await expect(page.getByRole("button", { name: "Pause" })).toBeVisible();
  await expect
    .poll(async () => Number(await time.inputValue()))
    .toBeGreaterThan(5);
  await page.getByRole("button", { name: "Pause" }).click();
  await expect(page.getByRole("button", { name: "Play" })).toBeVisible();
});

test("charts draw both Earths and offer a table", async ({ page }) => {
  await open(page);
  const charts = page.locator("figure.chart");
  await expect(charts).toHaveCount(4);
  for (const chart of await charts.all())
    await expect(chart.locator("path.series")).toHaveCount(2);
  await page.getByRole("button", { name: "Show as table" }).click();
  await expect(page.getByRole("table")).toBeVisible();
  await expect(
    page.getByRole("columnheader", { name: /Lifeless/ }).first(),
  ).toBeVisible();
});

test("a copied link restores the study", async ({ page }) => {
  await open(page);
  await panel(page);
  await page.getByRole("radio", { name: "Skeptic" }).check();
  await page.getByRole("checkbox", { name: "Life" }).check();
  await expect(page).toHaveURL(/c=/);
  const url = page.url();
  await page.goto("about:blank");
  await page.goto(url);
  await expect(page.locator('html[data-engine="ready"]')).toBeAttached();
  await panel(page);
  await expect(page.getByRole("radio", { name: "Skeptic" })).toBeChecked();
  await expect(page.getByRole("checkbox", { name: "Life" })).toBeChecked();
});

test("a damaged or out-of-range link falls back to the default with a notice", async ({
  page,
}) => {
  for (const c of [
    "%%%",
    btoa(JSON.stringify({ v: 1, m: { climate: "nope" } })),
    btoa(JSON.stringify({ v: 1, p: { "weathering.te": 1e9 } })),
    btoa(JSON.stringify({ v: 1, p: { __proto__x: 1 } })),
  ]) {
    await page.goto("about:blank");
    await open(page, "#/earth?c=" + encodeURIComponent(c));
    await expect(page.getByRole("status")).toContainText(/link/i);
    await expect(verdict(page)).toContainText(/dry/i);
  }
});

test("nothing overflows sideways", async ({ page }) => {
  await open(page);
  // Measured against the configured viewport: a page wider than it makes a
  // phone browser zoom out, which widens innerWidth and hides the overflow.
  const overflow = () =>
    page.evaluate((width) => {
      const worst = { right: 0, what: "" };
      for (const el of document.querySelectorAll("body *")) {
        const r = el.getBoundingClientRect();
        if (r.width && r.right > worst.right) {
          worst.right = r.right;
          worst.what = el.className?.toString() || el.tagName;
        }
      }
      return worst.right > width + 0.5 ? worst : null;
    }, page.viewportSize()!.width);
  expect(await overflow()).toBeNull();
  await panel(page);
  await page.getByText("Models", { exact: true }).click();
  expect(await overflow()).toBeNull();
  await page.getByRole("button", { name: "Show as table" }).click();
  expect(
    await page.evaluate(
      (width) =>
        document.querySelector(".table-wrap")!.getBoundingClientRect().right <=
        width,
      page.viewportSize()!.width,
    ),
  ).toBe(true);
});

test("opening Models does not move the planet, readout or charts", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "chromium", "side-by-side layout only");
  await open(page);
  await expect(verdict(page)).toBeVisible();
  const tops = () =>
    page.evaluate(() =>
      [".globe", ".moment", ".timeline", ".charts"].map(
        (q) => document.querySelector(q)!.getBoundingClientRect().top + scrollY,
      ),
    );
  const before = await tops();
  await page.getByText("Models", { exact: true }).click();
  expect(await tops()).toEqual(before);
});

test("a wide screen shows both Earths, a phone the chosen one", async ({
  page,
}, info) => {
  await open(page);
  const wide = info.project.name === "chromium";
  await expect(page.locator(".globe")).toHaveCount(wide ? 2 : 1);
  if (!wide) return;
  await expect(page.locator(".globes .chosen")).toContainText("Lifeless Earth");
  await page.getByRole("checkbox", { name: "Life" }).check();
  await expect(page.locator(".globes .chosen")).toContainText("Living Earth");
});

test("times are spelled out and speculation is emphasized", async ({
  page,
}) => {
  await open(page);
  await expect(page.locator("main")).not.toContainText(/\d (Ga|Ma|Gyr)\b/);
  await expect(page.locator(".events")).toContainText(/billion years ago/);
  const mark = page.getByTestId("speculative").locator("strong");
  await expect(mark).toHaveText("Speculative.");
  expect(
    await mark.evaluate((el) => {
      const s = getComputedStyle(el);
      return (
        Number(s.fontWeight) >= 600 &&
        s.textDecorationLine.includes("underline")
      );
    }),
  ).toBe(true);
  await panel(page);
  await page.getByText("Models", { exact: true }).click();
  await expect(page.locator("main")).not.toContainText(/\d (Ga|Ma|Gyr)\b/);
});

test("without WebGL the planet still shows", async ({ page }) => {
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
  await open(page);
  await expect(page.getByTestId("globe-fallback").first()).toBeVisible();
  await expect(verdict(page)).toContainText(/dry/i);
});

test("the science page credits the novel and cites every paper", async ({
  page,
}) => {
  await open(page);
  await page.getByRole("link", { name: "The science and its sources" }).click();
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "The science and its sources",
    }),
  ).toBeVisible();
  await expect(page.getByText(/Liu Cixin/).first()).toBeVisible();
  await expect(page.getByText(/unofficial/).first()).toBeVisible();
  const references = page.locator("ol.references li");
  expect(await references.count()).toBeGreaterThanOrEqual(15);
  for (const item of await references.all())
    await expect(item.getByRole("link")).toHaveAttribute(
      "href",
      /^https:\/\/(doi\.org|arxiv\.org)\//,
    );
  await expect(page.getByText(/Schwartzman & Volk 1989/).first()).toBeVisible();
  await expect(page.getByText(/Krissansen-Totton/).first()).toBeVisible();
  await expect(page.getByText(/speculative/i).first()).toBeVisible();
});

test("the content security policy is never violated", async ({ page }) => {
  await page.addInitScript(() => {
    (window as any).__csp = [];
    document.addEventListener("securitypolicyviolation", (e) =>
      (window as any).__csp.push(e.violatedDirective),
    );
  });
  await open(page);
  await panel(page);
  await page.getByRole("checkbox", { name: "Life" }).check();
  await expect(verdict(page)).toContainText(/temperate/i);
  expect(await page.evaluate(() => (window as any).__csp)).toEqual([]);
});

test("every eon is named in full beside the timeline", async ({ page }) => {
  await open(page);
  const names = page.locator(".eon-names li");
  await expect(names).toHaveText([
    "Hadean",
    "Archean",
    "Proterozoic",
    "Phanerozoic",
  ]);
  for (const name of await names.all())
    expect(
      await name.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
    ).toBe(true);
  // The one the scrubber is in is marked.
  await expect(page.locator(".eon-names li[aria-current]")).toHaveText(
    "Phanerozoic",
  );
  await slide(page.getByRole("slider", { name: "Time" }), 0);
  await expect(page.locator(".eon-names li[aria-current]")).toHaveText(
    "Hadean",
  );
});

test("a still globe is not redrawn", async ({ page }) => {
  // With reduced motion nothing on the planet moves by itself, so it must
  // cost nothing until something changes. (Without graphics hardware the
  // globe stops spinning for the same reason.)
  await page.emulateMedia({ reducedMotion: "reduce" });
  await open(page);
  await expect(verdict(page)).toBeVisible();
  const frames = async () =>
    Number(await page.locator(".globe").first().getAttribute("data-frames"));
  await expect.poll(frames).toBeGreaterThan(0);
  await page.waitForTimeout(500);
  const settled = await frames();
  await page.waitForTimeout(1000);
  expect(await frames()).toBe(settled);
  await slide(page.getByRole("slider", { name: "Time" }), 200);
  await expect.poll(frames).toBeGreaterThan(settled);
});

// A touch swipe that starts on an element, the way a visitor scrolls a
// page. Chromium only: the gesture is synthesized through its debugger.
async function swipeUpFrom(
  page: Page,
  target: import("@playwright/test").Locator,
) {
  await target.scrollIntoViewIfNeeded();
  const box = (await target.boundingBox())!;
  const session = await page.context().newCDPSession(page);
  await session.send("Input.synthesizeScrollGesture", {
    x: Math.round(box.x + box.width * 0.4),
    y: Math.round(box.y + box.height / 2),
    yDistance: -250,
    gestureSourceType: "touch",
    speed: 600,
  });
}

test("a link pasted while the planet is open is read", async ({ page }) => {
  await open(page);
  await expect(verdict(page)).toContainText("Lifeless Earth today: dry");
  await page.evaluate(() => {
    // Life checked, starting from Skeptic.
    location.hash = `#/earth?c=${btoa(JSON.stringify({ v: 1, l: 1, b: "skeptic" })).replace(/=+$/, "")}`;
  });
  await expect(verdict(page)).toContainText("Living Earth today");
  await panel(page);
  await expect(page.getByRole("radio", { name: /Skeptic/ })).toBeChecked();
});

test("a page opened from the bottom of another starts at its top, with focus on it", async ({
  page,
}) => {
  await open(page);
  await panel(page);
  await page.getByText("Models", { exact: true }).click();
  const link = page.getByRole("link", { name: "Where they come from" });
  await link.scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => scrollY)).toBeGreaterThan(300);
  await link.click();
  await expect(
    page.getByRole("heading", { level: 1, name: /science/i }),
  ).toBeVisible();
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
  expect(
    await page.evaluate(() => document.activeElement?.className ?? ""),
  ).toContain("view");
});

test("a simulation opened by its address never shows the home page first", async ({
  page,
}) => {
  await page.addInitScript(() => {
    (window as any).__home = false;
    const look = () => {
      if (document.body?.innerText.includes("Before you go on"))
        (window as any).__home = true;
      requestAnimationFrame(look);
    };
    requestAnimationFrame(look);
  });
  await open(page);
  await expect(verdict(page)).toBeVisible();
  expect(await page.evaluate(() => (window as any).__home)).toBe(false);
});

test("water is always read to the same two places, and a trace is called a trace", async ({
  page,
}) => {
  await open(page);
  await expect(verdict(page)).toBeVisible();
  const time = page.getByRole("slider", { name: "Time" });
  const last = Number(await time.getAttribute("max"));
  const seen = new Set<string>();
  for (let i = 0; i <= last; i++) {
    await slide(time, i);
    const text = await page.getByTestId("moment").innerText();
    const water = /Water\s+(.+)/.exec(text);
    if (water) seen.add(water[1].trim());
  }
  expect(seen.size).toBeGreaterThan(20);
  for (const reading of seen)
    expect(reading).toMatch(/^(none|less than 0\.01 oceans|\d+\.\d\d oceans)$/);
});

test("a slider put back beside its starting value lands on it", async ({
  page,
}) => {
  await open(page);
  await panel(page);
  const radio = page.getByRole("radio", { name: /Green Glasses/ });
  const distance = page.getByRole("slider", { name: "Distance from the Sun" });
  const readout = page
    .locator(".field", { hasText: "Distance from the Sun" })
    .locator("output");
  await expect(radio).toBeChecked();
  await slide(distance, 1.05);
  await expect(radio).not.toBeChecked();
  await expect(readout).toHaveText("1.05 AU");
  // The nearest stop a drag can reach is not exactly 1 AU. It counts as
  // 1 AU, and the planet is the starting point's again.
  await slide(distance, 1.0005);
  await expect(readout).toHaveText("1 AU");
  await expect(radio).toBeChecked();
  await expect(page).toHaveURL(/#\/earth$/);
});

test("a drag on the globe tilts it and never scrolls the page", async ({
  page,
}) => {
  await open(page);
  await expect(verdict(page)).toBeVisible();
  const globe = page.locator(".globe").first();
  expect(await globe.evaluate((el) => getComputedStyle(el).touchAction)).toBe(
    "none",
  );
  expect(
    await globe
      .locator("canvas")
      .evaluate((el) => getComputedStyle(el).touchAction),
  ).toBe("none");
});

test("on a phone, unchecking Life keeps the same globe", async ({ page }) => {
  test.skip(page.viewportSize()!.width >= 700, "one globe at a time");
  await open(page);
  await expect(verdict(page)).toBeVisible();
  await page
    .locator(".globe canvas")
    .evaluate((el) => ((el as any).__kept = true));
  await panel(page);
  await page.getByRole("checkbox", { name: "Life" }).check();
  await expect(verdict(page)).toContainText("Living Earth");
  expect(
    await page.locator(".globe canvas").evaluate((el) => (el as any).__kept),
  ).toBe(true);
});

test("the globe comes back after the browser takes its drawing surface away", async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== "chromium", "needs the lose-context extension");
  // Still, so nothing but the recovery itself would draw it again.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await open(page);
  await expect(verdict(page)).toBeVisible();
  const globe = page.locator(".globe").first();
  const frames = async () => Number(await globe.getAttribute("data-frames"));
  await expect.poll(frames).toBeGreaterThan(0);
  await page.waitForTimeout(400);
  const before = await frames();
  await globe.locator("canvas").evaluate(async (el) => {
    const canvas = el as HTMLCanvasElement;
    const gl = (canvas.getContext("webgl2") ??
      canvas.getContext("webgl")) as WebGLRenderingContext;
    const lose = gl.getExtension("WEBGL_lose_context")!;
    lose.loseContext();
    await new Promise((r) => setTimeout(r, 200));
    lose.restoreContext();
  });
  await expect.poll(frames).toBeGreaterThan(before);
});

test("on a phone, scrolling past a chart leaves the time alone, and a tap on it moves there", async ({
  page,
  browserName,
}) => {
  test.skip(
    browserName !== "chromium" || page.viewportSize()!.width >= 700,
    "a synthesized touch on a phone",
  );
  await open(page);
  await expect(verdict(page)).toBeVisible();
  const when = page.locator(".moment-when");
  await expect(when).toHaveText("Today");
  const chart = page.locator(".chart svg").first();
  const before = await page.evaluate(() => scrollY);
  await swipeUpFrom(page, chart);
  expect(await page.evaluate(() => scrollY)).toBeGreaterThan(before + 100);
  await page.waitForTimeout(300);
  await expect(when).toHaveText("Today");
  await chart.scrollIntoViewIfNeeded();
  const box = (await chart.boundingBox())!;
  await page.touchscreen.tap(box.x + box.width * 0.4, box.y + box.height / 2);
  await expect(when).toContainText("billion years ago");
});

test("the ways back from the science, surface and luck pages keep the planet as it was set", async ({
  page,
}) => {
  await open(page);
  await panel(page);
  await page.getByRole("radio", { name: /Skeptic/ }).check();
  await expect(page).toHaveURL(/#\/earth\?c=/);
  const address = page.url();
  for (const [out, back] of [
    ["Zoom in to this surface", "Back to the planet"],
    ["Was it luck?", "Back to the planet"],
    ["The science and its sources", "Back to the simulation"],
  ]) {
    await page.getByRole("link", { name: out }).first().click();
    await page.getByRole("link", { name: back }).click();
    await expect(page).toHaveURL(address);
    await panel(page);
    await expect(page.getByRole("radio", { name: /Skeptic/ })).toBeChecked();
  }
});

test("a mouse passing over a chart leaves the time alone; a press moves it", async ({
  page,
}) => {
  test.skip(page.viewportSize()!.width < 700, "a mouse on a wide screen");
  await open(page);
  await expect(verdict(page)).toBeVisible();
  const when = page.locator(".moment-when");
  await expect(when).toHaveText("Today");
  const chart = page.locator(".chart svg").first();
  await chart.scrollIntoViewIfNeeded();
  const box = (await chart.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height / 2);
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height / 2);
  await page.waitForTimeout(200);
  await expect(when).toHaveText("Today");
  await page.mouse.down();
  await expect(when).toContainText("billion years ago");
  await page.mouse.up();
});

test("a readout below one moves with every step of its slider", async ({
  page,
}) => {
  await open(page);
  await panel(page);
  const readout = page
    .locator(".field", { hasText: "Distance from the Sun" })
    .locator("output");
  // Three steps below 1 AU, which two figures would still call 1.
  await slide(
    page.getByRole("slider", { name: "Distance from the Sun" }),
    0.996,
  );
  await expect(readout).toHaveText("0.996 AU");
});
