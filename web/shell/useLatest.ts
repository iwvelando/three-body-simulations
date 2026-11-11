import { useEffect, useRef, useState } from "react";

// Runs an engine request for the latest input, one at a time. The engine
// worker cannot abandon a run it has started, so sending one for every
// position of a dragged slider would leave a queue to wait through. While
// a run is under way newer inputs replace one another; when it finishes,
// only the newest is sent. Results arrive in order, and the last one shown
// is always for the last input.
export function useLatest<Q, R>(
  input: Q | null,
  run: (input: Q) => Promise<R>,
  delay: number,
): { result: R | null; shown: Q | null; busy: boolean; error: Error | null } {
  const [state, setState] = useState<{
    result: R | null;
    shown: Q | null;
    error: Error | null;
  }>({ result: null, shown: null, error: null });
  const [busy, setBusy] = useState(true);
  const wanted = useRef<Q | null>(null);
  const done = useRef<Q | null>(null);
  const running = useRef(false);
  const alive = useRef(true);
  const runner = useRef(run);
  runner.current = run;
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const pump = useRef(() => {});
  pump.current = () => {
    const q = wanted.current;
    if (running.current || q === null || q === done.current) return;
    running.current = true;
    runner
      .current(q)
      .then(
        (result) =>
          alive.current && setState({ result, shown: q, error: null }),
        (error: Error) => alive.current && setState((s) => ({ ...s, error })),
      )
      .finally(() => {
        running.current = false;
        done.current = q;
        if (!alive.current) return;
        if (wanted.current !== q) pump.current();
        else setBusy(false);
      });
  };
  useEffect(() => {
    if (input === null) return;
    wanted.current = input;
    setBusy(true);
    const timer = setTimeout(() => pump.current(), delay);
    return () => clearTimeout(timer);
  }, [input, delay]);
  return { ...state, busy };
}
