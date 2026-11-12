import { number } from "../../shell/catalog";

const day = 86400,
  year = 365.25 * day;

// A whole number in words where words read better.
export function count(v: number): string {
  const names: [number, string][] = [
    [1e15, "quadrillion"],
    [1e12, "trillion"],
    [1e9, "billion"],
    [1e6, "million"],
  ];
  for (const [size, name] of names)
    if (v >= size * 0.9995) return `${number(v / size)} ${name}`;
  return Math.round(v).toLocaleString("en-US");
}

// A length of time.
export function span(seconds: number): string {
  const s = Math.abs(seconds);
  if (s < 2 * day) return `${number(s / 3600)} hours`;
  if (s < 2 * year) return `${number(s / day)} days`;
  const years = s / year;
  if (years < 1000) return `${number(years)} years`;
  if (years < 1e6)
    return `${(Math.round(years / 1000) * 1000).toLocaleString("en-US")} years`;
  if (years < 1e9) return `${number(years / 1e6)} million years`;
  return `${number(years / 1e9)} billion years`;
}

// A moment on the timeline, counted from the push.
export const when = (seconds: number) =>
  seconds < 0
    ? `${span(seconds)} before the push`
    : `${span(seconds)} after the push`;

// A speed, in the unit that suits it, so that a very small one is
// still a short number.
export function speed(metersPerSecond: number): string {
  const v = Math.abs(metersPerSecond);
  if (v === 0) return "0 m/s";
  const units: [number, string][] = [
    [1000, "km/s"],
    [1, "m/s"],
    [1e-3, "mm/s"],
    [1e-6, "µm/s"],
    [1e-9, "nm/s"],
  ];
  // Each unit serves from a tenth of itself up.
  const [size, name] =
    units.find(([size]) => v >= size / 10) ?? units[units.length - 1];
  return `${number(v / size)} ${name}`;
}

export const au = (v: number) => `${number(v)} AU`;

// A mass against a body's.
export const times = (v: number) => (v >= 100 ? count(v) : number(v));

// "The Earth" in the middle of a sentence.
export const named = (label: string) =>
  label.startsWith("The ") ? "the " + label.slice(4) : label;
