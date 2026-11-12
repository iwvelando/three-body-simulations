import { expect, test, type Locator, type Page } from "@playwright/test";

async function open(page: Page, hash = "#/flat") {
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
// How much of a canvas has been drawn on.
const painted = (canvas: Locator) =>
  canvas.evaluate((el) => {
    const c = el as HTMLCanvasElement;
    const copy = document.createElement("canvas");
    copy.width = copy.height = 64;
    const g = copy.getContext("2d")!;
    g.drawImage(c, 0, 0, 64, 64);
    const px = g.getImageData(0, 0, 64, 64).data;
    const seen = new Set<number>();
    for (let i = 0; i < px.length; i += 4)
      if (px[i + 3] > 0)
        seen.add(
          (px[i] >> 4) | ((px[i + 1] >> 4) << 4) | ((px[i + 2] >> 4) << 8),
        );
    return seen.size;
  });
// A small picture with large and small features, as a PNG.
const picture = (page: Page) =>
  page.evaluate(async () => {
    const c = document.createElement("canvas");
    c.width = 96;
    c.height = 72;
    const g = c.getContext("2d")!;
    for (let y = 0; y < 72; y += 12)
      for (let x = 0; x < 96; x += 12) {
        g.fillStyle = `rgb(${x * 2 + 30}, ${y * 3}, ${(x + y) % 24 ? 60 : 220})`;
        g.fillRect(x, y, 12, 12);
      }
    const blob = await new Promise<Blob>((r) =>
      c.toBlob((b) => r(b!), "image/png"),
    );
    return Array.from(new Uint8Array(await blob.arrayBuffer()));
  });
const recovered = async (page: Page) =>
  Number(
    /(\d+)%/.exec((await page.getByTestId("score").textContent()) ?? "")?.[1],
  );

test("home lists the third simulation and opens it", async ({ page }) => {
  const problems = await open(page, "");
  await page.getByRole("button", { name: /show the simulations/i }).click();
  await page.getByRole("link", { name: /Into two dimensions/ }).click();
  await expect(page).toHaveURL(/#\/flat/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Into two dimensions" }),
  ).toBeVisible();
  await expect(page).toHaveTitle(/Into two dimensions/);
  expect(problems).toEqual([]);
});

test("the Sun falls under the novel's clock, with its caveat", async ({
  page,
}) => {
  const problems = await open(page);
  await expect(verdict(page)).toContainText("flat Sun");
  await expect(verdict(page)).toContainText("70 times");
  await expect(verdict(page)).toContainText("30 seconds");
  await expect(page.getByTestId("fall")).toBeVisible();
  expect(
    await painted(page.getByTestId("fall").locator("canvas")),
  ).toBeGreaterThan(5);
  await expect(page.getByTestId("speculative")).toContainText("Speculative");
  await expect(page.getByTestId("rings")).toContainText("Radiation zone");
  expect(problems).toEqual([]);
});

test("the Earth's ocean ring is too narrow for the novel's snowflakes until the sheet is thin", async ({
  page,
}) => {
  await open(page);
  await page.getByLabel("What falls").selectOption("earth");
  await expect(verdict(page)).toContainText("flat Earth");
  await expect(page.getByTestId("snow")).toContainText("29.9 km");
  await panel(page);
  await page.getByRole("radio", { name: /Snowflake sea/ }).check();
  await expect(page.getByTestId("snow")).toContainText(/4,[45]\d\d km/);
  await expect(page).toHaveURL(/body=earth/);
});

test("spreading instead of shells changes the rings and says so", async ({
  page,
}) => {
  await open(page, "#/flat?body=neptune");
  await expect(page.getByTestId("rings")).toContainText("Water-rich mantle");
  await panel(page);
  await page.getByText("Models", { exact: true }).click();
  await page.getByLabel("How matter lands").selectOption("spread");
  await expect(page.getByTestId("explains")).toContainText("Spreading pool");
  await expect(page.getByTestId("rings")).toContainText("one for every");
});

test("the fall opens where the flat picture is as wide as the body, and plays unhurried", async ({
  page,
}) => {
  await open(page);
  const moment = page.getByTestId("moment");
  await expect(moment).toContainText("30 seconds after touching");
  // The first three tenths of the timeline are those thirty seconds;
  // the rest is the remainder of the hour, evenly, so the body can be
  // watched going under.
  const time = page.getByRole("slider", { name: "Time" });
  await slide(time, 0.1);
  await expect(moment).toContainText("10 seconds after touching");
  await slide(time, 0.65);
  await expect(moment).toContainText("30.2 minutes after touching");
  await slide(time, 0);
  await page.getByRole("button", { name: "Play" }).click();
  await page.waitForTimeout(1000);
  await page.getByRole("button", { name: "Pause" }).click();
  await expect(moment).toContainText(/[\d.]+ seconds after touching/);
});

// A browser may hand an animation frame a time a little before "now".
// That once sent the fall to a moment that is not a number.
test("play from the very start survives a frame stamped in the past", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const real = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (cb) =>
      real(() => cb(performance.now() - 80));
  });
  const problems = await open(page);
  await slide(page.getByRole("slider", { name: "Time" }), 0);
  await expect(page.getByTestId("moment")).toContainText("0 seconds");
  await page.getByRole("button", { name: "Play" }).click();
  await page.waitForTimeout(600);
  await expect(page.getByTestId("fall")).toBeVisible();
  await expect(page.getByTestId("moment")).toContainText("after touching");
  expect(problems).toEqual([]);
});

