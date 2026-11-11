import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLatest } from "../../shell/useLatest";
import type { Engine } from "../../shell/engine";
import { EngineError } from "../../shell/engine";
import { number } from "./format";
import { Terrain } from "./Terrain";
import type { Param } from "./types";

type Scene = {
  id: string;
  label: string;
  summary: string;
  defaults: Record<string, number>;
};
type Descriptor = { scenes: Scene[]; params: Param[]; citation: string };
type Run = {
  scene: string;
  size: number;
  cell: number;
  times: number[];
  peaks?: number[][];
  relief: number[];
  params: Record<string, number>;
  heights: Float32Array;
  cover: Float32Array;
};
type Setup = { scene: string; params: Record<string, number> };

// The address carries the scene and any of its numbers, as the planet
// view writes them. Anything unknown or out of range is dropped.
function arrive(rest: string, d: Descriptor): Setup {
  const query = new URLSearchParams(rest.split("?")[1] ?? "");
  const scene =
    d.scenes.find((s) => s.id === query.get("scene")) ?? d.scenes[1];
  const params: Record<string, number> = {};
  for (const spec of d.params) {
    const text = query.get(spec.id);
    if (text === null || text.trim() === "") continue;
    const value = Number(text);
    if (Number.isFinite(value) && value >= spec.min && value <= spec.max)
      params[spec.id] = value;
  }
  return { scene: scene.id, params };
}

const meters = (v: number) => `${Math.round(v).toLocaleString("en-US")} m`;
// Always two decimals, so the line does not change width as it counts.
const elapsed = (myr: number) =>
  myr === 0 ? "At the start" : `${myr.toFixed(2)} million years on`;

function Trend({
  times,
  lines,
  at,
}: {
  times: number[];
  lines: { name: string; kind: "living" | "lifeless"; values: number[] }[];
  at: number;
}) {
  const W = 320,
    H = 130,
    left = 40,
    right = 8,
    top = 8,
    bottom = 30;
  const top0 = Math.max(1, ...lines.flatMap((l) => l.values)) * 1.05;
  const end = times[times.length - 1];
  const x = (t: number) => left + (t / end) * (W - left - right);
  const y = (v: number) =>
    top + (1 - Math.max(0, v) / top0) * (H - top - bottom);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Height over time">
      {[0, top0 / 1.05 / 2, top0 / 1.05].map((v) => (
        <g key={v}>
          <line className="grid" x1={left} x2={W - right} y1={y(v)} y2={y(v)} />
          <text className="tick" x={left - 5} y={y(v) + 3} textAnchor="end">
            {Math.round(v)}
          </text>
        </g>
      ))}
      <text className="tick" x={left} y={H - 16} textAnchor="start">
        start
      </text>
      <text className="tick" x={W - right} y={H - 16} textAnchor="end">
        {number(end)}
      </text>
      <text
        className="tick"
        x={(left + W - right) / 2}
        y={H - 4}
        textAnchor="middle"
      >
        million years
      </text>
      {lines.map((l) => (
        <path
          key={l.name}
          className={`series ${l.kind}`}
          d={l.values
            .map(
              (v, i) =>
                `${i ? "L" : "M"}${x(times[i]).toFixed(1)},${y(v).toFixed(1)}`,
            )
            .join("")}
        />
      ))}
      <line className="cursor" x1={x(at)} x2={x(at)} y1={top} y2={H - bottom} />
    </svg>
  );
}

