import { useMemo, useRef, useState } from "react";
import { useScrub } from "../../shell/scrub";
import { useMedia } from "../../shell/useMedia";
import { dayOf, days } from "./format";
import type { Run } from "./types";

const left = 34,
  right = 10,
  top = 10,
  bottom = 36;
// The chart is drawn at about the size it is shown, so its figures stay
// their own size: wide beside the settings, narrow on a phone. Keep the
// width in step with the same one in style.css.
const narrowQuery = "(max-width: 43.99rem)";

// The clerk's record: how long each day lasted, with the eras the clerk
// reads from it. Pointing at the chart moves the whole page to that day.
export function Calendar({
  run,
  time,
  onTime,
}: {
  run: Run;
  time: number;
  onTime: (t: number) => void;
}) {
  const [table, setTable] = useState(false);
  const svg = useRef<SVGSVGElement>(null);
  const narrow = useMedia(narrowQuery);
  const W = narrow ? 360 : 720,
    H = narrow ? 200 : 230;
  const tolerance = run.choice.params["clerk.tolerance"];
  const drawn = useMemo(() => {
    const hours = run.calendar.length.map((d) => d * 24);
    const most = Math.max(36, Math.ceil(Math.max(0, ...hours) / 12) * 12);
    const x = (t: number) => left + (t / run.span) * (W - left - right);
    const y = (h: number) => H - bottom - (h / most) * (H - top - bottom);
    const path = hours
      .map(
        (h, i) =>
          `${i ? "L" : "M"}${x(run.calendar.rise[i]).toFixed(1)},${y(h).toFixed(1)}`,
      )
      .join("");
    const every =
      most <= 48 ? 12 : most <= 120 ? 24 : Math.ceil(most / 96) * 24;
    const ticks = [];
    for (let h = 0; h <= most; h += every) ticks.push(h);
    const stride =
      (run.span <= 500 ? 100 : run.span <= 2500 ? 500 : 1000) *
      (narrow ? 2 : 1);
    const marks = [];
    for (let d = 0; d <= run.span; d += stride) marks.push(d);
    return { x, y, path, ticks, marks };
  }, [run, W, H, narrow]);
  const scrub = useScrub((clientX) => {
    const box = svg.current!.getBoundingClientRect();
    const share =
      (((clientX - box.left) / box.width) * W - left) / (W - left - right);
    onTime(Math.min(run.span, Math.max(0, share * run.span)));
  }, false);
  const stable = run.eras.filter((e) => e.kind === "stable");
  return (
    <section className="calendar" aria-labelledby="calendar-title">
      <div className="charts-head">
        <h2 id="calendar-title">The clerk's calendar</h2>
        <button
          type="button"
          aria-pressed={table}
          onClick={() => setTable(!table)}
        >
          {table ? "Show as chart" : "Show as table"}
        </button>
      </div>
      {table ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Era</th>
                <th scope="col">Starts</th>
                <th scope="col">Lasts</th>
                <th scope="col">Sunrises</th>
              </tr>
            </thead>
            <tbody>
              {run.eras.map((e) => (
                <tr key={e.from}>
                  <th scope="row">
                    {e.kind === "stable" ? "Stable" : "Chaotic"}
                  </th>
                  <td>Day {dayOf(e.from).toLocaleString("en-US")}</td>
                  <td>{days(e.to - e.from)}</td>
                  <td>{e.days.toLocaleString("en-US")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <figure className="chart calendar-chart">
          <figcaption>
            <span className="chart-title">Length of each day</span>
            <span className="chart-unit">
              hours from one sunrise to the next
            </span>
            <span className="chart-values">
              <span>
                <i className="swatch era-stable" />
                Stable Era
              </span>
              <span>
                <i className="swatch era-chaotic" />
                Chaotic Era
              </span>
              <span>
                <i className="swatch band" />A regular day, within{" "}
                {Math.round(tolerance)}%
              </span>
            </span>
          </figcaption>
          <svg
            ref={svg}
            viewBox={`0 0 ${W} ${H}`}
            role="img"
            aria-label="Length of each day across the calendar, with Stable and Chaotic Eras marked"
            {...scrub}
          >
            {run.eras.map((e) => (
              <rect
                key={e.from}
                className={`era-${e.kind}`}
                x={drawn.x(e.from)}
                width={Math.max(0, drawn.x(e.to) - drawn.x(e.from))}
                y={top}
                height={H - top - bottom}
                opacity="0.22"
              />
            ))}
            <rect
              className="regular-band"
              x={left}
              width={W - left - right}
              y={drawn.y(24 * (1 + tolerance / 100))}
              height={
                drawn.y(24 * (1 - tolerance / 100)) -
                drawn.y(24 * (1 + tolerance / 100))
              }
            />
            {drawn.ticks.map((h) => (
              <g key={h}>
                <line
                  className="grid"
                  x1={left}
                  x2={W - right}
                  y1={drawn.y(h)}
                  y2={drawn.y(h)}
                />
                <text
                  className="tick"
                  x={left - 5}
                  y={drawn.y(h) + 3}
                  textAnchor="end"
                >
                  {h}
                </text>
              </g>
            ))}
            {drawn.marks.map((d) => (
              <text
                key={d}
                className="tick"
                x={drawn.x(d)}
                y={H - 20}
                textAnchor={
                  d === 0 ? "start" : d >= run.span ? "end" : "middle"
                }
              >
                {d.toLocaleString("en-US")}
              </text>
            ))}
            <text
              className="tick"
              x={(left + W - right) / 2}
              y={H - 6}
              textAnchor="middle"
            >
              day
            </text>
            <line
              className="axis"
              x1={left}
              x2={W - right}
              y1={H - bottom}
              y2={H - bottom}
            />
            <path className="series days" d={drawn.path} />
            <line
              className="cursor"
              x1={drawn.x(time)}
              x2={drawn.x(time)}
              y1={top}
              y2={H - bottom}
            />
          </svg>
        </figure>
      )}
      {stable.length > 0 && (
        <>
          <h3 className="calendar-sub">Stable Eras in this calendar</h3>
          <ul className="events" aria-label="Stable Eras">
            {stable.map((e) => (
              <li key={e.from}>
                <button
                  type="button"
                  aria-current={
                    time >= e.from && time < e.to ? "true" : undefined
                  }
                  // A little after its first sunrise, so the sun is up.
                  onClick={() => onTime(Math.min(run.span, e.from + 0.3))}
                >
                  Stable Era, day {dayOf(e.from).toLocaleString("en-US")}{" "}
                  <span>{days(e.to - e.from)}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="hint">
        This is the machine's own forecast. Nothing here checks it against a
        real sky.
      </p>
    </section>
  );
}
