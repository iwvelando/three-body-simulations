import { useCallback, useMemo, useState } from "react";
import { ball } from "./Ball";
import { tidy, useCanvas } from "./canvas";
import { bandColor, css, length, scatter } from "./format";
import type { Frames, Run } from "./types";

// How long the light lingers after the last of the body has gone under,
// as a share of the fall.
export const afterglow = 0.3;

// A fall's moments in order: the close-set ones up to the crossing, then
// the evenly spaced ones after it. Read between these, the picture is
// exactly as wide as what stands at the crossing, however early that is.
const moments = new WeakMap<Run, Frames>();
function momentsOf(run: Run): Frames {
  let f = moments.get(run);
  if (!f) {
    const from = run.frames.time.findIndex((t) => t > run.crossing);
    const join = <T,>(early: T[], rest: T[]) =>
      from < 0 ? early : early.concat(rest.slice(from));
    f = {
      time: join(run.early.time, run.frames.time),
      sink: join(run.early.sink, run.frames.sink),
      foot: join(run.early.foot, run.frames.foot),
      rim: join(run.early.rim, run.frames.rim),
      bands: join(run.early.bands, run.frames.bands),
    };
    moments.set(run, f);
  }
  return f;
}

// The fall at a moment: 0 is first touch, 1 the last of the body gone.
export function momentOf(run: Run, at: number) {
  const f = momentsOf(run),
    n = f.time.length - 1,
    t = (at > 0 ? Math.min(1, at) : 0) * run.duration;
  // The last moment at or before t.
  let i = 0,
    hi = n - 1;
  while (i < hi) {
    const mid = (i + hi + 1) >> 1;
    if (f.time[mid] <= t) i = mid;
    else hi = mid - 1;
  }
  const w = Math.min(
      1,
      Math.max(0, (t - f.time[i]) / (f.time[i + 1] - f.time[i])),
    ),
    mix = (v: number[]) => v[i] + (v[i + 1] - v[i]) * w;
  return {
    time: mix(f.time),
    sink: mix(f.sink),
    foot: mix(f.foot),
    rim: mix(f.rim),
    bands: f.bands[i].map((b, k) => b + (f.bands[i + 1][k] - b) * w),
  };
}

const space = "#060a12";

