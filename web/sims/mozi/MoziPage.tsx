import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { setPlace } from "../../shell/address";
import { EngineError } from "../../shell/engine";
import { number } from "../../shell/catalog";
import { useLatest } from "../../shell/useLatest";
import type { SimulationProps } from "../../shell/registry";
import { Calendar } from "./Calendar";
import {
  dayLabel,
  dayOf,
  eraAt,
  eraName,
  forecast,
  height,
  verdict,
  viewAt,
} from "./format";
import {
  hasTwoShells,
  layerNames,
  Machine,
  type Layer,
  type Layers,
} from "./Machine";
import { Panel } from "./Panel";
import { Science } from "./Science";
import { Sky } from "./Sky";
import {
  choice,
  decode,
  defaultStudy,
  encode,
  isDefault,
  resolve,
  type Study,
} from "./study";
import { Timeline, type Speed } from "./Timeline";
import type { Catalog, Frames, Run, View } from "./types";

const linkOf = (rest: string) => {
  const match = /[?&]c=([^&]*)/.exec(rest);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return "";
  }
};

const layerLabels: Record<Layer, string> = {
  fire: "Sea of fire",
  outer: "Outer shell",
  light: "Light between the shells",
  inner: "Inner shell",
  clerk: "The clerk",
};

// Where the two views stack and the timeline docks during play. Keep in
// step with the same width in style.css.
const narrowQuery = "(max-width: 43.99rem)";

// Frames are fetched a few days at a time, a quarter of an hour apart.
const frameStep = 1 / 96,
  windowDays = 3;

