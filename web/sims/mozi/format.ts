import type { Era, Frames, Quat, Run, Vec, View } from "./types";

const whole = (n: number) => Math.round(n).toLocaleString("en-US");
export const days = (n: number) => {
  if (n < 1) return "less than a day";
  const r = Math.round(n);
  return r === 1 ? "1 day" : `${whole(r)} days`;
};
// Days are counted from 1, as a calendar does.
export const dayOf = (t: number) => Math.floor(t) + 1;
export const dayLabel = (t: number) =>
  `Day ${dayOf(t).toLocaleString("en-US")}, hour ${Math.floor((t - Math.floor(t)) * 24)}`;
export const eraName = (e: Era) =>
  e.kind === "stable" ? "Stable Era" : "Chaotic Era";

export const height = (sun: Vec) =>
  (Math.asin(Math.max(-1, Math.min(1, sun[2]))) * 180) / Math.PI;

// How much daylight fills the sky, 0 to 1: it fades in as the sun clears
// the horizon and follows the sun's light, as Mozi has the scattered
// light around the patch do.
export const daylight = (view: View) =>
  Math.max(0, Math.min(1, (height(view.sun) + 6) / 18)) *
  Math.max(0, Math.min(1, 0.25 + 0.75 * view.light));
// The sky's color by night and by day.
export const nightSky = [9, 13, 26],
  daySky = [96, 150, 201];

export function eraAt(run: Run, t: number): number {
  const k = run.eras.findIndex((e) => t < e.to);
  return k < 0 ? run.eras.length - 1 : k;
}

// What the calendar says is coming, in a sentence or two.
export function forecast(run: Run, t: number): string {
  const k = eraAt(run, t);
  const now = run.eras[k];
  const next = run.eras[k + 1];
  if (!next) return `This ${eraName(now)} lasts to the end of the calendar.`;
  const ends = `This ${eraName(now)} ends in ${days(now.to - t)}.`;
  return k + 2 === run.eras.length
    ? `${ends} A ${eraName(next)} follows and lasts past the end of the calendar.`
    : `${ends} A ${eraName(next)} of ${days(next.to - next.from)} follows.`;
}

export function verdict(run: Run): string {
  const { stable, chaotic, longestStable, stableShare } = run.summary;
  const span = `${whole(run.span)} days`;
  if (stable === 0)
    return `In ${span} the machine predicts no Stable Era at all.`;
  if (chaotic === 0)
    return `The machine predicts one Stable Era that lasts all ${span}.`;
  const count = stable === 1 ? "one Stable Era" : `${stable} Stable Eras`;
  const share = Math.round(stableShare * 100);
  return `In ${span} the machine predicts ${count}. The longest lasts ${days(longestStable)}; ${share < 1 ? "less than 1" : share}% of the time is stable.`;
}

const mix = (a: number, b: number, f: number) => a + (b - a) * f;
function unit<T extends number[]>(v: T): T {
  const n = Math.hypot(...v) || 1;
  return v.map((x) => x / n) as T;
}
const mixVec = (a: Vec, b: Vec, f: number): Vec =>
  unit([mix(a[0], b[0], f), mix(a[1], b[1], f), mix(a[2], b[2], f)]);
function mixQuat(a: Quat, b: Quat, f: number): Quat {
  // q and −q are the same attitude; take the short way round.
  const s = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3] < 0 ? -1 : 1;
  return unit([
    mix(a[0], s * b[0], f),
    mix(a[1], s * b[1], f),
    mix(a[2], s * b[2], f),
    mix(a[3], s * b[3], f),
  ]);
}

// The machine at time t, read between the two nearest frames, or null
// when the frames do not cover t.
export function viewAt(frames: Frames, t: number): View | null {
  const n = frames.time.length;
  if (n < 2) return null;
  const step = frames.time[1] - frames.time[0];
  const at = (t - frames.time[0]) / step;
  if (at < -1e-6 || at > n - 1 + 1e-6) return null;
  const i = Math.min(n - 2, Math.max(0, Math.floor(at)));
  const f = Math.min(1, Math.max(0, at - i));
  return {
    time: t,
    sun: mixVec(frames.sun[i], frames.sun[i + 1], f),
    size: mix(frames.size[i], frames.size[i + 1], f),
    brightness: mix(frames.brightness[i], frames.brightness[i + 1], f),
    light: mix(frames.light[i], frames.light[i + 1], f),
    outer: mixQuat(frames.outer[i], frames.outer[i + 1], f),
    inner: mixQuat(frames.inner[i], frames.inner[i + 1], f),
    outerRadius: mix(frames.outerRadius[i], frames.outerRadius[i + 1], f),
    innerRadius: mix(frames.innerRadius[i], frames.innerRadius[i + 1], f),
    hole: mix(frames.hole[i], frames.hole[i + 1], f),
    flying: frames.flying[i].map((v, k) =>
      mixVec(v, frames.flying[i + 1][k] ?? v, f),
    ),
  };
}

// Turns a direction fixed on a shell into the clerk's frame.
export function turn(q: Quat, v: Vec): Vec {
  const [w, x, y, z] = q;
  return [
    (1 - 2 * (y * y + z * z)) * v[0] +
      2 * (x * y - w * z) * v[1] +
      2 * (x * z + w * y) * v[2],
    2 * (x * y + w * z) * v[0] +
      (1 - 2 * (x * x + z * z)) * v[1] +
      2 * (y * z - w * x) * v[2],
    2 * (x * z - w * y) * v[0] +
      2 * (y * z + w * x) * v[1] +
      (1 - 2 * (x * x + y * y)) * v[2],
  ];
}
