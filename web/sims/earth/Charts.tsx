import { useMemo, useRef, useState } from "react";
import { useScrub } from "../../shell/scrub";
import {
  ageNow,
  celsius,
  indexAt,
  oceans,
  pressure,
  shortWhen,
} from "./format";
import type { Pair, Result } from "./types";

type Measure = {
  id: string;
  title: string;
  unit: string;
  value: (r: Result, i: number) => number;
  text: (v: number) => string;
  log?: boolean;
  tick: (v: number) => string;
};

const measures: Measure[] = [
  {
    id: "temperature",
    title: "Surface temperature",
    unit: "°C",
    value: (r, i) => r.series.equilibrium[i] - 273.15,
    text: (v) => celsius(v + 273.15),
    tick: (v) => `${Math.round(v)}`,
  },
  {
    id: "co2",
    title: "Carbon dioxide",
    unit: "bar, log scale",
    value: (r, i) => r.series.co2[i],
    text: pressure,
    log: true,
    tick: (v) => (v >= 1 ? `${v}` : v >= 0.001 ? `${v}` : v.toExponential(0)),
  },
  {
    id: "ocean",
    title: "Water",
    unit: "present-day oceans",
    value: (r, i) => r.series.ocean[i],
    text: oceans,
    tick: (v) => v.toFixed(1),
  },
  {
    id: "o2",
    title: "Oxygen",
    unit: "bar",
    value: (r, i) => r.series.o2[i],
    text: pressure,
    tick: (v) => v.toFixed(2),
  },
];

const W = 320,
  H = 162,
  left = 34,
  right = 8,
  top = 8,
  bottom = 34;
// The chart starts once the surface has cooled; the molten start would
// flatten everything after it.
const from = 0.03;

function niceTicks(lo: number, hi: number, log: boolean): number[] {
  if (log) {
    const out = [];
    for (let e = Math.ceil(lo); e <= Math.floor(hi); e++) out.push(e);
    return out.length > 5 ? out.filter((_, k) => k % 2 === 0) : out;
  }
  const raw = (hi - lo) / 3;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw)!;
  const out = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step)
    out.push(Number(v.toPrecision(10)));
  return out;
}

