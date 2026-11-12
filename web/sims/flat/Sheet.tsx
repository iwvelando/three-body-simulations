import { useEffect, useRef, useState } from "react";
import type { Painted, Section } from "./types";

const space = [6 / 255, 10 / 255, 18 / 255] as const;
// Keep in step with `margin` in engine/flat/painting.go.
const margin = 0.96;

const vertex = `
attribute vec2 place;
attribute vec2 across;
varying vec2 uv;
void main() {
  uv = across;
  gl_Position = vec4(place.x * ${margin}, -place.y * ${margin}, 0.0, 1.0);
}`;
const fragment = `
precision mediump float;
varying vec2 uv;
uniform sampler2D picture;
void main() { gl_FragColor = texture2D(picture, uv); }`;

// `draw` says whether anything was drawn: nothing is while the browser
// has the drawing surface.
type Drawer = { draw: (painted: Painted, progress: number) => boolean };

function start(canvas: HTMLCanvasElement): Drawer | null {
  const gl = canvas.getContext("webgl", { antialias: true, alpha: false });
  if (!gl) return null;
  const program = gl.createProgram()!;
  for (const [kind, source] of [
    [gl.VERTEX_SHADER, vertex],
    [gl.FRAGMENT_SHADER, fragment],
  ] as const) {
    const shader = gl.createShader(kind)!;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    gl.attachShader(program, shader);
  }
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
  gl.useProgram(program);
  const place = gl.createBuffer(),
    across = gl.createBuffer(),
    order = gl.createBuffer();
  const at = {
    place: gl.getAttribLocation(program, "place"),
    across: gl.getAttribLocation(program, "across"),
  };
  gl.enableVertexAttribArray(at.place);
  gl.enableVertexAttribArray(at.across);

  // What was last loaded, so a new moment of the same fall is cheap.
  let held: Painted | null = null;
  let mesh = new Float32Array(0);
  let count = 0;
  const textures: WebGLTexture[] = [];
  const load = (bytes: Uint8Array, s: Section) => {
    const texture = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      s.width,
      s.height,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      bytes.subarray(s.offset, s.offset + 4 * s.width * s.height),
    );
    for (const side of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T])
      gl.texParameteri(gl.TEXTURE_2D, side, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    return texture;
  };
  const prepare = (p: Painted) => {
    held = p;
    for (const t of textures.splice(0)) gl.deleteTexture(t);
    textures.push(load(p.bytes, p.texture), load(p.bytes, p.back));
    // Little-endian float32, as every browser's own arrays are.
    mesh = new Float32Array(p.mesh.count);
    new Uint8Array(mesh.buffer).set(
      p.bytes.subarray(p.mesh.offset, p.mesh.offset + 4 * p.mesh.count),
    );
    const uv = new Float32Array(2 * p.cols * (p.rows + 1));
    for (let j = 0; j <= p.rows; j++)
      for (let i = 0; i < p.cols; i++)
        uv.set([p.u[i], j / p.rows], 2 * (j * p.cols + i));
    gl.bindBuffer(gl.ARRAY_BUFFER, across);
    gl.bufferData(gl.ARRAY_BUFFER, uv, gl.STATIC_DRAW);
    const index = new Uint16Array(6 * (p.cols - 1) * p.rows);
    let n = 0;
    for (let j = 0; j < p.rows; j++)
      for (let i = 0; i < p.cols - 1; i++) {
        const a = j * p.cols + i,
          b = a + p.cols;
        index.set([a, a + 1, b + 1, a, b + 1, b], n);
        n += 6;
      }
    count = n;
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, order);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, index, gl.STATIC_DRAW);
  };

  return {
    draw(p, progress) {
      if (gl.isContextLost()) return false;
      if (p !== held) prepare(p);
      const box = canvas.getBoundingClientRect();
      const scale = Math.min(devicePixelRatio || 1, 2);
      const side = Math.max(1, Math.round(box.width * scale));
      if (canvas.width !== side) canvas.width = canvas.height = side;
      gl.viewport(0, 0, side, side);
      // Buried, the frame is all Pluto: the back's one color.
      const ground =
        p.dilution !== undefined
          ? Array.from(p.bytes.subarray(p.back.offset, p.back.offset + 3)).map(
              (v) => v / 255,
            )
          : space;
      gl.clearColor(ground[0], ground[1], ground[2], 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      // Matter that went in at share j is at step progress − j: still on
      // the line before its turn, further along its path after.
      const points = new Float32Array(2 * p.cols * (p.rows + 1));
      for (let j = 0; j <= p.rows; j++) {
        const step = Math.min(p.rows, Math.max(0, progress - j)),
          k = Math.min(p.rows - 1, Math.floor(step)),
          w = step - k;
        for (let i = 0; i < p.cols; i++) {
          const a = 2 * (k * p.cols + i),
            b = a + 2 * p.cols;
          points[2 * (j * p.cols + i)] = mesh[a] + (mesh[b] - mesh[a]) * w;
          points[2 * (j * p.cols + i) + 1] =
            mesh[a + 1] + (mesh[b + 1] - mesh[a + 1]) * w;
        }
      }
      const sheet = (texture: WebGLTexture, at_: Float32Array) => {
        gl.bindBuffer(gl.ARRAY_BUFFER, place);
        gl.bufferData(gl.ARRAY_BUFFER, at_, gl.DYNAMIC_DRAW);
        gl.vertexAttribPointer(at.place, 2, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, across);
        gl.vertexAttribPointer(at.across, 2, gl.FLOAT, false, 0, 0);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.drawElements(gl.TRIANGLES, count, gl.UNSIGNED_SHORT, 0);
      };
      if (p.core) {
        // The patch left where it landed: one quad of the back's color.
        const { halfWidth: a, halfHeight: b } = p.core;
        gl.enable(gl.SCISSOR_TEST);
        const edge = (v: number) => Math.round(((v * margin + 1) / 2) * side);
        gl.scissor(edge(-a), edge(-b), edge(a) - edge(-a), edge(b) - edge(-b));
        gl.clearColor(
          p.core.color[0] / 255,
          p.core.color[1] / 255,
          p.core.color[2] / 255,
          1,
        );
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.disable(gl.SCISSOR_TEST);
      }
      if (p.mirror) {
        // The back half of the depth: the same sheet in the line's mirror.
        const [x0, y0, x1, y1] = p.line,
          long = Math.hypot(x1 - x0, y1 - y0) || 1,
          dx = (x1 - x0) / long,
          dy = (y1 - y0) / long;
        const back = new Float32Array(points.length);
        for (let n = 0; n < points.length; n += 2) {
          const dot = points[n] * dx + points[n + 1] * dy;
          back[n] = 2 * dot * dx - points[n];
          back[n + 1] = 2 * dot * dy - points[n + 1];
        }
        sheet(textures[1], back);
      }
      sheet(textures[0], points);
      return true;
    },
  };
}

