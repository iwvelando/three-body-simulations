import { useEffect, useRef } from "react";
import { eraAt } from "./format";
import type { Run } from "./types";

// How many days pass in a second of play.
export const speeds = [
  { id: "hour", label: "1 hour a second", rate: 1 / 24 },
  { id: "quarter", label: "6 hours a second", rate: 0.25 },
  { id: "day", label: "1 day a second", rate: 1 },
] as const;
export type Speed = (typeof speeds)[number]["id"];

// The scrubber over the whole calendar, with its eras as a band. On a
// phone it can be docked at the bottom of the screen.
export function Timeline({
  run,
  time,
  playing,
  docked,
  label,
  speed,
  onTime,
  onPlaying,
  onSpeed,
}: {
  run: Run;
  time: number;
  playing: boolean;
  // Docked, the timeline is pinned to the bottom of a narrow screen (the
  // stylesheet decides what narrow is) and says what moment it is, since
  // the readout may have scrolled away. The page decides when.
  docked: boolean;
  label: string;
  speed: Speed;
  onTime: (t: number) => void;
  onPlaying: (p: boolean) => void;
  onSpeed: (s: Speed) => void;
}) {
  const live = useRef(time);
  live.current = time;
  const rate = speeds.find((s) => s.id === speed)!.rate;
  useEffect(() => {
    if (!playing) return;
    let frame = 0,
      before = performance.now();
    const step = (now: number) => {
      const next = live.current + Math.min(0.25, (now - before) / 1000) * rate;
      before = now;
      if (next >= run.span) {
        onTime(run.span);
        onPlaying(false);
        return;
      }
      live.current = next;
      onTime(next);
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [playing, rate, run.span, onTime, onPlaying]);

  const current = run.eras[eraAt(run, time)].kind;
  return (
    <div
      className={`timeline${docked ? " docked" : ""}`}
      data-testid="timeline"
    >
      <p className="dock-when" data-testid="dock-when">
        {label} <i className={`eon-key era-${current}`} />
        {current === "stable" ? "Stable Era" : "Chaotic Era"}
      </p>
      <div className="transport">
        <button
          type="button"
          className="play"
          onClick={() => {
            if (!playing && time >= run.span) onTime(0);
            onPlaying(!playing);
          }}
        >
          {playing ? "Pause" : "Play"}
        </button>
        <input
          type="range"
          aria-label="Time"
          aria-valuetext={`Day ${Math.floor(time) + 1}`}
          min={0}
          max={run.span}
          step={0.01}
          value={time}
          onChange={(e) => {
            onPlaying(false);
            onTime(Number(e.target.value));
          }}
        />
      </div>
      <div className="eons eras" aria-hidden="true">
        {run.eras.map((e) => (
          <span
            key={e.from}
            className={`era era-${e.kind}`}
            style={{
              left: `${(e.from / run.span) * 100}%`,
              width: `${((e.to - e.from) / run.span) * 100}%`,
            }}
          />
        ))}
      </div>
      <div className="timeline-foot">
        <ul className="eon-names" aria-label="Eras">
          {(["stable", "chaotic"] as const).map((kind) => (
            <li key={kind} aria-current={kind === current ? "true" : undefined}>
              <i className={`eon-key era-${kind}`} />
              {kind === "stable" ? "Stable Era" : "Chaotic Era"}
            </li>
          ))}
        </ul>
        <label className="speed">
          <span>Speed</span>
          <select
            value={speed}
            onChange={(e) => onSpeed(e.target.value as Speed)}
          >
            {speeds.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
