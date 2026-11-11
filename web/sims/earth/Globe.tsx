import { useEffect, useRef, useState } from "react";
import {
  Color,
  Mesh,
  PerspectiveCamera,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
  WebGLRenderer,
} from "three";

// What the planet looks like at one moment, each 0 to 1 unless noted.
export type Look = {
  melt: number;
  // Share of the surface under water.
  sea: number;
  ice: number;
  vegetation: number;
  // How parched and oxidized the land reads, toward orange.
  arid: number;
  cloud: number;
  // Rim color of the air.
  air: [number, number, number];
};

const vertex = /* glsl */ `
varying vec3 vPos;
varying vec3 vNormal;
varying vec3 vView;
void main() {
  vPos = normalize(position);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vNormal = normalize(normalMatrix * normal);
  vView = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`;

const fragment = /* glsl */ `
precision highp float;
varying vec3 vPos;
varying vec3 vNormal;
varying vec3 vView;
uniform float uMelt, uSea, uIce, uVeg, uArid, uCloud, uTime;
uniform vec3 uAir, uLight;

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
float fbm(vec3 p) {
  float a = 0.5, s = 0.0;
  for (int i = 0; i < 4; i++) { s += a * noise(p); p *= 2.03; a *= 0.5; }
  return s / 0.9375;
}

void main() {
  float h = fbm(vPos * 2.1 + 3.7);
  float fine = fbm(vPos * 9.0 - 1.3);
  float lat = abs(vPos.y);

  // Land: rock, parched toward orange, greened where plants grow.
  vec3 rock = mix(vec3(0.42, 0.37, 0.31), vec3(0.62, 0.52, 0.38), fine);
  vec3 parched = mix(vec3(0.72, 0.42, 0.16), vec3(0.88, 0.62, 0.30), fine);
  vec3 land = mix(rock, parched, uArid);
  // Each layer is skipped when it would not show: the noise is the cost.
  if (uVeg > 0.001) {
    float grows = uVeg * (1.0 - smoothstep(0.62, 0.9, lat)) * smoothstep(0.25, 0.6, fbm(vPos * 4.0 + 9.0));
    land = mix(land, mix(vec3(0.16, 0.34, 0.16), vec3(0.30, 0.44, 0.20), fine), grows);
  }
  land *= 0.75 + 0.5 * h;

  // Sea level sits where the given share of the noise falls below it.
  float level = 0.5 + (uSea - 0.5) * 0.62;
  float shore = smoothstep(level - 0.012, level + 0.012, h);
  vec3 sea = mix(vec3(0.03, 0.13, 0.30), vec3(0.10, 0.40, 0.58), smoothstep(level - 0.25, level, h));
  vec3 surface = uSea <= 0.001 ? land : mix(sea, land, shore);

  float cap = smoothstep(1.0 - uIce - 0.06, 1.0 - uIce + 0.02, lat + (fine - 0.5) * 0.12);
  surface = mix(surface, vec3(0.92, 0.95, 0.97), cap * step(0.001, uIce));

  vec3 n = normalize(vNormal);
  float day = max(dot(n, normalize(uLight)), 0.0);
  float glint = (1.0 - shore) * (1.0 - cap) * pow(max(dot(reflect(-normalize(uLight), n), vView), 0.0), 40.0) * step(0.001, uSea);
  vec3 lit = surface * (0.06 + 0.94 * day) + glint * 0.5;

  if (uCloud > 0.001) {
    float veil = uCloud * smoothstep(0.52, 0.72, fbm(vPos * 3.2 + vec3(uTime * 0.02, 0.0, uTime * 0.013)));
    lit = mix(lit, vec3(0.96) * (0.1 + 0.9 * day), veil * 0.75);
  }

  // Molten: dark crust riven with glowing seams, lit from within.
  vec3 color = lit;
  if (uMelt > 0.001) {
    float seams = pow(1.0 - abs(fbm(vPos * 3.4 + uTime * 0.01) - 0.5) * 2.0, 7.0);
    vec3 magma = vec3(0.10, 0.03, 0.02) + vec3(1.0, 0.36, 0.05) * (seams * 1.6 + 0.22) + vec3(1.0, 0.8, 0.3) * pow(seams, 3.0);
    color = mix(lit, magma, uMelt);
  }

  float rim = pow(1.0 - max(dot(n, vView), 0.0), 2.6);
  color += uAir * rim * (0.25 + 0.75 * day) * 0.9;
  gl_FragColor = vec4(color, 1.0);
}`;

