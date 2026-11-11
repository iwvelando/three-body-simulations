import { useEffect, useRef } from "react";
import { ageNow, eventName, indexAt, shortWhen } from "./format";
import type { Result } from "./types";

const eons = [
  { name: "Hadean", from: 0 },
  { name: "Archean", from: ageNow - 4.0 },
  { name: "Proterozoic", from: ageNow - 2.5 },
  { name: "Phanerozoic", from: ageNow - 0.539 },
];
const playSeconds = 26;

// The scrubber. Its positions are the run's samples, which crowd toward
// the start, so the first molten moments get room.
export function Timeline({
  result,
  position,
  playing,
  onPosition,
  onPlaying,
}: {
  result: Result;
  position: number;
  playing: boolean;
  onPosition: (p: number) => void;
  onPlaying: (p: boolean) => void;
}) {
  const last = result.time.length - 1;
  const live = useRef(position);
  live.current = position;
  useEffect(() => {
    if (!playing) return;
    let frame = 0,
      before = performance.now();
    const step = (now: number) => {
      const next =
        live.current + ((now - before) / 1000) * (last / playSeconds);
      before = now;
      if (next >= last) {
        onPosition(last);
        onPlaying(false);
        return;
      }
      onPosition(next);
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [playing, last, onPosition, onPlaying]);

  const share = (age: number) => (indexAt(result, age) / last) * 100;
  const now = result.time[Math.round(Math.min(position, last))];
  const current = eons.reduce(
    (found, eon, k) => (now >= eon.from ? k : found),
    0,
  );
  return (
    <div className="timeline">
      <div className="transport">
        <button
          type="button"
          className="play"
          onClick={() => {
            if (!playing && position >= last) onPosition(0);
            onPlaying(!playing);
          }}
        >
          {playing ? "Pause" : "Play"}
        </button>
        <input
          type="range"
          aria-label="Time"
          min={0}
          max={last}
          step={1}
          value={Math.round(position)}
          onChange={(e) => {
            onPlaying(false);
            onPosition(Number(e.target.value));
          }}
        />
      </div>
      <div className="eons" aria-hidden="true">
        {eons.map((eon, k) => {
          const start = share(eon.from);
          const end = k + 1 < eons.length ? share(eons[k + 1].from) : 100;
          return (
            <span
              key={eon.name}
              className={`eon eon-${k}`}
              style={{ left: `${start}%`, width: `${end - start}%` }}
            />
          );
        })}
      </div>
      {/* The names sit beside the band, not inside it: the latest eon is
          too short a stretch to hold its own name. */}
      <ul className="eon-names" aria-label="Eons">
        {eons.map((eon, k) => (
          <li key={eon.name} aria-current={k === current ? "true" : undefined}>
            <i className={`eon-key eon-${k}`} />
            {eon.name}
          </li>
        ))}
      </ul>
      <ul className="events" aria-label="Moments in this run">
        {(result.events ?? []).map((e) => (
          <li key={e.id}>
            <button
              type="button"
              onClick={() => {
                onPlaying(false);
                onPosition(Math.min(last, indexAt(result, e.time) + 1));
              }}
            >
              {eventName(e.id)} <span>{shortWhen(e.time)}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
