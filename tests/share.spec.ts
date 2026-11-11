import { test, expect, type APIRequestContext } from "@playwright/test";

const CANONICAL = "https://three-body.isaacvelando.com/";

// Width and height from a PNG's IHDR chunk.
async function png(request: APIRequestContext, path: string) {
  const response = await request.get(path);
  expect(response.ok(), path).toBe(true);
  expect(response.headers()["content-type"]).toContain("image/png");
  const bytes = await response.body();
  expect(bytes.subarray(12, 16).toString("ascii")).toBe("IHDR");
  return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
}

test("@smoke link previews reuse the page's own words and a full-size card", async ({
  page,
  request,
}) => {
  await page.goto("/");
  const title = await page.title();
  const description = await page
    .locator('meta[name="description"]')
    .getAttribute("content");
  const meta = (attr: string, key: string) =>
    page.locator(`meta[${attr}="${key}"]`);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    CANONICAL,
  );
  await expect(meta("property", "og:type")).toHaveAttribute(
    "content",
    "website",
  );
  await expect(meta("property", "og:url")).toHaveAttribute(
    "content",
    CANONICAL,
  );
  await expect(meta("property", "og:title")).toHaveAttribute("content", title);
  await expect(meta("property", "og:description")).toHaveAttribute(
    "content",
    description!,
  );
  await expect(meta("property", "og:image")).toHaveAttribute(
    "content",
    `${CANONICAL}og.png`,
  );
  await expect(meta("property", "og:image:width")).toHaveAttribute(
    "content",
    "1200",
  );
  await expect(meta("property", "og:image:height")).toHaveAttribute(
    "content",
    "630",
  );
  await expect(meta("property", "og:image:alt")).toHaveAttribute(
    "content",
    /\S/,
  );
  await expect(meta("name", "twitter:card")).toHaveAttribute(
    "content",
    "summary_large_image",
  );
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute(
    "href",
    /apple-touch-icon\.png$/,
  );
  expect(await png(request, "/og.png")).toEqual([1200, 630]);
  expect(await png(request, "/apple-touch-icon.png")).toEqual([180, 180]);
});
