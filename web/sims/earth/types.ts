// Mirrors engine/earth. Keep field names in step with Go. The catalog's
// own types are shared by every simulation.
export type { Catalog, Model, Param, Preset, Slot } from "../../shell/catalog";

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
