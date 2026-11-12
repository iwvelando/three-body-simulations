import { Slider } from "../../shell/Slider";
import { startOf, withParam } from "../../shell/study";
import { edited, resolve, type Study } from "./study";
import type { Catalog } from "./types";

// The machine's settings, drawn entirely from the engine's catalog.
export function Panel({
  catalog,
  study,
  onStudy,
  onReset,
  onCopy,
  copied,
}: {
  catalog: Catalog;
  study: Study;
  onStudy: (update: (s: Study) => Study) => void;
  onReset: () => void;
  onCopy: () => void;
  copied: boolean;
}) {
  const now = resolve(study, catalog);
  const spec = (id: string) => catalog.params.find((p) => p.id === id)!;
  const start = startOf(study.preset, catalog);
  const chosen = catalog.slots.map((slot) =>
    slot.models.find((m) => m.id === now.models[slot.id])!,
  );
  const inUse = new Set(chosen.flatMap((m) => m.params));
  const slider = (id: string) => (
    <Slider
      key={id}
      // A slider comes back to where its starting point put it.
      spec={{ ...spec(id), default: start[id] }}
      value={now.params[id]}
      disabled={false}
      onChange={(v) => onStudy((s) => withParam(s, catalog, id, v))}
    />
  );
  return (
    <form className="panel" onSubmit={(e) => e.preventDefault()}>
      <fieldset className="presets">
        <legend>Start from</legend>
        {catalog.presets.map((p) => (
          <label key={p.id} className="preset">
            <input
              type="radio"
              name="preset"
              checked={study.preset === p.id && !edited(study)}
              onChange={() =>
                onStudy(() => ({ preset: p.id, models: {}, params: {} }))
              }
            />
            <span className="preset-name">{p.label}</span>
            <span className="preset-note">{p.summary}</span>
          </label>
        ))}
      </fieldset>

      <div className="basics">
        {catalog.params
          .filter((p) => p.basic && inUse.has(p.id))
          .map((p) => slider(p.id))}
      </div>

      <details className="models">
        <summary>Models</summary>
        <p className="hint">
          Each part of the machine is one of Mozi's answers to Wang, and can be
          taken back. <a href="#/mozi/science">What is invented</a>
        </p>
        {catalog.slots.map((slot, k) => {
          const model = chosen[k];
          return (
            <section key={slot.id} className="slot">
              <div className="field-head">
                <label className="field-label" htmlFor={`slot-${slot.id}`}>
                  {slot.label}
                </label>
              </div>
              <select
                id={`slot-${slot.id}`}
                value={model.id}
                disabled={slot.models.length < 2}
                onChange={(e) =>
                  onStudy((s) => ({
                    ...s,
                    models: { ...s.models, [slot.id]: e.target.value },
                  }))
                }
              >
                {slot.models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
              <p className="hint">
                {model.summary}
                {model.speculative && (
                  <strong className="spec"> Speculative.</strong>
                )}
              </p>
              <p className="cite">{model.citation}</p>
              {model.params.filter((id) => !spec(id).basic).map(slider)}
            </section>
          );
        })}
      </details>

      <div className="actions">
        <button type="button" onClick={onReset}>
          Reset
        </button>
        <button type="button" onClick={onCopy}>
          {copied ? "Link copied" : "Copy link"}
        </button>
      </div>
    </form>
  );
}
