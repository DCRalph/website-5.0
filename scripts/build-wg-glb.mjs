import * as fs from "node:fs";
import * as THREE from "three";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import opentype from "opentype.js";

// three's GLTFExporter reads the binary chunk through a FileReader; node has none.
globalThis.FileReader ??= class {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((buffer) => {
      this.result = buffer;
      this.onloadend?.();
    });
  }
};

const FONT = "/tmp/inter600.ttf";
const OUT = process.argv[2] ?? "/tmp/wg.glb";
const TEXT = "WG.";
const SIZE = 100;
const DEPTH = 0.14; // relative to SIZE; a slab, not a block
const TRACKING = -0.05; // em, matches the h1's tight tracking

const font = opentype.parse(fs.readFileSync(FONT).buffer);

// Lay out the glyphs with tracking, then pull every contour into one flat list.
const contours = [];
let x = 0;
for (const ch of TEXT) {
  const glyph = font.charToGlyph(ch);
  const path = glyph.getPath(x, 0, SIZE);
  let current = null;
  for (const cmd of path.commands) {
    switch (cmd.type) {
      case "M":
        current = [{ x: cmd.x, y: -cmd.y }];
        contours.push(current);
        break;
      case "L":
        current.push({ x: cmd.x, y: -cmd.y });
        break;
      case "C":
        current.push({ c: [cmd.x1, -cmd.y1, cmd.x2, -cmd.y2], x: cmd.x, y: -cmd.y });
        break;
      case "Q":
        current.push({ q: [cmd.x1, -cmd.y1], x: cmd.x, y: -cmd.y });
        break;
      case "Z":
        current = null;
        break;
    }
  }
  x += (glyph.advanceWidth / font.unitsPerEm) * SIZE + TRACKING * SIZE;
}

const signedArea = (c) => {
  let a = 0;
  for (let i = 0; i < c.length; i++) {
    const p = c[i];
    const n = c[(i + 1) % c.length];
    a += p.x * n.y - n.x * p.y;
  }
  return a / 2;
};

const bounds = (c) => {
  const xs = c.map((p) => p.x);
  const ys = c.map((p) => p.y);
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
};

const inside = (c, outer) => {
  const b = bounds(c);
  const o = bounds(outer);
  return b.x0 >= o.x0 && b.x1 <= o.x1 && b.y0 >= o.y0 && b.y1 <= o.y1;
};

// Largest contours are outlines; anything nested inside one is a counter (hole).
const ranked = contours.map((c) => ({ points: c, area: Math.abs(signedArea(c)) })).sort((a, b) => b.area - a.area);
const outers = [];
for (const c of ranked) {
  const parent = outers.find((o) => inside(c.points, o.points));
  if (parent) (parent.holes ??= []).push(c);
  else outers.push({ ...c, holes: [] });
}

const trace = (target, pts) => {
  target.moveTo(pts[0].x, pts[0].y);
  for (const p of pts.slice(1)) {
    if (p.c) target.bezierCurveTo(p.c[0], p.c[1], p.c[2], p.c[3], p.x, p.y);
    else if (p.q) target.quadraticCurveTo(p.q[0], p.q[1], p.x, p.y);
    else target.lineTo(p.x, p.y);
  }
  target.closePath();
};

const shapes = outers.map((o) => {
  const shape = new THREE.Shape();
  trace(shape, o.points);
  shape.holes = o.holes.map((h) => {
    const hole = new THREE.Path();
    trace(hole, h.points);
    return hole;
  });
  return shape;
});

const geometry = new THREE.ExtrudeGeometry(shapes, {
  depth: DEPTH * SIZE,
  bevelEnabled: true,
  bevelThickness: SIZE * 0.012,
  bevelSize: SIZE * 0.012,
  bevelSegments: 2,
  curveSegments: 6,
});
geometry.deleteAttribute("uv"); // particles never sample a texture
geometry.center();
geometry.computeVertexNormals();

// Normalise so the longest axis is 1 unit; the component scales from there.
geometry.computeBoundingBox();
const span = new THREE.Vector3();
geometry.boundingBox.getSize(span);
geometry.scale(1 / Math.max(span.x, span.y, span.z), 1 / Math.max(span.x, span.y, span.z), 1 / Math.max(span.x, span.y, span.z));

const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4, metalness: 0.1 }));
const scene = new THREE.Scene();
scene.add(mesh);

const glb = await new GLTFExporter().parseAsync(scene, { binary: true });
fs.writeFileSync(OUT, Buffer.from(glb));
console.log(`shapes: ${shapes.length}, holes: ${outers.map((o) => o.holes.length).join(",")}`);
console.log(`verts: ${geometry.attributes.position.count}, bytes: ${fs.statSync(OUT).size}`);
