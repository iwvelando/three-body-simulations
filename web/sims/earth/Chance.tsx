import { useEffect, useMemo, useRef, useState } from "react";
import { Engine, EngineError } from "../../shell/engine";
import { placeOf } from "../../shell/address";
import { scale } from "../../shell/catalog";
import { useDark } from "../../shell/Theme";
import { number } from "./format";
import type { Param } from "./types";

type Descriptor = { params: Param[]; speculative: string[]; citation: string };
type Chunk = { from: number; runs: number; chance: number[]; life: number[] };
type Setup = {
  seed: number;
  planets: number;
  runs: number;
  params: Record<string, number>;
};
type Tally = {
  setup: Setup;
  // Runs survived by each planet, -1 until computed.
  chance: Int16Array;
  life: Int16Array;
  finished: number;
  state: "running" | "done" | "stopped";
};

const chunk = 25;
const newSeed = () => Math.floor(Math.random() * 2 ** 31);
const count = (n: number) => n.toLocaleString("en-US");
const percent = (share: number) =>
  `${(100 * share).toFixed(share < 0.1 ? 1 : 0)}%`;

// A field of dots, one per planet: empty for a planet that never lasted,
// darker the more often it did.
function Field({
  wins,
  stamp,
  runs,
  kind,
  label,
}: {
  wins: Int16Array;
  // The array is filled in place as results arrive; this changes when it
  // does, so the field is drawn again.
  stamp: number;
  runs: number;
  kind: "living" | "lifeless";
  label: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const dark = useDark();
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) =>
      setWidth(Math.floor(entry.contentRect.width)),
    );
    observer.observe(ref.current!.parentElement!);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const canvas = ref.current!;
    if (!width) return;
    const columns = Math.max(10, Math.ceil(Math.sqrt(wins.length * 2.2)));
    const rows = Math.ceil(wins.length / columns);
    const step = width / columns;
    const ratio = Math.min(devicePixelRatio, 2);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(rows * step * ratio);
    canvas.style.height = `${rows * step}px`;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.scale(ratio, ratio);
    const style = getComputedStyle(canvas);
    const hue = style.getPropertyValue(`--${kind}`).trim();
    const faint = style.getPropertyValue("--line").trim();
    for (let i = 0; i < wins.length; i++) {
      const x = ((i % columns) + 0.5) * step;
      const y = (Math.floor(i / columns) + 0.5) * step;
      const w = wins[i];
      context.beginPath();
      context.arc(x, y, Math.max(1, step * 0.36), 0, 2 * Math.PI);
      if (w > 0) {
        context.globalAlpha = 0.35 + 0.65 * (w / runs);
        context.fillStyle = hue;
        context.fill();
      } else if (w === 0) {
        context.globalAlpha = 1;
        context.lineWidth = 1;
        context.strokeStyle = faint;
        context.stroke();
      }
    }
    context.globalAlpha = 1;
    // How many dots were filled in, for anything that cannot see them.
    canvas.dataset.filled = String(
      wins.reduce((n, w) => n + (w > 0 ? 1 : 0), 0),
    );
  }, [wins, stamp, runs, kind, width, dark]);
  return (
    <div className="field-of-dots">
      <canvas ref={ref} role="img" aria-label={label} />
    </div>
  );
}

const bins: [string, (share: number) => boolean][] = [
  ["Never", (s) => s === 0],
  ["Up to a quarter of tries", (s) => s > 0 && s <= 0.25],
  ["Up to half", (s) => s > 0.25 && s <= 0.5],
  ["Up to three quarters", (s) => s > 0.5 && s <= 0.75],
  ["Nearly every time", (s) => s > 0.75 && s < 1],
  ["Every time", (s) => s === 1],
];

