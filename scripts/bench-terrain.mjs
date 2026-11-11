// Times terrain runs through the built WASM engine: node scripts/bench-terrain.mjs
import { readFileSync } from "node:fs";
await import("../public/wasm_exec.js");
const go = new globalThis.Go();
const { instance } = await WebAssembly.instantiate(
  readFileSync("public/engine.wasm"),
  go.importObject,
);
void go.run(instance);
for (const [label, request] of [
  ["mountains, defaults", { scene: "mountains" }],
  ["crater, dry", { scene: "crater" }],
  ["crater, rain on bare ground", { scene: "crater", params: { rain: 1 } }],
  [
    "crater, rain, 20 million years",
    { scene: "crater", params: { rain: 1, duration: 20 } },
  ],
  [
    "mountains, uplift, 20 million years",
    { scene: "mountains", params: { uplift: 0.5, duration: 20 } },
  ],
]) {
  const started = performance.now();
  globalThis.threeBodyTerrain(
    JSON.stringify({ sim: "earth", action: "terrain", ...request }),
  );
  console.log(`${label}: ${(performance.now() - started).toFixed(0)} ms`);
}
process.exit(0);
