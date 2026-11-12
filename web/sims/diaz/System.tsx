import { useEffect, useRef, useState } from "react";
import {
  AdditiveBlending,
  AmbientLight,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  LineBasicMaterial,
  LineLoop,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  PointLight,
  Points,
  PointsMaterial,
  Scene,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from "three";
import { chart, parts } from "../../shell/faces";
import { gasOf, ringOf, type Body, type Moment, type Run } from "./types";

// What the view is turned to: how many AU across it shows.
export const looks = ["whole", "inner", "sun"] as const;
export type Look = (typeof looks)[number];
export function spanOf(look: Look, moment: Moment): number {
  if (look === "sun") return 0.14;
  if (look === "inner") return 2 * Math.max(1.9, Math.min(4, moment.edge));
  return clampSpan(2 * Math.max(33, moment.edge * 1.05));
}

// How far across the view may show, in AU. The widest holds the gas at
// its farthest: with the spiral's reach at its most and every planet
// fallen, the edge is 177 AU out.
export const nearest = 0.03,
  farthest = 400;
export function clampSpan(span: number) {
  return Math.min(farthest, Math.max(nearest, span));
}

// Nothing here is to scale: at the scale of the orbits every body is
// too small to see. Each is drawn at a share of the view's width, never
// smaller than it really is and never so large that it would swallow
// the orbit it started on. The size depends on the view alone, not on
// where the body is, so nothing swells or shrinks as it moves.
export function sizeOf(body: Body, span: number, innermost: number): number {
  const real = body.radius / 149597870.7;
  if (body.star) return Math.max(real, Math.min(0.016 * span, 0.3 * innermost));
  const share = body.radius > 20000 ? 0.022 : 0.015;
  return Math.max(real, Math.min(share * span, 0.2 * body.orbit));
}
// Whether the Sun is drawn at its true size in a view this wide.
export const sunIsTrue = (bodies: Body[], span: number) =>
  sizeOf(bodies[0], span, bodies[1].orbit) <=
  (bodies[0].radius / 149597870.7) * 1.001;

const gasColor = "#ffb45c";
const space = "#05070c";

type Stage = {
  canvas: HTMLCanvasElement;
  resize: (width: number, height: number) => void;
  draw: (
    run: Run,
    moment: Moment,
    span: number,
    yaw: number,
    pitch: number,
  ) => { x: number; y: number; shown: boolean }[];
  // Called when a body's map has loaded.
  onChange: (changed: () => void) => void;
  dispose: () => void;
};

function build(bodies: Body[]): Stage {
  const renderer = new WebGLRenderer({
    antialias: true,
    // The picture is drawn only when something changes, and has to
    // still be there when the page is asked for it between draws.
    preserveDrawingBuffer: true,
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor(space);
  const scene = new Scene();
  const camera = new PerspectiveCamera(32, 1, 0.0001, 4000);
  camera.up.set(0, 0, 1);
  const disposables: { dispose: () => void }[] = [renderer];
  const keep = <T extends { dispose: () => void }>(thing: T) => {
    disposables.push(thing);
    return thing;
  };
  let changed = () => {};

  // The Sun lights the planets; a little light from everywhere keeps
  // their night sides from vanishing.
  const sunlight = new PointLight(0xffffff, 3.2, 0, 0);
  scene.add(sunlight, new AmbientLight(0xffffff, 0.28));

  const ball = keep(new SphereGeometry(1, 48, 24));
  const meshes = bodies.map((body) => {
    const texture = keep(
      new CanvasTexture(
        chart(body.id, body.surface, () => {
          texture.needsUpdate = true;
          changed();
        }),
      ),
    );
    texture.colorSpace = SRGBColorSpace;
    const material = keep(
      body.star
        ? new MeshBasicMaterial({ map: texture })
        : new MeshStandardMaterial({ map: texture, roughness: 1 }),
    );
    const mesh = new Mesh(ball, material);
    // The maps' poles are the ball's y; the planets' north is z here.
    mesh.rotation.x = Math.PI / 2;
    scene.add(mesh);
    return mesh;
  });

  // The Sun's glow, drawn, not worked out.
  const halo = document.createElement("canvas");
  halo.width = halo.height = 128;
  const h = halo.getContext("2d");
  if (h) {
    const fade = h.createRadialGradient(64, 64, 4, 64, 64, 64);
    fade.addColorStop(0, "rgba(255, 226, 150, 0.9)");
    fade.addColorStop(0.3, "rgba(255, 170, 70, 0.35)");
    fade.addColorStop(1, "rgba(255, 140, 40, 0)");
    h.fillStyle = fade;
    h.fillRect(0, 0, 128, 128);
  }
  const glow = new Sprite(
    keep(
      new SpriteMaterial({
        map: keep(new CanvasTexture(halo)),
        blending: AdditiveBlending,
        depthWrite: false,
        transparent: true,
      }),
    ),
  );
  scene.add(glow);

  const rings = bodies.map((body, b) => {
    if (b === 0) return null;
    const geometry = keep(new BufferGeometry());
    const [red, green, blue] = parts(body.surface.colors[0]);
    const line = new LineLoop(
      geometry,
      keep(
        new LineBasicMaterial({
          color: (red << 16) | (green << 8) | blue,
          transparent: true,
          opacity: 0.55,
        }),
      ),
    );
    line.frustumCulled = false;
    scene.add(line);
    return line;
  });

  const gasMaterial = keep(
    new PointsMaterial({
      color: gasColor,
      size: 3,
      sizeAttenuation: false,
      transparent: true,
      opacity: 0.5,
      blending: AdditiveBlending,
      depthWrite: false,
    }),
  );
  const clouds: Points[] = [];
  const scratch: Float32Array[] = [];
  const at = new Vector3();

  return {
    canvas: renderer.domElement,
    onChange(f) {
      changed = f;
    },
    resize(width, height) {
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    },
    draw(run, moment, span, yaw, pitch) {
      // Far enough back that `span` AU fit across the shorter side.
      const half = Math.tan((camera.fov * Math.PI) / 360);
      const distance = span / 2 / (half * Math.min(1, camera.aspect));
      camera.position.set(
        distance * Math.cos(pitch) * Math.sin(yaw),
        -distance * Math.cos(pitch) * Math.cos(yaw),
        distance * Math.sin(pitch),
      );
      camera.near = distance / 500;
      camera.far = distance * 20;
      camera.updateProjectionMatrix();
      camera.lookAt(0, 0, 0);

      const marks = bodies.map((body, b) => {
        const place = b === 0 ? ([0, 0, 0] as const) : moment.bodies[b];
        const mesh = meshes[b];
        mesh.visible = place !== null;
        const ring = rings[b];
        if (ring) ring.visible = place !== null;
        if (!place) return { x: 0, y: 0, shown: false };
        const size = sizeOf(body, span, bodies[1].orbit);
        mesh.position.set(place[0], place[1], place[2]);
        mesh.scale.setScalar(size);
        if (b === 0) {
          glow.scale.setScalar(size * 4);
        } else if (ring) {
          ring.geometry.setAttribute(
            "position",
            new BufferAttribute(new Float32Array(ringOf(run, moment, b)), 3),
          );
        }
        at.set(place[0], place[1], place[2]).project(camera);
        // A body behind the viewer still projects onto the picture,
        // mirrored; only one in front of them, in the depth drawn, is
        // somewhere a name can be put.
        const ahead = at.z > -1 && at.z < 1;
        return { x: (at.x + 1) / 2, y: (1 - at.y) / 2, shown: ahead };
      });

      run.flows.forEach((flow, k) => {
        if (!clouds[k]) {
          clouds[k] = new Points(keep(new BufferGeometry()), gasMaterial);
          clouds[k].frustumCulled = false;
          scene.add(clouds[k]);
        }
        if (!scratch[k] || scratch[k].length < flow.count * 3) {
          scratch[k] = new Float32Array(flow.count * 3);
          clouds[k].geometry.setAttribute(
            "position",
            new BufferAttribute(scratch[k], 3),
          );
        }
        const shown = gasOf(run, flow, moment, scratch[k]);
        clouds[k].geometry.attributes.position.needsUpdate = true;
        clouds[k].geometry.setDrawRange(0, shown);
        clouds[k].visible = shown > 0;
      });
      for (let k = run.flows.length; k < clouds.length; k++)
        clouds[k].visible = false;

      renderer.render(scene, camera);
      return marks;
    },
    dispose() {
      for (const thing of disposables) thing.dispose();
    },
  };
}

// How many parcels of gas are out of the Sun at a moment.
const counting = new Float32Array(0);
export function gasShown(run: Run, moment: Moment): number {
  let total = 0;
  for (const flow of run.flows) total += gasOf(run, flow, moment, counting);
  return total;
}

type Props = {
  run: Run;
  moment: Moment;
  bodies: Body[];
  // How many AU across the view shows, and a way to ask for another.
  span: number;
  onSpan: (span: number) => void;
  label: string;
};

// The system from straight above, on a flat canvas: what is shown when
// the browser cannot draw in three dimensions.
function Flat({ run, moment, bodies, span, label }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const el = canvas.current!;
    const draw = () => {
      const side = Math.max(1, el.clientWidth);
      const ratio = Math.min(devicePixelRatio, 2);
      el.width = el.height = Math.round(side * ratio);
      const c = el.getContext("2d");
      if (!c) return;
      c.fillStyle = space;
      c.fillRect(0, 0, el.width, el.height);
      const scale = el.width / span;
      const px = (v: number) => el.width / 2 + v * scale,
        py = (v: number) => el.height / 2 - v * scale;
      c.lineWidth = ratio;
      bodies.forEach((body, b) => {
        if (b === 0 || !moment.bodies[b]) return;
        const ring = ringOf(run, moment, b);
        c.strokeStyle = body.surface.colors[0] + "99";
        c.beginPath();
        for (let k = 0; k < ring.length; k += 3)
          c.lineTo(px(ring[k]), py(ring[k + 1]));
        c.closePath();
        c.stroke();
      });
      c.fillStyle = gasColor + "88";
      for (const flow of run.flows) {
        const into = new Float32Array(flow.count * 3);
        const shown = gasOf(run, flow, moment, into);
        for (let k = 0; k < shown; k++)
          c.fillRect(
            px(into[k * 3]) - ratio,
            py(into[k * 3 + 1]) - ratio,
            2 * ratio,
            2 * ratio,
          );
      }
      c.font = `${12 * ratio}px "IBM Plex Sans", sans-serif`;
      bodies.forEach((body, b) => {
        const place = b === 0 ? ([0, 0, 0] as const) : moment.bodies[b];
        if (!place) return;
        const size = Math.max(
          1.5 * ratio,
          sizeOf(body, span, bodies[1].orbit) * scale,
        );
        c.fillStyle = body.surface.colors[body.star ? 1 : 0];
        c.beginPath();
        c.arc(px(place[0]), py(place[1]), size, 0, 2 * Math.PI);
        c.fill();
        if (b === 0 || Math.hypot(place[0], place[1]) * scale > 26 * ratio) {
          c.fillStyle = "#dfe5ee";
          c.fillText(
            body.label,
            px(place[0]) + size + 4 * ratio,
            py(place[1]) + 4 * ratio,
          );
        }
      });
    };
    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(el);
    return () => observer.disconnect();
  }, [run, moment, bodies, span]);
  return (
    <div
      className="system"
      data-testid="system-fallback"
      data-at={moment.at.toFixed(2)}
      data-bodies={moment.bodies.filter((p, b) => b === 0 || p).length}
      data-gas={gasShown(run, moment)}
      data-span={span}
      data-sun={sizeOf(bodies[0], span, bodies[1].orbit).toPrecision(4)}
      data-mercury={sizeOf(bodies[1], span, bodies[1].orbit).toPrecision(4)}
      role="img"
      aria-label={label}
    >
      <canvas ref={canvas} aria-hidden="true" />
    </div>
  );
}

// The Solar System in three dimensions. Drag to turn it. It is drawn
// only when something changes.
export function System(props: Props) {
  const { run, moment, bodies, span, onSpan, label } = props;
  const host = useRef<HTMLDivElement>(null);
  const names = useRef<HTMLDivElement>(null);
  const current = useRef({ run, moment, span, onSpan });
  current.current = { run, moment, span, onSpan };
  const stale = useRef(true);
  const turn = useRef({ yaw: 0.5, pitch: 0.9 });
  const [flat, setFlat] = useState(false);
  // The bodies are the same in every run; the stage is built once, so a
  // change of settings never loses how the view was turned.
  const cast = useRef(bodies);

  useEffect(() => {
    stale.current = true;
  }, [run, moment, span]);

  useEffect(() => {
    const element = host.current!;
    let stage: Stage;
    try {
      stage = build(cast.current);
    } catch {
      setFlat(true);
      return;
    }
    const canvas = stage.canvas;
    canvas.setAttribute("aria-hidden", "true");
    element.prepend(canvas);
    stage.onChange(() => {
      stale.current = true;
    });
    const resize = () => {
      stage.resize(
        Math.max(1, element.clientWidth),
        Math.max(1, element.clientHeight),
      );
      stale.current = true;
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(element);

    // One pointer, a mouse or a finger, turns and tilts the view. Two
    // fingers moving apart or together, in any direction, zoom it. A
    // touch that starts on the view belongs to it (touch-action: none),
    // as on Mozi's machine.
    const zoom = (by: number) =>
      current.current.onSpan(clampSpan(current.current.span * by));
    const fingers = new Map<number, { x: number; y: number }>();
    const gap = () => {
      const [a, b] = [...fingers.values()];
      return Math.hypot(a.x - b.x, a.y - b.y);
    };
    const down = (e: PointerEvent) => {
      fingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      canvas.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      const was = fingers.get(e.pointerId);
      if (!was) return;
      if (fingers.size === 2) {
        const before = gap();
        fingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        const after = gap();
        if (before > 0 && after > 0) zoom(before / after);
        return;
      }
      fingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (fingers.size > 1) return;
      turn.current.yaw -= (e.clientX - was.x) * 0.008;
      turn.current.pitch = Math.min(
        1.55,
        Math.max(0.08, turn.current.pitch + (e.clientY - was.y) * 0.008),
      );
      stale.current = true;
    };
    const up = (e: PointerEvent) => {
      fingers.delete(e.pointerId);
    };
    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", up);
    // Safari has pinch gestures of its own; they are not for the page
    // while fingers are on the view.
    const own = (e: Event) => e.preventDefault();
    element.addEventListener("gesturestart", own);
    element.addEventListener("gesturechange", own);
    // A plain wheel scrolls the page as it does anywhere else. With
    // Control or Command held, which is also how a pinch on a trackpad
    // arrives, it zooms.
    const wheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      zoom(Math.exp(Math.max(-1, Math.min(1, e.deltaY * 0.01))));
    };
    element.addEventListener("wheel", wheel, { passive: false });
    const key = (e: KeyboardEvent) => {
      if (e.key === "+" || e.key === "=" || e.key === "-") {
        e.preventDefault();
        zoom(e.key === "-" ? 1.25 : 0.8);
        return;
      }
      const step = {
        ArrowLeft: [0.1, 0],
        ArrowRight: [-0.1, 0],
        ArrowUp: [0, 0.1],
        ArrowDown: [0, -0.1],
      }[e.key];
      if (!step) return;
      e.preventDefault();
      turn.current.yaw += step[0];
      turn.current.pitch = Math.min(
        1.55,
        Math.max(0.08, turn.current.pitch + step[1]),
      );
      stale.current = true;
    };
    element.addEventListener("keydown", key);

    let frame = 0;
    const tick = () => {
      frame = requestAnimationFrame(tick);
      if (!stale.current) return;
      stale.current = false;
      const now = current.current;
      element.dataset.turn = `${turn.current.yaw.toFixed(3)} ${turn.current.pitch.toFixed(3)}`;
      const marks = stage.draw(
        now.run,
        now.moment,
        now.span,
        turn.current.yaw,
        turn.current.pitch,
      );
      // Names beside the bodies, where there is room for them.
      const labels = names.current?.children;
      if (!labels) return;
      const sun = marks[0];
      // Names already placed; one that would lie over another is left
      // out, the Sun's first and then the planets' from the inside out.
      const placed: DOMRect[] = [];
      marks.forEach((mark, b) => {
        const label = labels[b] as HTMLElement | undefined;
        if (!label) return;
        const apart =
          Math.hypot(mark.x - sun.x, mark.y - sun.y) * element.clientWidth;
        const room = b === 0 || apart > 30;
        label.hidden = !mark.shown || !room;
        label.style.left = `${(mark.x * 100).toFixed(2)}%`;
        label.style.top = `${(mark.y * 100).toFixed(2)}%`;
        if (label.hidden) return;
        const box = label.getBoundingClientRect();
        label.hidden = placed.some(
          (other) =>
            box.left < other.right &&
            other.left < box.right &&
            box.top < other.bottom &&
            other.top < box.bottom,
        );
        if (!label.hidden) placed.push(box);
      });
    };
    tick();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      element.removeEventListener("keydown", key);
      element.removeEventListener("wheel", wheel);
      element.removeEventListener("gesturestart", own);
      element.removeEventListener("gesturechange", own);
      canvas.remove();
      stage.dispose();
    };
  }, []);

  if (flat) return <Flat {...props} />;
  return (
    <div
      ref={host}
      className="system turns"
      data-testid="system"
      data-at={moment.at.toFixed(2)}
      data-bodies={moment.bodies.filter((p, b) => b === 0 || p).length}
      data-gas={gasShown(run, moment)}
      data-span={span}
      data-sun={sizeOf(bodies[0], span, bodies[1].orbit).toPrecision(4)}
      data-mercury={sizeOf(bodies[1], span, bodies[1].orbit).toPrecision(4)}
      role="img"
      aria-label={label}
      tabIndex={0}
    >
      <div ref={names} className="system-names" aria-hidden="true">
        {bodies.map((body) => (
          <span key={body.id} hidden>
            {body.label}
          </span>
        ))}
      </div>
    </div>
  );
}
