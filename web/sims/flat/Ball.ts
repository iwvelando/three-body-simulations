import { likeness, mapped } from "../../shell/faces";
import type { Surface } from "./types";

// A body's face as a lit ball. Where NASA has published a map of the
// body it is wrapped around the ball; until that arrives, and for the
// bodies without one, the face is a likeness made from noise in the
// colors the engine's description gives.

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
      } else col = likeness(surface, x, y, z, sz);
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
