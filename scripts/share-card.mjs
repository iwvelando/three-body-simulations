// Renders the link-preview card (public/og.png, 1200×630) and the touch icon
// (public/apple-touch-icon.png, 180×180) from the built site: make share-card.
// The images are committed; render again only when the look changes.
import { preview } from "vite";
import { chromium } from "@playwright/test";
import { readFileSync } from "node:fs";

const server = await preview({
  preview: {
    host: "127.0.0.1",
    port: 4199,
    strictPort: true,
    headers: { "Content-Security-Policy": "" },
  },
});
let browser;
try {
  browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1200, height: 630 },
    deviceScaleFactor: 1,
    colorScheme: "dark",
    reducedMotion: "reduce",
  });
  await page.goto("http://127.0.0.1:4199/#/earth");
  await page.getByTestId("verdict").waitFor();
  await page.evaluate(() => document.fonts.ready);
  // A billion years ago: the living Earth blue, the lifeless one orange with
  // the last of its seas.
  await page.getByRole("slider", { name: "Time" }).evaluate((el) => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    ).set.call(el, "380");
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
  const html = readFileSync("index.html", "utf8");
  const description = html.match(/name="description"\s+content="(.*?)"/)[1];
  await page.evaluate((description) => {
    // Compose inside the live page so its fonts and colors apply: keep the
    // two globes, drop every control, and set the words beside them.
    const globes = document.querySelector(".globes");
    const card = document.createElement("div");
    card.className = "share";
    card.innerHTML = `<div class="share-copy"><h1>Three-Body Simulations</h1><p class="share-text"></p><p class="share-host">three-body.isaacvelando.com</p></div>`;
    card.querySelector(".share-text").textContent = description;
    document.body.replaceChildren(card);
    card.append(globes);
    // The card names the site, not a scene: no captions on the globes.
    for (const caption of globes.querySelectorAll("figcaption"))
      caption.remove();
    const style = document.createElement("style");
    style.textContent = `
      body{margin:0;background:#0f1622;color:#e6eaf0}
      .share{width:1200px;height:630px;box-sizing:border-box;padding:56px 60px;display:grid;grid-template-columns:400px 1fr;gap:36px;align-items:center}
      .share h1{font-size:62px;line-height:1.05;letter-spacing:-1px}
      .share-text{font-size:19px;line-height:1.5;color:#9aa6b6;margin-top:22px}
      .share-host{font-size:15px;color:#9aa6b6;margin-top:32px}
      .share .globes{gap:8px}
      .share .globe{width:330px}`;
    document.head.append(style);
  }, description);
  await page.waitForTimeout(800);
  await page.screenshot({ path: "public/og.png" });

  // iOS fills transparent corners with black and rounds them itself, so the
  // icon is the logo on its own background color, edge to edge.
  await page.setViewportSize({ width: 180, height: 180 });
  await page.goto("http://127.0.0.1:4199/logo.svg");
  await page.evaluate(() => {
    document.documentElement.style.background = "#131b28";
    document.documentElement.querySelector("rect").setAttribute("rx", "0");
  });
  await page.screenshot({ path: "public/apple-touch-icon.png" });
  console.log("Rendered the 1200×630 share card and the 180×180 touch icon.");
} finally {
  await browser?.close();
  await new Promise((resolve) => server.httpServer.close(resolve));
}
