/* ─────────────────────────────────────────────────────────────────────────
   The geometry a piece becomes.

   Split out of three.js so it can be PROVEN. Drawing needs a WebGL context
   and a canvas; deciding what a cubie's body is made of needs neither - it
   is arithmetic over the polygons the engine already published. Keeping the
   two apart is what lets the cubie shapes have real tests instead of being
   eyeballed in a browser.

   Nothing in this file knows about three.js. It answers in plain arrays,
   and the adapter turns those into buffers.
   ───────────────────────────────────────────────────────────────────── */

/**
 * The body of one piece: the solid under the stickers, as flat arrays.
 *
 * `box` - the default - is the mechanism's own answer, drawn exactly as it
 * came back. It invents nothing: every vertex is one the engine named.
 *
 * `rounded` softens the corners, and only where the piece REALLY IS a box:
 * a Pyraminx's wedge or a warped cubie is left exactly as it came, because
 * rounding an arbitrary polyhedron is a different problem and guessing at it
 * would quietly deform the mechanism.
 *
 * @param {Object} piece - one entry of `getPieces()`
 * @param {Object} [options]
 * @param {"box"|"rounded"} [options.cubie] - the shape of the solid
 * @param {number} [options.radius] - corner radius, as a fraction of the
 *   piece's smallest half extent (default 0.18)
 * @param {number} [options.segments] - quarter-round subdivisions (default 3)
 * @param {string} [options.core] - colour for walls that carry no sticker.
 *   Left unset they wear the piece's own plastic, which is honest on a whole
 *   board and reads as a pit the moment a neighbour is missing.
 * @returns {{positions: number[], colors: number[], index: number[]}}
 */
export function bodyOf(piece, options = {}) {
  if (options.cubie === "rounded") {
    const box = boxOf(piece);
    if (box) return roundedBody(piece, box, options);
  }
  const positions = [];
  const colors = [];
  const index = [];

  for (const face of piece.faces) {
    const base = positions.length / 3;
    // A wall with no sticker is the inside of the mechanism: `core` in the
    // SVG's own vocabulary. It is the same black as the grid between
    // stickers, and dressing it warm is what stops a carved board, a board
    // mid-assembly and a shell mid-bloom from reading as a hole.
    const colour = !face.sticker && options.core ? options.core : face.plastic;
    for (const q of face.points) {
      positions.push(q[0], q[1], q[2]);
      colors.push(colour);
    }
    for (let i = 1; i + 1 < face.points.length; i++)
      index.push(base, base + i, base + i + 1);
  }

  return { positions, colors, index };
}

/**
 * The axis-aligned box this piece IS, or null if it is not one.
 *
 * Not "the box it fits inside": every solid has one of those. The question
 * is whether the piece's own corners are exactly the corners of their own
 * bounding box, which is what makes replacing it with a rounded box an
 * honest substitution rather than a reshaping.
 */
function boxOf(piece) {
  const lo = [Infinity, Infinity, Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  const seen = new Set();
  for (const face of piece.faces) {
    for (const q of face.points) {
      for (const k of [0, 1, 2]) {
        lo[k] = Math.min(lo[k], q[k]);
        hi[k] = Math.max(hi[k], q[k]);
      }
      seen.add(q.map((v) => v.toFixed(6)).join());
    }
  }
  if (seen.size !== 8) return null; // more corners than a box has
  const EPS = 1e-6;
  for (const key of seen) {
    const q = key.split(",").map(Number);
    for (const k of [0, 1, 2])
      if (Math.abs(q[k] - lo[k]) > EPS && Math.abs(q[k] - hi[k]) > EPS) return null;
  }
  const half = [0, 1, 2].map((k) => (hi[k] - lo[k]) / 2);
  if (half.some((h) => h <= EPS)) return null; // flat: nothing to round
  return { centre: [0, 1, 2].map((k) => (lo[k] + hi[k]) / 2), half };
}

// The six faces of a box, as an outward normal and the two directions that
// span it, so one grid routine serves all of them.
const BOX_FACES = [
  { n: [1, 0, 0], u: [0, 1, 0], v: [0, 0, 1] },
  { n: [-1, 0, 0], u: [0, 0, 1], v: [0, 1, 0] },
  { n: [0, 1, 0], u: [0, 0, 1], v: [1, 0, 0] },
  { n: [0, -1, 0], u: [1, 0, 0], v: [0, 0, 1] },
  { n: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0] },
  { n: [0, 0, -1], u: [0, 1, 0], v: [1, 0, 0] },
];

