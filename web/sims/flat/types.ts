// Mirrors engine/flat. Keep field names in step with Go.
import type { Catalog as Base } from "../../shell/catalog";
export type { Model, Param, Slot } from "../../shell/catalog";

export type Layer = {
  id: string;
  label: string;
  outer: number;
  density: number;
  color: string;
  schematic?: string;
  sea?: boolean;
};
import type { Surface } from "../../shell/faces";
export type { Surface };
export type Body = {
  surface: Surface;
  id: string;
  label: string;
  radius: number;
  orbit: number;
  source: string;
  star?: boolean;
  layers: Layer[];
};
export type Catalog = Base & {
  bodies: Body[];
  focus: Record<string, string>;
};
export type PaintingCatalog = Base;

export type Band = { mix: number[] };
export type Choice = {
  models: Record<string, string>;
  params: Record<string, number>;
};
export type Run = {
  body: Body;
  area: number;
  radius: number;
  duration: number;
  crossing: number;
  rimSpeed: number;
  fasterThanLight: boolean;
  rings: { layer: string; inner: number; outer: number }[];
  grain: number;
  bands: Band[];
  person: number;
  // Moments evenly spaced over the whole fall, and over its start up to
  // the crossing, which comes too soon for the first to show.
  frames: Frames;
  early: Frames;
  choice: Choice;
};
export type Frames = {
  time: number[];
  sink: number[];
  foot: number[];
  rim: number[];
  bands: number[][];
};

export type SkyBody = {
  body: Body;
  x: number;
  y: number;
  radius: number;
  order: number;
  edges: number[];
  bands: Band[];
};
export type Sky = {
  bodies: SkyBody[];
  origin: [number, number];
  covered: number;
  touching: [string, string][];
  choice: Choice;
};

export type Section = { offset: number; width: number; height: number };
export type Painted = {
  width: number;
  height: number;
  cols: number;
  rows: number;
  u: number[];
  mesh: { offset: number; count: number };
  mirror: boolean;
  line: [number, number, number, number];
  still: boolean;
  core?: { halfWidth: number; halfHeight: number; color: number[] };
  texture: Section;
  back: Section;
  flat: Section;
  restored: Section;
  area: number;
  across: number;
  tall: number;
  thin: boolean;
  stretch?: number;
  radial?: number;
  dilution?: number;
  score: number;
  choice: Choice;
  bytes: Uint8Array;
};
export type Snow = { count: number; size: number; bytes: Uint8Array };
