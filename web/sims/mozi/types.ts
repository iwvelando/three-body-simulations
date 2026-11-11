// Mirrors engine/mozi. Keep field names in step with Go.
export type { Catalog, Model, Param, Slot } from "../../shell/catalog";

export type Era = {
  kind: "stable" | "chaotic";
  from: number;
  to: number;
  days: number;
};
export type Run = {
  span: number;
  calendar: {
    rise: number[];
    length: number[];
    daylight: number[];
    size: number[];
    light: number[];
    regular: boolean[];
  };
  eras: Era[];
  standard: { daylight: number; size: number };
  // Directions fixed on the inner shell, and a brightness.
  stars: [number, number, number, number][];
  summary: {
    sunrises: number;
    stable: number;
    chaotic: number;
    longestStable: number;
    stableShare: number;
  };
  choice: { models: Record<string, string>; params: Record<string, number> };
};
export type Vec = [number, number, number];
export type Quat = [number, number, number, number];
export type Frames = {
  time: number[];
  sun: Vec[];
  size: number[];
  brightness: number[];
  light: number[];
  outer: Quat[];
  inner: Quat[];
  outerRadius: number[];
  innerRadius: number[];
  hole: number[];
  flying: Vec[][];
};
// The machine at one moment, read between two frames.
export type View = {
  time: number;
  sun: Vec;
  size: number;
  brightness: number;
  light: number;
  outer: Quat;
  inner: Quat;
  outerRadius: number;
  innerRadius: number;
  hole: number;
  flying: Vec[];
};
