import { number, type Param } from "./catalog";

// A slider described entirely by its descriptor. Logarithmic parameters
// slide in log10; the readout always shows the value itself.
export function Slider({
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
