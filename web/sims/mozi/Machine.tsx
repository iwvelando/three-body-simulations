import { useEffect, useRef, useState } from "react";
import {
  AdditiveBlending,
  AmbientLight,
  BackSide,
  BufferGeometry,
  CircleGeometry,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  EdgesGeometry,
  Float32BufferAttribute,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  Plane,
  Points,
  PointsMaterial,
  Quaternion,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
  WebGLRenderer,
} from "three";
import { daylight, daySky, height, nightSky } from "./format";
import type { Run, View } from "./types";

// The parts of the machine a visitor can peel away, outermost first.
export const layerNames = ["fire", "outer", "light", "inner", "clerk"] as const;
export type Layer = (typeof layerNames)[number];
export type Layers = Record<Layer, boolean>;

// Whether the machine has a second shell at this moment: with one sphere
// the engine reports the same radius twice.
export const hasTwoShells = (view: View) =>
  view.outerRadius - view.innerRadius > 1e-6;

// The layers on show: those ticked that this machine has.
export function shownLayers(view: View, layers: Layers): Layer[] {
  const two = hasTwoShells(view);
  return layerNames.filter(
    (name) => layers[name] && (two || (name !== "light" && name !== "inner")),
  );
}

const fireVertex = /* glsl */ `
varying vec3 vPos;
void main() {
  vPos = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const fireFragment = /* glsl */ `
