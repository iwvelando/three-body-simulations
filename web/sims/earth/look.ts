import type { Look } from "./Globe";
import type { Result } from "./types";

const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (v: number) => Math.min(1, Math.max(0, v));

// Turns the run's numbers at a (fractional) sample into what the globe
// draws. These mappings are for the picture only.
export function lookAt(r: Result, position: number): Look {
  const i = Math.min(r.time.length - 2, Math.max(0, Math.floor(position)));
  const t = clamp(position - i);
  const at = (name: keyof Result["series"]) =>
    mix(r.series[name][i], r.series[name][i + 1], t);
  const melt = at("melt");
  const water = at("ocean");
  const T = at("equilibrium");
  const co2 = at("co2");
  const wet = water > 0 ? 1 : 0;
  // Today 71% of the surface is sea; less land or less water moves that.
  const sea = wet * clamp((1 - 0.29 * at("land")) * Math.min(1, water) ** 0.4);
  const steam = clamp((T - 330) / 60);
  const arid = Math.max(
    1 - wet,
    clamp((T - 300) / 50) * (1 - at("vegetation")),
  );
  const thick = clamp((Math.log10(co2) + 1) / 2.5);
  const blue = [0.35, 0.62, 1.0],
    orange = [0.95, 0.6, 0.28],
    fire = [1.0, 0.42, 0.16];
  const air = blue.map((b, k) =>
    mix(mix(b, orange[k], Math.max(thick, 1 - wet)), fire[k], melt),
  ) as [number, number, number];
  return {
    melt,
    sea,
    ice: at("ice"),
    vegetation: at("vegetation"),
    arid,
    cloud: wet * (1 - melt) * mix(0.55, 0.95, steam),
    air,
  };
}
