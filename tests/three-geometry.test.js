// The glass, built without a glass: the geometry a piece becomes.
//
// erno.js/three needs a WebGL context to DRAW, but building a piece's
// geometry is arithmetic over what the engine already published, so it is
// testable here, in node, with no canvas anywhere. That is the whole reason
// the builders live in their own module: the cubie shapes get proven rather
// than eyeballed.
import { Cube, Pyraminx } from "../src/erno.js";
import { bodyOf, roundingOf, shrinkSticker } from "../src/three-geometry.js";

let passed = 0;
let failed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ok — ${name}`);
  } catch (err) {
    failed++;
    console.error(`  FAIL — ${name}\n      ${err.message}`);
  }
}
function assert(cond, msg) {
  if (!cond) throw new Error(msg || "assertion failed");
}

const cornerOf = (puzzle) => {
  const pieces = puzzle.getPieces();
  return pieces.find((p) => p.faces.filter((f) => f.sticker).length === 3);
};

// ── The body ────────────────────────────────────────────────────────────────

test("a box cubie keeps the engine's own corners", () => {
  // The default shape is the mechanism's: whatever polygons came back, drawn
  // as they came. Nothing here may invent a vertex the engine did not name.
  const piece = cornerOf(new Cube({ size: 3 }));
  const body = bodyOf(piece, { cubie: "box" });
  const named = new Set(
    piece.faces.flatMap((f) => f.points).map((q) => q.map((v) => v.toFixed(6)).join()),
  );
  for (let i = 0; i < body.positions.length; i += 3) {
    const key = [body.positions[i], body.positions[i + 1], body.positions[i + 2]]
      .map((v) => v.toFixed(6))
      .join();
    assert(named.has(key), `vertex ${key} is not one the engine named`);
  }
  assert(body.positions.length > 0, "and there is a body at all");
});

test("a rounded cubie never leaves the box it replaces", () => {
  // Rounding takes material AWAY from the corners; it may not add any. If a
  // rounded voxel grew even slightly it would poke through its neighbour,
  // and on a solved cube that reads as a seam that should not be there.
  const piece = cornerOf(new Cube({ size: 3 }));
  const box = bodyOf(piece, { cubie: "box" });
  const round = bodyOf(piece, { cubie: "rounded" });
  const span = (b, k) => {
    let lo = Infinity;
    let hi = -Infinity;
    for (let i = k; i < b.positions.length; i += 3) {
      lo = Math.min(lo, b.positions[i]);
      hi = Math.max(hi, b.positions[i]);
    }
    return [lo, hi];
  };
  for (const k of [0, 1, 2]) {
    const [blo, bhi] = span(box, k);
    const [rlo, rhi] = span(round, k);
    assert(rlo >= blo - 1e-9, `axis ${k}: rounded starts at ${rlo}, box at ${blo}`);
    assert(rhi <= bhi + 1e-9, `axis ${k}: rounded ends at ${rhi}, box at ${bhi}`);
  }
});

test("a rounded cubie is not the engine's polygons", () => {
  // The point of the shape: it really is different geometry. A "rounded"
  // that quietly returned the box would satisfy the bound above forever.
  const piece = cornerOf(new Cube({ size: 3 }));
  const box = bodyOf(piece, { cubie: "box" });
  const round = bodyOf(piece, { cubie: "rounded" });
  assert(
    round.positions.length > box.positions.length,
    `rounded has ${round.positions.length / 3} vertices, box has ${box.positions.length / 3}`,
  );
});

test("a piece that is not a box is left exactly as the engine drew it", () => {
  // Rounding an arbitrary polyhedron is a different problem, and a guess at
  // it would silently reshape the mechanism. A Pyraminx's pieces are wedges,
  // so asking for "rounded" there must change nothing at all.
  const puzzle = new Pyraminx();
  const pieces = puzzle.getPieces();
  const wedges = pieces.filter((p) => !isABox(p));
  assert(wedges.length > 0, "the Pyraminx really does have non-box pieces");
  for (const piece of wedges) {
    const plain = bodyOf(piece, { cubie: "box" });
    const asked = bodyOf(piece, { cubie: "rounded" });
    assert(
      asked.positions.join() === plain.positions.join(),
      "a wedge asked to round came back changed",
    );
  }
});

test("a wall with no sticker can be dressed apart from the plastic", () => {
  // The hollows. A cubie's inner walls wear the same black as the grid
  // between stickers, which is right on a whole cube and reads as a PIT the
  // moment a neighbour is missing: the board turns into a dark mass and the
  // voxels lose their depth. The SVG stage rewrites those polygons after the
  // fact; against geometry the colour has to be decided as it is built.
  const piece = cornerOf(new Cube({ size: 3 }));
  const inner = piece.faces.filter((f) => !f.sticker);
  assert(inner.length === 3, `a corner has three inner walls, found ${inner.length}`);

  const plain = bodyOf(piece, { cubie: "box" });
  const dressed = bodyOf(piece, { cubie: "box", core: "#c8b7a0" });
  assert(
    dressed.colors.includes("#c8b7a0"),
    "the recess colour reaches the vertices of the inner walls",
  );
  const stickered = piece.faces.filter((f) => f.sticker);
  for (const f of stickered)
    assert(
      dressed.colors.includes(f.plastic),
      "and a wall that DOES carry a sticker keeps its own plastic",
    );
  assert(
    plain.colors.filter((c) => c === "#c8b7a0").length === 0,
    "asking for nothing dresses nothing",
  );
});

test("a sticker retreats from a rounded shoulder, and only then", () => {
  // The fringe. A sticker is lifted flat above its face, and on a rounded
  // body the face's outer band has RETREATED - so the sticker poked past
  // the silhouette and showed as slivers of colour off every edge. The cure
  // is the same subtraction the body made: pull the sticker toward its own
  // centre by the corner radius.
  const piece = cornerOf(new Cube({ size: 3 }));
  const r = roundingOf(piece, { cubie: "rounded" });
  assert(r > 0, "a box piece asked to round has a radius");
  assert(roundingOf(piece, { cubie: "box" }) === 0, "a box asked plain has none");

  const face = piece.faces.find((f) => f.sticker);
  const shrunk = shrinkSticker(face.sticker, r);
  const c = [0, 1, 2].map((k) => face.sticker.reduce((a, q) => a + q[k], 0) / face.sticker.length);
  const reach = (pts) => Math.max(...pts.map((q) => Math.hypot(q[0] - c[0], q[1] - c[1], q[2] - c[2])));
  const before = reach(face.sticker);
  const after = reach(shrunk);
  assert(after < before - r * 0.5, `it really retreats: ${before.toFixed(3)} -> ${after.toFixed(3)}, r=${r.toFixed(3)}`);
  assert(shrinkSticker(face.sticker, 0).every((q, i) => q.join() === face.sticker[i].join()),
    "and a radius of zero moves nothing");
});

// A box, decided the way a reader would: eight distinct corners, each one a
// corner of its own bounding box.
function isABox(piece) {
  const lo = [Infinity, Infinity, Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  const seen = new Set();
  for (const f of piece.faces)
    for (const q of f.points) {
      for (const k of [0, 1, 2]) {
        lo[k] = Math.min(lo[k], q[k]);
        hi[k] = Math.max(hi[k], q[k]);
      }
      seen.add(q.map((v) => v.toFixed(6)).join());
    }
  if (seen.size !== 8) return false;
  for (const key of seen) {
    const q = key.split(",").map(Number);
    for (const k of [0, 1, 2])
      if (Math.abs(q[k] - lo[k]) > 1e-6 && Math.abs(q[k] - hi[k]) > 1e-6) return false;
  }
  return true;
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
