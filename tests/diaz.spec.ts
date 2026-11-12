import { expect, test, type Locator, type Page } from "@playwright/test";

async function open(page: Page, hash = "#/diaz") {
  const problems: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") problems.push(m.text());
  });
  page.on("pageerror", (e) => problems.push(String(e)));
  await page.goto("/" + hash);
  await expect(page.locator('html[data-engine="ready"]')).toBeAttached({
    timeout: 30_000,
  });
  // The page is there once its first run has come back.
  if (hash.startsWith("#/diaz") && !hash.includes("/science"))
    await expect(page.getByTestId("verdict")).toBeVisible();
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
// How many different colors a canvas shows.
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

test("home lists the simulation in book order and opens it", async ({
  page,
}) => {
  const problems = await open(page, "");
  await page.getByRole("button", { name: /show the simulations/i }).click();
  await expect(page.locator(".sims .sim-title")).toHaveText([
    "Mozi's machine",
    "Mercury into the Sun",
    "Earth without life",
    "Into two dimensions",
  ]);
  await page.getByRole("link", { name: /Mercury into the Sun/ }).click();
  await expect(page).toHaveURL(/#\/diaz/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Mercury into the Sun" }),
  ).toBeVisible();
  await expect(page).toHaveTitle(/Mercury into the Sun/);
  expect(problems).toEqual([]);
});

test("the novel's telling runs to the end, drawn in three dimensions, with its caveat", async ({
  page,
}) => {
  const problems = await open(page);
  await expect(verdict(page)).toContainText("every other planet follows");
  await expect(verdict(page)).toContainText("Venus first");
  await expect(verdict(page)).toContainText("209,000 years");
  await expect(page.getByTestId("speculative")).toContainText("Speculative");
  await expect(page.getByTestId("grounded")).toHaveCount(0);
  const system = page.getByTestId("system");
  await expect(system).toBeVisible();
  await expect(system).toHaveAttribute("data-bodies", "8");
  expect(await painted(system.locator("canvas"))).toBeGreaterThan(5);
  // It opens with Mercury gone and its spiral unwound.
  await expect(page.getByTestId("moment")).toContainText("The Sun answers");
  await expect(system).not.toHaveAttribute("data-gas", "0");
  const fates = page.getByTestId("fates");
  await expect(fates.getByRole("row")).toHaveCount(9);
  await expect(fates.getByRole("row", { name: /Jupiter/ })).toContainText(
    "195,000 years",
  );
  // Jupiter's wake takes it in before the Earth.
  await expect(page.getByTestId("steps")).toContainText("ahead of the Earth");
  expect(problems).toEqual([]);
});

