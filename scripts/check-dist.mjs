import { existsSync, readFileSync, statSync } from "node:fs";
for (const file of [
  "index.html",
  "engine.wasm",
  "wasm_exec.js",
  "worker.js",
  "logo.svg",
  "robots.txt",
  "sitemap.xml",
  "og.png",
  "apple-touch-icon.png",
  "starry-night.jpg",
  "planets/earth.jpg",
  "planets/jupiter.jpg",
  "404.html",
  "GO-LICENSE",
  "THIRD-PARTY-NOTICES.txt",
])
  if (!existsSync(`dist/${file}`) || !statSync(`dist/${file}`).size)
    throw Error(`Missing distribution artifact: ${file}`);
const html = readFileSync("dist/index.html", "utf8");
if (!html.includes("<title>Three-Body Simulations</title>"))
  throw Error("Missing metadata");
// The only absolute URLs are the site's own, for link previews and crawlers.
const site = "https://three-body.isaacvelando.com/";
for (const [url] of html.matchAll(/https?:\/\/[^"'\s<>]+/g))
  if (!url.startsWith(site) && !url.startsWith("http://www.w3.org/"))
    throw Error(`index.html must not reference another origin: ${url}`);
if (!html.includes(`${site}og.png`)) throw Error("Missing link-preview image");
if (
  !readFileSync("dist/robots.txt", "utf8").includes(
    `Sitemap: ${site}sitemap.xml`,
  )
)
  throw Error("Missing sitemap declaration");
// A site without its engine cannot run anything.
if (statSync("dist/engine.wasm").size < 1_000_000)
  throw Error("engine.wasm is too small to be the engine");
console.log("Static distribution complete.");