function fallbackColor(look: Look): string {
  if (look.melt > 0.4) return "#c8421b";
  if (look.sea > 0.3) return look.ice > 0.6 ? "#cfe0ea" : "#1f6f98";
  return look.arid > 0.5 ? "#c98538" : "#8a7560";
}

// The planet. Drag to turn it. Without WebGL it is a plain colored disc.
export function Globe({ look, label }: { look: Look; label: string }) {
  const host = useRef<HTMLDivElement>(null);
  const current = useRef(look);
  current.current = look;
  const [flat, setFlat] = useState(false);

  useEffect(() => {
    const element = host.current!;
    let renderer: WebGLRenderer;
    try {
      renderer = new WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      setFlat(true);
      return;
    }
    const canvas = renderer.domElement;
    canvas.setAttribute("aria-hidden", "true");
    element.append(canvas);
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    const scene = new Scene();
    const camera = new PerspectiveCamera(32, 1, 0.1, 20);
    camera.position.z = 3.9;
    const uniforms = {
      uMelt: { value: 0 },
      uSea: { value: 0 },
      uIce: { value: 0 },
      uVeg: { value: 0 },
      uArid: { value: 0 },
      uCloud: { value: 0 },
      uTime: { value: 0 },
      uAir: { value: new Color() },
      uLight: { value: new Vector3(-0.55, 0.45, 0.7) },
    };
    const geometry = new SphereGeometry(1, 96, 64);
    const material = new ShaderMaterial({
      uniforms,
      vertexShader: vertex,
      fragmentShader: fragment,
    });
    const planet = new Mesh(geometry, material);
    planet.rotation.z = 0.41;
    scene.add(planet);

    const still = matchMedia("(prefers-reduced-motion: reduce)");
    // The globe is drawn only when something has changed. It turns slowly
    // by itself, which means every frame, unless the visitor prefers
    // reduced motion, the globe is off screen, or frames are coming so
    // slowly (no graphics hardware) that spinning would bog the page down.
    let stale = true,
      seen = true,
      struggling = false,
      slowFrames = 0,
      drawn: Look | null = null;
    const watcher = new IntersectionObserver(([entry]) => {
      seen = entry.isIntersecting;
      stale = true;
    });
    watcher.observe(element);
    const resize = () => {
      const size = Math.max(
        1,
        Math.min(element.clientWidth, element.clientHeight),
      );
      renderer.setSize(size, size, false);
      canvas.style.width = canvas.style.height = `${size}px`;
      stale = true;
    };
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    resize();

    let dragging = false,
      lastX = 0,
      lastY = 0,
      tilt = 0.25;
    const down = (e: PointerEvent) => {
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      canvas.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (!dragging) return;
      planet.rotation.y += (e.clientX - lastX) * 0.008;
      tilt = Math.max(-1.2, Math.min(1.2, tilt + (e.clientY - lastY) * 0.006));
      lastX = e.clientX;
      lastY = e.clientY;
      stale = true;
    };
    const up = () => (dragging = false);
    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", up);

    let frame = 0,
      frames = 0,
      before = performance.now(),
      clock = 0;
    const draw = (now: number) => {
      frame = requestAnimationFrame(draw);
      const gap = now - before;
      const dt = Math.min(0.1, gap / 1000);
      before = now;
      const spinning = seen && !still.matches && !struggling;
      if (spinning) {
        // Four frames in a row a tenth of a second apart: stop spinning.
        slowFrames = gap > 100 ? slowFrames + 1 : 0;
        if (slowFrames >= 4) struggling = true;
        clock += dt;
        if (!dragging) planet.rotation.y += dt * 0.06;
      }
      const l = current.current;
      if (!seen || (!spinning && !stale && l === drawn)) return;
      stale = false;
      drawn = l;
      planet.rotation.x = tilt;
      uniforms.uMelt.value = l.melt;
      uniforms.uSea.value = l.sea;
      uniforms.uIce.value = l.ice;
      uniforms.uVeg.value = l.vegetation;
      uniforms.uArid.value = l.arid;
      uniforms.uCloud.value = l.cloud;
      uniforms.uTime.value = clock;
      uniforms.uAir.value.setRGB(l.air[0], l.air[1], l.air[2]);
      renderer.render(scene, camera);
      element.dataset.frames = String(++frames);
    };
    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      watcher.disconnect();
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      canvas.remove();
    };
  }, []);

  return (
    <div className="globe" ref={host} role="img" aria-label={label}>
      {flat && (
        <svg
          viewBox="0 0 100 100"
          data-testid="globe-fallback"
          aria-hidden="true"
        >
          <circle cx="50" cy="50" r="46" fill={fallbackColor(look)} />
        </svg>
      )}
    </div>
  );
}
