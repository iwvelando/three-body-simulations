import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EngineError } from "../../shell/engine";
import type { SimulationProps } from "../../shell/registry";
import { resolve, type Study } from "../../shell/study";
import { useLatest } from "../../shell/useLatest";
import { figure, length, still } from "./format";
import { Caveat, Tabs, useStudy } from "./link";
import { Panel } from "./Panel";
import { flatCanvas, Sheet } from "./Sheet";
import type { Painted, PaintingCatalog } from "./types";

// A picture as the engine takes it: dots, row by row, four bytes each.
type Source = {
  name: string;
  width: number;
  height: number;
  pixels: Uint8ClampedArray;
};

// Large enough to read, small enough to flatten in a moment.
const longest = 320,
  heaviest = 40e6;

async function read(blob: Blob, name: string): Promise<Source> {
  const bitmap = await createImageBitmap(blob);
  try {
    const shrink = Math.min(1, longest / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * shrink));
    canvas.height = Math.max(1, Math.round(bitmap.height * shrink));
    const c = canvas.getContext("2d", { willReadFrequently: true });
    if (!c) throw new Error("no canvas");
    c.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return {
      name,
      width: canvas.width,
      height: canvas.height,
      pixels: c.getImageData(0, 0, canvas.width, canvas.height).data,
    };
  } finally {
    bitmap.close();
  }
}

// Draws RGBA dots at their own size; CSS scales the canvas.
function Dots({
  width,
  height,
  pixels,
  label,
}: {
  width: number;
  height: number;
  pixels: Uint8Array | Uint8ClampedArray;
  label: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    canvas.width = width;
    canvas.height = height;
    const c = canvas.getContext("2d");
    if (!c) return;
    const image = c.createImageData(width, height);
    image.data.set(pixels);
    c.putImageData(image, 0, 0);
  }, [width, height, pixels]);
  return <canvas ref={ref} role="img" aria-label={label} />;
}

type Want = { study: Study; source: Source };

