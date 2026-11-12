import { expect, test } from "@playwright/test";

const ready = (page: import("@playwright/test").Page) =>
  expect(page.locator('html[data-engine="ready"]')).toBeAttached({
    timeout: 30_000,
  });

test("the list of simulations waits behind a spoiler warning", async ({
  page,
}) => {
  await page.goto("/");
  await ready(page);
  await expect(page.getByRole("main")).toContainText("spoilers");
  // The trilogy's name is less known than its books: the warning names each.
  const warning = page.getByRole("region", { name: "Before you go on" });
  await expect(warning).toContainText("Remembrance of Earth's Past");
  await expect(warning.locator("cite")).toHaveText([
    "Remembrance of Earth's Past",
    "The Three-Body Problem",
    "The Dark Forest",
    "Death's End",
  ]);
  await expect(
    page.getByRole("link", { name: /Earth without life/ }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: /Into two dimensions/ }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: /show the simulations/i }).click();
  for (const name of [
    /Earth without life/,
    /Mozi's machine/,
    /Into two dimensions/,
  ])
    await expect(page.getByRole("link", { name })).toBeVisible();
  // Once is enough for a visit: coming back to the list does not ask again.
  await page.getByRole("link", { name: /Mozi's machine/ }).click();
  await expect(page).toHaveURL(/#\/mozi/);
  await page.getByRole("link", { name: "Three-Body Simulations" }).click();
  await expect(
    page.getByRole("link", { name: /Earth without life/ }),
  ).toBeVisible();
});

test("the home page describes all the simulations and says where the source is", async ({
  page,
}) => {
  await page.goto("/");
  await ready(page);
  await expect(page.locator(".lede")).not.toContainText(
    "sits down at a computer",
  );
  await expect(page.locator(".lede")).toContainText("trilogy");
  const about = page.getByRole("region", { name: "About this site" });
  await expect(about).toBeVisible();
  await expect(about.getByRole("link", { name: /GitHub/ })).toHaveAttribute(
    "href",
    "https://github.com/iwvelando/three-body-simulations",
  );
  await expect(about).toContainText("unofficial");
});

test("each simulation in the list has a picture of its own", async ({
  page,
}) => {
  await page.goto("/");
  await ready(page);
  await page.getByRole("button", { name: /show the simulations/i }).click();
  const links = page.locator(".sims a");
  await expect(links).toHaveCount(3);
  // In the order the scenes come up in the books.
  await expect(page.locator(".sims .sim-title")).toHaveText([
    "Mozi's machine",
    "Earth without life",
    "Into two dimensions",
  ]);
  const drawings: string[] = [];
  for (const link of await links.all()) {
    const icon = link.locator("svg.sim-icon");
    await expect(icon).toBeVisible();
    // Decoration: the link is still named by its words alone.
    await expect(icon).toHaveAttribute("aria-hidden", "true");
    const box = (await icon.boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(40);
    expect(box.height).toBeCloseTo(box.width, 0);
    // The picture sits beside the words, inside the card.
    const card = (await link.boundingBox())!;
    const title = (await link.locator(".sim-title").boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(card.x);
    expect(box.x + box.width).toBeLessThanOrEqual(title.x);
    drawings.push(await icon.innerHTML());
  }
  expect(new Set(drawings).size).toBe(3);
  await expect(
    page.getByRole("link", { name: /^Earth without life/ }),
  ).toBeVisible();
  // Nothing spills past the edge of a phone.
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
