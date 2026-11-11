import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
await import("../public/wasm_exec.js");
const go = new globalThis.Go();
const { instance } = await WebAssembly.instantiate(
  readFileSync("public/engine.wasm"),
  go.importObject,
);
void go.run(instance);
assert.equal(typeof globalThis.threeBody, "function");
const ask = (request) =>
  JSON.parse(globalThis.threeBody(JSON.stringify(request)));
const catalog = ask({ sim: "earth", action: "catalog" });
assert.ok(catalog.slots.length >= 8);
assert.equal(catalog.presets[0].id, "green-glasses");
const living = ask({ sim: "earth", action: "run", life: true });
const lifeless = ask({ sim: "earth", action: "run", life: false });
assert.equal(living.summary.state, "temperate");
assert.equal(lifeless.summary.state, "dry");
assert.equal(living.time.length, living.series.temperature.length);
assert.equal(
  ask({ sim: "earth", action: "run", params: { "weathering.te": 1e9 } }).field,
  "params.weathering.te",
);
assert.ok(JSON.parse(globalThis.threeBody("{")).error);
const terrain = globalThis.threeBodyTerrain(
  JSON.stringify({
    sim: "earth",
    action: "terrain",
    scene: "mountains",
    params: { duration: 0.2 },
  }),
);
const meta = JSON.parse(terrain.json);
assert.ok(terrain.heights instanceof Float32Array);
assert.equal(terrain.heights.length, meta.times.length * meta.size * meta.size);
assert.equal(terrain.cover.length, meta.size * meta.size);
assert.ok(
  Math.abs(
    Math.max(...terrain.heights.subarray(0, meta.size * meta.size)) -
      meta.peaks[0][0],
  ) < 1,
);
assert.equal(
  typeof globalThis.threeBodyTerrain(
    JSON.stringify({ sim: "earth", action: "terrain", scene: "x" }),
  ),
  "string",
);
const machine = ask({ sim: "mozi", action: "run", preset: "clockwork" });
assert.deepEqual(
  machine.eras.map((e) => e.kind),
  ["stable"],
);
assert.equal(machine.calendar.rise.length, machine.calendar.regular.length);
const sky = ask({ sim: "mozi", action: "sky", from: 1, step: 0.01, count: 4 });
assert.equal(sky.sun.length, 4);
assert.equal(sky.inner[0].length, 4);
assert.equal(
  ask({ sim: "mozi", action: "sky", from: 1, step: 0, count: 4 }).field,
  "step",
);
console.log(
  "WASM bridge: Earth catalog, runs, terrain arrays and refusals; Mozi calendar and sky passed.",
);
process.exit(0);
