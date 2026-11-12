import { number, scale, type Param } from "./catalog";

// A slider described entirely by its descriptor (see `scale`). The
// readout always shows the value itself.
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
  const { min, max, step, to, from } = scale(spec);
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
        min={min}
        max={max}
        step={step}
        value={to(value)}
        disabled={disabled}
        onChange={(e) => onChange(from(Number(e.target.value)))}
      />
      <p className="hint">{spec.help}</p>
    </div>
  );
}
