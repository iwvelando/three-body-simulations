import { useEffect, useRef } from "react";
import { daylight, daySky, height, nightSky, turn } from "./format";
import type { Run, Vec, View } from "./types";

// Where a direction falls on the all-sky disc: straight up is the center,
// the horizon is the rim, north is at the top. East is on the left, as it
// is for anyone lying on their back.
function place(v: Vec, radius: number): [number, number] {
  const away = Math.acos(Math.max(-1, Math.min(1, v[2]))) / (Math.PI / 2);
  const flat = Math.hypot(v[0], v[1]) || 1;
  return [(-v[0] / flat) * away * radius, (-v[1] / flat) * away * radius];
}

function paint(
  canvas: HTMLCanvasElement,
  view: View,
  stars: Run["stars"],
  size: number,
) {
  // A whole number of dots, or the canvas would be made anew, and
  // cleared, on every frame of a screen whose ratio is not whole.
  const dots = Math.round(size * Math.min(devicePixelRatio || 1, 2));
  if (canvas.width !== dots) canvas.width = canvas.height = dots;
  const scale = dots / size;
  const c = canvas.getContext("2d");
  if (!c) return;
  // The origin is the middle of the canvas, in its own pixels.
  c.setTransform(scale, 0, 0, scale, dots / 2, dots / 2);
  c.clearRect(-size / 2, -size / 2, size, size);
  const radius = size / 2 - 14;
  const up = height(view.sun);
  const lit = daylight(view);
  const sky = nightSky.map((n, k) => Math.round(n + (daySky[k] - n) * lit));

  c.save();
  c.beginPath();
  c.arc(0, 0, radius, 0, 2 * Math.PI);
  c.clip();
  c.fillStyle = `rgb(${sky.join(",")})`;
  c.fillRect(-radius, -radius, 2 * radius, 2 * radius);

  const [sx, sy] = place(view.sun, radius);
  if (up > -12 && view.light > 0.01) {
    // The bright sky around the spot of light.
    const glow = c.createRadialGradient(sx, sy, 0, sx, sy, radius * 1.1);
    const strength = Math.min(1, 0.2 + 0.8 * lit) * Math.min(1, view.light);
    glow.addColorStop(0, `rgba(255, 240, 200, ${0.75 * strength})`);
    glow.addColorStop(0.25, `rgba(255, 226, 170, ${0.3 * strength})`);
    glow.addColorStop(1, "rgba(255, 226, 170, 0)");
    c.fillStyle = glow;
    c.fillRect(-radius, -radius, 2 * radius, 2 * radius);
  }

  // Stars: the small holes in the inner shell, washed out by day.
  const faint = 1 - 0.95 * lit;
  for (const [x, y, z, b] of stars) {
    const v = turn(view.inner, [x, y, z]);
    if (v[2] <= 0) continue;
    const [px, py] = place(v, radius);
    c.fillStyle = `rgba(255, 250, 235, ${Math.min(1, (0.35 + 0.65 * b) * faint)})`;
    c.beginPath();
    c.arc(px, py, 0.6 + 1.3 * b, 0, 2 * Math.PI);
    c.fill();
  }
  // Flying stars: quick and bright, with a short streak.
  for (const v of view.flying) {
    if (v[2] <= 0) continue;
    const [px, py] = place(v, radius);
    c.fillStyle = `rgba(255, 244, 214, ${0.95 * (1 - 0.7 * lit)})`;
    c.beginPath();
    c.arc(px, py, 2.4, 0, 2 * Math.PI);
    c.fill();
    c.strokeStyle = `rgba(255, 244, 214, ${0.45 * (1 - 0.7 * lit)})`;
    c.lineWidth = 1;
    c.beginPath();
    c.arc(px, py, 4.5, 0, 2 * Math.PI);
    c.stroke();
  }
  if (up > 0) {
    // The sun at its true width on this map, never smaller than a dot.
    const r = Math.max(2.5, (view.size / 2 / 90) * radius);
    const dim = Math.max(0, Math.min(1, view.brightness));
    const halo = c.createRadialGradient(sx, sy, r * 0.6, sx, sy, r * 3.2);
    halo.addColorStop(0, `rgba(255, 244, 210, ${0.9 * dim})`);
    halo.addColorStop(1, "rgba(255, 244, 210, 0)");
    c.fillStyle = halo;
    c.beginPath();
    c.arc(sx, sy, r * 3.2, 0, 2 * Math.PI);
    c.fill();
    c.fillStyle = `rgb(${[255, 250, 232].map((v, k) => Math.round(sky[k] + (v - sky[k]) * (0.15 + 0.85 * dim))).join(",")})`;
    c.beginPath();
    c.arc(sx, sy, r, 0, 2 * Math.PI);
    c.fill();
    c.strokeStyle = "rgba(255, 250, 232, 0.9)";
    c.lineWidth = 1;
    c.stroke();
  }
  c.restore();

  // The horizon and its four directions.
  const ink = getComputedStyle(canvas).color;
  c.strokeStyle = ink;
  c.lineWidth = 1.5;
  c.beginPath();
  c.arc(0, 0, radius, 0, 2 * Math.PI);
  c.stroke();
  c.fillStyle = ink;
  c.font = "600 11px 'IBM Plex Sans', system-ui, sans-serif";
  c.textAlign = "center";
  c.textBaseline = "middle";
  for (const [letter, x, y] of [
    ["N", 0, -1],
    ["S", 0, 1],
    ["E", -1, 0],
    ["W", 1, 0],
  ] as const)
    c.fillText(letter, x * (radius + 8), y * (radius + 8));
}

// The clerk's view: the whole sky at once, from the center of the machine
// looking up.
export function Sky({
  view,
  stars,
  label,
}: {
  view: View;
  stars: Run["stars"];
  label: string;
}) {
  const host = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const latest = useRef({ view, stars });
  latest.current = { view, stars };
  const draw = useRef(() => {});
  draw.current = () => {
    const element = host.current,
      target = canvas.current;
    if (!element || !target) return;
    const size = Math.max(
      1,
      Math.floor(Math.min(element.clientWidth, element.clientHeight)),
    );
    target.style.width = target.style.height = `${size}px`;
    paint(target, latest.current.view, latest.current.stars, size);
  };
  useEffect(() => {
    const observer = new ResizeObserver(() => draw.current());
    observer.observe(host.current!);
    // The compass letters take the page's ink, which changes with the theme.
    const theme = new MutationObserver(() => draw.current());
    theme.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => {
      observer.disconnect();
      theme.disconnect();
    };
  }, []);
  useEffect(() => draw.current(), [view, stars]);
  return (
    <div
      className="sky"
      ref={host}
      role="img"
      aria-label={label}
      data-testid="sky"
      data-day={view.time.toFixed(2)}
    >
      <canvas ref={canvas} aria-hidden="true" />
    </div>
  );
}