export default function MoziPage({ engine, rest, arrival }: SimulationProps) {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [failure, setFailure] = useState("");
  useEffect(() => {
    let live = true;
    engine.ask<Catalog>({ sim: "mozi", action: "catalog" }).then(
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
  if (rest.startsWith("/science")) return <Science catalog={catalog} />;
  // The address is read once, on arrival; keyed by the arrival, a link
  // followed or pasted while the machine is open is read too.
  return (
    <Simulation key={arrival} engine={engine} catalog={catalog} rest={rest} />
  );
}

// What the engine is asked for: a study, and the day the frames start.
type Want = { study: Study; from: number };
type Got = { run: Run; frames: Frames };

function Simulation({
  engine,
  catalog,
  rest,
}: Omit<SimulationProps, "arrival"> & { catalog: Catalog }) {
  // The address is read once, on arrival.
  const [arrival] = useState(() => {
    const text = linkOf(rest);
    if (text === null) return { study: defaultStudy(catalog), notice: "" };
    const study = decode(text, catalog);
    return study
      ? { study, notice: "" }
      : {
          study: defaultStudy(catalog),
          notice:
            "That link could not be read, so this is the default machine instead.",
        };
  });
  const [study, setStudy] = useState<Study>(arrival.study);
  const [notice, setNotice] = useState(arrival.notice);
  // Null until the first calendar arrives and says when the sun first rises.
  const [time, setTime] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<Speed>("quarter");
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [layers, setLayers] = useState<Layers>({
    fire: true,
    outer: true,
    light: true,
    inner: true,
    clerk: true,
  });

  // Keep the address in step, without adding history entries.
  useEffect(() => {
    const hash = isDefault(study, catalog)
      ? "#/mozi"
      : `#/mozi?c=${encode(study)}`;
    setPlace("mozi", hash);
    setCopied(false);
  }, [study, catalog]);

  // One request at a time, and only ever the newest (see useLatest). The
  // calendar is asked for again only when the study changes; the frames
  // follow the clock in windows of a few days.
  const from = Math.floor(time ?? 0);
  const want = useMemo<Want>(() => ({ study, from }), [study, from]);
  const held = useRef<{ study: Study; run: Run } | null>(null);
  const ask = useCallback(
    async (q: Want): Promise<Got> => {
      const run =
        held.current?.study === q.study
          ? held.current.run
          : await engine.ask<Run>({
              sim: "mozi",
              action: "run",
              ...choice(q.study),
            });
      held.current = { study: q.study, run };
      const frames = await engine.ask<Frames>({
        sim: "mozi",
        action: "sky",
        ...choice(q.study),
        from: Math.min(q.from, run.span),
        step: frameStep,
        count: Math.round(windowDays / frameStep) + 1,
      });
      return { run, frames };
    },
    [engine],
  );
  const latest = useLatest(want, ask, 30);
  useEffect(() => {
    if (latest.error)
      setNotice(
        latest.error instanceof EngineError
          ? latest.error.message
          : "The machine could not run. Reload the page to try again.",
      );
  }, [latest.error]);
  const run = latest.result?.run ?? null;
  const frames = latest.result?.frames ?? null;

  // Start a little after the first sunrise, so the sun is up on arrival.
  useEffect(() => {
    if (run && time === null)
      setTime(run.calendar.rise.length ? run.calendar.rise[0] + 0.2 : 0);
  }, [run, time]);
  // A shorter calendar may end before the moment on show.
  useEffect(() => {
    if (run && time !== null && time > run.span) setTime(run.span);
  }, [run, time]);

  // What is on screen comes from the frames that are in hand. While a
  // newer window is on its way, the last moment drawn stays up.
  const drawn = useRef<View | null>(null);
  const view = useMemo(() => {
    const fresh = frames && time !== null ? viewAt(frames, time) : null;
    if (fresh) drawn.current = fresh;
    return drawn.current;
  }, [frames, time]);

  const change = useCallback((update: (s: Study) => Study) => {
    setNotice("");
    setStudy(update);
  }, []);
  const move = useCallback((t: number) => setTime(t), []);

  // On a narrow screen, pressing Play brings the clerk's sky to the top and
  // pins the timeline to the bottom. It stays pinned through a pause or a
  // scrub, so the clock can be steered from where the visitor is; the
  // first scroll while time stands still puts it back in the page. The
  // slot keeps the timeline's place so nothing below it moves.
  const skyFigure = useRef<HTMLElement>(null);
  const slot = useRef<HTMLDivElement>(null);
  const [docked, setDocked] = useState(false);
  const [slotHeight, setSlotHeight] = useState(0);
  // The snap is itself a scroll; it must not count as the visitor's.
  const snapping = useRef(0);
  const play = useCallback((on: boolean) => {
    setPlaying(on);
    if (!on || !matchMedia(narrowQuery).matches) return;
    if (slot.current && !slot.current.querySelector(".docked"))
      setSlotHeight(slot.current.getBoundingClientRect().height);
    setDocked(true);
    snapping.current = performance.now() + 1000;
    skyFigure.current?.scrollIntoView({
      block: "start",
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    });
  }, []);
  useEffect(() => {
    if (!docked || playing) return;
    const dismiss = () => {
      if (performance.now() >= snapping.current) setDocked(false);
    };
    addEventListener("scroll", dismiss, { passive: true });
    return () => removeEventListener("scroll", dismiss);
  }, [docked, playing]);

  const now = useMemo(() => resolve(study, catalog), [study, catalog]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(location.href);
      setCopied(true);
    } catch {
      setNotice("Copying was blocked. Copy the address from the address bar.");
    }
  };

  if (!run || !view || time === null)
    return (
      <main className="page mozi" aria-busy="true">
        {notice && (
          <p role="status" className="notice">
            {notice}
          </p>
        )}
      </main>
    );

  const at = Math.min(view.time, run.span);
  const era = run.eras[eraAt(run, at)];
  const up = height(view.sun);
  const two = hasTwoShells(view);
  const sunLine =
    up > 0
      ? `the sun is up, ${Math.round(up)}° above the horizon`
      : "the sun is down";
  return (
    <main className={`page mozi${docked ? " docking" : ""}`}>
      <div className="intro">
        <h1>Mozi's machine</h1>
        <p className="lede">
          In <cite>The Three-Body Problem</cite>, Mozi builds the universe in
          copper: two shells in a sea of fire, and a clerk at the center writing
          a calendar. Here is that machine.{" "}
          <a href="#/mozi/science">The scene and what is invented</a>
        </p>
      </div>
      <p role="status" className="notice" hidden={!notice}>
        {notice}
      </p>

      <section className="stage" aria-busy={latest.busy}>
        <div className="views">
          <figure ref={skyFigure} className="sky-figure">
            <Sky
              view={view}
              stars={run.stars}
              label={`The clerk's sky on day ${dayOf(at, run.span)}: ${sunLine}`}
            />
            <figcaption>
              <strong>The clerk's sky</strong>
              <span> From the center, looking up. The rim is the horizon.</span>
            </figcaption>
          </figure>
          <figure>
            <Machine
              view={view}
              stars={run.stars}
              layers={layers}
              label={`The machine cut open on day ${dayOf(at, run.span)}: ${
                two ? "two shells" : "one sphere"
              }, with the large hole ${up > 0 ? "above" : "below"} the clerk's floor`}
            />
            <figcaption>
              <strong>The machine</strong>
              <span> From outside, cut open. Drag to turn it.</span>
            </figcaption>
          </figure>
        </div>
        <fieldset className="layers">
          <legend>Layers</legend>
          {layerNames.map((name) => {
            const missing = !two && (name === "light" || name === "inner");
            return (
              <label key={name} className="check">
                <input
                  type="checkbox"
                  checked={layers[name] && !missing}
                  disabled={missing}
                  onChange={(e) =>
                    setLayers((l) => ({ ...l, [name]: e.target.checked }))
                  }
                />
                <span>{layerLabels[name]}</span>
              </label>
            );
          })}
        </fieldset>
        <div className="moment" data-testid="moment">
          <p className="moment-when">{dayLabel(at, run.span)}</p>
          <dl>
            <div>
              <dt>Sun</dt>
              <dd>{up > 0 ? `Up, ${Math.round(up)}° high` : "Down"}</dd>
            </div>
            <div>
              <dt>Width</dt>
              <dd>{number(view.size)}°</dd>
            </div>
            <div>
              <dt>Brightness</dt>
              <dd>{number(Math.round(view.brightness * 100) / 100)} × rest</dd>
            </div>
            <div>
              <dt>Era</dt>
              <dd>
                <i className={`eon-key era-${era.kind}`} />
                {eraName(era)}
              </dd>
            </div>
          </dl>
        </div>
        <div
          className="timeline-slot"
          ref={slot}
          style={docked && slotHeight ? { minHeight: slotHeight } : undefined}
        >
          <Timeline
            run={run}
            time={Math.min(time, run.span)}
            playing={playing}
            docked={docked}
            label={dayLabel(at, run.span)}
            speed={speed}
            onTime={move}
            onPlaying={play}
            onSpeed={setSpeed}
          />
        </div>
        <p className="forecast" data-testid="forecast">
          {forecast(run, at)}
        </p>
        <p className="verdict" data-testid="verdict">
          {verdict(run)}
        </p>
        <section className="explains" data-testid="explains">
          <h2>How this machine explains the sky</h2>
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
                    </dt>
                    <dd>{model.summary}</dd>
                  </div>
                )
              );
            })}
          </dl>
        </section>
        <p className="caveat" data-testid="speculative">
          <strong className="spec">Speculative.</strong> The novel gives no
          numbers for this machine. Every gear, size and rule here was invented
          for this site.
        </p>
      </section>

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
            onStudy={change}
            onReset={() => change(() => defaultStudy(catalog))}
            onCopy={copy}
            copied={copied}
          />
        </div>
      </aside>

      <Calendar
        run={run}
        time={at}
        onTime={(t) => {
          setPlaying(false);
          setTime(t);
        }}
      />
    </main>
  );
}
