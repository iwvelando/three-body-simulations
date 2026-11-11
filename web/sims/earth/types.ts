// Mirrors engine/core and engine/earth. Keep field names in step with Go.
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

export type SeriesName =
  | "luminosity"
  | "temperature"
  | "equilibrium"
  | "co2"
  | "o2"
  | "n2"
  | "ocean"
  | "stratosphere"
  | "loss"
  | "land"
  | "biology"
  | "productivity"
  | "shield"
  | "melt"
  | "ice"
  | "vegetation";
export type EarthEvent = { id: string; time: number };
export type Result = {
  life: boolean;
  time: number[];
  series: Record<SeriesName, number[]>;
  events: EarthEvent[] | null;
  summary: { state: string; oceansLost: number; extrapolated: boolean };
  choice: { models: Record<string, string>; params: Record<string, number> };
};
export type Pair = { living: Result; lifeless: Result };
