import type { Result } from "./types";

export const ageNow = 4.5;

// "3.2 billion years ago", "540 million years ago", "Today".
export function whenLabel(age: number): string {
  const ago = ageNow - age;
  if (ago < 0.0005) return "Today";
  if (ago >= 0.9995)
    return `${ago.toFixed(ago >= 4.45 ? 3 : 1).replace(/\.?0+$/, "")} billion years ago`;
  return `${Math.round(ago * 1000)} million years ago`;
}
// The same without abbreviations a reader may not know (Ga, Ma).
export const shortWhen = (age: number) => {
  const ago = ageNow - age;
  if (ago < 0.0005) return "today";
  return ago >= 1
    ? `${ago.toFixed(1)} billion years ago`
    : `${Math.round(ago * 1000)} million years ago`;
};

export const celsius = (kelvin: number) => `${Math.round(kelvin - 273.15)} °C`;

export function pressure(bar: number): string {
  if (bar >= 100) return `${Math.round(bar)} bar`;
  if (bar >= 1) return `${bar.toFixed(1)} bar`;
  if (bar >= 0.01) return `${bar.toFixed(2)} bar`;
  if (bar >= 1e-6) return `${Math.round(bar * 1e6)} ppm`;
  return "none";
}
// Always to two places, so readings line up; a trace too small for that
// is said to be one rather than shown as nothing.
export const oceans = (w: number) =>
  w <= 0
    ? "none"
    : w < 0.005
      ? "less than 0.01 oceans"
      : `${w.toFixed(2)} oceans`;

export { number } from "../../shell/catalog";

const names: Record<string, string> = {
  "surface-solid": "Surface hardens",
  "life-begins": "Life begins",
  "oxygen-rises": "Oxygen rises",
  "land-plants": "Plants take the land",
  "moist-greenhouse": "Upper air turns wet",
  "half-ocean": "Half the water gone",
  "oceans-lost": "Oceans gone",
};
export const eventName = (id: string) => names[id] ?? id;

// The last sample at or before an age.
export function indexAt(r: Result, age: number): number {
  let lo = 0,
    hi = r.time.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (r.time[mid] <= age) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

// One sentence on how the run ended.
export function verdict(r: Result): string {
  const who = r.life ? "Living Earth today" : "Lifeless Earth today";
  const last = r.time.length - 1;
  const T = celsius(r.series.equilibrium[last]);
  const co2 = pressure(r.series.co2[last]);
  switch (r.summary.state) {
    case "dry":
      return `${who}: dry. The last water left ${whenLabel(r.summary.oceansLost).toLowerCase()}, and the surface sits at ${T} under ${co2} of carbon dioxide.`;
    case "hot":
      return `${who}: hot, ${T} under ${co2} of carbon dioxide, and still wet with ${oceans(r.series.ocean[last])} of water.`;
    case "frozen":
      return `${who}: frozen, ${T}, with ${oceans(r.series.ocean[last])} of water locked under ice.`;
    default:
      return `${who}: temperate, ${T}, with ${oceans(r.series.ocean[last])} of water and ${pressure(r.series.co2[last])} of carbon dioxide.`;
  }
}
