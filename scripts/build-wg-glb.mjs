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
const FLATTEN = 8; // line segments per curve; the extruder flattens anyway
const EPS = 1e-9;

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
        current = new THREE.Path();
        current.moveTo(cmd.x, -cmd.y);
        contours.push(current);
        break;
      case "L":
        current.lineTo(cmd.x, -cmd.y);
        break;
      case "C":
        current.bezierCurveTo(cmd.x1, -cmd.y1, cmd.x2, -cmd.y2, cmd.x, -cmd.y);
        break;
      case "Q":
        current.quadraticCurveTo(cmd.x1, -cmd.y1, cmd.x, -cmd.y);
        break;
      case "Z":
        current = null;
        break;
    }
  }
  x += (glyph.advanceWidth / font.unitsPerEm) * SIZE + TRACKING * SIZE;
}

/** Flatten a contour to a closed ring: no repeated end point, no duplicate neighbours. */
const ring = (path) => {
  const points = path.getPoints(FLATTEN);
  if (points.length > 1 && points[points.length - 1].equals(points[0])) points.pop();
  return points;
};

/** Where two segments cross, ignoring touches at their end points. */
const crossing = (p1, p2, p3, p4) => {
  const d = (p2.x - p1.x) * (p4.y - p3.y) - (p2.y - p1.y) * (p4.x - p3.x);
  if (Math.abs(d) < EPS) return null;
  const t = ((p3.x - p1.x) * (p4.y - p3.y) - (p3.y - p1.y) * (p4.x - p3.x)) / d;
  const u = ((p3.x - p1.x) * (p2.y - p1.y) - (p3.y - p1.y) * (p2.x - p1.x)) / d;
  if (t <= EPS || t >= 1 - EPS || u <= EPS || u >= 1 - EPS) return null;
  return new THREE.Vector2(p1.x + t * (p2.x - p1.x), p1.y + t * (p2.y - p1.y));
};

/**
 * Font outlines are drawn for nonzero-winding rasterisers, so a contour may
 * overlap itself: Inter's "W" doubles back at all three notch apexes. earcut
 * needs a simple polygon and, handed one of these, emits overlapping triangles
 * that fill the notches — which the particle sampler then seeds with dots.
 * Pull each crossing back to a single point, discarding the smaller of the two
 * loops it forms.
 */
const unloop = (points) => {
  for (let guard = 0; guard < 32 && points.length > 3; guard++) {
    let cut = null;
    for (let i = 0; i < points.length - 2 && !cut; i++) {
      for (let j = i + 2; j < points.length; j++) {
        if (i === 0 && j === points.length - 1) continue; // these two meet at the seam
        const at = crossing(points[i], points[i + 1], points[j], points[(j + 1) % points.length]);
        if (at) {
          cut = { i, j, at };
          break;
        }
      }
    }
    if (!cut) break;
    const loop = points.slice(cut.i + 1, cut.j + 1);
    const rest = [...points.slice(cut.j + 1), ...points.slice(0, cut.i + 1)];
    const keep = Math.abs(THREE.ShapeUtils.area(loop)) < Math.abs(THREE.ShapeUtils.area(rest)) ? rest : loop;
    points = [...keep, cut.at];
  }
  return points;
};

/** Even-odd ray cast. Rings are simple by this point, so one vertex decides. */
const contains = (outer, p) => {
  let hit = false;
  for (let i = 0, j = outer.length - 1; i < outer.length; j = i++) {
    const a = outer[i];
    const b = outer[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) hit = !hit;
  }
  return hit;
};

// Largest rings are outlines; anything sitting inside one is a counter (hole).
const ranked = contours
  .map((c) => unloop(ring(c)))
  .map((points) => ({ points, area: Math.abs(THREE.ShapeUtils.area(points)) }))
  .sort((a, b) => b.area - a.area);
const outers = [];
for (const c of ranked) {
  const parent = outers.find((o) => contains(o.points, c.points[0]));
  if (parent) parent.holes.push(c);
  else outers.push({ ...c, holes: [] });
}

const shapes = outers.map((o) => {
  const shape = new THREE.Shape(o.points);
  shape.holes = o.holes.map((h) => new THREE.Path(h.points));
  return shape;
});

// earcut fails silently, so check every cap covers exactly the area it should.
const triangleArea = (a, b, c) => Math.abs((b.x - a.x) * (c.y - a.y) - (c.x - a.x) * (b.y - a.y)) / 2;
for (const [i, shape] of shapes.entries()) {
  const { shape: outline, holes } = shape.extractPoints();
  const vertices = [outline, ...holes].flat();
  const covered = THREE.ShapeUtils.triangulateShape(outline, holes).reduce(
    (sum, [a, b, c]) => sum + triangleArea(vertices[a], vertices[b], vertices[c]),
    0,
  );
  const expected = holes.reduce((sum, h) => sum - Math.abs(THREE.ShapeUtils.area(h)), Math.abs(THREE.ShapeUtils.area(outline)));
  const error = Math.abs(covered / expected - 1);
  console.log(`shape ${i}: area ${expected.toFixed(1)}, triangulated ${covered.toFixed(1)} (${(error * 100).toFixed(2)}% off)`);
  if (error > 0.005) throw new Error(`shape ${i} triangulated badly; the outline is probably still self-intersecting`);
}

const geometry = new THREE.ExtrudeGeometry(shapes, {
  depth: DEPTH * SIZE,
  bevelEnabled: true,
  bevelThickness: SIZE * 0.012,
  bevelSize: SIZE * 0.012,
  bevelSegments: 2,
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
