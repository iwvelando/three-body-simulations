import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { number } from "../../shell/catalog";
import { EngineError } from "../../shell/engine";
import { query, useStudy } from "../../shell/link";
import { Panel } from "../../shell/Panel";
import type { SimulationProps } from "../../shell/registry";
import type { Study } from "../../shell/study";
import { useLatest } from "../../shell/useLatest";
import { au, count, named, span, speed, when } from "./format";
import { Science } from "./Science";
import {
  clampSpan,
  farthest,
  looks,
  nearest,
  spanOf,
  sunIsTrue,
  System,
  type Look,
} from "./System";
import { momentOf, type Catalog, type Chapter, type Run } from "./types";

export default function DiazPage({ engine, rest, arrival }: SimulationProps) {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [failure, setFailure] = useState("");
  useEffect(() => {
    let live = true;
    engine.ask<Catalog>({ sim: "diaz", action: "catalog" }).then(
      (c) => live && setCatalog(c),
      (e: Error) => live && setFailure(e.message),
    );
    return () => {
      live = false;
    };
  }, [engine]);
  if (failure)
    return (
      <main className="page notice-page">
        <p role="alert">{failure}</p>
      </main>
    );
  if (!catalog) return <main className="page" aria-busy="true" />;
  if (rest.split("?")[0].startsWith("/science"))
    return <Science catalog={catalog} />;
  // The view reads the address once, on arrival; keying it by the
  // arrival makes a link followed from inside the page one too.
  return <View key={arrival} engine={engine} catalog={catalog} rest={rest} />;
}

const lookNames: Record<Look, string> = {
  whole: "The whole system",
  inner: "The inner planets",
  sun: "The Sun",
};

// Each chapter takes this long to play, whatever its real length.
const pace = 5;

// Where a run opens: Mercury gone and the Sun's answer complete, or the
// end of a run that never gets that far.
const opening = (run: Run) =>
  run.chapters.length > 2 ? 2.999 : run.chapters.length;