precision highp float;
varying vec3 vPos;
float hash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float noise(vec3 x) {
  vec3 i = floor(x), f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x),
                 mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
                 mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
}
void main() {
  float a = 0.5, flame = 0.0;
  vec3 p = vPos * 3.0;
  for (int i = 0; i < 4; i++) { flame += a * noise(p); p *= 2.1; a *= 0.5; }
  flame = smoothstep(0.25, 0.85, flame / 0.9375);
  vec3 color = mix(vec3(0.33, 0.04, 0.02), vec3(0.86, 0.27, 0.05), flame);
  color = mix(color, vec3(1.0, 0.72, 0.25), smoothstep(0.7, 1.0, flame));
  gl_FragColor = vec4(color, 1.0);
}`;

// Engine vectors have z up; three.js has y up. Everything hangs from one
// group turned to match, so engine numbers are used as they come.
const upright = new Quaternion().setFromAxisAngle(
  new Vector3(1, 0, 0),
  -Math.PI / 2,
);

type Stage = {
  draw: (view: View, layers: Layers) => void;
  resize: (size: number) => void;
  orbit: (dx: number, dy: number) => void;
  dispose: () => void;
  canvas: HTMLCanvasElement;
};

function build(stars: Run["stars"]): Stage {
  const renderer = new WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.localClippingEnabled = true;
  const scene = new Scene();
  const camera = new PerspectiveCamera(34, 1, 0.1, 60);
  scene.add(camera);
  scene.add(new AmbientLight(0xffffff, 1.1));
  const lamp = new DirectionalLight(0xffffff, 1.9);
  lamp.position.set(-0.6, 0.9, 1);
  camera.add(lamp);
  // The near half of both shells is cut away to show the inside.
  const cut = [new Plane(new Vector3(0, 0, -1), 0)];
  const disposables: { dispose: () => void }[] = [renderer];
  const keep = <T extends { dispose: () => void }>(thing: T) => {
    disposables.push(thing);
    return thing;
  };

  const fire = new Mesh(
    keep(new SphereGeometry(20, 32, 20)),
    keep(
      new ShaderMaterial({
        vertexShader: fireVertex,
        fragmentShader: fireFragment,
        side: BackSide,
      }),
    ),
  );
  scene.add(fire);

  const world = new Group();
  world.quaternion.copy(upright);
  scene.add(world);

  const ball = keep(new SphereGeometry(1, 72, 48));
  const ribs = keep(new EdgesGeometry(new SphereGeometry(1.004, 12, 8), 12));
  // Each shell has two faces: what it is made of outside, and inside
  // whatever the caller makes of it.
  const shell = (
    color: number,
    metalness: number,
    roughness: number,
    lining: MeshBasicMaterial | MeshStandardMaterial,
  ) => {
    const group = new Group();
    const skin = new Mesh(
      ball,
      keep(
        new MeshStandardMaterial({
          color,
          metalness,
          roughness,
          clippingPlanes: cut,
        }),
      ),
    );
    lining.side = BackSide;
    lining.clippingPlanes = cut;
    const lines = new LineSegments(
      ribs,
      keep(
        new LineBasicMaterial({
          color: 0x1c1410,
          transparent: true,
          opacity: 0.45,
          clippingPlanes: cut,
        }),
      ),
    );
    group.add(skin, new Mesh(ball, keep(lining)), lines);
    world.add(group);
    return group;
  };
  const outer = shell(
    0xb5703a,
    0.55,
    0.5,
    new MeshStandardMaterial({ color: 0x5a3520, roughness: 0.8 }),
  );
  // The inside of the inner shell is the sky the clerk sees.
  const heaven = new MeshBasicMaterial();
  const inner = shell(0xe7e1d2, 0, 0.95, heaven);

  // The small holes: points fixed on the shell that carries the stars.
  const holes = new Group();
  const spots = keep(new BufferGeometry());
  spots.setAttribute(
    "position",
    new Float32BufferAttribute(
      stars.flatMap(([x, y, z]) => [x * 0.99, y * 0.99, z * 0.99]),
      3,
    ),
  );
  holes.add(
    new Points(
      spots,
      keep(
        new PointsMaterial({
          color: 0xfff6da,
          size: 0.03,
          clippingPlanes: cut,
        }),
      ),
    ),
  );
  world.add(holes);

  // The large hole (Mozi's firefly lamp), the light crossing the gap and
  // the patch it makes on the inner shell.
  const glow = keep(
    new MeshBasicMaterial({ color: 0xfff3c4, side: DoubleSide }),
  );
  const source = new Mesh(keep(new CircleGeometry(0.5, 32)), glow);
  const patch = new Mesh(keep(new CircleGeometry(0.5, 32)), glow);
  const beam = new Mesh(
    keep(new CylinderGeometry(0.5, 0.5, 1, 32, 1, true)),
    keep(
      new MeshBasicMaterial({
        color: 0xffe9a3,
        transparent: true,
        opacity: 0.4,
        blending: AdditiveBlending,
        depthWrite: false,
        side: DoubleSide,
      }),
    ),
  );
  world.add(source, patch, beam);

  // The clerk on the shelf at the center, and the floor that is the horizon.
  const clerk = new Group();
  const dark = keep(
    new MeshStandardMaterial({ color: 0x2b3342, roughness: 0.8 }),
  );
  const floor = new Mesh(
    keep(new CircleGeometry(1, 64)),
    keep(
      new MeshBasicMaterial({
        color: 0x1a2231,
        transparent: true,
        opacity: 0.4,
        side: DoubleSide,
        depthWrite: false,
      }),
    ),
  );
  const standing = (geometry: BufferGeometry, z: number) => {
    const mesh = new Mesh(keep(geometry), dark);
    mesh.rotation.x = Math.PI / 2;
    mesh.position.z = z;
    return mesh;
  };
  clerk.add(
    floor,
    standing(new CylinderGeometry(0.13, 0.17, 0.26, 20), -0.32),
    standing(new CylinderGeometry(0.035, 0.05, 0.16, 12), -0.11),
    standing(new SphereGeometry(0.045, 16, 12), 0),
  );
  world.add(clerk);

  let yaw = 0.62,
    pitch = 0.3;
  const place = () => {
    const distance = 5.6;
    camera.position.set(
      distance * Math.cos(pitch) * Math.sin(yaw),
      distance * Math.sin(pitch),
      distance * Math.cos(pitch) * Math.cos(yaw),
    );
    camera.lookAt(0, 0, 0);
  };
  place();

  const sun = new Vector3();
  const out = new Vector3(0, 0, 1);
  const along = new Vector3(0, 1, 0);
  return {
    canvas: renderer.domElement,
    resize(size) {
      renderer.setSize(size, size, false);
    },
    orbit(dx, dy) {
      yaw -= dx * 0.008;
      pitch = Math.max(-1.3, Math.min(1.3, pitch + dy * 0.006));
      place();
    },
    draw(view, layers) {
      const two = hasTwoShells(view);
      const on = new Set(shownLayers(view, layers));
      fire.visible = on.has("fire");
      outer.visible = on.has("outer");
      outer.quaternion.set(
        view.outer[1],
        view.outer[2],
        view.outer[3],
        view.outer[0],
      );
      outer.scale.setScalar(view.outerRadius);
      inner.visible = on.has("inner");
      inner.quaternion.set(
        view.inner[1],
        view.inner[2],
        view.inner[3],
        view.inner[0],
      );
      inner.scale.setScalar(view.innerRadius);
      const lit = daylight(view);
      heaven.color.setRGB(
        (nightSky[0] + (daySky[0] - nightSky[0]) * lit) / 255,
        (nightSky[1] + (daySky[1] - nightSky[1]) * lit) / 255,
        (nightSky[2] + (daySky[2] - nightSky[2]) * lit) / 255,
      );
      // The stars ride the inner shell, or the only shell there is.
      holes.visible = two ? on.has("inner") : on.has("outer");
      holes.quaternion.copy(inner.quaternion);
      holes.scale.setScalar(view.innerRadius);

      sun.set(view.sun[0], view.sun[1], view.sun[2]);
      const dim = Math.max(0.12, Math.min(1, view.light));
      glow.color.setRGB(dim, 0.95 * dim, 0.77 * dim);
      const width =
        2 * view.innerRadius * Math.tan((view.size * Math.PI) / 360);
      source.visible = on.has("outer") || on.has("light");
      source.position.copy(sun).multiplyScalar(view.outerRadius * 0.994);
      source.quaternion.setFromUnitVectors(out, sun);
      source.scale.setScalar(view.hole);
      patch.visible = two && on.has("light");
      // Just inside the inner shell, where the clerk sees it.
      patch.position.copy(sun).multiplyScalar(view.innerRadius * 0.985);
      patch.quaternion.copy(source.quaternion);
      patch.scale.setScalar(width);
      beam.visible = two && on.has("light");
      if (two) {
        // Drawn as a tube of the mean width; the two discs at its ends
        // carry the true widths.
        const gap = view.outerRadius - view.innerRadius;
        const middle = (view.outerRadius + view.innerRadius) / 2;
        beam.position.copy(sun).multiplyScalar(middle);
        beam.quaternion.setFromUnitVectors(along, sun);
        beam.scale.set((view.hole + width) / 2, gap, (view.hole + width) / 2);
      }
      clerk.visible = on.has("clerk");
      floor.scale.setScalar(view.innerRadius * 0.992);
      renderer.render(scene, camera);
    },
    dispose() {
      for (const thing of disposables) thing.dispose();
      renderer.domElement.remove();
    },
  };
}

// A cross-section through the sun, for a browser without WebGL.
function CrossSection({ view, layers }: { view: View; layers: Layers }) {
  const on = new Set(shownLayers(view, layers));
  const two = hasTwoShells(view);
  const unit = 46;
  const up = (height(view.sun) * Math.PI) / 180;
  const at = (r: number, lift = 0): [number, number] => [
    100 + r * unit * Math.cos(up + lift),
    100 - r * unit * Math.sin(up + lift),
  ];
  const half = (width: number, r: number) => Math.atan(width / 2 / r);
  const width = 2 * view.innerRadius * Math.tan((view.size * Math.PI) / 360);
  const lampHalf = half(view.hole, view.outerRadius);
  const spotHalf = half(width, view.innerRadius);
  const points = [
    at(view.outerRadius, lampHalf),
    at(view.outerRadius, -lampHalf),
    at(view.innerRadius, -spotHalf),
    at(view.innerRadius, spotHalf),
  ]
    .map((p) => p.map((v) => v.toFixed(1)).join(","))
    .join(" ");
  const [lx, ly] = at(view.outerRadius);
  return (
    <svg
      viewBox="0 0 200 200"
      data-testid="machine-fallback"
      aria-hidden="true"
    >
      {on.has("fire") && (
        <rect data-layer="fire" width="200" height="200" fill="#a8380f" />
      )}
      {on.has("outer") && (
        <g data-layer="outer">
          <circle
            cx="100"
            cy="100"
            r={view.outerRadius * unit}
            fill={two ? "#3a2a22" : "#11161f"}
            stroke="#b5703a"
            strokeWidth="4"
          />
          <circle cx={lx} cy={ly} r="3.5" fill="#fff3c4" />
        </g>
      )}
      {on.has("light") && (
        <polygon
          data-layer="light"
          points={points}
          fill="#ffe9a3"
          opacity="0.7"
        />
      )}
      {on.has("inner") && (
        <circle
          data-layer="inner"
          cx="100"
          cy="100"
          r={view.innerRadius * unit}
          fill="#11161f"
          stroke="#e7e1d2"
          strokeWidth="3"
          strokeDasharray="7 1.5"
        />
      )}
      {on.has("clerk") && (
        <g data-layer="clerk" stroke="#9aa6b6" fill="#9aa6b6">
          <line
            x1={100 - view.innerRadius * unit}
            x2={100 + view.innerRadius * unit}
            y1="100"
            y2="100"
            strokeWidth="1"
          />
          <rect x="95" y="106" width="10" height="12" stroke="none" />
          <circle cx="100" cy="100" r="2.5" stroke="none" />
        </g>
      )}
    </svg>
  );
}

// The machine from outside, cut open. Drag to turn it. It is drawn only
// when something changes: nothing here moves unless time does.
export function Machine({
  view,
  stars,
  layers,
  label,
}: {
  view: View;
  stars: Run["stars"];
  layers: Layers;
  label: string;
}) {
  const host = useRef<HTMLDivElement>(null);
  const current = useRef({ view, layers });
  current.current = { view, layers };
  const stale = useRef(true);
  const [flat, setFlat] = useState(false);
  // The small holes are the same in every machine, though each run brings
  // its own copy of the list. The machine is built once, from the first,
  // so a change of settings never rebuilds it or loses how it was turned.
  const holes = useRef(stars);

  useEffect(() => {
    stale.current = true;
  }, [view, layers]);

  useEffect(() => {
    const element = host.current!;
    let stage: Stage;
    try {
      stage = build(holes.current);
    } catch {
      setFlat(true);
      return;
    }
    const canvas = stage.canvas;
    canvas.setAttribute("aria-hidden", "true");
    element.append(canvas);
    let seen = true;
    const watcher = new IntersectionObserver(([entry]) => {
      seen = entry.isIntersecting;
      stale.current = true;
    });
    watcher.observe(element);
    const resize = () => {
      const size = Math.max(
        1,
        Math.min(element.clientWidth, element.clientHeight),
      );
      stage.resize(size);
      canvas.style.width = canvas.style.height = `${size}px`;
      stale.current = true;
    };
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    resize();

    let dragging = false,
      lastX = 0,
      lastY = 0;
    const down = (e: PointerEvent) => {
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      canvas.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (!dragging) return;
      stage.orbit(e.clientX - lastX, e.clientY - lastY);
      lastX = e.clientX;
      lastY = e.clientY;
      stale.current = true;
    };
    const up = () => (dragging = false);
    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", up);
    // Drawn only when something changes, so drawn again when the browser
    // gives back a drawing surface it took away.
    const restored = () => (stale.current = true);
    canvas.addEventListener("webglcontextrestored", restored);

    let frame = 0,
      frames = 0;
    const draw = () => {
      frame = requestAnimationFrame(draw);
      if (!seen || !stale.current) return;
      stale.current = false;
      stage.draw(current.current.view, current.current.layers);
      element.dataset.frames = String(++frames);
    };
    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      watcher.disconnect();
      stage.dispose();
    };
  }, []);

  return (
    <div
      className="machine"
      ref={host}
      role="img"
      aria-label={label}
      data-testid="machine"
      data-layers={shownLayers(view, layers).join(" ")}
    >
      {flat && <CrossSection view={view} layers={layers} />}
    </div>
  );
}