// The flat picture, as the engine drew it, for a browser without WebGL
// and for saving.
export function flatCanvas(p: Painted): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = p.flat.width;
  canvas.height = p.flat.height;
  const c = canvas.getContext("2d");
  if (c) {
    const image = c.createImageData(p.flat.width, p.flat.height);
    image.data.set(
      p.bytes.subarray(
        p.flat.offset,
        p.flat.offset + 4 * p.flat.width * p.flat.height,
      ),
    );
    c.putImageData(image, 0, 0);
  }
  return canvas;
}

// The plane seen from above, with the picture spreading on it. Progress
// runs from 0 (nothing in yet) to the picture's `rows` (all of it flat).
export function Sheet({
  painted,
  progress,
  label,
}: {
  painted: Painted;
  progress: number;
  label: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawer = useRef<Drawer | null>(null);
  const [plain, setPlain] = useState(false);
  // Counts the times the drawing surface has come back.
  const [returned, setReturned] = useState(0);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || plain) return;
    drawer.current ??= start(canvas);
    if (!drawer.current) {
      setPlain(true);
      return;
    }
    // A browser may take the drawing surface away, as phones do with a
    // page left in the background. It gives one back only if asked to,
    // and everything loaded onto the old one is gone: start again and
    // draw the picture as it stood.
    const lost = (e: Event) => e.preventDefault();
    const back = () => {
      drawer.current = start(canvas);
      setReturned((n) => n + 1);
    };
    canvas.addEventListener("webglcontextlost", lost);
    canvas.addEventListener("webglcontextrestored", back);
    return () => {
      canvas.removeEventListener("webglcontextlost", lost);
      canvas.removeEventListener("webglcontextrestored", back);
    };
  }, [plain]);
  const frames = useRef(0);
  useEffect(() => {
    if (plain) return;
    const paint = () => {
      const host = ref.current?.parentElement;
      if (drawer.current?.draw(painted, progress) && host)
        host.dataset.frames = String(++frames.current);
    };
    paint();
    if (!ref.current) return;
    const watch = new ResizeObserver(paint);
    watch.observe(ref.current);
    return () => watch.disconnect();
  }, [painted, progress, plain, returned]);
  // Without WebGL there is no fall to watch, only how it ends.
  const flat = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = flat.current;
    if (!plain || !canvas) return;
    canvas.width = canvas.height = painted.flat.width;
    const c = canvas.getContext("2d");
    if (!c) return;
    c.fillStyle = "#060a12";
    c.fillRect(0, 0, canvas.width, canvas.height);
    c.drawImage(flatCanvas(painted), 0, 0);
  }, [plain, painted]);
  return (
    <div className="flat-view" data-testid="flat-picture">
      {plain ? (
        <canvas ref={flat} role="img" aria-label={label} />
      ) : (
        <canvas ref={ref} role="img" aria-label={label} />
      )}
    </div>
  );
}
