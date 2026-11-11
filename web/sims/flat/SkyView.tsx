import { useCallback, useEffect, useMemo, useState } from "react";
import { EngineError } from "../../shell/engine";
import type { SimulationProps } from "../../shell/registry";
import { resolve, type Study } from "../../shell/study";
import { useLatest } from "../../shell/useLatest";
import { tidy, useCanvas } from "./canvas";
import { bandColor, css, figure, length, scatter } from "./format";
import { Caveat, query, Tabs, useStudy } from "./link";
import { Panel } from "./Panel";
import type { Catalog, Sky } from "./types";

const AU = 149.6e6;
const reaches = [
  { id: "whole", label: "Out to Neptune", au: 34 },
  { id: "inner", label: "Out to Mars", au: 2 },
  { id: "far", label: "Far beyond", au: 400 },
] as const;
type Reach = (typeof reaches)[number]["id"];

// The flattened Solar System from straight above the plane. Places and
// sizes are the engine's, at one scale; the brush strokes are a manner
// of drawing, after the character who saw a painted night sky in it.
function Picture({
  sky,
  reach,
  brushed,
  label,
}: {
  sky: Sky;
  reach: number;
  brushed: boolean;
  label: string;
}) {
  const ref = useCanvas((c, width, height) => {
    const size = Math.min(width, height),
      cx = width / 2,
      cy = height / 2,
      px = size / 2 / (reach * AU);
    const where = (b: Sky["bodies"][number]) =>
      [cx + b.x * px, cy - b.y * px, b.radius * px] as const;
    c.fillStyle = "#081226";
    c.fillRect(0, 0, width, height);

    // Widest first, so the smaller lie on top.
    const order = [...sky.bodies].sort((a, b) => b.radius - a.radius);
    const disc = (b: Sky["bodies"][number], alpha: number) => {
      const [x, y, r] = where(b);
      for (let k = b.edges.length - 1; k >= 0; k--) {
        c.fillStyle = css(bandColor(b.bands[k], b.body), alpha);
        c.beginPath();
        c.arc(x, y, Math.max(0, b.edges[k] * r), 0, 2 * Math.PI);
        c.fill();
      }
    };
    for (const b of order) if (where(b)[2] >= 0.75) disc(b, 1);

    if (brushed) {
      // Short strokes that turn around each body like water round a
      // drain, taking the color of what lies under them.
      const under = c.getImageData(0, 0, c.canvas.width, c.canvas.height);
      const ratio = c.canvas.width / width;
      const tone = (x: number, y: number) => {
        const i =
          4 *
          (Math.min(under.height - 1, Math.max(0, Math.round(y * ratio))) *
            under.width +
            Math.min(under.width - 1, Math.max(0, Math.round(x * ratio))));
        return [under.data[i], under.data[i + 1], under.data[i + 2]];
      };
      const swirl = (x: number, y: number) => {
        let vx = 0.35,
          vy = 0.08;
        for (const b of sky.bodies) {
          const [bx, by, r] = where(b),
            dx = x - bx,
            dy = y - by,
            d = Math.hypot(dx, dy) + 1e-6,
            pull = Math.max(r, 10) / (d + Math.max(r, 10) * 0.4);
          vx += (-dy / d) * pull;
          vy += (dx / d) * pull;
        }
        const v = Math.hypot(vx, vy) || 1;
        return [vx / v, vy / v];
      };
      const any = scatter(sky.bodies.reduce((s, b) => s + b.order * 31, 7));
      c.lineCap = "round";
      const strokes = Math.round((width * height) / 60);
      for (let n = 0; n < strokes; n++) {
        let x = any() * width,
          y = any() * height;
        const [r, g, b] = tone(x, y),
          lift = 0.75 + 0.6 * any();
        c.strokeStyle = css(
          [r * lift + 8, g * lift + 10, b * lift + 18].map((v) =>
            Math.min(255, v),
          ),
          0.85,
        );
        c.lineWidth = 1.2 + 2.2 * any();
        c.beginPath();
        c.moveTo(x, y);
        for (let s = 0; s < 5; s++) {
          const [vx, vy] = swirl(x, y);
          x += vx * 3.2;
          y += vy * 3.2;
          c.lineTo(x, y);
        }
        c.stroke();
      }
    } else {
      // Orbits, to show where each body stood.
      c.strokeStyle = "rgba(200,214,240,0.16)";
      c.lineWidth = 1;
      for (const b of sky.bodies) {
        if (!b.body.orbit) continue;
        c.beginPath();
        c.arc(cx, cy, b.body.orbit * px, 0, 2 * Math.PI);
        c.stroke();
      }
    }
    // A body too small to see at this scale is marked where it is.
    c.font = "12px 'IBM Plex Sans', system-ui, sans-serif";
    for (const b of order) {
      const [x, y, r] = where(b);
      if (x < -20 || y < -20 || x > width + 20 || y > height + 20) continue;
      if (r < 0.75) {
        c.fillStyle = b.body.layers[b.body.layers.length - 1].color;
        c.beginPath();
        c.arc(x, y, 1.5, 0, 2 * Math.PI);
        c.fill();
      }
      c.fillStyle = "rgba(236,241,250,0.92)";
      c.strokeStyle = "rgba(8,18,38,0.8)";
      c.lineWidth = 3;
      const name = b.body.label.replace(/^The /, "");
      c.strokeText(name, x + Math.min(r, 40) * 0.7 + 5, y - 5);
      c.fillText(name, x + Math.min(r, 40) * 0.7 + 5, y - 5);
    }
    const bar = tidy((0.3 * width) / px / AU);
    c.strokeStyle = c.fillStyle = "rgba(236,241,250,0.9)";
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(14, height - 14);
    c.lineTo(14 + bar * AU * px, height - 14);
    c.stroke();
    c.fillText(`${figure(bar)} AU`, 14, height - 20);
  });
  return (
    <div className="flat-view" data-testid="sky">
      <canvas ref={ref} role="img" aria-label={label} />
    </div>
  );
}

