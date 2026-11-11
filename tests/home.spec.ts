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
