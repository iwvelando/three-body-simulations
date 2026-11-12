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
const fall = ask({ sim: "flat", action: "run", body: "earth" });
assert.equal(fall.rings.at(-1).layer, "ocean");
assert.equal(fall.frames.rim.length, fall.frames.time.length);
// The run up to the crossing has frames of its own, from nothing flat.
assert.equal(fall.early.rim[0], 0);
assert.ok(Math.abs(fall.early.time.at(-1) / fall.crossing - 1) < 1e-9);
// Rounding differs between processors and WebAssembly; no body's fall
// may come back without a number on any of them.
for (const body of ask({ sim: "flat", action: "catalog" }).bodies)
  for (const landing of ["shells", "spread"])
    assert.equal(
      ask({ sim: "flat", action: "run", body: body.id, models: { landing } })
        .error,
      undefined,
      `${body.id} ${landing}`,
    );
assert.equal(ask({ sim: "flat", action: "sky" }).bodies.length, 10);
assert.equal(ask({ sim: "flat", action: "painting" }).field, "action");
const picture = new Uint8Array(4 * 16 * 12).map((_, i) => (i * 37) % 256);
const painted = globalThis.threeBodyBytes(
  JSON.stringify({ sim: "flat", action: "painting", width: 16, height: 12 }),
  picture,
);
const told = JSON.parse(painted.json);
assert.ok(painted.bytes instanceof Uint8Array);
assert.equal(
  painted.bytes.length,
  told.restored.offset + 4 * told.restored.width * told.restored.height,
);
assert.equal(told.mesh.offset % 4, 0);
assert.ok(told.score > 0.5);
assert.equal(
  JSON.parse(
    globalThis.threeBodyBytes(
      JSON.stringify({ sim: "flat", action: "painting", width: 16, height: 9 }),
      picture,
    ),
  ).field,
  "pixels",
);
const snow = globalThis.threeBodyBytes(
  JSON.stringify({ sim: "flat", action: "snowflakes", count: 2, size: 32 }),
);
assert.equal(snow.bytes.length, 2 * 32 * 32);
console.log(
  "WASM bridge: Earth catalog, runs, terrain arrays and refusals; Mozi calendar and sky; flat falls, sky, pictures and snow as bytes passed.",
);
process.exit(0);