test("planets are drawn from NASA's maps, and dropdowns leave room for their arrow", async ({
  page,
}) => {
  const map = page.waitForResponse(/planets\/earth\.jpg/);
  await open(page, "#/flat?body=earth");
  expect((await map).ok()).toBe(true);
  const select = page.getByLabel("What falls");
  const room = await select.evaluate((el) => {
    const style = getComputedStyle(el);
    return {
      right: parseFloat(style.paddingRight),
      arrow: style.backgroundImage,
    };
  });
  expect(room.right).toBeGreaterThanOrEqual(30);
  expect(room.arrow).toContain("gradient");
});

test("at first touch the whole body is drawn, down to the point that touches", async ({
  page,
}) => {
  await open(page);
  await slide(page.getByRole("slider", { name: "Time" }), 0);
  await expect(page.getByTestId("moment")).toContainText("0 seconds");
  // Seen from the side, the body's near edge hangs below the point where
  // it touches the plane. It was once cut off there.
  const lit = await page
    .getByTestId("fall")
    .locator("canvas")
    .evaluate((el) => {
      const c = el as HTMLCanvasElement;
      const g = c.getContext("2d")!;
      const x = Math.round(c.width / 2),
        y = Math.round(c.height * 0.6 + (0.06 * c.width) / 4.4);
      const [r, gr, b] = g.getImageData(x, y, 1, 1).data;
      return r + gr + b;
    });
  expect(lit).toBeGreaterThan(300);
});