function Chart({
  measure,
  pair,
  age,
  onAge,
}: {
  measure: Measure;
  pair: Pair;
  age: number;
  onAge: (age: number) => void;
}) {
  const svg = useRef<SVGSVGElement>(null);
  const scale = (v: number) =>
    measure.log ? Math.log10(Math.max(v, 1e-9)) : v;
  const drawn = useMemo(() => {
    const runs = [pair.living, pair.lifeless];
    let lo = Infinity,
      hi = -Infinity;
    for (const r of runs)
      for (let i = indexAt(r, from); i < r.time.length; i++) {
        const v = scale(measure.value(r, i));
        lo = Math.min(lo, v);
        hi = Math.max(hi, v);
      }
    if (!measure.log) lo = Math.min(lo, measure.id === "temperature" ? lo : 0);
    if (hi - lo < 1e-9) hi = lo + 1;
    const pad = (hi - lo) * 0.08;
    lo -= measure.id === "ocean" || measure.id === "o2" ? 0 : pad;
    hi += pad;
    const x = (t: number) =>
      left + ((t - from) / (ageNow - from)) * (W - left - right);
    const y = (v: number) =>
      top + (1 - (scale(v) - lo) / (hi - lo)) * (H - top - bottom);
    const path = (r: Result) => {
      let d = "";
      for (let i = indexAt(r, from); i < r.time.length; i++)
        d += `${d ? "L" : "M"}${x(Math.max(r.time[i], from)).toFixed(1)},${y(measure.value(r, i)).toFixed(1)}`;
      return d;
    };
    return {
      x,
      y,
      lo,
      hi,
      living: path(pair.living),
      lifeless: path(pair.lifeless),
    };
  }, [measure, pair]);

  const at = (r: Result) => measure.value(r, indexAt(r, Math.max(age, from)));
  const scrub = useScrub((clientX) => {
    const box = svg.current!.getBoundingClientRect();
    const px = ((clientX - box.left) / box.width) * W;
    const t = from + ((px - left) / (W - left - right)) * (ageNow - from);
    onAge(Math.min(ageNow, Math.max(from, t)));
  }, true);
  const cursor = drawn.x(Math.max(age, from));
  return (
    <figure className="chart">
      <figcaption>
        <span className="chart-title">{measure.title}</span>
        <span className="chart-unit">{measure.unit}</span>
        <span className="chart-values">
          <span>
            <i className="key living" />
            {measure.text(at(pair.living))}
          </span>
          <span>
            <i className="key lifeless" />
            {measure.text(at(pair.lifeless))}
          </span>
        </span>
      </figcaption>
      <svg
        ref={svg}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${measure.title} over time for the living and lifeless Earth`}
        {...scrub}
      >
        {niceTicks(drawn.lo, drawn.hi, !!measure.log).map((v) => {
          const value = measure.log ? 10 ** v : v;
          return (
            <g key={v}>
              <line
                className="grid"
                x1={left}
                x2={W - right}
                y1={drawn.y(value)}
                y2={drawn.y(value)}
              />
              <text
                className="tick"
                x={left - 5}
                y={drawn.y(value) + 3}
                textAnchor="end"
              >
                {measure.tick(value)}
              </text>
            </g>
          );
        })}
        {[4, 3, 2, 1, 0].map((ago) => (
          <text
            key={ago}
            className="tick"
            x={drawn.x(ageNow - ago)}
            y={H - 20}
            textAnchor={ago === 0 ? "end" : "middle"}
          >
            {ago === 0 ? "today" : ago}
          </text>
        ))}
        <text
          className="tick"
          x={(left + W - right) / 2}
          y={H - 6}
          textAnchor="middle"
        >
          billion years ago
        </text>
        <line
          className="axis"
          x1={left}
          x2={W - right}
          y1={H - bottom}
          y2={H - bottom}
        />
        <path className="series living" d={drawn.living} />
        <path className="series lifeless" d={drawn.lifeless} />
        <line
          className="cursor"
          x1={cursor}
          x2={cursor}
          y1={top}
          y2={H - bottom}
        />
        <circle
          className="dot living"
          cx={cursor}
          cy={drawn.y(at(pair.living))}
          r="4"
        />
        <circle
          className="dot lifeless"
          cx={cursor}
          cy={drawn.y(at(pair.lifeless))}
          r="4"
        />
      </svg>
    </figure>
  );
}

// Four small charts, one measure each, both Earths on every one. Pointing
// at a chart moves the whole page to that time.
export function Charts({
  pair,
  age,
  onAge,
}: {
  pair: Pair;
  age: number;
  onAge: (age: number) => void;
}) {
  const [table, setTable] = useState(false);
  const rows = [0.1, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5];
  return (
    <section className="charts" aria-label="The two histories compared">
      <div className="charts-head">
        <ul className="legend">
          <li>
            <i className="key living" />
            Living Earth
          </li>
          <li>
            <i className="key lifeless" />
            Lifeless Earth
          </li>
        </ul>
        <button
          type="button"
          aria-pressed={table}
          onClick={() => setTable(!table)}
        >
          {table ? "Show as charts" : "Show as table"}
        </button>
      </div>
      {table ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">When</th>
                {measures.flatMap((m) => [
                  <th scope="col" key={m.id + "a"}>
                    {m.title}, Living
                  </th>,
                  <th scope="col" key={m.id + "b"}>
                    {m.title}, Lifeless
                  </th>,
                ])}
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t}>
                  <th scope="row">{t === ageNow ? "Today" : shortWhen(t)}</th>
                  {measures.flatMap((m) => [
                    <td key={m.id + "a"}>
                      {m.text(m.value(pair.living, indexAt(pair.living, t)))}
                    </td>,
                    <td key={m.id + "b"}>
                      {m.text(
                        m.value(pair.lifeless, indexAt(pair.lifeless, t)),
                      )}
                    </td>,
                  ])}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="chart-grid">
          {measures.map((m) => (
            <Chart key={m.id} measure={m} pair={pair} age={age} onAge={onAge} />
          ))}
        </div>
      )}
    </section>
  );
}
