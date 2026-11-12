import { useEffect, useRef, useState } from "react";
import {
  AmbientLight,
  BufferAttribute,
  DirectionalLight,
  Group,
  Mesh,
  MeshLambertMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  WebGLRenderer,
} from "three";

export type Land = {
  size: number;
  // Meters per cell.
  cell: number;
  // One frame of heights, row by row, in meters.
  heights: Float32Array;
  cover: Float32Array;
  // No rain: the ground reads as parched.
  dry: boolean;
};

const lift = 1.6; // vertical exaggeration, so relief reads at this scale

function tint(land: Land, i: number, shade: number): [number, number, number] {
  const v = land.cover[i];
  const rock = land.dry ? [0.78, 0.5, 0.24] : [0.55, 0.5, 0.44];
  const green = [0.22, 0.42, 0.2];
  return [0, 1, 2].map((k) => (rock[k] + (green[k] - rock[k]) * v) * shade) as [
    number,
    number,
    number,
  ];
}

// A shaded map from above, for browsers without WebGL.
function Flat({ land }: { land: Land }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current!;
    const n = land.size;
    canvas.width = canvas.height = n;
    const context = canvas.getContext("2d");
    if (!context) return;
    const image = context.createImageData(n, n);
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) {
        const i = y * n + x;
        const west = land.heights[y * n + Math.max(0, x - 1)];
        const north = land.heights[Math.max(0, y - 1) * n + x];
        const slope =
          (land.heights[i] - west + (land.heights[i] - north)) / land.cell;
        const [r, g, b] = tint(
          land,
          i,
          Math.min(1.3, Math.max(0.35, 0.85 + slope * 0.9)),
        );
        image.data.set([r * 255, g * 255, b * 255, 255], i * 4);
      }
    context.putImageData(image, 0, 0);
  }, [land]);
  return (
    <canvas
      ref={ref}
      className="terrain-flat"
      data-testid="terrain-fallback"
      aria-hidden="true"
    />
  );
}

// The patch of land in three dimensions. Drag to turn it.
export function Terrain({ land, label }: { land: Land; label: string }) {
  const host = useRef<HTMLDivElement>(null);
  const current = useRef(land);
  const dirty = useRef(true);
  if (current.current !== land) {
    current.current = land;
    dirty.current = true;
  }
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
    const camera = new PerspectiveCamera(30, 1.5, 0.1, 50);
    camera.position.set(0, 1.55, 2.75);
    camera.lookAt(0, -0.05, 0);
    scene.add(new AmbientLight(0xffffff, 0.75));
    const sun = new DirectionalLight(0xffffff, 2.4);
    sun.position.set(-1.2, 1.4, 0.8);
    scene.add(sun);

    const n = current.current.size;
    const geometry = new PlaneGeometry(2, 2, n - 1, n - 1);
    geometry.rotateX(-Math.PI / 2);
    geometry.setAttribute(
      "color",
      new BufferAttribute(new Float32Array(n * n * 3), 3),
    );
    const material = new MeshLambertMaterial({ vertexColors: true });
    const turn = new Group();
    turn.add(new Mesh(geometry, material));
    turn.rotation.y = 0.5;
    scene.add(turn);

    const resize = () => {
      const w = Math.max(1, element.clientWidth);
      const h = Math.max(1, element.clientHeight);
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      dirty.current = true;
    };
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    resize();

    let dragging = false,
      lastX = 0;
    const down = (e: PointerEvent) => {
      dragging = true;
      lastX = e.clientX;
      canvas.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (!dragging) return;
      turn.rotation.y += (e.clientX - lastX) * 0.008;
      lastX = e.clientX;
      dirty.current = true;
    };
    const up = () => (dragging = false);
    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", up);
    // The land is drawn only when it changes, so it must be drawn again
    // when the browser gives back a drawing surface it took away.
    const restored = () => (dirty.current = true);
    canvas.addEventListener("webglcontextrestored", restored);

    let shown: Land | null = null;
    let frame = 0;
    const draw = () => {
      frame = requestAnimationFrame(draw);
      if (!dirty.current) return;
      dirty.current = false;
      const l = current.current;
      if (l !== shown) {
        shown = l;
        const position = geometry.getAttribute("position");
        const color = geometry.getAttribute("color");
        const scale = (2 / (l.size * l.cell)) * lift;
        for (let i = 0; i < l.size * l.size; i++) {
          position.setY(i, l.heights[i] * scale);
          const [r, g, b] = tint(l, i, 1);
          color.setXYZ(i, r, g, b);
        }
        position.needsUpdate = true;
        color.needsUpdate = true;
        geometry.computeVertexNormals();
      }
      renderer.render(scene, camera);
    };
    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      canvas.remove();
    };
  }, []);

  return (
    <div className="terrain" ref={host} role="img" aria-label={label}>
      {flat && <Flat land={land} />}
    </div>
  );
}