test("published physics alone leaves Mercury where it is", async ({ page }) => {
  await open(page);
  await panel(page);
  await page.getByRole("radio", { name: /Published physics only/ }).check();
  await expect(verdict(page)).toContainText("0.57 mm/s");
  await expect(verdict(page)).toContainText("32.7 km/s");
  await expect(verdict(page)).toContainText("57.4 trillion");
  await expect(page.getByTestId("speculative")).toHaveCount(0);
  await expect(page.getByTestId("grounded")).toBeVisible();
  await expect(page.getByTestId("system")).toHaveAttribute("data-bodies", "9");
  await expect(page).toHaveURL(/#\/diaz\?c=/);
  // Enough bombs do it, and the page says how many that was.
  await slide(page.getByRole("slider", { name: "Bombs" }), 14);
  await expect(verdict(page)).toContainText("reaches the Sun");
  await expect(verdict(page)).toContainText(/^[\d.]+ trillion bombs/);
});

test("granting only the fall, the Sun swallows Mercury and nothing follows", async ({
  page,
}) => {
  await open(page, "#/diaz?c=eyJ2IjoxLCJiIjoiZ3JhbnRlZCJ9");
  await expect(verdict(page)).toContainText("reaches the Sun");
  await expect(verdict(page)).toContainText("615 km/s");
  await expect(verdict(page)).toContainText("No planet follows");
  await expect(page.getByTestId("speculative")).toContainText("Speculative");
  const steps = page.getByTestId("steps");
  await expect(steps).toContainText("below the convection zone");
  await expect(steps).toContainText("its own mass");
  await expect(
    page.getByTestId("fates").getByRole("row", { name: /The Earth/ }),
  ).toContainText(/36\.\d µm\/s/);
});

test("the timeline walks the chapters and Play moves it", async ({ page }) => {
  await open(page);
  const time = page.getByRole("slider", { name: "Time" });
  const moment = page.getByTestId("moment");
  const system = page.getByTestId("system");
  await slide(time, 0);
  await expect(moment).toContainText("The bombs");
  await expect(moment).toContainText("before the push");
  await expect(system).toHaveAttribute("data-bodies", "9");
  await expect(system).toHaveAttribute("data-gas", "0");
  await slide(time, 1.5);
  await expect(moment).toContainText("The fall");
  await expect(moment).toContainText("days after the push");
  const last = Number(await time.getAttribute("max"));
  await slide(time, last);
  await expect(system).toHaveAttribute("data-bodies", "1");
  await expect(moment).toContainText("209,000 years");
  await slide(time, 0);
  const before = await system.getAttribute("data-at");
  await page.getByRole("button", { name: "Play" }).click();
  await expect(page.getByRole("button", { name: "Pause" })).toBeVisible();
  await expect(system).not.toHaveAttribute("data-at", before!);
  await page.getByRole("button", { name: "Pause" }).click();
  await expect(page.getByRole("button", { name: "Play" })).toBeVisible();
});

test("the view can be turned to look at the inner planets or the Sun", async ({
  page,
}) => {
  await open(page);
  const whole = page.getByRole("button", { name: "The whole system" });
  const inner = page.getByRole("button", { name: "The inner planets" });
  await expect(whole).toHaveAttribute("aria-pressed", "true");
  const system = page.getByTestId("system");
  const far = Number(await system.getAttribute("data-span"));
  await inner.click();
  await expect(inner).toHaveAttribute("aria-pressed", "true");
  await expect(whole).toHaveAttribute("aria-pressed", "false");
  await expect
    .poll(async () => Number(await system.getAttribute("data-span")))
    .toBeLessThan(far / 3);
  await expect(page).toHaveURL(/look=inner/);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "The inner planets" }),
  ).toHaveAttribute("aria-pressed", "true");
});

test("a link that cannot be read falls back to the default and says so", async ({
  page,
}) => {
  await open(page, "#/diaz?c=nonsense");
  await expect(page.locator(".notice")).toContainText("could not be read");
  await expect(verdict(page)).toContainText("every other planet follows");
});

test("without WebGL the system is drawn flat, from above", async ({ page }) => {
  await noWebGL(page);
  // three.js reports the missing context on the console itself.
  await open(page);
  await expect(page.getByTestId("system")).toHaveCount(0);
  const flat = page.getByTestId("system-fallback");
  await expect(flat).toBeVisible();
  await expect(flat).toHaveAttribute("data-bodies", "8");
  expect(await painted(flat.locator("canvas"))).toBeGreaterThan(5);
  await expect(verdict(page)).toContainText("every other planet follows");
});

