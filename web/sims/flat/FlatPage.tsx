import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EngineError } from "../../shell/engine";
import type { SimulationProps } from "../../shell/registry";
import { resolve, type Study } from "../../shell/study";
import { useLatest } from "../../shell/useLatest";
import { afterglow, Fall, momentOf } from "./Fall";
import { bare, duration, figure, length, named } from "./format";
import { Caveat, query, Tabs, useStudy } from "./link";
import { PaintingView } from "./Painting";
import { Panel } from "./Panel";
import { Science } from "./Science";
import { SkyView } from "./SkyView";
import type { Catalog, PaintingCatalog, Run, Snow } from "./types";

export default function FlatPage({ engine, rest, arrival }: SimulationProps) {
  const [catalogs, setCatalogs] = useState<{
    bodies: Catalog;
    painting: PaintingCatalog;
  } | null>(null);
  const [failure, setFailure] = useState("");
  useEffect(() => {
    let live = true;
    Promise.all([
      engine.ask<Catalog>({ sim: "flat", action: "catalog" }),
      engine.ask<PaintingCatalog>({ sim: "flat", action: "painting-catalog" }),
    ]).then(
      ([bodies, painting]) => live && setCatalogs({ bodies, painting }),
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
  if (!catalogs) return <main className="page" aria-busy="true" />;
  const view = rest.split("?")[0];
  // A view reads the address once, on arrival. Keying it by the arrival
  // makes a link followed from inside the page one too, even a link to
  // the address the page was first opened at.
  if (view.startsWith("/science"))
    return <Science catalog={catalogs.bodies} painting={catalogs.painting} />;
  if (view.startsWith("/painting"))
    return (
      <PaintingView
        key={arrival}
        engine={engine}
        catalog={catalogs.painting}
        rest={rest}
      />
    );
  if (view.startsWith("/sky"))
    return (
      <SkyView
        key={arrival}
        engine={engine}
        catalog={catalogs.bodies}
        rest={rest}
      />
    );
  return (
    <BodyView
      key={arrival}
      engine={engine}
      catalog={catalogs.bodies}
      rest={rest}
    />
  );
}

// Snow crystals from the engine, as small pictures ready to draw.
export function useSnow(engine: SimulationProps["engine"]) {
  const [flakes, setFlakes] = useState<HTMLCanvasElement[] | null>(null);
  useEffect(() => {
    let live = true;
    engine
      .ask<Snow>({
        sim: "flat",
        action: "snowflakes",
        seed: 1,
        count: 12,
        size: 96,
      })
      .then(
        (snow) => {
          if (!live) return;
          const each = snow.size * snow.size;
          setFlakes(
            Array.from({ length: snow.count }, (_, n) => {
              const canvas = document.createElement("canvas");
              canvas.width = canvas.height = snow.size;
              const c = canvas.getContext("2d");
              if (!c) return canvas;
              const image = c.createImageData(snow.size, snow.size);
              for (let i = 0; i < each; i++) {
                image.data.set(
                  [255, 255, 255, snow.bytes[n * each + i]],
                  4 * i,
                );
              }
              c.putImageData(image, 0, 0);
              return canvas;
            }),
          );
        },
        () => {},
      );
    return () => {
      live = false;
    };
  }, [engine]);
  return flakes;
}

// The finished picture's width set among things of known size, since
// the view always pulls back to fit it.
const landmarks: [string, number][] = [
  ["The Moon's distance from the Earth", 384_400],
  ["Earth's distance from the Sun", 149.6e6],
  ["Neptune's distance from the Sun", 4515e6],
  ["A light-year", 9.4607e12],
];
function Ruler({ run }: { run: Run }) {
  const flat = 2 * run.radius;
  const rows: { label: string; km: number; own?: boolean }[] = [
    ...landmarks.map(([label, km]) => ({ label, km })),
    { label: `${run.body.label}, before`, km: 2 * run.body.radius },
    { label: `The flat ${bare(run.body)}`, km: flat, own: true },
  ].sort((a, b) => a.km - b.km);
  return (
    <div className="flat-ruler" data-testid="ruler" data-at={Math.round(flat)}>
      <h2>How wide that is</h2>
      <ol>
        {rows.map((row) => (
          <li key={row.label} aria-current={row.own ? "true" : undefined}>
            <span>{row.label}</span>
            <span>{length(row.km)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

type Want = { study: Study; body: string };

// Where on the timeline the flat picture becomes as wide as the body,
// when that happens early in the fall.
const crossingAt = 0.3;

function BodyView({
  engine,
  catalog,
  rest,
}: Omit<SimulationProps, "arrival"> & { catalog: Catalog }) {
  // The address is read once, on arrival.
  const [arrival] = useState(() => {
    const asked = query(rest).get("body");
    const known = catalog.bodies.some((b) => b.id === asked);
    const view = query(rest).get("view");
    return {
      body: known ? asked! : catalog.bodies[0].id,
      tilted: view !== "top",
      doubt: (asked !== null && !known) || (view !== null && view !== "top"),
    };
  });
  const [body, setBody] = useState(arrival.body);
  const [tilted, setTilted] = useState(arrival.tilted);
  const { study, change, reset, notice, setNotice, copied, copy } = useStudy(
    catalog,
    "#/flat",
    rest,
    {
      body: body === catalog.bodies[0].id ? "" : body,
      view: tilted ? "" : "top",
    },
    arrival.doubt,
  );
  // Where the timeline's handle stands, from 0 to 1 and on into the
  // afterglow. Unset until the first fall arrives and says where its
  // flat picture is as wide as the body.
  const [place, setPlace] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [open, setOpen] = useState(false);
  const flakes = useSnow(engine);

  const want = useMemo<Want>(() => ({ study, body }), [study, body]);
  const ask = useCallback(
    (q: Want) =>
      engine.ask<Run>({
        sim: "flat",
        action: "run",
        body: q.body,
        preset: q.study.preset,
        models: q.study.models,
        params: q.study.params,
      }),
    [engine],
  );
  const latest = useLatest(want, ask, 60);
  useEffect(() => {
    if (latest.error)
      setNotice(
        latest.error instanceof EngineError
          ? latest.error.message
          : "The fall could not be worked out. Reload the page to try again.",
      );
  }, [latest.error, setNotice]);
  const run = latest.result;

  // Nearly everything about the flat picture's growth happens in the
  // first moments of a fall: the Sun's is wider than the Sun thirty
  // seconds into an hour. So the first three tenths of the timeline run
  // up to that crossing, and the rest runs evenly to the end, where the
  // body can be watched going under.
  const crossing = run ? Math.min(1, run.crossing / run.duration) : 1;
  const moment = (p: number) => {
    if (!(p > 0)) return 0;
    if (p >= 1 || crossing >= crossingAt) return p;
    return p < crossingAt
      ? (crossing * p) / crossingAt
      : crossing + ((p - crossingAt) / (1 - crossingAt)) * (1 - crossing);
  };
  useEffect(() => {
    if (run && place === null) setPlace(Math.max(crossing, crossingAt));
  }, [run, place, crossing]);
  const at = moment(place ?? 0);

  // Play takes forty seconds over the fall, whatever its real length,
  // then lets the light fade.
  const live = useRef(place ?? 0);
  live.current = place ?? 0;
  useEffect(() => {
    if (!playing) return;
    let frame = 0,
      before = performance.now();
    const step = (now: number) => {
      // A frame can be stamped a little before the moment Play was
      // pressed; time never runs backwards here.
      const passed = Math.min(0.25, Math.max(0, (now - before) / 1000));
      const next = live.current + passed / 40;
      before = now;
      if (next >= 1 + afterglow) {
        setPlace(1 + afterglow);
        setPlaying(false);
        return;
      }
      live.current = next;
      setPlace(next);
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [playing]);

  if (!run || place === null)
    return (
      <main className="page flat" aria-busy="true">
        {notice && (
          <p role="status" className="notice">
            {notice}
          </p>
        )}
      </main>
    );

  const now = momentOf(run, at);
  const left = now.sink < 0 ? run.body.radius : now.foot;
  const h = run.choice.params["sheet.thickness"] / 1000;
  const spread = run.bands.length !== run.body.layers.length;
  const sea = run.body.layers.find((l) => l.sea);
  const seaRing = sea && run.rings.find((r) => r.layer === sea.id);
  const chosen = resolve(study, catalog);
  return (
    <main className="page flat">
      <div className="intro">
        <h1>Into two dimensions</h1>
        <p className="lede">
          In <cite>Death's End</cite>, a slip of flat space arrives and the
          Solar System falls into it: everything that touches the plane spreads
          out on it, with nothing overlapping and nothing hidden. Drop something
          in.
        </p>
        <Tabs current="body" />
      </div>
      <p role="status" className="notice" hidden={!notice}>
        {notice}
      </p>

      <section className="stage" aria-busy={latest.busy}>
        <div className="flat-pick">
          <label>
            <span>What falls</span>
            <select value={body} onChange={(e) => setBody(e.target.value)}>
              {catalog.bodies.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            aria-pressed={tilted}
            onClick={() => setTilted(!tilted)}
          >
            Seen from the side
          </button>
        </div>
        <figure className="flat-figure">
          <Fall
            run={run}
            at={at}
            tilted={tilted}
            flakes={flakes}
            label={`${run.body.label}, ${duration(Math.min(now.time, run.duration))} after touching the plane: its flat picture is ${length(2 * now.rim)} across`}
          />
          <figcaption>
            The plane is unseen. What has gone under lies flat on it. The view
            pulls back as the picture grows, so watch the bar for the scale.
          </figcaption>
        </figure>
        <div className="moment" data-testid="moment">
          <p className="moment-when">
            {at >= 1
              ? `All of ${named(run.body)} is flat`
              : `${duration(now.time)} after touching`}
          </p>
          <dl>
            <div>
              <dt>Flat picture</dt>
              <dd>{length(2 * now.rim)} across</dd>
            </div>
            <div>
              <dt>Still standing</dt>
              <dd>{at >= 1 ? "Nothing" : `${length(2 * left)} across`}</dd>
            </div>
            <div>
              <dt>The whole fall</dt>
              <dd>{duration(run.duration)}</dd>
            </div>
          </dl>
        </div>
        <div className="timeline">
          <div className="transport">
            <button
              type="button"
              className="play"
              onClick={() => {
                if (!playing && place >= 1 + afterglow) setPlace(0);
                setPlaying(!playing);
              }}
            >
              {playing ? "Pause" : "Play"}
            </button>
            <input
              type="range"
              aria-label="Time"
              aria-valuetext={duration(now.time)}
              min={0}
              max={1 + afterglow}
              step={0.001}
              value={place}
              onChange={(e) => {
                setPlaying(false);
                setPlace(Number(e.target.value));
              }}
            />
          </div>
        </div>
        <p className="verdict" data-testid="verdict">
          The flat {bare(run.body)} ends {length(2 * run.radius)} across,{" "}
          {figure(run.radius / run.body.radius, 2)} times{" "}
          {run.body.id === "sun" ? "the Sun's" : "its"} own width. It is wider
          than what is left standing after {duration(run.crossing)} of a fall
          that takes {duration(run.duration)}, so its rim grows at{" "}
          {figure(run.rimSpeed)} km/s.
          {run.fasterThanLight && " That is faster than light."} A person
          flattened on this sheet would be {length(run.person)} across.
        </p>
        <Ruler run={run} />
        <div className="flat-rings" data-testid="rings">
          <h2>What the picture is made of</h2>
          {spread ? (
            <p>
              Rings in the order they went in, one for every {length(h)} of
              depth: about {figure(run.grain, 2)} of them, the first slice of{" "}
              {named(run.body)} at the rim and the last in the middle. Each ring
              holds everything that was at that height.
            </p>
          ) : (
            <ol>
              {run.rings.map((ring) => {
                const layer = run.body.layers.find((l) => l.id === ring.layer)!;
                return (
                  <li key={ring.layer}>
                    <i className="swatch" style={{ background: layer.color }} />
                    <span>
                      <strong>{layer.label}</strong>:{" "}
                      {ring.inner === 0
                        ? `out to ${length(ring.outer)} from the middle`
                        : `a ring ${length(ring.outer - ring.inner)} wide, out to ${length(ring.outer)}`}
                      {layer.schematic && (
                        <span className="hint"> {layer.schematic}</span>
                      )}
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
          <p className="cite">Layers: {run.body.source}.</p>
        </div>
        {sea && (
          <p className="flat-snow" data-testid="snow">
            {spread || !seaRing
              ? "Spreading, the ocean is not a ring of its own, so there is nowhere for the novel's snowflakes to lie."
              : `Its ocean lands as a ring ${length(seaRing.outer - seaRing.inner)} wide, so that is the widest snowflake that fits. The novel's are 4,000 to 5,000 km across.`}
          </p>
        )}
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
                    </dt>
                    <dd>{model.summary}</dd>
                  </div>
                )
              );
            })}
          </dl>
        </section>
        <p className="hint">
          The light, the sparks, the Sun's flames and the snow crystals are
          drawn from the novel's description. The sizes, times and rings are
          worked out.
        </p>
        <Caveat />
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
            hint={
              <>
                Two ways matter could land, and two things the plane could keep.
                Now set to a sheet{" "}
                {length(chosen.params["sheet.thickness"] / 1000)} thick.{" "}
                <a href="#/flat/science">What is invented</a>
              </>
            }
            onStudy={change}
            // Choosing a starting point turns to the body its statement
            // in the novel is about, if it is about one. Nothing else
            // does: a slider put back where it started leaves the body.
            onPreset={(id) => {
              const about = catalog.focus[id];
              if (about) setBody(about);
            }}
            onReset={() => {
              reset();
              setBody(catalog.bodies[0].id);
            }}
            onCopy={copy}
            copied={copied}
          />
        </div>
      </aside>
    </main>
  );
}