function View({
  engine,
  catalog,
  rest,
}: Omit<SimulationProps, "arrival"> & { catalog: Catalog }) {
  // The address is read once, on arrival.
  const [arrival] = useState(() => {
    const asked = query(rest).get("look");
    const known = (looks as readonly string[]).includes(asked ?? "");
    // A zoom set by hand: how many AU across the view shows.
    const wide = query(rest).get("zoom");
    const zoom = wide === null ? NaN : Number(wide);
    const fits = zoom >= nearest && zoom <= farthest;
    return {
      look: (known ? asked : "whole") as Look,
      zoom: fits ? zoom : null,
      doubt:
        (asked !== null && (!known || asked === "whole")) ||
        (wide !== null && !fits),
    };
  });
  const [look, setLook] = useState<Look>(arrival.look);
  const [zoom, setZoom] = useState<number | null>(arrival.zoom);
  const { study, change, reset, notice, setNotice, copied, copy } = useStudy(
    catalog,
    "#/diaz",
    rest,
    {
      look: look === "whole" ? "" : look,
      zoom: zoom === null ? "" : String(Number(zoom.toPrecision(3))),
    },
    arrival.doubt,
  );
  const [place, setPlace] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [open, setOpen] = useState(false);

  const ask = useCallback(
    (q: Study) =>
      engine.ask<Run>({
        sim: "diaz",
        action: "run",
        preset: q.preset,
        models: q.models,
        params: q.params,
      }),
    [engine],
  );
  const latest = useLatest(study, ask, 60);
  useEffect(() => {
    if (latest.error)
      setNotice(
        latest.error instanceof EngineError
          ? latest.error.message
          : "The plan could not be worked out. Reload the page to try again.",
      );
  }, [latest.error, setNotice]);
  const run = latest.result;
  // A run opens where its own story is best seen: the first, and the
  // first after a starting point is chosen. After any other change the
  // timeline stays where the visitor left it, or at the end if the new
  // run is over sooner.
  const fresh = useRef(true);
  useEffect(() => {
    if (!run) return;
    setPlaying(false);
    const start = fresh.current;
    fresh.current = false;
    setPlace((was) =>
      start || was === null ? opening(run) : Math.min(was, run.chapters.length),
    );
  }, [run]);

  const end = run ? run.chapters.length : 1;
  const live = useRef(0);
  live.current = place ?? 0;
  useEffect(() => {
    if (!playing) return;
    let frame = 0,
      before = performance.now();
    const step = (now: number) => {
      // A frame can be stamped a little before the moment Play was
      // pressed; time never runs backwards here.
      const passed = Math.min(0.25, Math.max(0, (now - before) / 1000));
      const next = live.current + passed / pace;
      before = now;
      if (next >= end) {
        setPlace(end);
        setPlaying(false);
        return;
      }
      live.current = next;
      setPlace(next);
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [playing, end]);

  const moment = useMemo(
    () => (run && place !== null ? momentOf(run, Math.min(place, end)) : null),
    [run, place, end],
  );

  // The settings do not change as the timeline moves, so playing does
  // not draw them again.
  const settings = useMemo(
    () => (
      <aside className={`controls${open ? " open" : ""}`}>
        <button
          type="button"
          className="controls-toggle"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          Settings
        </button>
        <div className="controls-body">
          <Panel
            catalog={catalog}
            study={study}
            hint={
              <>
                Each step of the plan has a rule from published physics. The
                three steps physics does not allow also have an invented one.{" "}
                <a href="#/diaz/science">What is invented</a>
              </>
            }
            onStudy={change}
            onPreset={() => {
              fresh.current = true;
            }}
            onReset={() => {
              fresh.current = true;
              reset();
              setLook("whole");
              setZoom(null);
            }}
            onCopy={copy}
            copied={copied}
          />
        </div>
      </aside>
    ),
    [catalog, study, open, change, reset, copy, copied],
  );

  if (!run || place === null || !moment)
    return (
      <main className="page diaz" aria-busy="true">
        {notice && (
          <p role="status" className="notice">
            {notice}
          </p>
        )}
      </main>
    );

  const label = (id: string) => catalog.bodies.find((b) => b.id === id)!.label;
  const chapter = run.chapters[moment.chapter];
  const span = zoom ?? spanOf(look, moment);
  const trueSun = sunIsTrue(catalog.bodies, span);
  const left = moment.bodies.filter((p, b) => b > 0 && p).length;
  return (
    <main className="page diaz">
      <div className="intro">
        <h1>Mercury into the Sun</h1>
        <p className="lede">
          In <cite>The Dark Forest</cite>, a plan is uncovered: set off enough
          bombs on Mercury to drop it into the Sun, so that the Sun throws out a
          spiral of gas that drags every other planet in after it. Run the plan,
          as the novel tells it or with published physics alone.
        </p>
      </div>
      <p role="status" className="notice" hidden={!notice}>
        {notice}
      </p>

      {/* Before the view, so that on a phone it is not at the foot of the
          page; on a wide screen the grid stands it beside the view. */}
      {settings}
      <section className="stage" aria-busy={latest.busy}>
        <div className="diaz-looks" role="group" aria-label="Look at">
          {looks.map((id) => (
            <button
              key={id}
              type="button"
              aria-pressed={zoom === null && look === id}
              onClick={() => {
                setLook(id);
                setZoom(null);
              }}
            >
              {lookNames[id]}
            </button>
          ))}
          <label className="diaz-zoom">
            <span>Zoom</span>
            <input
              type="range"
              aria-label="Zoom"
              aria-valuetext={`${au(span)} across`}
              min={-Math.log10(farthest)}
              max={-Math.log10(nearest)}
              step="any"
              value={-Math.log10(span)}
              onChange={(e) =>
                setZoom(clampSpan(10 ** -Number(e.target.value)))
              }
            />
          </label>
        </div>
        <p className="hint" data-testid="sizes-note">
          {trueSun
            ? "At this zoom the Sun is its true size. The planets are still drawn larger than they are, so Mercury can seem to touch the Sun without touching it."
            : "The Sun and planets are drawn far larger than they are, so that they can be seen. Mercury can seem to pass through the Sun without touching it: look at the Sun to see it at its true size."}
        </p>
        <figure className="diaz-figure">
          <System
            run={run}
            moment={moment}
            bodies={catalog.bodies}
            span={span}
            onSpan={setZoom}
            label={`The Solar System ${when(moment.time)}: ${left} of 8 planets still orbit${moment.edge > 0 ? `, and gas reaches ${au(moment.edge)} from the Sun` : ""}`}
          />
          <figcaption>The view is {au(span)} across.</figcaption>
        </figure>
        <p className="hint" data-testid="ways">
          Drag to turn and tilt the view. To zoom, pinch with two fingers, pinch
          on a trackpad, or hold Ctrl or ⌘ and scroll; the Zoom slider does the
          same. With the view selected, the arrow keys turn it and + and − zoom.
        </p>
        <div className="moment" data-testid="moment">
          <p className="moment-when">{title(chapter, label)}</p>
          <p className="moment-state">{when(moment.time)}</p>
          <dl>
            <div>
              <dt>Planets still orbiting</dt>
              <dd>{left} of 8</dd>
            </div>
            <div>
              <dt>Gas reaches</dt>
              <dd>{moment.edge > 0 ? au(moment.edge) : "None yet"}</dd>
            </div>
          </dl>
        </div>
        <div className="timeline">
          <div className="transport">
            <button
              type="button"
              className="play"
              onClick={() => {
                if (!playing && place >= end) setPlace(0);
                setPlaying(!playing);
              }}
            >
              {playing ? "Pause" : "Play"}
            </button>
            <input
              type="range"
              aria-label="Time"
              aria-valuetext={`${title(chapter, label)}, ${when(moment.time)}`}
              min={0}
              max={end}
              step={0.001}
              value={Math.min(place, end)}
              onChange={(e) => {
                setPlaying(false);
                setPlace(Number(e.target.value));
              }}
            />
          </div>
          {/* Always given its room, shown or not, so that nothing below
              the view moves as the timeline passes in and out of a
              slowed stretch. */}
          <p
            className="hint diaz-slowed"
            data-testid="slowed"
            aria-hidden={!chapter.slowed}
            data-on={chapter.slowed ? "" : undefined}
          >
            This stretch covers so many orbits that the planets' motion around
            the Sun is drawn slowed.
          </p>
          <p className="hint">
            The timeline gives each part of the story the same room, from the
            weeks of Mercury's fall to the ages the planets take.
          </p>
        </div>

        <Account run={run} catalog={catalog} />
      </section>
    </main>
  );
}

// Everything said about a run that does not change as the timeline
// moves. Kept apart so that playing redraws only the view and the clock.
const Account = memo(function Account({
  run,
  catalog,
}: {
  run: Run;
  catalog: Catalog;
}) {
  const label = (id: string) => catalog.bodies.find((b) => b.id === id)!.label;
  return (
    <>
      <p className="verdict" data-testid="verdict">
        {verdict(run, label)}
      </p>
      <Steps run={run} label={label} />
      <Fates run={run} label={label} />

      <section className="explains" data-testid="explains">
        <h2>The rules in use</h2>
        <dl>
          {catalog.slots.map((slot) => {
            const model = slot.models.find(
              (m) => m.id === run.choice.models[slot.id],
            );
            return (
              model && (
                <div key={slot.id}>
                  <dt>
                    {slot.label}: {model.label}
                    {model.speculative && (
                      <strong className="spec"> Speculative.</strong>
                    )}
                  </dt>
                  <dd>{model.summary}</dd>
                </div>
              )
            );
          })}
        </dl>
      </section>
      <p className="hint">
        The sizes of the bodies, the Sun's glow and the pace of the planets in
        the long stretches are drawn. The paths, the times, the gas and the
        fates are worked out.
      </p>
      {run.speculative ? (
        <p className="caveat" data-testid="speculative">
          <strong className="spec">Speculative.</strong> At least one rule in
          use here was invented for this site to make the novel's plan run.
          Published physics does not allow it.{" "}
          <a href="#/diaz/science">The scene and what is invented</a>
        </p>
      ) : (
        <p className="caveat" data-testid="grounded">
          Every rule in use here comes from published physics.{" "}
          <a href="#/diaz/science">The scene and the sources</a>
        </p>
      )}
    </>
  );
});

type Label = (id: string) => string;

function title(chapter: Chapter, label: Label): string {
  switch (chapter.id) {
    case "bombs":
      return "The bombs";
    case "fall":
      return "The fall";
    case "answer":
      return chapter.body === "mercury"
        ? "The Sun answers"
        : `${label(chapter.body!)} goes in`;
    default:
      return "The long drag";
  }
}

const megatons = (run: Run) =>
  `${number(run.choice.params["bombs.yield"])} megatons`;

function verdict(run: Run, label: Label): string {
  const p = run.choice.params;
  const charges = run.choice.models.bombs === "charges";
  if (!run.falls)
    return `${count(p["bombs.count"])} bombs of ${megatons(run)} slow Mercury by ${speed(run.delivered)} at the very most. To touch the Sun it must lose ${speed(run.needed)}, which would take ${count(run.bombsNeeded)} of them. Mercury stays in its orbit and nothing else happens.`;
  const impact = run.impact!;
  let text = charges
    ? `${count(p["bombs.count"])} bombs of ${megatons(run)}, each doing the most a bomb could, are enough: Mercury`
    : `Slowed by ${speed(run.delivered)}, which would take at least ${count((run.bombsNeeded * run.delivered) / run.needed)} bombs of ${megatons(run)}, Mercury`;
  text += ` reaches the Sun ${span(impact.time)} after the push, at ${speed(impact.speed)}.`;
  if (run.choice.models.cloud === "free") {
    const earth = run.fates.find((f) => f.id === "earth")?.nudge ?? 0;
    return (
      text +
      ` The gas thrown out is ${number(impact.ejecta / mass(run))} of Mercury's mass; ${Math.round(100 * (1 - impact.escaping))}% of it falls back and the rest leaves the Solar System. No planet follows: the most the passing gas could slow the Earth is ${speed(earth)}.`
    );
  }
  const fallen = run.fates
    .filter((f) => f.fate === "falls")
    .sort((a, b) => a.time! - b.time!);
  if (fallen.length === 0)
    text += ` Its spiral reaches ${au(run.flows[0].edge)}, but no planet follows within ten billion years.`;
  else {
    const first = fallen[0],
      last = fallen[fallen.length - 1];
    text +=
      fallen.length === run.fates.length
        ? " Then every other planet follows"
        : ` Then ${fallen.length} of the other ${run.fates.length} planets follow`;
    text +=
      fallen.length === 1
        ? `: ${label(first.id)}, after ${span(first.time!)}.`
        : `, ${label(first.id)} first after ${span(first.time!)} and ${label(last.id)} last after ${span(last.time!)}.`;
  }
  text += ` The gas outside the Sun ends at ${share(run.cloudMass / sunMass)} the Sun's own mass.`;
  if (run.exhausted) text += " The eruptions ask for more than the Sun holds.";
  return text;
}

// NASA's mass for the Sun, kg, to set the gas against.
const sunMass = 1.9884e30;
// Mercury's mass, from the energy the engine reports: the bound is what
// the fall could lift, the ejecta what was thrown.
const mass = (run: Run) =>
  (2 * run.impact!.energy) / (run.impact!.speed * run.impact!.speed);

const share = (v: number) =>
  v >= 0.01 ? `${number(100 * v)}% of` : `${number(v)} times`;

function Steps({ run, label }: { run: Run; label: Label }) {
  const p = run.choice.params;
  const impact = run.impact;
  const standing = run.choice.models.cloud === "standing";
  const order = run.flows.slice(1).map((f) => f.body);
  const early =
    order.includes("jupiter") &&
    order.includes("earth") &&
    order.indexOf("jupiter") < order.indexOf("earth");
  return (
    <section className="diaz-steps" data-testid="steps">
      <h2>Step by step</h2>
      <ol>
        <li>
          <strong>The bombs.</strong> At its farthest from the Sun, Mercury must
          lose {speed(run.needed)} for its path to touch the Sun. The bombs take
          off {speed(run.delivered)}. Only rock thrown clear of Mercury pushes
          it, so even with every joule spent on that, the fall needs{" "}
          {count(run.bombsNeeded)} bombs of {megatons(run)}. The novel's plan
          has a million, and says itself that they are far from enough.
        </li>
        {!impact && (
          <li>
            <strong>The fall.</strong> There is none. Mercury's closest approach
            stays {number(run.perihelion)} Sun-radii out.
          </li>
        )}
        {impact && (
          <>
            <li>
              <strong>The fall.</strong> Mercury's new path comes within{" "}
              {number(run.perihelion)} Sun-radii of the Sun's center. It takes{" "}
              {span(impact.time)} to get there and arrives at{" "}
              {speed(impact.speed)}, {number(impact.angle)}° from straight down.
            </li>
            <li>
              <strong>The impact.</strong> If Mercury held together, drag alone
              would stop it at {number(impact.depth)} of the Sun's radius,{" "}
              {impact.deep
                ? "below the convection zone, as the novel has it"
                : "still inside the convection zone"}
              . Bodies studied so far break up and burst far higher. Its energy
              of motion could lift at most {number(impact.bound / mass(run))}{" "}
              times its own mass out of the Sun. This run throws out{" "}
              {number(impact.ejecta / mass(run))} times its mass.
            </li>
            <li>
              <strong>The gas.</strong>{" "}
              {standing
                ? `The spiral unwinds at ${number(p["cloud.speed"])} km/s and stops ${au(run.flows[0].edge)} out, past ${reach(run.flows[0].edge)}.`
                : `${Math.round(100 * impact.escaping)}% of it is faster than escape speed and never comes back; the rest falls into the Sun again within days. It leaves in one jet. Nothing stays to make a spiral.`}
            </li>
            <li>
              <strong>The planets.</strong>{" "}
              {!standing
                ? "Gas that only passes can only nudge. The table gives the most each planet could be slowed if the jet hit it square on."
                : order.length === 0
                  ? "The gas is too thin to bring any planet down within ten billion years."
                  : `Each planet in the gas loses speed to it and spirals in; each impact adds gas and pushes the edge out. They fall in this order: ${order.map((id) => named(label(id))).join(", ")}.`}
              {early &&
                " Jupiter's own wake drags it in ahead of the Earth; the novel has the gas barely touching it."}
              {standing &&
                order.length > 0 &&
                " A planet that spirals in arrives at the speed of an orbit skimming the Sun, slower than Mercury's plunge, not faster as the novel has it."}
            </li>
            {run.airGone || run.seaGone ? (
              <li>
                <strong>The Earth.</strong>{" "}
                {run.airGone
                  ? `${span(run.airGone)} after the push it has met as much gas as it has air. `
                  : ""}
                {run.seaGone
                  ? `${span(run.seaGone)} after the push, drag has given it the heat to boil the sea away, if all of that heat went into the sea.`
                  : ""}
              </li>
            ) : null}
          </>
        )}
        <li>
          <strong>The novel's sums.</strong> Venus, the Earth and Mars together
          are {number(run.ratios.three)} times Mercury's mass (the novel says
          forty). Jupiter is {number(run.ratios.jupiter)} times the four of them
          (the novel says six hundred).
        </li>
      </ol>
    </section>
  );
}

// The orbit a distance has passed, for scale.
function reach(edge: number): string {
  const marks: [number, string][] = [
    [30.07, "Neptune's orbit"],
    [19.19, "the orbit of Uranus"],
    [9.54, "Saturn's orbit"],
    [5.2, "Jupiter's orbit"],
    [1.52, "the orbit of Mars"],
    [1, "the Earth's orbit"],
    [0.39, "Mercury's orbit"],
  ];
  return marks.find(([at]) => edge >= at)?.[1] ?? "the Sun's surface";
}

function Fates({ run, label }: { run: Run; label: Label }) {
  const what = (f: Run["fates"][number]): [string, string] => {
    switch (f.fate) {
      case "falls":
        return ["Falls into the Sun", `${span(f.time!)} after the push`];
      case "dragged":
        return ["In the gas, still orbiting", "After ten billion years"];
      case "beyond":
        return ["The gas never reaches it", ""];
      case "nudged":
        return f.nudge
          ? ["Passed by the jet", `Slowed by ${speed(f.nudge)} at most`]
          : ["No gas gets this far", ""];
      default:
        return ["Nothing reaches it", ""];
    }
  };
  return (
    <section className="diaz-fates" data-testid="fates">
      <h2>What becomes of each planet</h2>
      <table>
        <thead>
          <tr>
            <th scope="col">Planet</th>
            <th scope="col">What happens</th>
            <th scope="col">When, or how much</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">Mercury</th>
            <td>{run.falls ? "Falls into the Sun" : "Stays in its orbit"}</td>
            <td>
              {run.impact
                ? `${span(run.impact.time)} after the push`
                : `Slowed by ${speed(run.delivered)}`}
            </td>
          </tr>
          {run.fates.map((f) => {
            const [happens, much] = what(f);
            return (
              <tr key={f.id}>
                <th scope="row">{label(f.id)}</th>
                <td>{happens}</td>
                <td>{much}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
