// Mirrors engine/diaz. Keep field names in step with Go.
import type { Catalog as Base } from "../../shell/catalog";
import type { Surface } from "../../shell/faces";

export type Body = {
  id: string;
  label: string;
  mass: number;
  radius: number;
  orbit: number;
  star?: boolean;
  surface: Surface;
};
export type Catalog = Base & { bodies: Body[]; sources: string[] };

export type Impact = {
  time: number;
  speed: number;
  angle: number;
  energy: number;
  depth: number;
  deep: boolean;
  bound: number;
  ejecta: number;
  escaping: number;
};
export type Fate = {
  id: string;
  fate: "untouched" | "nudged" | "falls" | "dragged" | "beyond";
  time?: number;
  nudge?: number;
};
export type Chapter = {
  id: "bombs" | "fall" | "answer" | "drag";
  from: number;
  to: number;
  start: number;
  end: number;
  slowed?: boolean;
  body?: string;
  flow?: string;
};
export type Flow = {
  body: string;
  chapter: number;
  count: number;
  dirs: number;
  radii: number;
  stays: boolean;
  time: number;
  mass: number;
  edge: number;
};
export type Run = {
  needed: number;
  delivered: number;
  bombsNeeded: number;
  falls: boolean;
  perihelion: number;
  fallDays?: number;
  impact?: Impact;
  fates: Fate[];
  airGone?: number;
  seaGone?: number;
  exhausted?: boolean;
  cloudMass: number;
  ratios: { three: number; jupiter: number };
  speculative: boolean;
  chapters: Chapter[];
  time: number[];
  orbits: number[][];
  gone: number[];
  edge: number[];
  flows: Flow[];
  places: { offset: number; frames: number; bodies: number };
  rings: { offset: number; points: number; pushed: number };
  choice: { models: Record<string, string>; params: Record<string, number> };
  // Every place, outline and parcel of gas, beside the reply.
  floats: Float32Array;
};

// A moment of a run, read between two of the engine's frames.
export type Moment = {
  chapter: number;
  // The frame, with a fraction.
  at: number;
  time: number;
  edge: number;
  // x, y, z in AU for each body; null once it is in the Sun.
  bodies: ([number, number, number] | null)[];
  sizes: number[];
};

export function momentOf(run: Run, place: number): Moment {
  const last = run.chapters.length - 1;
  const chapter = Math.min(last, Math.max(0, Math.floor(place)));
  const c = run.chapters[chapter];
  const share = Math.min(1, Math.max(0, place - chapter));
  const at = c.from + share * (c.to - c.from);
  const i = Math.min(c.to - 1, Math.floor(at)),
    j = Math.min(c.to, i + 1),
    f = at - i;
  const mix = (a: number, b: number) => a + (b - a) * f;
  const n = run.places.bodies;
  const bodies: Moment["bodies"] = [];
  const sizes: number[] = [];
  for (let b = 0; b < n; b++) {
    const gone = run.gone[b];
    sizes.push(mix(run.orbits[b][i], run.orbits[b][j]));
    if (gone >= 0 && at >= gone) {
      bodies.push(null);
      continue;
    }
    const p = run.places.offset + (i * n + b) * 3,
      q = run.places.offset + (j * n + b) * 3;
    bodies.push([
      mix(run.floats[p], run.floats[q]),
      mix(run.floats[p + 1], run.floats[q + 1]),
      mix(run.floats[p + 2], run.floats[q + 2]),
    ]);
  }
  return {
    chapter,
    at,
    time: mix(run.time[i], run.time[j]),
    edge: mix(run.edge[i], run.edge[j]),
    bodies,
    sizes,
  };
}

// Where a flow's gas is at a moment: x, y, z in AU for each parcel that
// is out of the Sun, written into `into`; returns how many.
export function gasOf(
  run: Run,
  flow: Flow,
  moment: Moment,
  into: Float32Array,
): number {
  const c = run.chapters[flow.chapter];
  if (moment.at < c.from) return 0;
  if (moment.at > c.to && !flow.stays) return 0;
  const at = Math.min(c.to, moment.at) - c.from;
  const i = Math.min(c.to - c.from, Math.floor(at)),
    j = Math.min(c.to - c.from, i + 1),
    f = at - i;
  let shown = 0;
  for (let k = 0; k < flow.count; k++) {
    const a = run.floats[flow.radii + i * flow.count + k],
      b = run.floats[flow.radii + j * flow.count + k];
    // Gas not yet out, or back in the Sun, is not drawn.
    if (a === 0 && b === 0) continue;
    const r = a === 0 || b === 0 ? Math.max(a, b) : a + (b - a) * f;
    // An array with no room is only being asked how many there are.
    if (into.length >= (shown + 1) * 3)
      for (let d = 0; d < 3; d++)
        into[shown * 3 + d] = r * run.floats[flow.dirs + k * 3 + d];
    shown++;
  }
  return shown;
}

// The outline of a body's orbit at a moment, as x, y, z in AU.
export function ringOf(run: Run, moment: Moment, body: number): number[] {
  // Mercury's path changes at the push.
  const ring = body === 1 && moment.chapter >= 1 ? run.rings.pushed : body;
  const from = run.rings.offset + (ring - 1) * run.rings.points * 3;
  const out: number[] = [];
  for (let k = 0; k < run.rings.points * 3; k++)
    out.push(run.floats[from + k] * moment.sizes[body]);
  return out;
}
