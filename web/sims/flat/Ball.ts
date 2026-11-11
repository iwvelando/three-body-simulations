import type { Surface } from "./types";

// A body's face as a lit ball. Where NASA has published a map of the
// body it is wrapped around the ball; until that arrives, and for the
// bodies without one, the face is a likeness made from noise in the
// colors the engine's description gives.

// Bodies with a map in public/planets. docs/models-flat.md says where
// each came from.
const mapped = new Set([
  "mercury",
  "venus",
  "earth",
  "mars",
  "jupiter",
  "saturn",
  "neptune",
  "pluto",
]);

const parts = (hex: string) =>
  [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const blend = (a: number[], b: number[], t: number) =>
  a.map((v, k) => v + (b[k] - v) * Math.min(1, Math.max(0, t)));

// Smooth noise in space, so it wraps around a ball without a seam.
function hash(x: number, y: number, z: number) {
  let h =
    Math.imul(x, 374761393) ^
    Math.imul(y, 668265263) ^
    Math.imul(z, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function noise(x: number, y: number, z: number) {
  const xi = Math.floor(x),
    yi = Math.floor(y),
    zi = Math.floor(z);
  const ease = (t: number) => t * t * (3 - 2 * t);
  const u = ease(x - xi),
    v = ease(y - yi),
    w = ease(z - zi);
  let total = 0;
  for (let c = 0; c < 8; c++) {
    const dx = c & 1,
      dy = (c >> 1) & 1,
      dz = c >> 2;
    total +=
      hash(xi + dx, yi + dy, zi + dz) *
      (dx ? u : 1 - u) *
      (dy ? v : 1 - v) *
      (dz ? w : 1 - w);
  }
  return total;
}
function rough(x: number, y: number, z: number, octaves = 4) {
  let total = 0,
    size = 0.5,
    reach = 0;
  for (let o = 0; o < octaves; o++) {
    total += size * noise(x, y, z);
    reach += size;
    size /= 2;
    x *= 2.03;
    y *= 2.03;
    z *= 2.03;
  }
  return total / reach;
}

const made = new Map<string, HTMLCanvasElement>();
const side = 384;

type Chart = { width: number; height: number; data: Uint8ClampedArray };

// The ball for a body. It is drawn at once from the description, and
// drawn over from the body's map when that has loaded; `changed` is
// called then, so whoever shows it can show it again.
export function ball(
  id: string,
  surface: Surface,
  changed: () => void,
): HTMLCanvasElement {
  const held = made.get(id);
  if (held) return held;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = side;
  made.set(id, canvas);
  paint(canvas, surface, null);
  if (mapped.has(id)) {
    const picture = new Image();
    picture.onload = () => {
      const flat = document.createElement("canvas");
      flat.width = picture.naturalWidth;
      flat.height = picture.naturalHeight;
      const g = flat.getContext("2d", { willReadFrequently: true });
      if (!g) return;
      g.drawImage(picture, 0, 0);
      paint(canvas, surface, g.getImageData(0, 0, flat.width, flat.height));
      changed();
    };
    picture.src = `./planets/${id}.jpg`;
  }
  return canvas;
}

function paint(
  canvas: HTMLCanvasElement,
  surface: Surface,
  chart: Chart | null,
) {
  const c = canvas.getContext("2d");
  if (!c) return;
  const image = c.createImageData(side, side);
  const colors = surface.colors.map(parts);
  const spot = surface.spot ? parts(surface.spot) : null;
  const white = [246, 248, 250];
  // Leaning a little, as planets do.
  const lean = 0.35,
    cl = Math.cos(lean),
    sl = Math.sin(lean);
  for (let j = 0; j < side; j++)
    for (let i = 0; i < side; i++) {
      const sx = (2 * (i + 0.5)) / side - 1,
        sy = (2 * (j + 0.5)) / side - 1,
        d = sx * sx + sy * sy;
      if (d > 1) continue;
      const sz = Math.sqrt(1 - d);
      // The same point in the body's own frame: x east, y to its pole.
      const x = sx * cl + sy * sl,
        y = -(-sx * sl + sy * cl),
        z = sz;
      let col: number[];
      if (chart) {
        // The map is laid out by longitude and latitude.
        const u = Math.atan2(x, z) / (2 * Math.PI) + 0.5,
          v = 0.5 - Math.asin(Math.max(-1, Math.min(1, y))) / Math.PI,
          at =
            4 *
            (Math.min(chart.height - 1, Math.floor(v * chart.height)) *
              chart.width +
              Math.min(chart.width - 1, Math.floor(u * chart.width)));
        col = [chart.data[at], chart.data[at + 1], chart.data[at + 2]];
      } else
        switch (surface.kind) {
          case "star": {
            const grain = rough(x * 9, y * 9, z * 9, 3);
            col = blend(colors[1], colors[0], grain * 1.6 - 0.35);
            // Darker toward the limb.
            col = blend(colors[2], col, 0.25 + 0.75 * sz);
            break;
          }
          case "earth": {
            const land = rough(x * 2.1 + 3, y * 2.1 + 1, z * 2.1 + 7, 5);
            const dry = rough(x * 4 + 11, y * 4, z * 4, 3);
            col =
              land > 0.52
                ? blend(
                    colors[1],
                    colors[2],
                    (dry - 0.4) * 3 + (0.3 - Math.abs(y)),
                  )
                : blend(colors[0], [40, 110, 170], (land - 0.4) * 6);
            const ice = Math.abs(y) + 0.08 * (dry - 0.5);
            if (ice > 0.86) col = colors[3];
            const cloud = rough(x * 3 + 20, y * 6 + 5, z * 3 + 9, 4);
            col = blend(col, white, (cloud - 0.52) * 4.5);
            break;
          }
          case "cloud": {
            const swirl = rough(x * 2 + y * 3, y * 5, z * 2 + y * 2, 4);
            col = blend(colors[1], colors[2], swirl * 2 - 0.5);
            col = blend(col, colors[0], 0.4);
            break;
          }
          case "bands": {
            const wobble = 0.05 * (rough(x * 5, y * 14, z * 5, 3) - 0.5);
            const at = ((y + wobble + 1) / 2) * colors.length * 1.6;
            const k = Math.floor(at);
            // Near the south pole the wobble can dip below the first band.
            const pick = (n: number) =>
              colors[((n % colors.length) + colors.length) % colors.length];
            col = blend(pick(k), pick(k + 1), (at - k) * 3 - 1);
            col = blend(col, colors[0], 0.25 * rough(x * 8, y * 30, z * 8, 2));
            break;
          }
          default: {
            const ground = rough(x * 3 + 5, y * 3, z * 3 + 2, 5);
            col = blend(colors[1], colors[0], ground * 2.4 - 0.7);
            const pit = rough(x * 11, y * 11 + 4, z * 11, 2);
            col = blend(col, colors[2], (pit - 0.62) * 5);
          }
        }
      if (spot && !chart) {
        // One marking, south of the equator on the near side.
        const dx = (x - 0.25) / 0.3,
          dy = (y + 0.38) / 0.17;
        col = blend(col, spot, z > 0 ? (1 - dx * dx - dy * dy) * 2.5 : 0);
      }
      if (surface.caps && !chart && Math.abs(y) > 0.88) col = white;
      // Lit from the upper left; a star lights itself.
      const light =
        surface.kind === "star"
          ? 1
          : 0.22 + 0.9 * Math.max(0, -0.45 * sx - 0.5 * sy + 0.74 * sz);
      const at = 4 * (j * side + i);
      for (let k = 0; k < 3; k++)
        image.data[at + k] = Math.min(255, Math.max(0, col[k] * light));
      // Soften the last dot of the edge.
      image.data[at + 3] = 255 * Math.min(1, (1 - Math.sqrt(d)) * side * 0.5);
    }
  c.putImageData(image, 0, 0);
}