/**
 * A rounded box, as the Minkowski sum of a smaller box and a sphere.
 *
 * Every surface point is `clamp(p, -(half - r)) + r * dir`, with `dir` a unit
 * vector: on a face it is the face normal and the point sits exactly on the
 * original plane; toward an edge or a corner it swings around, and the point
 * moves INWARD. That is the property worth having - a rounded voxel can
 * never grow past the box it replaces, so it can never poke through the
 * neighbour standing beside it.
 */
function roundedBody(piece, box, options) {
  const seg = Math.max(1, Math.round(options.segments ?? 3));
  const ratio = Math.max(0, Math.min(0.5, options.radius ?? 0.18));
  const r = Math.min(...box.half) * ratio;
  const core = box.half.map((h) => Math.max(0, h - r));

  const positions = [];
  const colors = [];
  const index = [];
  // A face's plastic, taken from the piece's own face pointing that way, so
  // a body painted per-face keeps its painting.
  const plasticFacing = (n) => {
    let best = null;
    let bestDot = -Infinity;
    for (const face of piece.faces) {
      const d = face.normal[0] * n[0] + face.normal[1] * n[1] + face.normal[2] * n[2];
      if (d > bestDot) {
        bestDot = d;
        best = face;
      }
    }
    return best ? best.plastic : "#000000";
  };

  for (const { n, u, v } of BOX_FACES) {
    const plastic = plasticFacing(n);
    const base = positions.length / 3;
    for (let i = 0; i <= seg; i++) {
      for (let j = 0; j <= seg; j++) {
        // a point on the original face, in the box's own frame
        const a = (i / seg) * 2 - 1;
        const b = (j / seg) * 2 - 1;
        const p = [0, 1, 2].map(
          (k) => n[k] * box.half[k] + u[k] * a * box.half[k] + v[k] * b * box.half[k],
        );
        const c = [0, 1, 2].map((k) => Math.max(-core[k], Math.min(core[k], p[k])));
        const d = [0, 1, 2].map((k) => p[k] - c[k]);
        const len = Math.hypot(d[0], d[1], d[2]) || 1;
        positions.push(
          box.centre[0] + c[0] + (d[0] / len) * r,
          box.centre[1] + c[1] + (d[1] / len) * r,
          box.centre[2] + c[2] + (d[2] / len) * r,
        );
        colors.push(plastic);
      }
    }
    for (let i = 0; i < seg; i++) {
      for (let j = 0; j < seg; j++) {
        const a = base + i * (seg + 1) + j;
        const b = a + 1;
        const c = a + seg + 1;
        const d = c + 1;
        index.push(a, c, b, b, c, d);
      }
    }
  }

  return { positions, colors, index };
}

/**
 * The corner radius this piece would round with, in world units - and 0
 * when it would not round at all (a plain box asked for, or a piece that
 * is not a box). One answer shared by the body builder and the sticker
 * dressers, so the two can never disagree about how far a shoulder went.
 */
export function roundingOf(piece, options = {}) {
  if (options.cubie !== "rounded") return 0;
  const box = boxOf(piece);
  if (!box) return 0;
  const ratio = Math.max(0, Math.min(0.5, options.radius ?? 0.18));
  return Math.min(...box.half) * ratio;
}

/**
 * A sticker pulled toward its own centre by `r`.
 *
 * The sticker is lifted flat above its face, and on a rounded body the
 * face's outer band has retreated by the corner radius - a sticker left
 * at full size pokes past the silhouette and reads as slivers of colour
 * off every edge. The retreat is per vertex, along the vertex's own
 * direction from the sticker's centre, so a rectangular sticker keeps
 * its proportions.
 */
export function shrinkSticker(points, r) {
  if (!r) return points;
  const c = [0, 1, 2].map((k) => points.reduce((a, q) => a + q[k], 0) / points.length);
  return points.map((q) => {
    const d = [q[0] - c[0], q[1] - c[1], q[2] - c[2]];
    const len = Math.hypot(...d);
    if (len <= r) return [c[0], c[1], c[2]];
    const k = (len - r) / len;
    return [c[0] + d[0] * k, c[1] + d[1] * k, c[2] + d[2] * k];
  });
}
