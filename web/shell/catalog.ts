// What every simulation's catalog looks like. Mirrors engine/core; keep
// field names in step with Go.
export type Param = {
  id: string;
  label: string;
  unit: string;
  min: number;
  max: number;
  default: number;
  log?: boolean;
  help: string;
  when: "always" | "on" | "off";
  basic?: boolean;
  // A count: it moves in whole numbers.
  whole?: boolean;
};
export type Model = {
  id: string;
  label: string;
  summary: string;
  citation: string;
  params: string[];
  speculative?: boolean;
};
export type Slot = { id: string; label: string; help: string; models: Model[] };
export type Preset = {
  id: string;
  label: string;
  summary: string;
  models: Record<string, string>;
  params: Record<string, number>;
};
export type Catalog = { slots: Slot[]; params: Param[]; presets: Preset[] };

// A number for a readout: about three significant figures, no trailing
// zeros, and commas in the thousands.
export function number(v: number): string {
  if (v === 0) return "0";
  const a = Math.abs(v);
  if (a >= 100) return Math.round(v).toLocaleString("en-US");
  if (a >= 10) return v.toFixed(1).replace(/\.0$/, "");
  if (a >= 1) return v.toFixed(2).replace(/\.?0+$/, "");
  // Very small values come back in powers of ten; the zeros to trim are
  // then the ones before the power.
  return v.toPrecision(3).replace(/\.?0+(e|$)/, "$1");
}

// How a slider stands for a parameter. Logarithmic parameters slide in
// log10. A count moves in whole numbers. Other parameters have 200 stops,
// which seldom include the value they start from, so a stop within half a
// step of that value gives the value itself: a visitor can always put a
// slider back where it was.
export function scale(spec: Param) {
  const to = (v: number) => (spec.log ? Math.log10(v) : v);
  const step = spec.whole ? 1 : (to(spec.max) - to(spec.min)) / 200;
  const from = (position: number) => {
    if (Math.abs(position - to(spec.default)) <= step / 2) return spec.default;
    const v = spec.log ? 10 ** position : position;
    return Math.min(
      spec.max,
      Math.max(spec.min, spec.whole ? Math.round(v) : v),
    );
  };
  return { min: to(spec.min), max: to(spec.max), step, to, from };
}
