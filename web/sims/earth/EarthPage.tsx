import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EngineError } from "../../shell/engine";
import { useLatest } from "../../shell/useLatest";
import type { SimulationProps } from "../../shell/registry";
import { Chance } from "./Chance";
import { Charts } from "./Charts";
import {
  celsius,
  indexAt,
  oceans,
  pressure,
  verdict,
  whenLabel,
} from "./format";
import { Globe } from "./Globe";
import { lookAt } from "./look";
import { Panel } from "./Panel";
import { Science } from "./Science";
import { Surface } from "./Surface";
import {
  decode,
  defaultStudy,
  encode,
  isDefault,
  request,
  resolve,
  type Study,
} from "./study";
import { Timeline } from "./Timeline";
import type { Catalog, Pair, Result } from "./types";

const wideQuery = "(min-width: 62rem)";

const linkOf = (rest: string) => {
  const match = /[?&]c=([^&]*)/.exec(rest);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return "";
  }
};

export default function EarthPage({ engine, rest }: SimulationProps) {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [failure, setFailure] = useState("");
  useEffect(() => {
    let live = true;
    engine.ask<Catalog>({ sim: "earth", action: "catalog" }).then(
      (c) => live && setCatalog(c),
      (e: Error) => live && setFailure(e.message),
    );
    return () => {
      live = false;
    };
  }, [engine]);
  if (rest.startsWith("/chance")) return <Chance engine={engine} />;
  if (rest.startsWith("/surface"))
    return <Surface engine={engine} rest={rest} />;
  if (failure)
    return (
      <main className="page notice-page">
        <p role="alert">{failure}</p>
      </main>
    );
  if (!catalog) return <main className="page" aria-busy="true" />;
  if (rest.startsWith("/science")) return <Science catalog={catalog} />;
  return <Simulation engine={engine} catalog={catalog} rest={rest} />;
}