export function PaintingView({
  engine,
  catalog,
  rest,
}: SimulationProps & { catalog: PaintingCatalog }) {
  const { study, change, reset, notice, setNotice, copied, copy } = useStudy(
    catalog,
    "#/flat/painting",
    rest,
    {},
  );
  const [source, setSource] = useState<Source | null>(null);
  const [refusal, setRefusal] = useState("");
  const [open, setOpen] = useState(false);

  // The sample is the site's own file; a visitor's picture is read here
  // and never leaves the page.
  const sample = useCallback(async () => {
    try {
      const reply = await fetch("./starry-night.jpg");
      if (!reply.ok) throw new Error("missing");
      setSource(await read(await reply.blob(), "The Starry Night (sample)"));
      setRefusal("");
    } catch {
      setRefusal("The sample picture could not be loaded. Choose your own.");
    }
  }, []);
  useEffect(() => {
    void sample();
  }, [sample]);
  const choose = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > heaviest) {
      setRefusal("That file is too large. Choose one under 40 MB.");
      return;
    }
    try {
      setSource(await read(file, file.name));
      setRefusal("");
    } catch {
      setRefusal(
        "That file could not be read as a picture. Choose a PNG or a JPEG.",
      );
    }
  };

  const want = useMemo<Want | null>(
    () => (source ? { study, source } : null),
    [study, source],
  );
  const ask = useCallback(
    (q: Want) =>
      engine.ask<Painted>(
        {
          sim: "flat",
          action: "painting",
          width: q.source.width,
          height: q.source.height,
          preset: q.study.preset,
          models: q.study.models,
          params: q.study.params,
        },
        // A copy: the engine takes the bytes it is handed.
        new Uint8Array(q.source.pixels),
      ),
    [engine],
  );
  const latest = useLatest(want, ask, 120);
  useEffect(() => {
    if (latest.error)
      setNotice(
        latest.error instanceof EngineError
          ? latest.error.message
          : "The picture could not be flattened. Reload the page to try again.",
      );
  }, [latest.error, setNotice]);
  const painted = latest.result;
  const shown = latest.shown;

  // Where the fall stands, in shares of the picture gone in; and whether
  // the restored picture has been asked for.
  const [progress, setProgress] = useState<number | null>(null);
  const [restored, setRestored] = useState(false);
  const moving = useRef(0);
  useEffect(() => {
    cancelAnimationFrame(moving.current);
    setProgress(null);
    setRestored(false);
  }, [painted]);
  useEffect(() => () => cancelAnimationFrame(moving.current), []);
  const run = (from: number, to: number, seconds: number, then: () => void) => {
    cancelAnimationFrame(moving.current);
    if (still() || !painted || painted.still) {
      setProgress(to);
      then();
      return;
    }
    const began = performance.now();
    const step = (now: number) => {
      const share = Math.min(1, (now - began) / (1000 * seconds));
      setProgress(from + (to - from) * share);
      if (share < 1) moving.current = requestAnimationFrame(step);
      else then();
    };
    moving.current = requestAnimationFrame(step);
  };

  const save = () => {
    if (!painted) return;
    flatCanvas(painted).toBlob((blob) => {
      if (!blob) return;
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "flat-picture.png";
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    }, "image/png");
  };

  const chosen = resolve(study, catalog);
  const used = painted?.choice;
  const size = () => {
    if (!painted || !used) return "";
    const wide = used.params["paper.width"] / 100;
    if (painted.dilution !== undefined)
      return `Buried, the picture is spread over ${length(painted.across / 1000)} by ${length(painted.tall / 1000)} of Pluto's ring, and is one part in ${figure(1 / painted.dilution, 2)} of what lies there.`;
    if (painted.thin)
      return `This sheet is thicker than the picture, so the picture cannot spread: it lands ${length(painted.across / 1000)} by ${length(painted.tall / 1000)}.`;
    return `The flat picture is ${length(painted.across / 1000)} across, from a canvas ${length(wide / 1000)} wide and ${length(used.params["paper.depth"] / 1e6)} deep.`;
  };
  return (
    <main className="page flat">
      <div className="intro">
        <h1>Save a painting</h1>
        <p className="lede">
          The museum on Pluto asks for its paintings to be carried off and let
          go one by one, so that each falls into the plane alone and some later
          mind might work out what it was. Drop a picture in, then try to get it
          back.
        </p>
        <Tabs current="painting" />
      </div>
      <p role="status" className="notice" hidden={!notice}>
        {notice}
      </p>

      <section className="stage" aria-busy={latest.busy}>
        <div className="flat-pick">
          <label className="file" data-testid="choose">
            <span>Choose a picture</span>
            <input
              type="file"
              accept="image/png,image/jpeg"
              onChange={(e) => {
                void choose(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>
          <button type="button" onClick={() => void sample()}>
            Use the sample
          </button>
        </div>
        <p className="hint">
          PNG or JPEG. Your picture is read on this device and is not sent
          anywhere.
        </p>
        {refusal && (
          <p role="alert" className="notice">
            {refusal}
          </p>
        )}
        {painted && shown && (
          <>
            <div className="flat-pair">
              <figure className="flat-figure">
                <Sheet
                  painted={painted}
                  progress={progress ?? painted.rows}
                  label={`The plane from above: ${shown.source.name}, flattened`}
                />
                <figcaption>
                  The plane, from above.{" "}
                  {painted.mirror
                    ? "The picture stands on the line across the middle and sinks through it: the painted front spreads to one side, the back to the other."
                    : painted.core
                      ? "The picture lay on the patch in the middle and has left it as bands."
                      : "The picture does not spread."}
                </figcaption>
              </figure>
              <div className="flat-side">
                <figure>
                  <div className="flat-thumb">
                    <Dots
                      width={shown.source.width}
                      height={shown.source.height}
                      pixels={shown.source.pixels}
                      label="The picture as it was"
                    />
                  </div>
                  <figcaption data-testid="source">
                    {shown.source.name}, {shown.source.width} by{" "}
                    {shown.source.height} dots
                  </figcaption>
                </figure>
                {restored && (
                  <figure>
                    <div className="flat-thumb">
                      <Dots
                        width={painted.restored.width}
                        height={painted.restored.height}
                        pixels={painted.bytes.subarray(
                          painted.restored.offset,
                          painted.restored.offset +
                            4 *
                              painted.restored.width *
                              painted.restored.height,
                        )}
                        label="The picture as restored"
                      />
                    </div>
                    <figcaption data-testid="score">
                      Restored: {Math.round(painted.score * 100)}% of the
                      picture came back
                    </figcaption>
                  </figure>
                )}
              </div>
            </div>
            <div className="actions">
              <button
                type="button"
                disabled={painted.still}
                onClick={() => {
                  setRestored(false);
                  run(0, painted.rows, 6, () => {});
                }}
              >
                Let it fall
              </button>
              <button
                type="button"
                onClick={() =>
                  run(progress ?? painted.rows, 0, 2.5, () => {
                    setRestored(true);
                  })
                }
              >
                Restore it
              </button>
              <button type="button" onClick={save}>
                Save the flat picture
              </button>
            </div>
            <p className="verdict" data-testid="size">
              {size()}
            </p>
            <section className="explains" data-testid="explains">
              <h2>The rules in use</h2>
              <dl>
                {catalog.slots.map((slot) => {
                  const model = slot.models.find(
                    (m) => m.id === painted.choice.models[slot.id],
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
                <div>
                  <dt>Restoring</dt>
                  <dd>
                    Whoever restores it knows the rule and runs it backwards,
                    but sees the flat picture only as{" "}
                    {figure(Math.round(painted.choice.params.reader))} dots
                    across. What is finer than a dot is lost.
                  </dd>
                </div>
              </dl>
            </section>
          </>
        )}
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
                How the picture goes in, what goes in with it, and how thin the
                sheet is: now {length(chosen.params["sheet.thickness"] / 1000)}.{" "}
                <a href="#/flat/science">What is invented</a>
              </>
            }
            onStudy={change}
            onReset={reset}
            onCopy={copy}
            copied={copied}
          />
        </div>
      </aside>
    </main>
  );
}
