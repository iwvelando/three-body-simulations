// How the engine describes a body's face (engine/core).
export type Surface = {
  kind: string;
  colors: string[];
  spot?: string;
  rings?: string;
  caps?: boolean;
};

// What a body's face looks like at a point on it. Where NASA has
// published a map of the body, that is used once it loads (see `mapped`);
// until then, and for the bodies without one, the face is a likeness made
// from noise in the colors the engine's description gives.

// Bodies with a map in public/planets. docs/models-flat.md says where
// each came from.
export const mapped = new Set([
  "mercury",
  "venus",
  "earth",
  "mars",
  "jupiter",
  "saturn",
  "neptune",
  "pluto",
]);

export const parts = (hex: string) =>
  [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
export const blend = (a: number[], b: number[], t: number) =>
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

const white = [246, 248, 250];

// The likeness at a point of a ball of radius one, in the body's own
// frame: x east, y to its pole, z toward whoever is looking. `facing` is
// how squarely the point faces them, from 0 at the limb to 1.
export function likeness(
  surface: Surface,
  x: number,
  y: number,
  z: number,
  facing: number,
): number[] {
  const colors = surface.colors.map(parts);
  let col: number[];
  switch (surface.kind) {
    case "star": {
      const grain = rough(x * 9, y * 9, z * 9, 3);
      col = blend(colors[1], colors[0], grain * 1.6 - 0.35);
      // Darker toward the limb.
      col = blend(colors[2], col, 0.25 + 0.75 * facing);
      break;
    }
    case "earth": {
      const land = rough(x * 2.1 + 3, y * 2.1 + 1, z * 2.1 + 7, 5);
      const dry = rough(x * 4 + 11, y * 4, z * 4, 3);
      col =
        land > 0.52
          ? blend(colors[1], colors[2], (dry - 0.4) * 3 + (0.3 - Math.abs(y)))
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
  if (surface.spot) {
    // One marking, south of the equator on the near side.
    const dx = (x - 0.25) / 0.3,
      dy = (y + 0.38) / 0.17;
    col = blend(
      col,
      parts(surface.spot),
      z > 0 ? (1 - dx * dx - dy * dy) * 2.5 : 0,
    );
  }
  if (surface.caps && Math.abs(y) > 0.88) col = white;
  return col;
}

// A map of a body's whole face, by longitude and latitude, for wrapping
// around a ball: the likeness at once, and NASA's map over it when that
// has loaded. `changed` is called then. The canvas keeps one size
// throughout, since whatever is wrapped in it was sized from it.
export function chart(
  id: string,
  surface: Surface,
  changed: () => void,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 512;
  const c = canvas.getContext("2d");
  if (!c) return canvas;
  const small = document.createElement("canvas");
  small.width = 256;
  small.height = 128;
  const g = small.getContext("2d");
  if (!g) return canvas;
  const image = g.createImageData(small.width, small.height);
  for (let j = 0; j < small.height; j++)
    for (let i = 0; i < small.width; i++) {
      const lon = ((i + 0.5) / small.width - 0.5) * 2 * Math.PI,
        lat = (0.5 - (j + 0.5) / small.height) * Math.PI;
      const col = likeness(
        surface,
        Math.cos(lat) * Math.sin(lon),
        Math.sin(lat),
        Math.cos(lat) * Math.cos(lon),
        1,
      );
      const at = 4 * (j * small.width + i);
      for (let k = 0; k < 3; k++)
        image.data[at + k] = Math.min(255, Math.max(0, col[k]));
      image.data[at + 3] = 255;
    }
  g.putImageData(image, 0, 0);
  c.drawImage(small, 0, 0, canvas.width, canvas.height);
  if (mapped.has(id)) {
    const picture = new Image();
    picture.onload = () => {
      c.drawImage(picture, 0, 0, canvas.width, canvas.height);
      changed();
    };
    picture.src = `./planets/${id}.jpg`;
  }
  return canvas;
}