export function Surface({ engine, rest }: { engine: Engine; rest: string }) {
  const [descriptor, setDescriptor] = useState<Descriptor | null>(null);
  const [setup, setSetup] = useState<Setup | null>(null);
  const [notice, setNotice] = useState("");
  const [frame, setFrame] = useState(Number.POSITIVE_INFINITY);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    let live = true;
    engine.ask<Descriptor>({ sim: "earth", action: "terrain-catalog" }).then(
      (d) => {
        if (!live) return;
        setDescriptor(d);
        setSetup(arrive(rest, d));
      },
      (e: Error) => live && setNotice(e.message),
    );
    return () => {
      live = false;
    };
    // The address is read once, on arrival.
  }, [engine]);

  const ask = useCallback(
    (q: Setup) => engine.ask<Run>({ sim: "earth", action: "terrain", ...q }),
    [engine],
  );
  const latest = useLatest(setup, ask, 60);
  const run = latest.result;
  const busy = latest.busy;
  useEffect(() => {
    setNotice(
      !latest.error
        ? ""
        : latest.error instanceof EngineError
          ? latest.error.message
          : "The surface could not be computed. Reload to try again.",
    );
  }, [latest.error]);

  const last = run ? run.times.length - 1 : 0;
  const at = Math.round(Math.min(frame, last));
  const live = useRef(frame);
  live.current = Math.min(frame, last);
  useEffect(() => {
    if (!playing || !run) return;
    let handle = 0,
      before = performance.now();
    const step = (now: number) => {
      const next = live.current + ((now - before) / 1000) * (last / 8);
      before = now;
      if (next >= last) {
        setFrame(last);
        setPlaying(false);
        return;
      }
      setFrame(next);
      handle = requestAnimationFrame(step);
    };
    handle = requestAnimationFrame(step);
    return () => cancelAnimationFrame(handle);
  }, [playing, run, last]);

  // The engine stores 25 moments. Between them the land, and every
  // number read off it, is blended, so playback glides instead of
  // stepping from one stored moment to the next.
  const position = Math.max(0, Math.min(frame, last));
  const below = Math.min(Math.floor(position), Math.max(0, last - 1));
  const part = position - below;
  const mix = (values: number[]) =>
    values[below] + (values[Math.min(below + 1, last)] - values[below]) * part;
  const land = useMemo(() => {
    if (!run) return null;
    const cells = run.size * run.size;
    const a = run.heights.subarray(below * cells, (below + 1) * cells);
    let heights = a;
    if (part > 0 && below < last) {
      const b = run.heights.subarray((below + 1) * cells, (below + 2) * cells);
      heights = new Float32Array(cells);
      for (let i = 0; i < cells; i++) heights[i] = a[i] + (b[i] - a[i]) * part;
    }
    return {
      size: run.size,
      cell: run.cell,
      heights,
      cover: run.cover,
      dry: run.params.rain === 0,
    };
  }, [run, below, part, last]);

  if (!descriptor || !setup)
    return (
      <main className="page" aria-busy={!notice}>
        {notice && <p role="alert">{notice}</p>}
      </main>
    );
  const scene = descriptor.scenes.find((s) => s.id === setup.scene)!;
  const value = (id: string) =>
    setup.params[id] ??
    scene.defaults[id] ??
    descriptor.params.find((p) => p.id === id)!.default;
  const slider = (spec: Param) => {
    const to = (v: number) => (spec.log ? Math.log10(v) : v);
    const from = (v: number) =>
      Math.min(spec.max, Math.max(spec.min, spec.log ? 10 ** v : v));
    return (
      <div className="field" key={spec.id}>
        <div className="field-head">
          <span className="field-label">{spec.label}</span>
          <output>
            {number(value(spec.id))}
            {spec.unit ? ` ${spec.unit}` : ""}
          </output>
        </div>
        <input
          type="range"
          aria-label={spec.label}
          min={to(spec.min)}
          max={to(spec.max)}
          step={(to(spec.max) - to(spec.min)) / 200}
          value={to(value(spec.id))}
          onChange={(e) =>
            setSetup((s) => ({
              ...s!,
              params: { ...s!.params, [spec.id]: from(Number(e.target.value)) },
            }))
          }
        />
        <p className="hint">{spec.help}</p>
      </div>
    );
  };

  const mountains = run?.peaks && run.scene === "mountains";
  return (
    <main className="page surface">
      <p className="back">
        <a href="#/earth">Back to the planet</a>
      </p>
      <h1>The surface up close</h1>
      <p className="lede">
        A patch of land about ten kilometers across, left to rain, creeping soil
        and whatever grows on it. Bare ground gives way to running water far
        faster than ground that plants hold.{" "}
        <a href="#/earth/science">The science and its sources</a>
      </p>
      <p role="status" className="notice" hidden={!notice}>
        {notice}
      </p>
      <div className="surface-grid">
        <section className="stage" aria-busy={busy}>
          {/* The land's box and the readout below it keep their room while
              the first landscape is computed, so the settings never move. */}
          {land ? (
            <Terrain
              land={land}
              label={`${scene.label}, ${elapsed(mix(run!.times)).toLowerCase()}`}
            />
          ) : (
            <div className="terrain" />
          )}
          <div className="surface-readout">
            {run && (
              <>
                <p className="moment-when" data-testid="surface-when">
                  {elapsed(mix(run.times))}
                </p>
                <div className="transport">
                  <button
                    type="button"
                    className="play"
                    onClick={() => {
                      if (!playing && at >= last) setFrame(0);
                      setPlaying(!playing);
                    }}
                  >
                    {playing ? "Pause" : "Play"}
                  </button>
                  <input
                    type="range"
                    aria-label="Time elapsed"
                    min={0}
                    max={last}
                    step={1}
                    value={at}
                    onChange={(e) => {
                      setPlaying(false);
                      setFrame(Number(e.target.value));
                    }}
                  />
                </div>
                {mountains ? (
                  <>
                    <p
                      className="verdict"
                      data-testid="surface-outcome"
                      data-rain={number(run.params.rain)}
                    >
                      The bare mountain stands{" "}
                      <span data-testid="peak-bare">
                        {meters(mix(run.peaks![2]))}
                      </span>{" "}
                      high; the two under vegetation,{" "}
                      <span data-testid="peak-covered">
                        {meters((mix(run.peaks![0]) + mix(run.peaks![1])) / 2)}
                      </span>
                      . All three began at {meters(run.peaks![2][0])}.
                    </p>
                    <figure className="chart">
                      <figcaption>
                        <span className="chart-title">Summit height</span>
                        <span className="chart-unit">meters</span>
                        <span className="chart-values">
                          <span>
                            <i className="key living" />
                            Under vegetation
                          </span>
                          <span>
                            <i className="key lifeless" />
                            Bare
                          </span>
                        </span>
                      </figcaption>
                      <Trend
                        times={run.times}
                        at={mix(run.times)}
                        lines={[
                          { name: "a", kind: "living", values: run.peaks![0] },
                          {
                            name: "bare",
                            kind: "lifeless",
                            values: run.peaks![2],
                          },
                        ]}
                      />
                    </figure>
                  </>
                ) : (
                  <>
                    <p
                      className="verdict"
                      data-testid="surface-outcome"
                      data-rain={number(run.params.rain)}
                    >
                      {mix(run.relief) < 10
                        ? "The crater is gone: its rim worn off and its bowl filled."
                        : `The crater's rim stands ${meters(mix(run.relief))} above its floor. It began at ${meters(run.relief[0])}.`}
                    </p>
                    <figure className="chart">
                      <figcaption>
                        <span className="chart-title">
                          Crater rim above floor
                        </span>
                        <span className="chart-unit">meters</span>
                      </figcaption>
                      <Trend
                        times={run.times}
                        at={mix(run.times)}
                        lines={[
                          {
                            name: "relief",
                            kind:
                              run.params.cover > 0.5 ? "living" : "lifeless",
                            values: run.relief,
                          },
                        ]}
                      />
                    </figure>
                  </>
                )}
              </>
            )}
          </div>
        </section>
        <form className="panel" onSubmit={(e) => e.preventDefault()}>
          <fieldset className="presets">
            <legend>Scene</legend>
            {descriptor.scenes.map((s) => (
              <label key={s.id} className="preset">
                <input
                  type="radio"
                  name="scene"
                  checked={setup.scene === s.id}
                  onChange={() => {
                    setFrame(Number.POSITIVE_INFINITY);
                    setSetup({ scene: s.id, params: {} });
                  }}
                />
                <span className="preset-name">{s.label}</span>
                <span className="preset-note">{s.summary}</span>
              </label>
            ))}
          </fieldset>
          <div className="basics">
            {descriptor.params.filter((p) => p.basic).map(slider)}
          </div>
          <details className="models">
            <summary>More settings</summary>
            <div className="basics">
              {descriptor.params.filter((p) => !p.basic).map(slider)}
            </div>
            <p className="cite">{descriptor.citation}</p>
          </details>
          <div className="actions">
            <button
              type="button"
              onClick={() => setSetup({ scene: setup.scene, params: {} })}
            >
              Reset
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