function Simulation({
  engine,
  catalog,
  rest,
}: SimulationProps & { catalog: Catalog }) {
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
            "That link could not be read, so this is the default run instead.",
        };
  });
  const [study, setStudy] = useState<Study>(arrival.study);
  const [notice, setNotice] = useState(arrival.notice);
  const [position, setPosition] = useState(Number.POSITIVE_INFINITY);
  const [playing, setPlaying] = useState(false);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  // Room for both Earths side by side: the same width at which the panel
  // moves beside the stage.
  const [wide, setWide] = useState(() => matchMedia(wideQuery).matches);
  useEffect(() => {
    const media = matchMedia(wideQuery);
    const update = () => setWide(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  // Keep the address in step, without adding history entries.
  useEffect(() => {
    const hash = isDefault(study, catalog)
      ? "#/earth"
      : `#/earth?c=${encode(study)}`;
    if (location.hash !== hash) history.replaceState(null, "", hash);
    setCopied(false);
  }, [study, catalog]);

  // Run both Earths for the latest study. Runs go one at a time and a
  // study that a newer one has replaced is never sent (see useLatest).
  const ask = useCallback(
    (q: Study) =>
      Promise.all([
        engine.ask<Result>(request(q, true)),
        engine.ask<Result>(request(q, false)),
      ]).then(([living, lifeless]) => ({ living, lifeless })),
    [engine],
  );
  const latest = useLatest(study, ask, 60);
  const pair: Pair | null = latest.result;
  const busy = latest.busy;
  useEffect(() => {
    if (latest.error)
      setNotice(
        latest.error instanceof EngineError
          ? latest.error.message
          : "The simulation could not run. Reload the page to try again.",
      );
  }, [latest.error]);

  const change = useCallback((update: (s: Study) => Study) => {
    setNotice("");
    setStudy(update);
  }, []);

  const shown = pair && (study.life ? pair.living : pair.lifeless);
  const last = shown ? shown.time.length - 1 : 0;
  const at = Math.min(position, last);
  const look = useMemo(() => (shown ? lookAt(shown, at) : null), [shown, at]);
  const now = useMemo(() => resolve(study, catalog), [study, catalog]);
  const speculative = catalog.slots.flatMap((slot) =>
    slot.models.filter((m) => m.speculative && now.models[slot.id] === m.id),
  );

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(location.href);
      setCopied(true);
    } catch {
      setNotice("Copying was blocked. Copy the address from the address bar.");
    }
  };

  if (!shown || !look)
    return (
      <main className="page earth" aria-busy="true">
        {notice && (
          <p role="status" className="notice">
            {notice}
          </p>
        )}
      </main>
    );

  const i = Math.round(at);
  const age = shown.time[i];
  const molten = shown.series.melt[i] > 0.3;
  // The surface view takes this moment's plant cover and rain. Runoff
  // rises with warmth as Schwartzman & Volk (1989) take it, exp(0.017 dT)
  // capped at twice today's; a planet without oceans has none.
  const warmth =
    shown.series.equilibrium[i] - pair!.living.series.equilibrium[last];
  const rain =
    shown.series.ocean[i] > 0
      ? Math.min(2, Math.max(0.2, Math.exp(0.017 * warmth)))
      : 0;
  const surfaceLink = `#/earth/surface?scene=crater&cover=${(0.9 * shown.series.vegetation[i]).toFixed(2)}&rain=${rain.toFixed(2)}`;
  const water = shown.series.ocean[i];
  return (
    <main className="page earth">
      <div className="intro">
        <h1>Earth without life</h1>
        <p className="lede">
          In <cite>Death's End</cite>, a researcher unchecks one box and reruns
          the planet. Here is that panel. The numbers behind it come from
          published Earth science.{" "}
          <a href="#/earth/science">The science and its sources</a>
        </p>
      </div>
      <p role="status" className="notice" hidden={!notice}>
        {notice}
      </p>

      <section className="stage" aria-busy={busy}>
        <div className={`globes${wide ? " two" : ""}`}>
          {(wide ? [pair!.living, pair!.lifeless] : [shown]).map((r) => (
            <figure
              key={String(r.life)}
              className={r === shown ? "chosen" : undefined}
            >
              <Globe
                look={r === shown ? look : lookAt(r, at)}
                label={`${r.life ? "Living" : "Lifeless"} Earth, ${whenLabel(age).toLowerCase()}`}
              />
              {wide && (
                <figcaption>
                  <i className={`key ${r.life ? "living" : "lifeless"}`} />
                  {r.life ? "Living Earth" : "Lifeless Earth"}
                  {r === shown && <span> (in the readout below)</span>}
                </figcaption>
              )}
            </figure>
          ))}
        </div>
        <div className="moment" data-testid="moment">
          <p className="moment-when">{whenLabel(age)}</p>
          {molten ? (
            <p className="moment-state">Molten surface, cooling</p>
          ) : (
            <dl>
              <div>
                <dt>Surface</dt>
                <dd>{celsius(shown.series.equilibrium[i])}</dd>
              </div>
              <div>
                <dt>Carbon dioxide</dt>
                <dd>{pressure(shown.series.co2[i])}</dd>
              </div>
              <div>
                <dt>Oxygen</dt>
                <dd>{pressure(shown.series.o2[i])}</dd>
              </div>
              <div>
                <dt>Water</dt>
                <dd>{oceans(water)}</dd>
              </div>
            </dl>
          )}
        </div>
        <Timeline
          result={shown}
          position={at}
          playing={playing}
          onPosition={setPosition}
          onPlaying={setPlaying}
        />
        <p className="verdict" data-testid="verdict">
          {verdict(shown)}
        </p>
        <p className="zoom">
          <a href={surfaceLink}>Zoom in to this surface</a>
          <span className="hint">
            {" "}
            What rain and time do to a mountain range and a crater on this
            planet, at the moment shown.
          </span>
        </p>
        <p className="zoom">
          <a href="#/earth/chance">Was it luck?</a>
          <span className="hint">
            {" "}
            Run a thousand random planets and count the ones that stay
            habitable.
          </span>
        </p>
        {speculative.length > 0 && (
          <p className="caveat" data-testid="speculative">
            <strong className="spec">Speculative.</strong> This run includes{" "}
            {speculative.map((m) => m.label.toLowerCase()).join(" and ")}, which
            has no published basis. Choose Skeptic, or set Unshielded loss to
            None under Models, to see published physics alone.
          </p>
        )}
        {shown.summary.extrapolated && (
          <p className="caveat">
            Part of this run lies outside the range the climate model was fitted
            over. Read those temperatures as rough.
          </p>
        )}
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

      <Charts
        pair={pair!}
        age={age}
        onAge={(t) => {
          setPlaying(false);
          setPosition(indexAt(shown, t));
        }}
      />
    </main>
  );
}