export function Chance({ engine }: { engine: Engine }) {
  const [descriptor, setDescriptor] = useState<Descriptor | null>(null);
  const [setup, setSetup] = useState<Setup>(() => ({
    seed: newSeed(),
    planets: 1000,
    runs: 20,
    params: {},
  }));
  const [tally, setTally] = useState<Tally | null>(null);
  const [notice, setNotice] = useState("");
  const token = useRef(0);

  useEffect(() => {
    let live = true;
    engine.ask<Descriptor>({ sim: "earth", action: "chance-catalog" }).then(
      (d) => live && setDescriptor(d),
      (e: Error) => live && setNotice(e.message),
    );
    return () => {
      live = false;
    };
  }, [engine]);

  // The planets are independent, so they are shared out among a few
  // engines, each in its own worker. Any split gives the same planets the
  // same fates.
  const pool = useRef<Engine[]>([]);
  useEffect(() => {
    const extra = Math.min(
      3,
      Math.max(0, (navigator.hardwareConcurrency || 2) - 2),
    );
    const made = Array.from({ length: extra }, () => new Engine());
    pool.current = [engine, ...made];
    return () => {
      token.current++;
      for (const e of made) e.dispose();
      pool.current = [];
    };
  }, [engine]);

  useEffect(() => {
    const mine = ++token.current;
    const timer = setTimeout(() => {
      const next: Tally = {
        setup,
        chance: new Int16Array(setup.planets).fill(-1),
        life: new Int16Array(setup.planets).fill(-1),
        finished: 0,
        state: "running",
      };
      setTally(next);
      setNotice("");
      let from = 0;
      const work = async (e: Engine) => {
        while (mine === token.current && from < setup.planets) {
          const start = from;
          from += chunk;
          try {
            const r = await e.ask<Chunk>({
              sim: "earth",
              action: "chance",
              seed: setup.seed,
              from: start,
              count: Math.min(chunk, setup.planets - start),
              runs: setup.runs,
              params: setup.params,
            });
            if (mine !== token.current) return;
            next.chance.set(r.chance, start);
            next.life.set(r.life, start);
            next.finished += r.chance.length;
            setTally({
              ...next,
              state: next.finished >= setup.planets ? "done" : "running",
            });
          } catch (error) {
            if (mine !== token.current) return;
            token.current++;
            setTally({ ...next, state: "stopped" });
            setNotice(
              error instanceof EngineError
                ? error.message
                : "The planets could not be run. Reload to try again.",
            );
          }
        }
      };
      for (const e of pool.current) void work(e);
    }, 250);
    return () => clearTimeout(timer);
  }, [setup]);

  const stats = useMemo(() => {
    if (!tally) return null;
    const of = (wins: Int16Array) => {
      let seen = 0,
        once = 0,
        always = 0;
      const rows = bins.map(() => 0);
      for (const w of wins) {
        if (w < 0) continue;
        seen++;
        if (w > 0) once++;
        if (w === tally.setup.runs) always++;
        rows[bins.findIndex(([, test]) => test(w / tally.setup.runs))]++;
      }
      return { seen, once, always, rows, share: seen ? once / seen : 0 };
    };
    return { chance: of(tally.chance), life: of(tally.life) };
  }, [tally]);

  if (!descriptor)
    return (
      <main className="page" aria-busy={!notice}>
        {notice && <p role="alert">{notice}</p>}
      </main>
    );
  const value = (id: string) =>
    setup.params[id] ?? descriptor.params.find((p) => p.id === id)!.default;
  const slider = (spec: Param) => {
    const { min, max, step, to, from } = scale(spec);
    const speculative = descriptor.speculative.includes(spec.id);
    return (
      <div className="field" key={spec.id}>
        <div className="field-head">
          <span className="field-label">{spec.label}</span>
          <output>{number(value(spec.id))}</output>
        </div>
        <input
          type="range"
          aria-label={spec.label}
          min={min}
          max={max}
          step={step}
          value={to(value(spec.id))}
          onChange={(e) =>
            setSetup((s) => ({
              ...s,
              params: { ...s.params, [spec.id]: from(Number(e.target.value)) },
            }))
          }
        />
        <p className="hint">
          {spec.help.replace(/ Speculative\.$/, "")}
          {spec.unit ? ` In ${spec.unit}.` : ""}
          {speculative && <strong className="spec"> Speculative.</strong>}
        </p>
      </div>
    );
  };
  const runs = tally?.setup.runs ?? setup.runs;
  // Described from the run on screen, never from a setting that has not
  // been run yet.
  const thermostat =
    (tally?.setup.params.life ??
      descriptor.params.find((p) => p.id === "life")!.default) > 0;
  return (
    <main className="page chance">
      <p className="back">
        <a href={placeOf("earth")}>Back to the planet</a>
      </p>
      <h1>Was it luck?</h1>
      <p className="lede">
        The scene begins with a physicist asking whether a planet this fit for
        life could be an accident. Here is one published way to ask. Give
        thousands of planets random climates, strike each with random accidents
        for billions of years, and count the ones that never freeze or boil.
        Then run the same planets through the same accidents with life pulling
        the temperature back toward comfort.{" "}
        <a href="#/earth/science">The science and its sources</a>
      </p>
      <p role="status" className="notice" hidden={!notice}>
        {notice}
      </p>
      <div className="surface-grid">
        <section className="stage">
          {tally && stats && (
            <>
              <p
                className="chance-status"
                data-testid="chance-status"
                data-state={tally.state}
                data-seed={tally.setup.seed}
              >
                {tally.state === "running" &&
                  `Running planet ${count(tally.finished)} of ${count(tally.setup.planets)}`}
                {tally.state === "done" &&
                  `${count(tally.setup.planets)} planets, each run ${runs} times`}
                {tally.state === "stopped" &&
                  `Stopped after ${count(tally.finished)} of ${count(tally.setup.planets)} planets`}
              </p>
              <progress
                max={tally.setup.planets}
                value={tally.finished}
                aria-label="Planets run"
              />
              <div className="outcomes">
                <figure>
                  <figcaption>
                    <span className="chart-title">By chance alone</span>
                    <p
                      data-testid="share-chance"
                      data-share={stats.chance.share}
                    >
                      <b>{percent(stats.chance.share)}</b> of planets stayed
                      habitable at least once in {runs} tries.{" "}
                      {count(stats.chance.always)} did every time.
                    </p>
                  </figcaption>
                  <Field
                    wins={tally.chance}
                    stamp={tally.finished}
                    runs={runs}
                    kind="lifeless"
                    label={`${percent(stats.chance.share)} of planets lasted at least once by chance alone`}
                  />
                </figure>
                <figure>
                  <figcaption>
                    <span className="chart-title">With life's thermostat</span>
                    <p data-testid="share-life" data-share={stats.life.share}>
                      <b>{percent(stats.life.share)}</b> of the same planets,
                      meeting the same accidents. {count(stats.life.always)} did
                      every time.{" "}
                      {thermostat ? (
                        <strong className="spec">
                          Speculative: the thermostat is this site's addition,
                          not part of the published model.
                        </strong>
                      ) : (
                        "The thermostat is off, so nothing differs."
                      )}
                    </p>
                  </figcaption>
                  <Field
                    wins={tally.life}
                    stamp={tally.finished}
                    runs={runs}
                    kind="living"
                    label={`${percent(stats.life.share)} of planets lasted at least once with life's thermostat`}
                  />
                </figure>
              </div>
              <p className="hint">
                Each dot is a planet. Empty: it never lasted. Darker: it lasted
                in more of its tries.
              </p>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Stayed habitable</th>
                      <th scope="col">By chance alone</th>
                      <th scope="col">With life's thermostat</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bins.map(([name], k) => (
                      <tr key={name}>
                        <th scope="row">{name}</th>
                        <td>{count(stats.chance.rows[k])}</td>
                        <td>{count(stats.life.rows[k])}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
        <form className="panel" onSubmit={(e) => e.preventDefault()}>
          <div className="actions">
            {tally?.state === "running" ? (
              <button
                type="button"
                onClick={() => {
                  token.current++;
                  setTally((t) => t && { ...t, state: "stopped" });
                }}
              >
                Stop
              </button>
            ) : (
              // The same planets meet the same accidents every time, so
              // only a run that was cut short has anything left to show.
              tally?.state === "stopped" && (
                <button
                  type="button"
                  onClick={() => setSetup((s) => ({ ...s }))}
                >
                  Run again
                </button>
              )
            )}
            <button
              type="button"
              onClick={() => setSetup((s) => ({ ...s, seed: newSeed() }))}
            >
              Draw new planets
            </button>
          </div>
          <div className="pair-of-selects">
            <label>
              <span className="field-label">Planets</span>
              <select
                aria-label="Planets"
                value={setup.planets}
                onChange={(e) =>
                  setSetup((s) => ({ ...s, planets: Number(e.target.value) }))
                }
              >
                {[500, 1000, 2000, 5000].map((n) => (
                  <option key={n} value={n}>
                    {count(n)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="field-label">Tries for each</span>
              <select
                aria-label="Tries for each"
                value={setup.runs}
                onChange={(e) =>
                  setSetup((s) => ({ ...s, runs: Number(e.target.value) }))
                }
              >
                {[10, 20, 50, 100].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          </div>
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
              onClick={() => setSetup((s) => ({ ...s, params: {} }))}
            >
              Reset
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
