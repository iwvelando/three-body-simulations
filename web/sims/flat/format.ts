import type { Band, Body } from "./types";

// About three figures, with commas: 23,200 or 0.68.
export const figure = (v: number, digits = 3) =>
  v.toLocaleString("en-US", { maximumSignificantDigits: digits });

const AU = 149.6e6,
  lightYear = 9.4607e12;

// A length given in kilometers, in whatever unit reads best.
export function length(km: number): string {
  const m = Math.abs(km) * 1000;
  if (m === 0) return "0 m";
  if (m < 1e-6) return `${figure(m * 1e9)} nm`;
  if (m < 1e-3) return `${figure(m * 1e6)} µm`;
  if (m < 1) return `${figure(m * 1e3)} mm`;
  if (m < 1000) return `${figure(m)} m`;
  if (km < 1e6) return `${figure(km)} km`;
  if (km < 0.2 * AU) return `${figure(km / 1e6)} million km`;
  if (km < 0.2 * lightYear) return `${figure(km / AU)} AU`;
  const years = figure(km / lightYear);
  return `${years} light-year${years === "1" ? "" : "s"}`;
}

export function duration(seconds: number): string {
  const many = (v: number, unit: string) =>
    `${figure(v)} ${unit}${figure(v) === "1" ? "" : "s"}`;
  if (seconds === 0) return "0 seconds";
  if (seconds < 1e-3) return many(seconds * 1e6, "microsecond");
  if (seconds < 1) return many(seconds * 1e3, "millisecond");
  if (seconds < 120) return many(Math.round(seconds * 10) / 10, "second");
  if (seconds < 7200) return many(Math.round(seconds / 6) / 10, "minute");
  return many(Math.round(seconds / 360) / 10, "hour");
}

// "The Sun" in the middle of a sentence, and "Sun" after "flat".
export const named = (b: Body) => b.label.replace(/^The /, "the ");
export const bare = (b: Body) => b.label.replace(/^The /, "");

const parts = (hex: string) =>
  [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

// A band's color: its layers' colors in the shares it holds of each.
export function bandColor(band: Band, body: Body): [number, number, number] {
  const out: [number, number, number] = [0, 0, 0];
  band.mix.forEach((share, i) => {
    const c = parts(body.layers[i].color);
    for (let k = 0; k < 3; k++) out[k] += share * c[k];
  });
  return out;
}
export const css = (c: number[], alpha = 1) =>
  `rgba(${c.map((v) => Math.round(v)).join(",")},${alpha})`;

// A repeatable scatter for stars, sparks and brush strokes.
export function scatter(seed: number) {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const still = () =>
  matchMedia("(prefers-reduced-motion: reduce)").matches;