type Want = { study: Study; seed: number };

export function SkyView({
  engine,
  catalog,
  rest,
}: SimulationProps & { catalog: Catalog }) {
  const [arrival] = useState(() => {
    const text = query(rest).get("seed");
    const seed = Number(text);
    const sound =
      text !== null && /^\d{1,9}$/.test(text) && Number.isInteger(seed);
    const show = query(rest).get("show");
    const known = reaches.some((r) => r.id === show);
    const plain = query(rest).get("plain");
    return {
      seed: sound ? seed : 0,
      reach: (known ? show : "whole") as Reach,
      brushed: plain !== "1",
      doubt:
        (text !== null && !sound) ||
        (show !== null && !known) ||
        (plain !== null && plain !== "1"),
    };
  });
  const [seed, setSeed] = useState(arrival.seed);
  const [reach, setReach] = useState<Reach>(arrival.reach);
  const [brushed, setBrushed] = useState(arrival.brushed);
  const { study, change, reset, notice, setNotice, copied, copy } = useStudy(
    catalog,
    "#/flat/sky",
    rest,
    {
      seed: seed ? String(seed) : "",
      show: reach === "whole" ? "" : reach,
      plain: brushed ? "" : "1",
    },
    arrival.doubt,
  );
  const [open, setOpen] = useState(false);

  const want = useMemo<Want>(() => ({ study, seed }), [study, seed]);
  const ask = useCallback(
    (q: Want) =>
      engine.ask<Sky>({
        sim: "flat",
        action: "sky",
        seed: q.seed,
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
          : "The sky could not be worked out. Reload the page to try again.",
      );
  }, [latest.error, setNotice]);
  const sky = latest.result;
  if (!sky)
    return (
      <main className="page flat" aria-busy="true">
        {notice && (
          <p role="status" className="notice">
            {notice}
          </p>
        )}
      </main>
    );

  const sun = sky.bodies.find((b) => b.body.star)!;
  const under = sky.touching.filter(([a]) => a === sun.body.id).length;
  const others = sky.touching.length - under;
  const turn = [...sky.bodies].sort((a, b) => a.order - b.order);
  const widest = sky.bodies
    .filter((b) => !b.body.star)
    .sort((a, b) => b.radius - a.radius)[0];
  const share = `${figure(sky.covered * 100, 2)}%`;
  const chosen = resolve(study, catalog);
  return (
    <main className="page flat">
      <div className="intro">
        <h1>The flat sky</h1>
        <p className="lede">
          When all of it has fallen, one character looks at the flat Solar
          System and sees a painting she knows: planets like whirlpools, wider
          than the gaps between them. Here is the whole system flattened by the
          same rule, at one scale.
        </p>
        <Tabs current="sky" />
      </div>
      <p role="status" className="notice" hidden={!notice}>
        {notice}
      </p>

      <section className="stage" aria-busy={latest.busy}>
        <div className="flat-pick">
          <button
            type="button"
            onClick={() => setSeed(1 + Math.floor(Math.random() * 999_999))}
          >
            Shuffle the planets
          </button>
          <button
            type="button"
            disabled={seed === 0}
            onClick={() => setSeed(0)}
          >
            As in the novel
          </button>
          <label>
            <span>Show</span>
            <select
              value={reach}
              onChange={(e) => setReach(e.target.value as Reach)}
            >
              {reaches.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={brushed}
              onChange={(e) => setBrushed(e.target.checked)}
            />
            <span>Brush strokes</span>
          </label>
        </div>
        <figure className="flat-figure">
          <Picture
            sky={sky}
            reach={reaches.find((r) => r.id === reach)!.au}
            brushed={brushed}
            label={`The flattened Solar System from above. The planets cover ${share} of the space inside Neptune's orbit.`}
          />
          <figcaption>
            From above the plane, the Sun in the middle. Every body is drawn at
            its true flat size; one too small to see is a dot.
          </figcaption>
        </figure>
        <p className="verdict" data-testid="verdict">
          {sky.touching.length === 0
            ? "Nothing touches. "
            : under > 0
              ? `The flat Sun lies over ${under} of the nine planets${others ? `, and ${others} more pair${others === 1 ? "" : "s"} of planets overlap` : ""}. `
              : `${others} pair${others === 1 ? "" : "s"} of planets overlap. `}
          The planets cover {share} of the space inside Neptune's orbit. The
          flat Sun is {length(2 * sun.radius)} across and the widest planet,{" "}
          {widest.body.label.replace(/^The /, "the ")},{" "}
          {length(2 * widest.radius)}.
        </p>
        <div className="flat-rings">
          <h2>The order they fall in</h2>
          <p data-testid="order">
            {turn.map((b) => b.body.label.replace(/^The /, "")).join(", ")}
          </p>
          <p className="hint">
            The plane spreads evenly from the side Neptune stands on in the
            novel, so whatever is nearest goes first.{" "}
            {seed === 0
              ? "The novel gives the order, not the places; these places were chosen to match it."
              : "These places are a shuffle, not the novel's."}
          </p>
        </div>
        <p className="hint">
          Where flat bodies would overlap they are simply drawn over one
          another, smallest on top. What they would do to each other is not
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
                The same rules as for one body, applied to all of them. Now set
                to a sheet {length(chosen.params["sheet.thickness"] / 1000)}{" "}
                thick. <a href="#/flat/science">What is invented</a>
              </>
            }
            onStudy={change}
            onReset={() => {
              reset();
              setSeed(0);
              setReach("whole");
              setBrushed(true);
            }}
            onCopy={copy}
            copied={copied}
          />
        </div>
      </aside>
    </main>
  );
}
