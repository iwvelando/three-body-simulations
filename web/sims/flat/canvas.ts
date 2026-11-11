import { useEffect, useRef } from "react";

// A canvas that fills its box and is redrawn when its box or what it
// shows changes. `draw` gets a context scaled to CSS pixels.
export function useCanvas(
  draw: (c: CanvasRenderingContext2D, width: number, height: number) => void,
) {
  const ref = useRef<HTMLCanvasElement>(null);
  const latest = useRef(draw);
  latest.current = draw;
  const paint = useRef(() => {});
  paint.current = () => {
    const canvas = ref.current;
    if (!canvas) return;
    const box = canvas.getBoundingClientRect();
    if (!box.width || !box.height) return;
    const scale = Math.min(devicePixelRatio || 1, 2);
    const w = Math.round(box.width * scale),
      h = Math.round(box.height * scale);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    const c = canvas.getContext("2d");
    if (!c) return;
    c.setTransform(scale, 0, 0, scale, 0, 0);
    c.clearRect(0, 0, box.width, box.height);
    latest.current(c, box.width, box.height);
  };
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const watch = new ResizeObserver(() => paint.current());
    watch.observe(canvas);
    return () => watch.disconnect();
  }, []);
  // Every render may carry something new to show.
  useEffect(() => paint.current());
  return ref;
}

// A tidy length for a scale bar: 1, 2 or 5 times a power of ten, no
// longer than `most`.
export function tidy(most: number): number {
  const power = 10 ** Math.floor(Math.log10(most));
  for (const m of [5, 2, 1]) if (m * power <= most) return m * power;
  return power;
}