// One body sinking into the plane, with its flat picture spreading under
// it. Everything measured comes from the engine's frames; the light, the
// sparks, the flames and the snow are drawn from the novel's description.
export function Fall({
  run,
  at,
  tilted,
  flakes,
  label,
}: {
  run: Run;
  at: number;
  tilted: boolean;
  flakes: HTMLCanvasElement[] | null;
  label: string;
}) {
  // A body's map arrives after the page; draw again when it does.
  const [, setDrawn] = useState(0);
  const redraw = useCallback(() => setDrawn((n) => n + 1), []);
  const colors = useMemo(
    () => run.bands.map((b) => bandColor(b, run.body)),
    [run],
  );
  const ref = useCanvas((c, width, height) => {
    const now = momentOf(run, at);
    const lit = at <= 1 ? 1 : Math.max(0, 1 - (at - 1) / afterglow);
    const r = run.body.radius;
    const size = Math.min(width, height);
    const cx = width / 2,
      cy = tilted ? height * 0.6 : height / 2;
    // The view pulls back as the picture grows.
    const reach = Math.max(2.2 * r, 1.14 * now.rim);
    const px = size / 2 / reach;
    const squash = tilted ? 0.46 : 1,
      lift = tilted ? 0.89 : 0;

    c.fillStyle = space;
    c.fillRect(0, 0, width, height);
    const far = scatter(11);
    for (let i = 0; i < 90; i++) {
      c.fillStyle = `rgba(230,236,255,${0.2 + 0.5 * far()})`;
      c.fillRect(far() * width, far() * height, 1, 1);
    }

    // The flat picture, outermost band first.
    c.save();
    c.translate(cx, cy);
    c.scale(1, squash);
    const dim = 0.62 + 0.38 * lit;
    for (let k = now.bands.length - 1; k >= 0; k--) {
      const edge = now.bands[k] * px;
      if (edge <= 0) continue;
      c.fillStyle = css(colors[k].map((v) => v * dim));
      c.beginPath();
      c.arc(0, 0, edge, 0, 2 * Math.PI);
      c.fill();
    }
    const rim = now.rim * px;
    // Rings within rings, where the picture has more than can be drawn.
    if (run.grain > run.bands.length && rim > 20) {
      c.strokeStyle = "rgba(10,14,22,0.16)";
      c.lineWidth = 0.6;
      const lines = Math.min(70, Math.floor(rim / 4));
      for (let j = 1; j < lines; j++) {
        c.beginPath();
        c.arc(0, 0, rim * Math.sqrt(j / lines), 0, 2 * Math.PI);
        c.stroke();
      }
    }
    // Snow where a sea has landed as a ring of its own.
    const sea = run.body.layers.findIndex((l) => l.sea);
    if (flakes && sea >= 0 && run.bands.length === run.body.layers.length) {
      const inner = sea ? now.bands[sea - 1] * px : 0,
        outer = now.bands[sea] * px,
        wide = outer - inner,
        shown = Math.min(1, Math.max(0, (at - 0.55) / 0.35));
      if (wide >= 5 && shown > 0) {
        const mid = (inner + outer) / 2;
        const count = Math.min(240, Math.floor((2 * Math.PI * mid) / wide));
        c.globalAlpha = shown;
        for (let i = 0; i < count; i++) {
          c.save();
          c.rotate((i / count) * 2 * Math.PI);
          c.translate(mid, 0);
          c.rotate((i * 37 * Math.PI) / 180);
          c.drawImage(
            flakes[(i * 7) % flakes.length],
            -wide / 2,
            -wide / 2,
            wide,
            wide,
          );
          c.restore();
        }
        c.globalAlpha = 1;
      }
    }
    if (rim > 0.5 && lit > 0) {
      // Flames at the rim of a star, sinking back as it goes out.
      const spark = scatter(5);
      if (run.body.star)
        for (let i = 0; i < 34; i++) {
          const a = spark() * 2 * Math.PI,
            tall =
              rim *
              (0.03 + 0.09 * spark()) *
              lit *
              (0.7 + 0.3 * Math.sin(at * 40 + i)),
            half = 0.02 + 0.03 * spark();
          c.fillStyle = `rgba(255,${180 + Math.round(50 * spark())},90,${0.55 * lit})`;
          c.beginPath();
          c.moveTo(rim * Math.cos(a - half), rim * Math.sin(a - half));
          c.quadraticCurveTo(
            (rim + tall * 1.6) * Math.cos(a + half),
            (rim + tall * 1.6) * Math.sin(a + half),
            (rim + tall) * Math.cos(a + 2 * half),
            (rim + tall) * Math.sin(a + 2 * half),
          );
          c.quadraticCurveTo(
            (rim + tall * 0.3) * Math.cos(a + half),
            (rim + tall * 0.3) * Math.sin(a + half),
            rim * Math.cos(a + half),
            rim * Math.sin(a + half),
          );
          c.fill();
        }
      // The light of the fall: a bright rim and sparks through the sheet.
      c.strokeStyle = `rgba(255,236,190,${0.85 * lit})`;
      c.lineWidth = 1.5;
      c.shadowColor = "rgba(255,210,140,0.9)";
      c.shadowBlur = 14 * lit;
      c.beginPath();
      c.arc(0, 0, rim, 0, 2 * Math.PI);
      c.stroke();
      c.shadowBlur = 0;
      const beat = Math.floor(at * 60);
      const flick = scatter(1000 + beat);
      for (let i = 0; i < 70; i++) {
        const a = flick() * 2 * Math.PI,
          d = rim * Math.sqrt(flick());
        c.fillStyle = `hsla(${Math.round(flick() * 360)},90%,75%,${0.75 * lit * flick()})`;
        c.beginPath();
        c.arc(d * Math.cos(a), d * Math.sin(a), 0.6 + 1.2 * flick(), 0, 7);
        c.fill();
      }
    }
    c.restore();

    // What is left of the body, above the plane, drawn about (bx, by)
    // at `scale` pixels to the kilometer.
    const face = ball(run.body.id, run.body.surface, redraw);
    const standing = (bx: number, by: number, scale: number) => {
      if (now.sink >= r) return;
      const whole = r * scale,
        cut = now.foot * scale,
        oy = by + now.sink * lift * scale;
      const rings = run.body.surface.rings;
      // Rings lie level with the plane and go under with the middle.
      const ring = (half: 0 | 1) => {
        if (!rings || !tilted || now.sink >= 0) return;
        c.save();
        c.strokeStyle = rings;
        c.globalAlpha = 0.8;
        c.lineWidth = 0.42 * whole;
        c.beginPath();
        c.ellipse(
          bx,
          oy,
          1.75 * whole,
          1.75 * whole * squash,
          0,
          half ? 0 : Math.PI,
          half ? Math.PI : 2 * Math.PI,
        );
        c.stroke();
        c.restore();
      };
      ring(0);
      c.save();
      c.beginPath();
      if (!tilted) c.arc(bx, by, now.sink < 0 ? whole : cut, 0, 2 * Math.PI);
      else {
        // Seen from the side, the part above the plane is everything
        // higher on the screen than where the plane cuts the outline,
        // and the cut itself.
        c.rect(
          bx - whole - 2,
          oy - whole - 2,
          2 * whole + 4,
          whole + 2 - (now.sink * scale) / lift,
        );
        c.ellipse(bx, by, cut, cut * squash, 0, 0, 2 * Math.PI);
      }
      c.clip();
      const top = tilted ? oy : by;
      c.drawImage(face, bx - whole, top - whole, 2 * whole, 2 * whole);
      c.restore();
      ring(1);
    };
    standing(cx, cy, px);

    // Once the view has pulled back the body is a speck, so it is shown
    // again, closer, with the flat matter it stands in.
    if (now.sink < r && r * px < 26) {
      const box = Math.min(width * 0.36, 190),
        x0 = 12,
        y0 = 12,
        scale = box / (4.6 * r),
        bx = x0 + box / 2,
        by = y0 + box * (tilted ? 0.66 : 0.5);
      c.save();
      c.beginPath();
      c.rect(x0, y0, box, box);
      c.clip();
      c.fillStyle = space;
      c.fillRect(x0, y0, box, box);
      // The newest flat matter lies under the body, whichever way it
      // landed: the innermost band.
      const under = Math.min(now.rim, now.bands[0]) * scale;
      c.fillStyle = css(colors[0].map((v) => v * dim));
      c.beginPath();
      c.ellipse(bx, by, under, under * squash, 0, 0, 2 * Math.PI);
      c.fill();
      if (now.rim > now.bands[0]) {
        // And the rest of the picture runs on past this frame.
        c.strokeStyle = css(colors[Math.min(1, colors.length - 1)], 0.5);
        c.lineWidth = 1;
        c.stroke();
      }
      standing(bx, by, scale);
      c.restore();
      c.strokeStyle = "rgba(230,236,245,0.6)";
      c.lineWidth = 1;
      c.strokeRect(x0 + 0.5, y0 + 0.5, box - 1, box - 1);
      c.fillStyle = "rgba(230,236,245,0.9)";
      c.font = "12px 'IBM Plex Sans', system-ui, sans-serif";
      c.fillText("The body, closer", x0 + 8, y0 + 16);
    }

    // A sea's ring is often too thin to see at this scale, so the rim is
    // shown again, closer: the layer under the sea, the sea with its
    // snow lying side by side, and space beyond.
    if (flakes && sea > 0 && run.bands.length === run.body.layers.length) {
      const wide = now.bands[sea] - now.bands[sea - 1],
        shown = Math.min(1, Math.max(0, (at - 0.55) / 0.35));
      if (wide > 0 && wide * px < 5 && shown > 0) {
        const w = Math.min(width * 0.46, 300),
          h = w * 0.42,
          x0 = width - w - 12,
          y0 = 12,
          flake = h * 0.5,
          closer = flake / wide;
        c.save();
        c.globalAlpha = shown;
        c.beginPath();
        c.rect(x0, y0, w, h);
        c.clip();
        c.fillStyle = space;
        c.fillRect(x0, y0, w, h);
        c.fillStyle = css(colors[sea - 1].map((v) => v * dim));
        c.fillRect(x0, y0 + 0.75 * h, w, 0.25 * h);
        c.fillStyle = css(colors[sea].map((v) => v * 0.55));
        c.fillRect(x0, y0 + 0.25 * h, w, flake);
        for (let i = 0; i * flake < w; i++) {
          c.save();
          c.translate(x0 + (i + 0.5) * flake, y0 + 0.5 * h);
          c.rotate((i * 37 * Math.PI) / 180);
          c.drawImage(
            flakes[(i * 7) % flakes.length],
            -flake / 2,
            -flake / 2,
            flake,
            flake,
          );
          c.restore();
        }
        c.restore();
        c.globalAlpha = shown;
        c.strokeStyle = "rgba(230,236,245,0.6)";
        c.lineWidth = 1;
        c.strokeRect(x0 + 0.5, y0 + 0.5, w - 1, h - 1);
        c.fillStyle = "rgba(230,236,245,0.9)";
        c.font = "12px 'IBM Plex Sans', system-ui, sans-serif";
        const bar = tidy((0.4 * w) / closer);
        c.fillText(`The rim, closer: ${length(bar)}`, x0 + 8, y0 + 16);
        c.beginPath();
        c.moveTo(x0 + 8, y0 + 22);
        c.lineTo(x0 + 8 + bar * closer, y0 + 22);
        c.stroke();
        c.globalAlpha = 1;
      }
    }

    // A scale bar.
    const bar = tidy((0.3 * width) / px);
    c.fillStyle = c.strokeStyle = "rgba(230,236,245,0.85)";
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(14, height - 14);
    c.lineTo(14 + bar * px, height - 14);
    c.stroke();
    c.font = "12px 'IBM Plex Sans', system-ui, sans-serif";
    c.fillText(length(bar), 14, height - 20);
  });
  return (
    <div className="flat-view" data-testid="fall">
      <canvas ref={ref} role="img" aria-label={label} />
    </div>
  );
}
