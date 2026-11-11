import type { ReactNode } from "react";
import type { Catalog } from "../../shell/catalog";
import { Slider } from "../../shell/Slider";
import { edited, resolve, type Study } from "../../shell/study";

// Settings drawn entirely from one of the engine's catalogs.
export function Panel({
  catalog,
  study,
  hint,
  onStudy,
  onReset,
  onCopy,
  copied,
}: {
  catalog: Catalog;
  study: Study;
  hint: ReactNode;
  onStudy: (update: (s: Study) => Study) => void;
  onReset: () => void;
  onCopy: () => void;
  copied: boolean;
}) {
  const now = resolve(study, catalog);
  const spec = (id: string) => catalog.params.find((p) => p.id === id)!;
  const chosen = catalog.slots.map((slot) =>
    slot.models.find((m) => m.id === now.models[slot.id])!,
  );
  const inUse = new Set(chosen.flatMap((m) => m.params));
  const slider = (id: string) => (
    <Slider
      key={id}
      spec={spec(id)}
      value={now.params[id]}
      disabled={false}
      onChange={(v) =>
        onStudy((s) => ({ ...s, params: { ...s.params, [id]: v } }))
      }
    />
  );
  // A parameter several models share is shown once.
  const shown = new Set<string>();
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
        <p className="hint">{hint}</p>
        {catalog.slots.map((slot, k) => {
          const model = chosen[k];
          const own = model.params.filter(
            (id) => !spec(id).basic && !shown.has(id),
          );
          own.forEach((id) => shown.add(id));
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
              {own.map(slider)}
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