test("each starting point turns to the body its statement is about, and the ruler shows the size", async ({
  page,
}) => {
  await open(page);
  const body = page.getByLabel("What falls");
  const ruler = page.getByTestId("ruler");
  await expect(ruler).toContainText("Earth's distance from the Sun");
  const before = await ruler.getAttribute("data-at");
  await panel(page);
  await page.getByRole("radio", { name: /Snowflake sea/ }).check();
  await expect(body).toHaveValue("earth");
  await expect(verdict(page)).toContainText("flat Earth");
  await expect(ruler).not.toHaveAttribute("data-at", before!);
  await page.getByRole("radio", { name: /Starry Night/ }).check();
  await expect(body).toHaveValue("jupiter");
  await page.getByRole("radio", { name: /Sun's thirty seconds/ }).check();
  await expect(body).toHaveValue("sun");
  // A body chosen by hand stays when the sheet is only made thinner.
  await body.selectOption("mars");
  await panel(page);
  await page.getByRole("radio", { name: /Every atom/ }).check();
  await expect(body).toHaveValue("mars");
  await expect(verdict(page)).toContainText("flat Mars");
});

test("every body can be chosen and is drawn without trouble", async ({
  page,
}) => {
  const problems = await open(page);
  await expect(verdict(page)).toBeVisible();
  const ids = await page
    .getByLabel("What falls")
    .locator("option")
    .evaluateAll((all) => all.map((o) => (o as HTMLOptionElement).value));
  expect(ids.length).toBe(10);
  for (const id of ids) {
    await page.getByLabel("What falls").selectOption(id);
    await expect(page).toHaveURL(
      id === "sun" ? /#\/flat$/ : new RegExp(`body=${id}`),
    );
    await slide(page.getByRole("slider", { name: "Time" }), 0.2);
    await expect(page.getByTestId("rings")).toBeVisible();
  }
  expect(problems).toEqual([]);
});

test("the timeline plays and scrubs the fall", async ({ page }) => {
  await open(page);
  const moment = page.getByTestId("moment");
  await slide(page.getByRole("slider", { name: "Time" }), 0);
  await expect(moment).toContainText("0 seconds");
  await page.getByRole("button", { name: "Play" }).click();
  await expect(page.getByRole("button", { name: "Pause" })).toBeVisible();
  await expect(moment).not.toContainText("0 seconds");
  await page.getByRole("button", { name: "Pause" }).click();
  await expect(page.getByRole("button", { name: "Play" })).toBeVisible();
});

test("a link that cannot be read falls back to the default with a notice", async ({
  page,
}) => {
  await open(page, "#/flat?body=vulcan&c=eyJ2IjoxLCJiIjoibm9wZSJ9");
  await expect(page.getByRole("status")).toContainText("could not be read");
  await expect(verdict(page)).toContainText("flat Sun");
});

test("the sample painting falls edge first and comes back", async ({
  page,
}) => {
  const problems = await open(page, "#/flat/painting");
  await expect(
    page.getByRole("heading", { level: 1, name: /painting/i }),
  ).toBeVisible();
  await expect(page.getByTestId("flat-picture")).toBeVisible();
  await expect(page.getByTestId("size")).toContainText("km");
  await page.getByRole("button", { name: "Restore it" }).click();
  await expect(page.getByTestId("score")).toContainText("%", {
    timeout: 15_000,
  });
  // The sample's fine brushwork is harder to get back than a test card.
  expect(await recovered(page)).toBeGreaterThan(70);
  await expect(page.getByTestId("speculative")).toContainText("Speculative");
  expect(problems).toEqual([]);
});

test("an uploaded picture is flattened, and buried in Pluto it does not come back", async ({
  page,
}) => {
  await open(page, "#/flat/painting");
  await expect(page.getByTestId("flat-picture")).toBeVisible();
  const png = await picture(page);
  await page.getByLabel("Choose a picture").setInputFiles({
    name: "mine.png",
    mimeType: "image/png",
    buffer: Buffer.from(png),
  });
  await expect(page.getByTestId("source")).toContainText("mine.png");
  await page.getByRole("button", { name: "Restore it" }).click();
  await expect(page.getByTestId("score")).toContainText("%", {
    timeout: 15_000,
  });
  expect(await recovered(page)).toBeGreaterThan(85);
  await panel(page);
  await page.getByText("Models", { exact: true }).click();
  await page.getByLabel("What falls with it").selectOption("buried");
  await expect(page.getByTestId("size")).toContainText("part in");
  await page.getByRole("button", { name: "Restore it" }).click();
  await expect(page.getByTestId("score")).toContainText("%", {
    timeout: 15_000,
  });
  expect(await recovered(page)).toBeLessThan(5);
});

test("a file that is not a picture is refused in plain words", async ({
  page,
}) => {
  await open(page, "#/flat/painting");
  await expect(page.getByTestId("flat-picture")).toBeVisible();
  await page.getByLabel("Choose a picture").setInputFiles({
    name: "notes.png",
    mimeType: "image/png",
    buffer: Buffer.from("not a picture at all"),
  });
  await expect(page.getByRole("alert")).toContainText("could not be read");
  await expect(page.getByTestId("flat-picture")).toBeVisible();
});

test("without WebGL the flat picture is still shown", async ({ page }) => {
  await noWebGL(page);
  const problems = await open(page, "#/flat/painting");
  const flat = page.getByTestId("flat-picture");
  await expect(flat).toBeVisible();
  await expect
    .poll(() => painted(flat.locator("canvas")), { timeout: 15_000 })
    .toBeGreaterThan(20);
  expect(problems).toEqual([]);
});

test("the whole sky: tiny fragments under the Sun's clock, a sea of Sun under Starry Night", async ({
  page,
}) => {
  const problems = await open(page, "#/flat/sky");
  await expect(
    page.getByRole("heading", { level: 1, name: /sky/i }),
  ).toBeVisible();
  await expect(verdict(page)).toContainText("Nothing touches");
  await expect(page.getByTestId("order")).toContainText(
    /Neptune.*Saturn.*Earth/,
  );
  expect(
    await painted(page.getByTestId("sky").locator("canvas")),
  ).toBeGreaterThan(5);
  await panel(page);
  await page.getByRole("radio", { name: /Starry Night/ }).check();
  await expect(verdict(page)).toContainText("1.1%");
  await expect(verdict(page)).toContainText("flat Sun");
  await expect(page.getByTestId("speculative")).toContainText("Speculative");
  expect(problems).toEqual([]);
});

test("shuffling the planets changes the order and the link", async ({
  page,
}) => {
  await open(page, "#/flat/sky");
  const order = page.getByTestId("order");
  const before = await order.textContent();
  await page.getByRole("button", { name: "Shuffle the planets" }).click();
  await expect(page).toHaveURL(/seed=\d+/);
  await expect(order).not.toHaveText(before!);
  const shuffled = await order.textContent();
  await page.reload();
  await expect(page.locator('html[data-engine="ready"]')).toBeAttached({
    timeout: 30_000,
  });
  await expect(order).toHaveText(shuffled!);
  await page.getByRole("button", { name: "As in the novel" }).click();
  await expect(order).toHaveText(before!);
});

test("what the sky shows travels in the link", async ({ page }) => {
  await open(page, "#/flat/sky");
  await page.getByLabel("Show").selectOption("inner");
  await expect(page).toHaveURL(/show=inner/);
  await page.getByRole("checkbox", { name: "Brush strokes" }).uncheck();
  await expect(page).toHaveURL(/plain=1/);
  await page.reload();
  await expect(page.locator('html[data-engine="ready"]')).toBeAttached({
    timeout: 30_000,
  });
  await expect(page.getByLabel("Show")).toHaveValue("inner");
  await expect(
    page.getByRole("checkbox", { name: "Brush strokes" }),
  ).not.toBeChecked();
  await open(page, "#/flat/sky?show=sideways");
  await expect(page.getByRole("status")).toContainText("could not be read");
});

test("the side view travels in the link too", async ({ page }) => {
  await open(page);
  await page.getByRole("button", { name: "Seen from the side" }).click();
  await expect(page).toHaveURL(/view=top/);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Seen from the side" }),
  ).toHaveAttribute("aria-pressed", "false");
});

test("choosing a picture and using the sample sit side by side as equals", async ({
  page,
}) => {
  await open(page, "#/flat/painting");
  await expect(page.getByTestId("flat-picture")).toBeVisible();
  const choose = await page.getByTestId("choose").boundingBox();
  const sample = await page
    .getByRole("button", { name: "Use the sample" })
    .boundingBox();
  expect(Math.abs(choose!.height - sample!.height)).toBeLessThan(1);
  expect(Math.abs(choose!.y - sample!.y)).toBeLessThan(1);
});

test("a link followed while the view is open is read afresh", async ({
  page,
}) => {
  await open(page);
  await expect(verdict(page)).toContainText("flat Sun");
  await page.evaluate(() => {
    location.hash = "#/flat?body=earth&c=eyJ2IjoxLCJiIjoic25vdyJ9";
  });
  await expect(verdict(page)).toContainText("flat Earth");
  await expect(page.getByTestId("snow")).toContainText(/4,[45]\d\d km/);
});

test("the science page credits the novel, says what is invented and links its sources", async ({
  page,
}) => {
  await open(page, "#/flat/science");
  await expect(page.getByRole("main")).toContainText("Liu Cixin");
  await expect(page.getByRole("main")).toContainText("unofficial");
  await expect(page.getByRole("main")).toContainText("192 km");
  const links = page.locator(".references a");
  expect(await links.count()).toBeGreaterThan(6);
  for (const href of await links.evaluateAll((all) =>
    all.map((a) => (a as HTMLAnchorElement).href),
  ))
    expect(href).toMatch(/^https:\/\//);
});

test("the three views link to one another", async ({ page }) => {
  await open(page);
  await page.getByRole("link", { name: "A painting" }).click();
  await expect(page).toHaveURL(/#\/flat\/painting/);
  await page.getByRole("link", { name: "The whole sky" }).click();
  await expect(page).toHaveURL(/#\/flat\/sky/);
  await page.getByRole("link", { name: "A body falls" }).click();
  await expect(verdict(page)).toContainText("flat Sun");
});

test("the tab already open leads back to the view as its address has it", async ({
  page,
}) => {
  await open(page);
  const body = page.getByLabel("What falls");
  await body.selectOption("earth");
  await expect(page).toHaveURL(/body=earth/);
  await page.getByRole("link", { name: "A body falls" }).click();
  await expect(page).toHaveURL(/#\/flat$/);
  // The address names no body, so the page shows the first.
  await expect(body).toHaveValue("sun");
  await expect(verdict(page)).toContainText("flat Sun");
});

test("lengths read as a person would say them", async ({ page }) => {
  await open(page);
  await expect(page.getByTestId("ruler")).toContainText(/1 light-year\b(?!s)/);
  await expect(page.getByTestId("ruler")).not.toContainText("1 light-years");
  await expect(verdict(page)).toBeVisible();
  await panel(page);
  await expect(
    page
      .locator(".field", { hasText: "Thickness of the sheet" })
      .locator("output"),
  ).toHaveText("192,000 m");
});

test("every starting point opens on the moment its picture is as wide as what stands", async ({
  page,
}) => {
  await open(page);
  await expect(verdict(page)).toBeVisible();
  await panel(page);
  const widths = async () => {
    const text = await page.getByTestId("moment").innerText();
    return [
      /Flat picture\s+(.+) across/.exec(text)?.[1],
      /Still standing\s+(.+) across/.exec(text)?.[1],
    ];
  };
  // Each run is told from the last by what its verdict says.
  for (const [name, result] of [
    [/Snowflake sea/, /flat Earth/],
    [/Starry Night/, /flat Jupiter ends [\d.]+ AU/],
    [/Every atom/, /light-years/],
    [/Sun's thirty seconds/, /flat Sun/],
  ]) {
    await page.getByRole("radio", { name }).check();
    await expect(verdict(page)).toContainText(result);
    await expect
      .poll(async () => {
        const [flat, standing] = await widths();
        return flat !== undefined && flat === standing;
      })
      .toBe(true);
  }
});

test("a picture chosen before the sample arrives is kept", async ({ page }) => {
  await page.route("**/starry-night.jpg", async (route) => {
    await new Promise((r) => setTimeout(r, 1500));
    await route.continue();
  });
  await open(page, "#/flat/painting");
  const png = await picture(page);
  await page.getByLabel("Choose a picture").setInputFiles({
    name: "mine.png",
    mimeType: "image/png",
    buffer: Buffer.from(png),
  });
  await expect(page.getByTestId("source")).toContainText("mine.png");
  await page.waitForTimeout(2500);
  await expect(page.getByTestId("source")).toContainText("mine.png");
});