test("the science page credits the novel, says what is invented and links its sources", async ({
  page,
}) => {
  await open(page, "#/diaz/science");
  const main = page.getByRole("main");
  await expect(main).toContainText("The Dark Forest");
  await expect(main).toContainText("Liu Cixin");
  await expect(main).toContainText("unofficial");
  await expect(main).toContainText("How it came out");
  await expect(main.locator(".spec").first()).toBeVisible();
  for (const href of [
    "https://ssd.jpl.nasa.gov/planets/approx_pos.html",
    "https://ntrs.nasa.gov/citations/19920011112",
    "https://doi.org/10.1086/306858",
    "https://doi.org/10.1143/PTP.56.1756",
    "https://doi.org/10.1088/0004-637X/807/2/165",
    "https://doi.org/10.1126/science.272.5266.1286",
  ])
    await expect(main.locator(`a[href="${href}"]`).first()).toBeVisible();
  await page.getByRole("link", { name: "Back to the simulation" }).click();
  await expect(page).toHaveURL(/#\/diaz$/);
});

test("the Sun and planets keep their drawn size as Mercury passes close", async ({
  page,
}) => {
  // Not quite enough bombs: Mercury skims past the Sun and comes back.
  await open(
    page,
    "#/diaz?look=inner&c=eyJ2IjoxLCJiIjoicHVibGlzaGVkIiwibSI6e30sInAiOnsiYm9tYnMuY291bnQiOjQ3ODYzMDA5MjMyMjYzLjgwNX19",
  );
  const system = page.getByTestId("system");
  const time = page.getByRole("slider", { name: "Time" });
  const sizes = new Set<string>();
  for (const at of [1.05, 1.3, 1.45, 1.5, 1.55, 1.8]) {
    await slide(time, at);
    await expect(system).toHaveAttribute("data-at", /./);
    sizes.add(
      `${await system.getAttribute("data-sun")} ${await system.getAttribute("data-mercury")}`,
    );
  }
  expect([...sizes]).toHaveLength(1);
  // Drawn larger than life here, and the page says where to see it true.
  await expect(page.getByTestId("sizes-note")).toContainText("true size");
});

test("the view can be zoomed by hand, and the zoom travels in the link", async ({
  page,
}) => {
  await open(page);
  const system = page.getByTestId("system");
  const zoom = page.getByRole("slider", { name: "Zoom" });
  const span = async () => Number(await system.getAttribute("data-span"));
  const wide = await span();
  await slide(zoom, 0);
  await expect.poll(span).toBeCloseTo(1, 5);
  expect(wide).toBeGreaterThan(60);
  await expect(page).toHaveURL(/zoom=1(&|$)/);
  // No look is the one chosen now.
  for (const name of ["The whole system", "The inner planets", "The Sun"])
    await expect(page.getByRole("button", { name })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  await page.reload();
  await expect(verdict(page)).toBeVisible();
  await expect.poll(span).toBeCloseTo(1, 5);
  // The keyboard zooms the view it is on.
  await system.focus();
  await page.keyboard.press("+");
  await expect.poll(span).toBeLessThan(1);
  // Choosing a look puts the zoom back in its hands.
  await page.getByRole("button", { name: "The whole system" }).click();
  await expect.poll(span).toBeCloseTo(wide, 5);
  await expect(page).not.toHaveURL(/zoom=/);
});

test("changing a setting leaves the timeline where it was; a new start does not", async ({
  page,
}) => {
  await open(page);
  const time = page.getByRole("slider", { name: "Time" });
  await slide(time, 1.5);
  await panel(page);
  await page.getByText("Models", { exact: true }).click();
  await slide(page.getByRole("slider", { name: "Yield of each bomb" }), 3);
  await expect(verdict(page)).toContainText("1,000 megatons");
  await expect(time).toHaveValue("1.5");
  await expect(page.getByTestId("moment")).toContainText("The fall");
  // A run with fewer chapters than where the handle stood ends there.
  await slide(time, 9.25);
  await page.getByLabel("What the gas does").selectOption("free");
  await expect(verdict(page)).toContainText("No planet follows");
  await expect(time).toHaveValue("3");
  // A starting point opens where its own story is best seen.
  await slide(time, 0.5);
  await page.getByRole("radio", { name: /The Wallbreaker's telling/ }).check();
  await expect(verdict(page)).toContainText("every other planet follows");
  await expect(page.getByTestId("moment")).toContainText("The Sun answers");
});

test("the view says that sizes are drawn large and how to move around it", async ({
  page,
}) => {
  await open(page);
  const sizes = page.getByTestId("sizes-note");
  await expect(sizes).toContainText("larger than they are");
  await expect(sizes).toContainText("without touching");
  const ways = page.getByTestId("ways");
  for (const word of ["Drag", "pinch", "Ctrl", "+", "arrow keys"])
    await expect(ways).toContainText(word);
});

test("a touch on the view is the view's: one finger turns and tilts, two zoom any way round", async ({
  page,
}) => {
  await open(page);
  const system = page.getByTestId("system");
  const canvas = system.locator("canvas");
  // Nothing a finger does here is left to the browser to scroll or zoom.
  expect(await canvas.evaluate((el) => getComputedStyle(el).touchAction)).toBe(
    "none",
  );
  const touch = (type: string, id: number, x: number, y: number) =>
    canvas.evaluate(
      (el, e) => {
        const box = el.getBoundingClientRect();
        el.dispatchEvent(
          new PointerEvent(e.type, {
            pointerId: e.id,
            pointerType: "touch",
            clientX: box.left + e.x,
            clientY: box.top + e.y,
            bubbles: true,
            cancelable: true,
          }),
        );
      },
      { type, id, x, y },
    );
  const turn = async () =>
    ((await system.getAttribute("data-turn")) ?? "").split(" ").map(Number);
  await expect.poll(async () => (await turn()).length).toBe(2);
  const [yaw, pitch] = await turn();
  await touch("pointerdown", 11, 100, 100);
  await touch("pointermove", 11, 100, 160);
  await touch("pointerup", 11, 100, 160);
  await expect.poll(async () => (await turn())[1]).not.toBe(pitch);
  expect((await turn())[0]).toBe(yaw);
  // Two fingers moving apart up and down zoom in.
  const span = async () => Number(await system.getAttribute("data-span"));
  const wide = await span();
  await touch("pointerdown", 21, 150, 120);
  await touch("pointerdown", 22, 150, 160);
  await touch("pointermove", 21, 150, 60);
  await touch("pointermove", 22, 150, 220);
  await touch("pointerup", 21, 150, 60);
  await touch("pointerup", 22, 150, 220);
  await expect.poll(span).toBeLessThan(wide / 2);
});

test("nothing spills past the edge of a phone, whatever the planets' fates read", async ({
  page,
}) => {
  for (const hash of [
    "#/diaz",
    "#/diaz?c=eyJ2IjoxLCJiIjoiZ3JhbnRlZCJ9",
    "#/diaz?c=eyJ2IjoxLCJiIjoicHVibGlzaGVkIn0",
  ]) {
    await open(page, hash);
    await page.reload();
    await expect(verdict(page)).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      hash,
    ).toBe(true);
  }
  // Small slowings are given in a unit that keeps them short.
  await expect(
    page.getByTestId("fates").getByRole("row", { name: /Neptune/ }),
  ).toContainText("Nothing reaches it");
  await open(page, "#/diaz?c=eyJ2IjoxLCJiIjoiZ3JhbnRlZCJ9");
  await page.reload();
  await expect(
    page.getByTestId("fates").getByRole("row", { name: /Neptune/ }),
  ).toContainText(/Slowed by [\d.]+ nm\/s at most/);
});

test("on a phone the settings sit above the view, closed until asked for", async ({
  page,
}) => {
  await open(page);
  const toggle = page.getByRole("button", { name: "Settings" });
  // On a wide screen the panel stands open beside the view instead.
  test.skip(!(await toggle.isVisible()), "the panel is beside the view");
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByRole("radio").first()).toBeHidden();
  const above = (await toggle.boundingBox())!;
  const looks = (await page
    .getByRole("button", { name: "The whole system" })
    .boundingBox())!;
  expect(above.y + above.height).toBeLessThanOrEqual(looks.y);
  // It comes before the view for the keyboard and a screen reader too.
  expect(
    await page.evaluate(() => {
      const panel = document.querySelector(".diaz .controls")!;
      const stage = document.querySelector(".diaz .stage")!;
      return !!(
        panel.compareDocumentPosition(stage) & Node.DOCUMENT_POSITION_FOLLOWING
      );
    }),
  ).toBe(true);
});

test("the timeline stays put when a stretch is drawn slowed", async ({
  page,
}) => {
  await open(page);
  const time = page.getByRole("slider", { name: "Time" });
  const note = page.getByTestId("slowed");
  const top = async () =>
    Math.round(
      await time.evaluate(
        (el) => el.getBoundingClientRect().top + window.scrollY,
      ),
    );
  await slide(time, 1.5);
  await expect(page.getByTestId("moment")).toContainText("The fall");
  await expect(note).toBeHidden();
  const before = await top();
  await slide(time, 3.5);
  await expect(page.getByTestId("moment")).toContainText("The long drag");
  await expect(note).toBeVisible();
  await expect(note).toContainText("drawn slowed");
  expect(await top()).toBe(before);
});

// A study as a link carries it.
const study = (body: object) =>
  Buffer.from(JSON.stringify({ v: 1, ...body })).toString("base64url");
// The names shown inside the view, with where each is drawn.
const names = (page: Page) =>
  page.getByTestId("system").evaluate((el) => {
    const view = el.getBoundingClientRect();
    return [...el.querySelectorAll<HTMLElement>(".system-names span")]
      .filter((s) => !s.hidden)
      .map((s) => {
        const r = s.getBoundingClientRect();
        return {
          name: s.textContent ?? "",
          left: r.left,
          right: r.right,
          top: r.top,
          bottom: r.bottom,
          inside:
            r.right > view.left &&
            r.left < view.right &&
            r.bottom > view.top &&
            r.top < view.bottom,
        };
      });
  });

test("a planet behind the viewer is not named in front of them", async ({
  page,
}) => {
  await open(page, "#/diaz?look=sun");
  const system = page.getByTestId("system");
  await system.focus();
  const turned = async (yaw: number, pitch: number) =>
    expect(system).toHaveAttribute(
      "data-turn",
      `${yaw.toFixed(3)} ${pitch.toFixed(3)}`,
    );
  // Tilt down to look along the planets' plane.
  for (let i = 0; i < 9; i++) await page.keyboard.press("ArrowDown");
  await turned(0.5, 0.08);
  // This close to the Sun every planet is farther off than the viewer
  // is, so none can be in front of the viewer from one side and also
  // from the opposite side. Walk once round and compare each view with
  // the one half a turn on.
  const seen: string[][] = [];
  for (let i = 0; i <= 62; i++) {
    if (i > 0) {
      await page.keyboard.press("ArrowLeft");
      await turned(0.5 + i * 0.1, 0.08);
    }
    seen.push(
      (await names(page))
        .filter((n) => n.inside && n.name !== "The Sun")
        .map((n) => n.name),
    );
  }
  for (let i = 0; i + 31 < seen.length; i++)
    expect(
      seen[i].filter((name) => seen[i + 31].includes(name)),
      `named from both sides, at steps ${i} and ${i + 31}`,
    ).toEqual([]);
});

test("names in the view do not lie over one another", async ({ page }) => {
  for (const hash of ["#/diaz", "#/diaz?look=inner"]) {
    await open(page, hash);
    // The names are placed when the view is first drawn.
    const inside = async () => (await names(page)).filter((n) => n.inside);
    await expect.poll(async () => (await inside()).length).toBeGreaterThan(1);
    const shown = await inside();
    for (const a of shown)
      for (const b of shown)
        if (a.name < b.name)
          expect(
            a.right <= b.left ||
              b.right <= a.left ||
              a.bottom <= b.top ||
              b.bottom <= a.top,
            `${hash}: ${a.name} and ${b.name} overlap`,
          ).toBe(true);
  }
});

test("the whole system fits however far the gas goes, within the zoom's range", async ({
  page,
}) => {
  await open(
    page,
    "#/diaz?c=" + study({ b: "plan", p: { "cloud.reach": 10 } }),
  );
  const system = page.getByTestId("system");
  const time = page.getByRole("slider", { name: "Time" });
  await slide(time, Number(await time.getAttribute("max")));
  const moment = page.getByTestId("moment");
  await expect(moment).toContainText("0 of 8");
  const reach = Number(
    /Gas reaches\s*([\d.]+) AU/.exec(await moment.innerText())![1],
  );
  expect(reach).toBeGreaterThan(150);
  const span = async () => Number(await system.getAttribute("data-span"));
  const wide = await span();
  // All of the gas is in view.
  expect(wide).toBeGreaterThanOrEqual(2 * reach);
  // The slider can show where the view is.
  const zoom = page.getByRole("slider", { name: "Zoom" });
  const widest = 10 ** -Number(await zoom.getAttribute("min"));
  expect(wide).toBeLessThanOrEqual(widest * (1 + 1e-9));
  // Zooming by hand goes on from there and does not jump inward.
  await system.focus();
  await page.keyboard.press("+");
  await expect.poll(span).toBeCloseTo(wide * 0.8, 3);
});

test("the account gives the Earth's troubles in order and both counts of bombs", async ({
  page,
}) => {
  await open(page);
  const steps = page.getByTestId("steps");
  // Touching the Sun and the deeper fall of this run are told apart.
  await expect(steps).toContainText(
    /touch the Sun\..*57\.4 trillion bombs.*34\.5 km\/s.*60\.5 trillion/s,
  );
  await expect(verdict(page)).toContainText("60.5 trillion");
  // The sea, at 603 days, comes before the air, at 2.2 years.
  await expect(steps).toContainText(/603 days.*boil the sea.*2\.2 years.*air/s);
});

test("a Sun with nothing left sends out no more gas, and the page says who is spared", async ({
  page,
}) => {
  const problems = await open(
    page,
    "#/diaz?c=" + study({ b: "plan", p: { "eruption.gain": 1e6 } }),
  );
  await expect(verdict(page)).toContainText("4 of the other 7 planets follow");
  await expect(verdict(page)).toContainText("more than the Sun holds");
  const time = page.getByRole("slider", { name: "Time" });
  await slide(time, Number(await time.getAttribute("max")));
  const moment = page.getByTestId("moment");
  await expect(moment).toContainText("3 of 8");
  await expect(moment).toContainText("6.78 AU");
  const fates = page.getByTestId("fates");
  await expect(fates.getByRole("row", { name: /Saturn/ })).toContainText(
    "The gas never reaches it",
  );
  expect(problems).toEqual([]);
});
