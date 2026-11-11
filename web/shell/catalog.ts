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
// zeros.
export function number(v: number): string {
  if (v === 0) return "0";
  const a = Math.abs(v);
  if (a >= 100) return v.toFixed(0);
  if (a >= 10) return v.toFixed(1).replace(/\.0$/, "");
  if (a >= 1) return v.toFixed(2).replace(/\.?0+$/, "");
  // Very small values come back in powers of ten, which have no
  // trailing zeros to trim.
  const text = v.toPrecision(2);
  return text.includes("e") ? text : text.replace(/\.?0+$/, "");
}
