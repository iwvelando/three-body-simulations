import { number } from "./format";
import { edited, resolve, type Study } from "./study";
import type { Catalog, Param } from "./types";

// A slider described entirely by its descriptor. Logarithmic parameters
// slide in log10; the readout always shows the value itself.
function Slider({
  spec,
  value,
  disabled,
  onChange,
}: {
  spec: Param;
  value: number;
  disabled: boolean;
  onChange: (v: number) => void;
}) {
  const to = (v: number) => (spec.log ? Math.log10(v) : v);
  const from = (v: number) =>
    Math.min(spec.max, Math.max(spec.min, spec.log ? 10 ** v : v));
  const span = to(spec.max) - to(spec.min);
  return (
    <div className={`field${disabled ? " off" : ""}`}>
      <div className="field-head">
        <span className="field-label">{spec.label}</span>
        <output>
          {number(value)}
          {spec.unit ? ` ${spec.unit}` : ""}
        </output>
      </div>
      <input
        type="range"
        aria-label={spec.label}
        min={to(spec.min)}
        max={to(spec.max)}
        step={span / 200}
        value={to(value)}
        disabled={disabled}
        onChange={(e) => onChange(from(Number(e.target.value)))}
      />
      <p className="hint">{spec.help}</p>
    </div>
  );
}

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
  const chosen = catalog.slots.map((slot) =>
    slot.models.find((m) => m.id === now.models[slot.id])!,
  );
  const inUse = new Set(chosen.flatMap((m) => m.params));
  const off = (p: Param) =>
    (p.when === "on" && !study.life) || (p.when === "off" && study.life);
  // Whether a preset's choices, over the defaults, use a speculative model.
  const speculativeIn = (models: Record<string, string>) =>
    catalog.slots.some(
      (slot) =>
        slot.models.find((m) => m.id === (models[slot.id] ?? slot.models[0].id))
          ?.speculative,
    );
  const slider = (id: string) => (
    <Slider
      key={id}
      spec={spec(id)}
      value={now.params[id]}
      disabled={off(spec(id))}
      onChange={(v) =>
        onStudy((s) => ({ ...s, params: { ...s.params, [id]: v } }))
      }
    />
  );
  return (
    <form className="panel" onSubmit={(e) => e.preventDefault()}>
      <label className="life">
        <input
          type="checkbox"
          checked={study.life}
          onChange={(e) => onStudy((s) => ({ ...s, life: e.target.checked }))}
        />
        <span className="life-word">Life</span>
        <span className="life-note">
          {study.life
            ? "Living things act on the planet."
            : "Nothing living acts on the planet."}
        </span>
      </label>

      <fieldset className="presets">
        <legend>Start from</legend>
        {catalog.presets.map((p) => (
          <label key={p.id} className="preset">
            <input
              type="radio"
              name="preset"
              checked={study.preset === p.id && !edited(study)}
              onChange={() =>
                onStudy((s) => ({ ...s, preset: p.id, models: {}, params: {} }))
              }
            />
            <span className="preset-name">{p.label}</span>
            <span className="preset-note">
              {p.summary}
              {speculativeIn(p.models) && (
                <strong className="spec"> Includes a speculative model.</strong>
              )}
            </span>
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
          Each part of the planet can follow a different published model.{" "}
          <a href="#/earth/science">Where they come from</a>
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
        <label className="check">
          <input
            type="checkbox"
            checked={study.fine}
            onChange={(e) => onStudy((s) => ({ ...s, fine: e.target.checked }))}
          />
          <span>Finer time steps</span>
        </label>
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
