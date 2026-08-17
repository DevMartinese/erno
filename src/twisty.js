/**
 * erno/twisty.js — a generic engine for twisty puzzles rendered to SVG.
 *
 * The piece-based counterpart of the N×N facelet cube in erno.js, following
 * the architecture proven by cubing.js's KPuzzle + PuzzleGeometry:
 *
 * - Geometry is GENERATED, not hand-authored: a puzzle definition supplies a
 *   base solid (its outer faces, stickered with face letters) plus a set of
 *   cut planes; the engine slices the solid into convex pieces.
 * - State is EXACT: each piece carries a rotation from the puzzle's finite
 *   symmetry group, stored as an integer signed-permutation matrix and
 *   composed with integer matrix products — no float drift, so
 *   scramble + inverse restores the solved state bit for bit.
 * - Rendering transforms each piece's solved polygons by its current
 *   rotation and feeds them through the shared pipeline in render.js.
 *   Layer animation adds a continuous rotation on top for the moving set —
 *   same `turn: { move, progress }` contract as the cube.
 *
 * Pieces distinguish a LOGICAL position (`slotPoint`, in a normalized
 * symmetric space used for move selection and facelet bookkeeping) from
 * their PHYSICAL geometry (used only for drawing). For most puzzles the two
 * coincide; for shape-shifters like the Mirror cube the slot space is the
 * uniform 3×3 grid while the drawn blocks are uneven.
 */

import {
  makeProjector,
  buildSvgAttributes,
  projectPolygon,
  pointsAttr,
  boundsViewBox,
  sphereViewBox,
  openSvgTag,
  t4,
} from "./render.js";

// ── Cube notation (shared with erno.js and the cube-shaped variants) ────────

export const FACES = ["U", "R", "F", "D", "L", "B"];

export const CUBE_COLORS = {
  U: "#ffffff",
  R: "#b71234",
  F: "#009b48",
  D: "#ffd500",
  L: "#ff5800",
  B: "#0046ad",
};

// face letter → [axis (0=x,1=y,2=z), dir (+1 = R/U/F sense), highEnd]
export const FACE_AXIS = {
  R: [0, 1, true],
  L: [0, -1, false],
  U: [1, 1, true],
  D: [1, -1, false],
  F: [2, 1, true],
  B: [2, -1, false],
};

// slice letter → [axis, dir] (M follows L, E follows D, S follows F)
export const SLICE_AXIS = { M: [0, -1], E: [1, -1], S: [2, 1] };

// rotation letter → [axis, dir] (x follows R, y follows U, z follows F)
export const ROT_AXIS = { x: [0, 1], y: [1, 1], z: [2, 1] };

// Sign of the continuous rotation angle per axis such that
// angle = SPIN_SIGN[axis] * (π/2) matches one positive discrete quarter turn.
export const SPIN_SIGN = [-1, 1, -1];

const MOVE_RE = /^(\d+)?([RUFDLBrufdlbMESxyz])(w?)(\d*)('?)$/;

/**
 * Parse one cube-notation token against per-axis layer counts (a cuboid).
 * Returns {axis, lo, hi, quarters}. Supported: face turns (R U F D L B),
 * primes and doubles (R', R2, R2'), wide turns (Rw, r, 3Rw, 3r), slices
 * (M E S, odd layer counts only) and whole-puzzle rotations (x y z).
 */
export function parseBoxMove(token, dims) {
  const m = MOVE_RE.exec(token);
  if (!m) throw new Error(`erno: bad move '${token}'`);
  const [, prefix, rawLetter, w, countStr, prime] = m;
  const count = countStr ? parseInt(countStr, 10) : 1;
  const sign = prime ? -1 : 1;

  if (ROT_AXIS[rawLetter]) {
    if (prefix || w)
      throw new Error(`erno: rotations take no prefix/w: '${token}'`);
    const [axis, dir] = ROT_AXIS[rawLetter];
    return { axis, lo: 0, hi: dims[axis] - 1, quarters: dir * count * sign };
  }
  if (SLICE_AXIS[rawLetter]) {
    if (prefix || w)
      throw new Error(`erno: slices take no prefix/w: '${token}'`);
    const [axis, dir] = SLICE_AXIS[rawLetter];
    const N = dims[axis];
    if (N % 2 === 0)
      throw new Error(`erno: '${rawLetter}' needs an odd cube (size ${N})`);
    const mid = (N - 1) / 2;
    return { axis, lo: mid, hi: mid, quarters: dir * count * sign };
  }

  const upper = rawLetter.toUpperCase();
  const wide = w === "w" || rawLetter !== upper || !!prefix;
  const n = prefix ? parseInt(prefix, 10) : wide ? 2 : 1;
  const [axis, dir, highEnd] = FACE_AXIS[upper];
  const N = dims[axis];
  if (n < 1 || n > N)
    throw new Error(`erno: layer count ${n} out of range for size ${N}`);
  const lo = highEnd ? N - n : 0;
  const hi = highEnd ? N - 1 : n - 1;
  return { axis, lo, hi, quarters: dir * count * sign };
}

/** parseBoxMove specialized to an N×N×N cube. */
export function parseCubeMove(token, N) {
  return parseBoxMove(token, [N, N, N]);
}

/** Split a sequence string into move tokens. */
export function tokenize(sequence) {
  return String(sequence).trim().split(/[\s,]+/).filter(Boolean);
}

/** Invert a move sequence: inverseSequence("R U2 f'") → "f U2 R'". */
export function inverseSequence(sequence) {
  return tokenize(sequence)
    .reverse()
    .map((tok) => {
      if (/2'?$/.test(tok)) return tok.replace(/2'?$/, "2");
      return tok.endsWith("'") ? tok.slice(0, -1) : tok + "'";
    })
    .join(" ");
}

// ── Vectors and rotation matrices ───────────────────────────────────────────

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const vlen = (a) => Math.sqrt(dot(a, a));
const norm = (a) => {
  const l = vlen(a);
  return [a[0] / l, a[1] / l, a[2] / l];
};

const IDENT = [
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1],
];

const ORIGIN = [0, 0, 0];

const matVec = (m, v) => [dot(m[0], v), dot(m[1], v), dot(m[2], v)];

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

/**
 * Offset of a rotation that turns about `center` instead of the origin:
 * p → M·p + t with t = center − M·center. Every puzzle here used to turn
 * about one global point, which a single matrix per piece can carry. A
 * fused puzzle cannot — each welded body turns about its own centre — so
 * a piece's placement is a matrix AND a translation.
 */
const offsetFor = (M, center) =>
  center === ORIGIN ? ORIGIN : sub(center, matVec(M, center));

function matMul(a, b) {
  const r = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++)
      r[i][j] = a[i][0] * b[0][j] + a[i][1] * b[1][j] + a[i][2] * b[2][j];
  return r;
}

/** Rodrigues rotation matrix about a unit axis (right-handed, radians). */
export function rotationMatrix(axis, angle) {
  const [x, y, z] = axis;
  const c = Math.cos(angle),
    s = Math.sin(angle),
    t = 1 - c;
  return [
    [c + x * x * t, x * y * t - z * s, x * z * t + y * s],
    [y * x * t + z * s, c + y * y * t, y * z * t - x * s],
    [z * x * t - y * s, z * y * t + x * s, c + z * z * t],
  ];
}

/**
 * Round near-integer entries so group rotations (90°/120° about symmetry
 * axes) become exact signed-permutation matrices — the source of the
 * engine's drift-free state.
 */
function snapMatrix(m) {
  return m.map((row) =>
    row.map((v) => (Math.abs(v - Math.round(v)) < 1e-9 ? Math.round(v) : v)),
  );
}

// ── Convex cell slicing ─────────────────────────────────────────────────────

const EPS = 1e-9;
const qk = (v) => Math.round(v * 1e5) / 1e5;
const keyOf = (p) => `${qk(p[0])},${qk(p[1])},${qk(p[2])}`;

function centroidOf(pts) {
  let x = 0,
    y = 0,
    z = 0;
  for (const p of pts) {
    x += p[0];
    y += p[1];
    z += p[2];
  }
  const n = pts.length;
  return [x / n, y / n, z / n];
}

/** Newell normal of a planar polygon (unit length, follows winding). */
function polygonNormal(pts) {
  let x = 0,
    y = 0,
    z = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i],
      b = pts[(i + 1) % pts.length];
    x += (a[1] - b[1]) * (a[2] + b[2]);
    y += (a[2] - b[2]) * (a[0] + b[0]);
    z += (a[0] - b[0]) * (a[1] + b[1]);
  }
  return norm([x, y, z]);
}

/**
 * Split a convex cell (array of faces {pts, letter}) by a plane {n, d}.
 * Returns {below, above} or null when the plane misses the cell. Cut cross
 * sections become new letter-less (plastic) cap faces on both halves.
 */
function splitCell(faces, plane) {
  const { n, d } = plane;
  const below = [],
    above = [];
  const capPts = new Map();
  let anyBelow = false,
    anyAbove = false;

  for (const face of faces) {
    const pts = face.pts;
    const sides = pts.map((p) => dot(p, n) - d);
    const bp = [],
      ap = [];
    for (let i = 0; i < pts.length; i++) {
      const j = (i + 1) % pts.length;
      const si = sides[i],
        sj = sides[j];
      const pi = pts[i];
      if (si <= EPS) bp.push(pi);
      if (si >= -EPS) ap.push(pi);
      if (Math.abs(si) <= EPS) capPts.set(keyOf(pi), pi);
      if ((si < -EPS && sj > EPS) || (si > EPS && sj < -EPS)) {
        const t = si / (si - sj);
        const pj = pts[j];
        const q = [
          pi[0] + (pj[0] - pi[0]) * t,
          pi[1] + (pj[1] - pi[1]) * t,
          pi[2] + (pj[2] - pi[2]) * t,
        ];
        bp.push(q);
        ap.push(q);
        capPts.set(keyOf(q), q);
      }
      if (si < -EPS) anyBelow = true;
      if (si > EPS) anyAbove = true;
    }
    if (bp.length >= 3) below.push({ pts: bp, letter: face.letter });
    if (ap.length >= 3) above.push({ pts: ap, letter: face.letter });
  }

  if (!anyBelow || !anyAbove) return null;

  const cap = [...capPts.values()];
  if (cap.length >= 3) {
    const c = centroidOf(cap);
    const e1 = norm(sub(cap[0], c));
    const e2 = cross(n, e1);
    const angle = (p) => {
      const v = sub(p, c);
      return Math.atan2(dot(v, e2), dot(v, e1));
    };
    cap.sort((p, q) => angle(p) - angle(q));
    below.push({ pts: cap, letter: null }); // outward +n
    above.push({ pts: [...cap].reverse(), letter: null }); // outward -n
  }
  return { below, above };
}

/** Slice a solid (faces of a convex polyhedron) by a list of planes. */
export function slicePieces(solidFaces, planes) {
  let cells = [solidFaces];
  for (const plane of planes) {
    const next = [];
    for (const cell of cells) {
      const s = splitCell(cell, plane);
      if (!s) next.push(cell);
      else next.push(s.below, s.above);
    }
    cells = next;
  }
  return cells;
}

/**
 * Normalise the `remove` option into one predicate.
 *
 * - a function: `({ slot, stickers, piece, centroid }) => boolean`
 * - `"centers"`: the face centres, which is what makes a Void
 * - `{ box: [[x0,y0,z0], [x1,y1,z1]] }`: everything inside that region of
 *   slot space, the closest thing here to heerich's subtract
 */
/**
 * Internal walls between fragments of one rigid piece (coincident plastic
 * faces) can never be seen — hide them from rendering while keeping them
 * for the fragment hulls.
 */
/** The slot a sticker calls home — its piece's, unless bandaging moved it. */
const homeSlot = (piece, face) =>
  face.slotShift ? add(piece.slotPoint, face.slotShift) : piece.slotPoint;

/**
 * The affine transform that lays a unit square onto a projected sticker.
 *
 * Every camera here but the perspective one is a PARALLEL projection, so a
 * flat square comes out a parallelogram and three corners fix the map
 * exactly. Corner 0 is the origin, corner 1 the x edge, corner 3 the y edge.
 * Returns null for anything that is not a quadrilateral.
 */
function unitSquareTo(points, u, v) {
  if (!points || points.length !== 8 || !u || !v) return null;
  const px = (i) => [points[i * 2], points[i * 2 + 1]];
  const p0 = px(0);
  const sub2 = (a, b) => [a[0] - b[0], a[1] - b[1]];
  const dot2 = (a, b) => a[0] * b[0] + a[1] * b[1];
  const eA = sub2(px(1), p0);
  const eB = sub2(px(3), p0);
  // The sticker is a parallelogram, so its two edges ARE the basis — reading
  // the corners into a bounding box instead inflates it wherever the two
  // directions are not square on screen, which on a cube's top face is
  // always: +x and +z both lean, and the mark spills off its own tile.
  let col = Math.abs(dot2(eA, u)) >= Math.abs(dot2(eB, u)) ? eA : eB;
  let row = col === eA ? eB : eA;
  let ox = p0[0],
    oy = p0[1];
  if (dot2(col, u) < 0) {
    ox += col[0];
    oy += col[1];
    col = [-col[0], -col[1]];
  }
  if (dot2(row, v) < 0) {
    ox += row[0];
    oy += row[1];
    row = [-row[0], -row[1]];
  }
  return `matrix(${t4(col[0])} ${t4(col[1])} ${t4(row[0])} ${t4(row[1])} ${t4(ox)} ${t4(oy)})`;
}

/** Screen-space unit vector of a world direction, as this piece now sits. */
function screenDir(dir, M, view, at, proj) {
  const w = matVec(view, matVec(M, dir));
  const r = [at[0] + w[0], at[1] - w[1], at[2] - w[2]];
  const a = proj.point(at[0], at[1], at[2]);
  const b = proj.point(r[0], r[1], r[2]);
  const dx = b[0] - a[0],
    dy = b[1] - a[1];
  const len = Math.hypot(dx, dy);
  return len < 1e-9 ? null : [dx / len, dy / len];
}

function hideInnerWalls(piece) {
  if (piece.fragments.length < 2) return;
  const counts = new Map();
  const faceKey = (f) => f.pts.map(keyOf).sort().join("|");
  for (const f of piece.faces)
    if (!f.letter) counts.set(faceKey(f), (counts.get(faceKey(f)) || 0) + 1);
  for (const f of piece.faces)
    if (!f.letter && counts.get(faceKey(f)) > 1) f.hidden = true;
}

/**
 * Normalise the `bandage` option into one grouping function: pieces that
 * answer with the same non-null key are welded into a single rigid piece.
 *
 * - a function: `({ slot, piece, centroid }) => key | null`
 * - a list of slot groups: `[[[1,1,1],[1,1,0]], ...]`
 */
function normalizeBandage(bandage) {
  if (!bandage) return null;
  if (typeof bandage === "function") return bandage;
  if (Array.isArray(bandage)) {
    const groupOf = new Map();
    bandage.forEach((group, gi) => {
      if (!Array.isArray(group) || group.length < 2)
        throw new Error(`erno: bandage group ${gi} needs at least two slots`);
      for (const slot of group) groupOf.set(keyOf(slot), `g${gi}`);
    });
    return ({ slot }) => groupOf.get(keyOf(slot)) ?? null;
  }
  throw new Error(
    `erno: bandage takes a list of slot groups, or ({ slot }) => group key`,
  );
}

function normalizeRemove(remove) {
  if (!remove) return null;
  if (typeof remove === "function") return remove;
  if (remove === "centers")
    // a face centre is the only piece with two zero slot coordinates
    return ({ slot }) => slot.filter((v) => Math.abs(v) < 1e-6).length >= 2;
  if (remove === "core") return ({ stickers }) => stickers === 0;
  if (remove && Array.isArray(remove.box)) {
    const [lo, hi] = remove.box;
    return ({ slot }) => slot.every((v, i) => v >= lo[i] - 1e-6 && v <= hi[i] + 1e-6);
  }
  throw new Error(
    `erno: remove takes a function, "centers", or { box: [[x,y,z],[x,y,z]] }`,
  );
}

// ── The engine ──────────────────────────────────────────────────────────────

export class Twisty {
  /**
   * @param {Object} def - Puzzle definition:
   *   solid:        outer faces [{letter, pts}] of a convex solid, centered
   *                 on the origin (winding is auto-corrected to face outward)
   *   cuts:         slicing planes [{n: [x,y,z], d}]
   *   moves:        token → {axis, angle, min, max?}: rotation by `angle`
   *                 about unit `axis` of every piece whose slotPoint·axis
   *                 lies in (min, max)
   *   parseMove:    optional custom token parser → {axis, angle, min, max?}
   *   faceOrder:    face letters in canonical getState() order
   *   faceSortDirs: letter → [primary, secondary] sort directions for the
   *                 within-face reading order
   *   colors:       letter → default fill
   *   view:         optional 3×3 display-only orientation matrix
   *   slotPointOf:  optional (centroid) → logical position (defaults to the
   *                 physical centroid; shape-shifters map to a uniform grid)
   *   keepPiece:    optional (slotPoint, stickerCount) → boolean
   *   scramble:     (randomFn) → sequence string
   *   camera:       default camera spec
   * @param {Object} [options] - tile, camera, colors, plastic, stickerInset,
   *   style — same semantics as the Erno cube.
   */
  constructor(def, options = {}) {
    this.def = def;
    this.name = def.name;
    this.tile = options.tile || 40;
    this.colors = { ...def.colors, ...(options.colors || {}) };
    this.plastic = options.plastic || def.plastic || "#0d0d0d";
    this.stickerInset =
      options.stickerInset === undefined ? 0.12 : options.stickerInset;
    // Subtraction, the sibling of heerich's removeGeometry: drop whole
    // pieces and the engine draws the interior walls they leave behind, so
    // the holes go all the way through. A predicate, a named region, or a
    // box in slot space.
    this._remove = normalizeRemove(options.remove);
    // Grouped stickers: several facets of one piece drawn as a single tile.
    // Curved bodies need it (the Twist cube's strips); so does a bandaged
    // block, where it is what makes the glue visible — the welded cubies
    // wear one sticker per face instead of a grid pretending they can come
    // apart.
    this._stickerGroup =
      options.stickerGroup === undefined
        ? !!def.stickerGroup
        : !!options.stickerGroup;
    // A decal is a MARK on a sticker, where paint is a colour. Dice pips,
    // sudoku digits and the Domino's spots are all the same puzzle
    // underneath and differ only in what is printed on the plastic, so they
    // are a decoration rather than a mechanism — the same argument that made
    // Tetris a paint. The callback returns SVG drawn in a unit square and
    // the engine lays it onto the sticker, so a mark turns with its piece
    // exactly as a printed one does.
    this._decal =
      typeof options.decal === "object" && options.decal !== null
        ? ({ face, index }) => {
            const row = options.decal[face];
            return Array.isArray(row) ? row[index] : row;
          }
        : options.decal || null;
    this._bandage = normalizeBandage(
      options.bandage === undefined ? def.bandage : options.bandage,
    );
    // Blocking: refuse a turn whose layer would not come back to itself. A
    // definition asks for it — a Siamese cube is nothing but its blocked
    // turns — and bandaging is pointless without it, since the whole point
    // of a glued pair is the turns it forbids. A caller can force it either
    // way.
    this._blocking =
      options.blocking === undefined
        ? !!def.blocking || !!this._bandage
        : !!options.blocking;
    // `paint` may be a callback, or — for painting by hand — a plain map of
    // face letter to colours in the same reading order getState() uses, with
    // a hole anywhere a sticker should keep its face colour.
    this._paint =
      typeof options.paint === "object" && options.paint !== null
        ? ({ face, index }) => {
            const row = options.paint[face];
            return Array.isArray(row) ? row[index] : row;
          }
        : options.paint || null;
    this._styleFn = null;
    this._styleObj = null;
    if (options.style) this.style(options.style);

    this._build();
    this.reset();

    // A painted puzzle is solved by its PATTERN, not by its facelets: with
    // solid-coloured cubies, two pieces of the same colour are
    // interchangeable and orientation stops mattering — exactly like the
    // real Tetris cube. Remember the factory pattern so isSolved() can
    // compare against it.
    if (this._paint || def.paint) this._solvedTints = this.getTints().join();
    this.setCamera(options.camera || def.camera || { type: "isometric", angle: 30 });
  }

  // ── Geometry construction ────────────────────────────────────────────────

  _build() {
    const def = this.def;
    // Physical rotations happen about the puzzle's mechanism center — the
    // origin for symmetric puzzles, offset for shape-shifters like the
    // Mirror cube (logical slot space always rotates about the origin).
    this._pivot = def.pivot || [0, 0, 0];
    // A puzzle may be one convex solid or several (e.g. the Twist cube's
    // yawed slabs, whose union is not convex). Winding is corrected to face
    // outward from each solid's own centroid.
    const solids = (def.solids || [def.solid]).map((source) => {
      const center = centroidOf(source.flatMap((f) => f.pts));
      return source.map((f) => {
        const n = polygonNormal(f.pts);
        const c = centroidOf(f.pts);
        return dot(n, sub(c, center)) >= 0
          ? f
          : { ...f, pts: [...f.pts].reverse() };
      });
    });

    // Where the drawing is centred, and how far it can ever reach from
    // there. A puzzle built around the origin centres on the origin, which
    // is every puzzle here but the welded ones: those sit off to one side,
    // and centring on the origin would leave them hanging in a corner of
    // their own frame. The reach has to cover every turn centre the puzzle
    // has, since a point turning about one of those stays within its own
    // distance of it — that is what keeps the viewBox from clipping
    // mid-turn.
    const verts = [];
    for (const solid of solids) for (const f of solid) verts.push(...f.pts);
    const lo = [Infinity, Infinity, Infinity];
    const hi = [-Infinity, -Infinity, -Infinity];
    for (const p of verts)
      for (let i = 0; i < 3; i++) {
        if (p[i] < lo[i]) lo[i] = p[i];
        if (p[i] > hi[i]) hi[i] = p[i];
      }
    const mid = [0, 1, 2].map((i) => (lo[i] + hi[i]) / 2);
    this._viewCenter = mid.every((v) => Math.abs(v) < 1e-9) ? ORIGIN : mid;
    let radius = 0;
    for (const c of def.turnCenters ? [this._pivot, ...def.turnCenters] : [this._pivot]) {
      let reach = 0;
      for (const p of verts) reach = Math.max(reach, vlen(sub(p, c)));
      radius = Math.max(radius, vlen(sub(c, this._viewCenter)) + reach);
    }
    this._radius = radius;

    // normal → position face letter
    this._faceOfNormal = new Map();
    for (const solid of solids)
      for (const f of solid)
        if (f.letter) this._faceOfNormal.set(keyOf(polygonNormal(f.pts)), f.letter);

    // Fusion — the union, and the sibling of `remove`'s subtraction. Where
    // two bodies overlap, the wall between them is not a wall: a lettered
    // facet buried inside another body was never on the outside, so it
    // stops being a sticker, and a cell both bodies produce is one cell
    // rather than two coincident ones. Bodies that merely touch — the Twist
    // cube's stacked strips — are left alone, because nothing of theirs
    // lies strictly inside anything.
    const planesOf = solids.map((s) =>
      s.map((f) => ({ n: polygonNormal(f.pts), p0: f.pts[0] })),
    );
    const buried = (p, self) =>
      planesOf.some(
        (planes, k) =>
          k !== self && planes.every((pl) => dot(sub(p, pl.p0), pl.n) < -1e-6),
      );

    const cells = [];
    const seenCell = new Set();
    solids.forEach((solid, si) => {
      for (const cell of slicePieces(solid, def.cuts)) {
        if (solids.length === 1) {
          cells.push(cell);
          continue;
        }
        const key = cell.flatMap((f) => f.pts.map(keyOf)).sort().join("|");
        if (seenCell.has(key)) continue;
        seenCell.add(key);
        cells.push(
          cell.map((f) =>
            f.letter && buried(centroidOf(f.pts), si)
              ? { ...f, letter: undefined }
              : f,
          ),
        );
      }
    });

    // One convex cell per slot is the common case, but a puzzle built from
    // several solids (e.g. the Twist cube's thin curved strips) produces
    // multiple cells per slot: merge them into one piece that moves rigidly,
    // remembering the convex fragments for the painter's separation tests.
    const bySlot = new Map();
    for (const cell of cells) {
      const faces = cell.map((f) => ({
        pts: f.pts,
        letter: f.letter,
        normal: polygonNormal(f.pts),
        centroid: centroidOf(f.pts),
      }));
      const verts = [];
      const seen = new Set();
      for (const f of faces)
        for (const p of f.pts) {
          const k = keyOf(p);
          if (!seen.has(k)) {
            seen.add(k);
            verts.push(p);
          }
        }
      const centroid = centroidOf(verts);
      const slotPoint = def.slotPointOf ? def.slotPointOf(centroid) : centroid;
      const key = keyOf(slotPoint);
      let piece = bySlot.get(key);
      if (!piece) {
        piece = { faces: [], fragments: [], allVerts: [], slotPoint };
        bySlot.set(key, piece);
      }
      piece.fragments.push([piece.faces.length, piece.faces.length + faces.length]);
      piece.faces.push(...faces);
      piece.allVerts.push(...verts);
    }

    this.pieces = [];
    for (const piece of bySlot.values()) {
      const stickers = piece.faces.filter((f) => f.letter);
      if (stickers.length === 0) continue; // interior core
      if (def.keepPiece && !def.keepPiece(piece.slotPoint, stickers.length))
        continue;
      if (
        this._remove &&
        this._remove({
          slot: piece.slotPoint,
          stickers: stickers.length,
          piece,
          centroid: centroidOf(piece.allVerts),
        })
      )
        continue;
      piece.centroid = centroidOf(piece.allVerts);
      hideInnerWalls(piece);
      this.pieces.push(piece);
    }

    // Bandaging: weld neighbouring cubies into one rigid piece. Fusion joins
    // whole bodies; this joins cubies inside one, which is the other way a
    // twisty puzzle gets its blocked turns — a bandaged 3×3 is an ordinary
    // 3×3 whose glued pair straddles two layers, so neither can turn without
    // the other. The piece keeps a slot per cubie it fills; everything
    // downstream reads a sticker's own slot rather than its piece's.
    if (this._bandage) {
      const lead = new Map();
      const kept = [];
      for (const piece of this.pieces) {
        const group =
          this._bandage({ slot: piece.slotPoint, piece, centroid: piece.centroid }) ??
          null;
        const host = group === null ? null : lead.get(group);
        if (!host) {
          if (group !== null) {
            lead.set(group, piece);
            piece.slotShifts = [ORIGIN];
          }
          kept.push(piece);
          continue;
        }
        const shift = sub(piece.slotPoint, host.slotPoint);
        const base = host.faces.length;
        for (const f of piece.faces) {
          f.slotShift = shift;
          host.faces.push(f);
        }
        for (const [s, e] of piece.fragments) host.fragments.push([base + s, base + e]);
        host.allVerts.push(...piece.allVerts);
        host.slotShifts.push(shift);
      }
      for (const piece of kept)
        if (piece.slotShifts && piece.slotShifts.length > 1) {
          piece.centroid = centroidOf(piece.allVerts);
          hideInnerWalls(piece);
        }
      this.pieces = kept;
    }
    for (const piece of this.pieces) delete piece.allVerts;

    // Per-piece decoration, tinting stickers by piece rather than by face —
    // solid-colored cubies like Rubik's Tetris. A definition can bake one in
    // (`def.paint`, given the whole piece list), and a caller can supply one
    // per instance (`options.paint`, called once per sticker). Nothing about
    // this is specific to Tetris: it is a paint job, so any mechanism in the
    // library can wear any paint.
    if (def.paint) def.paint(this.pieces);

    // Canonical facelet order: by face, then reading order within the face.
    const stickers = [];
    for (let i = 0; i < this.pieces.length; i++) {
      const piece = this.pieces[i];
      for (const f of piece.faces)
        if (f.letter) stickers.push({ piece: i, face: f });
    }
    const rank = (letter) => def.faceOrder.indexOf(letter);
    const q3 = (v) => Math.round(v * 1e3);
    stickers.sort((a, b) => {
      const fa = rank(a.face.letter),
        fb = rank(b.face.letter);
      if (fa !== fb) return fa - fb;
      const [pa, sa] = def.faceSortDirs[a.face.letter];
      const da = q3(dot(a.face.centroid, pa)) - q3(dot(b.face.centroid, pa));
      if (da !== 0) return da;
      return q3(dot(a.face.centroid, sa)) - q3(dot(b.face.centroid, sa));
    });

    this._faceletCount = stickers.length;
    this._faceletIndex = new Map(); // slotPoint|normal → {index, posLetter}
    this._solvedLetters = stickers.map((s) => s.face.letter);
    this._faceRanges = [];
    let rangeStart = 0;
    stickers.forEach((s, idx) => {
      const key = `${keyOf(homeSlot(this.pieces[s.piece], s.face))}|${keyOf(s.face.normal)}`;
      this._faceletIndex.set(key, { index: idx, posLetter: s.face.letter });
      if (idx > 0 && s.face.letter !== stickers[idx - 1].face.letter) {
        this._faceRanges.push([rangeStart, idx]);
        rangeStart = idx;
      }
    });
    this._faceRanges.push([rangeStart, stickers.length]);

    // Painting runs here, after the facelet order is known, so a paint can
    // address a sticker the way getState() does — by its face and its place
    // within that face — instead of by an internal piece number. `row`/`col`
    // are offered only when a face is square; a Skewb face holds five
    // stickers and a Megaminx eleven, where a grid would be a lie.
    if (this._paint) {
      const faceStart = {};
      for (const [start, end] of this._faceRanges)
        faceStart[stickers[start].face.letter] = { start, size: end - start };
      stickers.forEach((s, i) => {
        const f = s.face;
        const { start, size } = faceStart[f.letter];
        const within = i - start;
        const side = Math.sqrt(size);
        const square = Number.isInteger(side);
        const tint = this._paint({
          face: f.letter,
          index: within,
          row: square ? Math.floor(within / side) : undefined,
          col: square ? within % side : undefined,
          letter: f.letter,
          piece: this.pieces[s.piece],
          pieceIndex: s.piece,
          slot: homeSlot(this.pieces[s.piece], f),
          normal: f.normal,
        });
        // returning nothing leaves the sticker its face colour, so a paint
        // can decorate a few stickers without restating the rest
        if (tint) f.tint = tint;
      });
    }

    // Decals are PRINTED, at the same moment and by the same addressing as a
    // paint. Deciding them at draw time instead would nail every mark to a
    // position, so a scramble would shuffle the colours and leave the pips
    // hanging in place — which is not what a printed cube does.
    if (this._decal) {
      const faceStart = {};
      for (const [start, end] of this._faceRanges)
        faceStart[stickers[start].face.letter] = { start, size: end - start };
      stickers.forEach((s, i) => {
        const f = s.face;
        const { start, size } = faceStart[f.letter];
        const within = i - start;
        const side = Math.sqrt(size);
        const square = Number.isInteger(side);
        const mark = this._decal({
          face: f.letter,
          index: within,
          row: square ? Math.floor(within / side) : undefined,
          col: square ? within % side : undefined,
          size: square ? side : undefined,
          letter: f.letter,
          piece: this.pieces[s.piece],
          pieceIndex: s.piece,
          slot: homeSlot(this.pieces[s.piece], f),
          normal: f.normal,
          fill: f.tint || this.colors[f.letter],
        });
        if (mark) f.decal = mark;
      });
    }
  }

  /**
   * The face's two reading directions, projected into the screen as this
   * piece currently sits: the same directions getState() sorts by, so a
   * decal lands the way the face reads and turns with its cubie.
   */
  _decalBasis(face, M, view, pts3, proj) {
    if (!this._decal) return null;
    const dirs = this.def.faceSortDirs[face.letter];
    if (!dirs) return null;
    let cx = 0,
      cy = 0,
      cz = 0;
    for (const q of pts3) {
      cx += q[0];
      cy += q[1];
      cz += q[2];
    }
    const at = [cx / pts3.length, cy / pts3.length, cz / pts3.length];
    // secondary runs along a row (the x of the unit square), primary down
    // the rows (its y) — the order getState() sorts in
    return {
      decalU: screenDir(dirs[1], M, view, at, proj),
      decalV: screenDir(dirs[0], M, view, at, proj),
    };
  }

  _faceletAt(slotPoint, normal) {
    return this._faceletIndex.get(`${keyOf(slotPoint)}|${keyOf(normal)}`);
  }

  // ── State ────────────────────────────────────────────────────────────────

  /** Reset to the solved state and clear the move history. */
  reset() {
    this._rot = this.pieces.map(() => IDENT);
    // Translations accumulated by turns about an off-origin centre, kept
    // separately for the two spaces: slot space is the logical grid the
    // state lives on, body space is where the geometry is drawn. They part
    // company on shape-shifters, whose mechanism centre (`pivot`) is not
    // the origin of their logical grid.
    this._slotT = this.pieces.map(() => ORIGIN);
    this._bodyT = this.pieces.map(() => ORIGIN);
    this.history = [];
    return this;
  }

  /** Where piece `i` currently sits on the logical grid. */
  _slotOf(i) {
    return add(matVec(this._rot[i], this.pieces[i].slotPoint), this._slotT[i]);
  }

  /** True if every face is a single color. */
  isSolved() {
    // Painted puzzles are judged on the visible pattern — see the note in
    // the constructor.
    if (this._solvedTints !== undefined)
      return this.getTints().join() === this._solvedTints;
    const s = this.getState();
    for (const [start, end] of this._faceRanges)
      for (let i = start; i < end; i++) {
        // "?" marks a sticker that has left the facelet grid. A solved
        // puzzle never has one, and a face of nothing but "?" would
        // otherwise pass the uniformity test below.
        if (s[i] === "?") return false;
        if (s[i] !== s[start]) return false;
      }
    return true;
  }

  /**
   * Facelet string in the puzzle's canonical order (def.faceOrder, reading
   * order within each face), one letter per sticker naming its home face.
   */
  getState() {
    const letters = new Array(this._faceletCount).fill("?");
    for (let i = 0; i < this.pieces.length; i++) {
      const piece = this.pieces[i];
      const rot = this._rot[i];
      const slot = this._slotOf(i);
      for (const f of piece.faces) {
        if (!f.letter) continue;
        const at = f.slotShift ? add(slot, matVec(rot, f.slotShift)) : slot;
        const pos = this._faceletAt(at, matVec(rot, f.normal));
        if (pos) letters[pos.index] = f.letter;
      }
    }
    return letters.join("");
  }

  /**
   * Current sticker tint per facelet position (parallel to getState) —
   * null where a sticker carries no tint. Solid-colored-piece puzzles use
   * this for their visual solved check.
   */
  getTints() {
    const tints = new Array(this._faceletCount).fill(null);
    for (let i = 0; i < this.pieces.length; i++) {
      const piece = this.pieces[i];
      const rot = this._rot[i];
      const slot = this._slotOf(i);
      for (const f of piece.faces) {
        if (!f.letter) continue;
        const at = f.slotShift ? add(slot, matVec(rot, f.slotShift)) : slot;
        const pos = this._faceletAt(at, matVec(rot, f.normal));
        if (pos) tints[pos.index] = f.tint || null;
      }
    }
    return tints;
  }

  // ── Moves ────────────────────────────────────────────────────────────────

  /** Parse a single move token into {axis, angle, min, max}. */
  parseMove(token) {
    const def = this.def;
    if (def.parseMove) return def.parseMove(token);
    const m = /^([A-Za-z]+)(\d*)('?)$/.exec(token);
    const spec = m && def.moves[m[1]];
    if (!spec) throw new Error(`erno: bad ${def.name} move '${token}'`);
    const times = (m[2] ? parseInt(m[2], 10) : 1) * (m[3] ? -1 : 1);
    return {
      axis: spec.axis,
      angle: spec.angle * times,
      min: spec.min,
      max: spec.max,
      center: spec.center,
    };
  }

  /** Every slot piece `i` currently fills — more than one only if bandaged. */
  _slotsOf(i) {
    const base = this._slotOf(i);
    const shifts = this.pieces[i].slotShifts;
    if (!shifts || shifts.length < 2) return [base];
    const rot = this._rot[i];
    return shifts.map((s) => add(base, matVec(rot, s)));
  }

  _inLayer(slot, spec) {
    const d = dot(slot, spec.axis);
    return d > spec.min && (spec.max === undefined || d < spec.max);
  }

  _selected(i, spec) {
    // A glued piece goes wherever any part of it is grabbed; whether that is
    // allowed is _turnFits' business, not this one's.
    const shifts = this.pieces[i].slotShifts;
    if (!shifts || shifts.length < 2)
      return this._inLayer(this._slotOf(i), spec);
    return this._slotsOf(i).some((s) => this._inLayer(s, spec));
  }

  /**
   * Does this turn's layer map onto itself?
   *
   * The shell symmetry law, narrowed from the whole puzzle to one layer: a
   * layer can only turn if the region it occupies comes back to the region
   * it occupied, because whatever is left behind is still in the way. On an
   * ordinary cube every layer passes and the test costs nothing. It earns
   * its keep on welded puzzles, where a layer of one body reaches into
   * another and the two no longer add up to a shape that spins — which is
   * exactly what makes a Siamese cube hard, and exactly what the mechanism
   * refuses to do in your hands.
   */
  _turnFits(spec) {
    if (spec.angle === 0) return true;
    const M = snapMatrix(rotationMatrix(spec.axis, spec.angle));
    const center = spec.center || ORIGIN;
    const t = offsetFor(M, center);
    const here = new Set();
    const moving = [];
    for (let i = 0; i < this.pieces.length; i++)
      if (this._selected(i, spec))
        for (const s of this._slotsOf(i)) {
          here.add(keyOf(s));
          moving.push(s);
        }
    for (const s of moving) if (!here.has(keyOf(add(matVec(M, s), t)))) return false;
    return true;
  }

  /**
   * Can this move be made from the current position? False both for turns
   * the puzzle's notation refuses outright (a Domino has no quarter turn
   * about x) and, on a blocking puzzle, for turns the pieces are in the way
   * of right now.
   */
  canMove(token) {
    let spec;
    try {
      spec = this.parseMove(token);
    } catch {
      // a puzzle whose policy refuses a turn outright refuses it here too,
      // so one question answers for both kinds of impossibility
      return false;
    }
    return !this._blocking || this._turnFits(spec);
  }

  /**
   * The moves available from here, out of `def.tokens` (the puzzle's full
   * vocabulary). On a blocking puzzle this shrinks as pieces move.
   */
  legalMoves() {
    const vocab = this.def.tokens || Object.keys(this.def.moves || {});
    return vocab.filter((t) => this.canMove(t));
  }

  /**
   * Apply a sequence of moves in the puzzle's notation.
   * @returns {Twisty} this (chainable)
   */
  move(sequence) {
    for (const token of tokenize(sequence)) {
      const spec = this.parseMove(token);
      if (this._blocking && !this._turnFits(spec))
        throw new Error(
          `erno: ${this.def.name} cannot turn '${token}' from here — the layer does not come back to itself`,
        );
      if (spec.angle !== 0) {
        const M = snapMatrix(rotationMatrix(spec.axis, spec.angle));
        // Slot space turns about the origin, body space about the mechanism
        // pivot, unless the move names its own centre — a welded puzzle's
        // bodies each turn about themselves, in both spaces alike.
        const sT = offsetFor(M, spec.center || ORIGIN);
        const bT = offsetFor(M, spec.center || this._pivot);
        for (let i = 0; i < this.pieces.length; i++)
          if (this._selected(i, spec)) {
            this._slotT[i] = add(matVec(M, this._slotT[i]), sT);
            this._bodyT[i] = add(matVec(M, this._bodyT[i]), bT);
            this._rot[i] = matMul(M, this._rot[i]);
          }
      }
      this.history.push(token);
    }
    return this;
  }

  /**
   * Scramble with the puzzle's standard random-move scramble.
   * @returns {string} the scramble sequence applied
   */
  scramble(length) {
    // A blocking puzzle cannot be handed a sequence written in advance: what
    // is legal depends on where the pieces are, so the scramble has to be
    // walked one move at a time, picking from whatever is open. A puzzle
    // that never wrote a scrambler gets the same walk for free.
    if (this._blocking || !this.def.scramble) {
      const n = length || this.def.scrambleLength || 25;
      const tokens = [];
      for (let k = 0; k < n; k++) {
        const open = this.legalMoves();
        if (!open.length) break;
        const token = open[Math.floor(Math.random() * open.length)];
        this.move(token);
        tokens.push(token);
      }
      return tokens.join(" ");
    }
    const seq = this.def.scramble(Math.random, length);
    this.move(seq);
    return seq;
  }

  /** Invert a move sequence (same token grammar across all puzzles). */
  static inverse(sequence) {
    return inverseSequence(sequence);
  }

  // ── Styling & camera ─────────────────────────────────────────────────────

  /**
   * Set the sticker style: a static object merged into every sticker, or a
   * callback ({face, index, letter, piece}) → style object (falsy = defaults).
   */
  style(objOrFn) {
    if (typeof objOrFn === "function") {
      this._styleFn = objOrFn;
      this._styleObj = null;
    } else {
      this._styleObj = objOrFn;
      this._styleFn = null;
    }
    return this;
  }

  /** Set the camera (same types and semantics as the Erno cube). */
  setCamera(camera) {
    this.camera = { type: "isometric", ...camera };
    return this;
  }

  // ── Rendering ────────────────────────────────────────────────────────────

  _project() {
    return makeProjector(this.camera, this.tile, 2 * this._radius);
  }

  /**
   * Build, project and depth-sort all visible faces.
   * @param {Object} [turn] - In-progress turn: { move: "R", progress: 0..1 }
   * @param {Function} [pieceFilter] - (pieceIndex) => boolean; pieces the
   *   filter rejects are omitted — partial builds, exploded views, tutorials
   * @returns {Object[]} projected faces, back-to-front
   */
  getFaces(turn, pieceFilter) {
    const proj = this._project();
    const view = this.def.view || IDENT;
    const R = this._radius;
    let spin = null;
    if (turn && turn.progress) {
      const spec = this.parseMove(turn.move);
      const mat = rotationMatrix(spec.axis, spec.angle * turn.progress);
      spin = { spec, mat, off: offsetFor(mat, spec.center || this._pivot) };
    }

    const inset = Math.max(0, Math.min(0.45, this.stickerInset));
    const C = this._viewCenter;
    const toRender = (p) => [p[0] - C[0] + R, R - (p[1] - C[1]), R - (p[2] - C[2])];
    // physical placement, then orient for display — p' = V · (M·p + T),
    // where T carries every turn taken about a centre other than the origin
    const place = (M, T, p) => toRender(matVec(view, add(matVec(M, p), T)));

    // Pass 0 — place every piece's facets, and find the plastic walls lying
    // flush against a neighbouring piece's. Such a pair hides itself however
    // it is drawn, but leaving both in lets the painter slip one of them
    // over the neighbour's stickers: where the seam between two pieces is
    // curved (a twisted body) no plane separates them, so no draw order can
    // be proven and the wall lands on top as a wedge. Coincidence is
    // measured per frame, so a turn that pulls the layers apart — or a
    // shape-shift that leaves real gaps — brings the core back.
    const staged = [];
    const wallsAt = new Map();
    for (let i = 0; i < this.pieces.length; i++) {
      if (pieceFilter && !pieceFilter(i)) continue;
      const piece = this.pieces[i];
      const rot = this._rot[i];
      let M = rot;
      let T = this._bodyT[i];
      let moving = false;
      if (spin && this._selected(i, spin.spec)) {
        M = matMul(spin.mat, rot);
        T = add(matVec(spin.mat, T), spin.off);
        moving = true;
      }
      const placed = piece.faces.map((f) => ({
        f,
        pts3: f.pts.map((p) => place(M, T, p)),
      }));
      for (const u of placed) {
        if (u.f.letter || u.f.hidden) continue;
        const key = u.pts3.map(keyOf).sort().join("|");
        u.normal3 = polygonNormal(u.pts3);
        const list = wallsAt.get(key);
        if (list) list.push(u);
        else wallsAt.set(key, [u]);
      }
      staged.push({ i, piece, rot, M, T, moving, placed });
    }
    // The walls must face each other for the pair to be solid: mid-turn two
    // pieces can slide until their walls coincide while both keep their
    // material on the same side, and dropping those would open a hole
    // straight through the puzzle.
    for (const list of wallsAt.values())
      if (list.length > 1)
        for (const a of list)
          if (list.some((b) => b !== a && dot(a.normal3, b.normal3) < -0.9))
            a.flush = true;

    // Pass 1 — project every piece, keeping its faces grouped and its full
    // 3D hull (planes + vertices, culled faces included) for ordering.
    const rendered = [];
    for (const { i, piece, rot, M, T, moving, placed } of staged) {
      const slot = this._slotOf(i);
      const units = [];
      let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity;

      // convex fragments for the painter's separating-plane tests
      const hulls = piece.fragments.map(([s, e]) => {
        const verts = [];
        const planes = [];
        for (let fi = s; fi < e; fi++) {
          const pts3 = placed[fi].pts3;
          for (const p of pts3) verts.push(p);
          planes.push({ n: polygonNormal(pts3), p0: pts3[0] });
        }
        return { verts, planes };
      });

      // Grouped stickers span several facets per piece (curved bodies,
      // Grouped (curved multi-facet) tiles: shrinking every facet toward the
      // shared group centroid keeps their common edges coincident, so the
      // inset border only appears around the whole tile. The center is
      // lifted to surface level so the sticker hugs the curve instead of
      // sinking beneath its own ridges.
      let groupCenter = null;
      let grouped = null;
      if (this._stickerGroup) {
        const acc = {};
        for (const { f, pts3 } of placed)
          if (f.letter && !f.hidden) (acc[f.letter] ||= []).push(...pts3);
        groupCenter = {};
        for (const k in acc) {
          const c = centroidOf(acc[k]);
          let nx = 0,
            ny = 0,
            nz = 0;
          for (const { f, pts3 } of placed)
            if (f.letter === k && !f.hidden) {
              const fn = polygonNormal(pts3);
              nx += fn[0];
              ny += fn[1];
              nz += fn[2];
            }
          const nl = Math.hypot(nx, ny, nz) || 1;
          const nrm = [nx / nl, ny / nl, nz / nl];
          let lift = 0;
          for (const { f, pts3 } of placed)
            if (f.letter === k && !f.hidden)
              lift = Math.max(lift, dot(nrm, sub(centroidOf(pts3), c)));
          groupCenter[k] = [
            c[0] + nrm[0] * lift * 1.35,
            c[1] + nrm[1] * lift * 1.35,
            c[2] + nrm[2] * lift * 1.35,
          ];
        }
        grouped = { backs: [], sticks: [] };
      }

      for (const { f, pts3, flush } of placed) {
        if (f.hidden) continue;
        if (flush) continue; // sealed against a neighbouring piece's wall
        const projected = projectPolygon(pts3, proj);
        if (!projected) continue;
        for (let k = 0; k < projected.points.length; k += 2) {
          minX = Math.min(minX, projected.points[k]);
          maxX = Math.max(maxX, projected.points[k]);
          minY = Math.min(minY, projected.points[k + 1]);
          maxY = Math.max(maxY, projected.points[k + 1]);
        }

        if (!f.letter) {
          units.push({ depth: projected.depth, polys: [{ part: "core", piece: i, ...projected }] });
          continue;
        }

        const pos = this._faceletAt(slot, matVec(rot, f.normal));
        const meta = {
          face: pos ? pos.posLetter : f.letter,
          index: pos ? pos.index : -1,
          letter: f.letter,
          piece: i,
          tint: f.tint,
          decal: f.decal,
        };
        if (inset > 0) {
          const c = groupCenter ? groupCenter[f.letter] : centroidOf(pts3);
          const shrunk = pts3.map(([x, y, z]) => [
            x + (c[0] - x) * inset,
            y + (c[1] - y) * inset,
            z + (c[2] - z) * inset,
          ]);
          const sticker = projectPolygon(shrunk, proj);
          if (grouped) {
            // emit every backing before every sticker so a neighbouring
            // facet's backing never paints over a sunken curved sticker
            grouped.backs.push({ ...meta, part: "plastic", ...projected });
            if (sticker)
              grouped.sticks.push({ ...meta, part: "sticker", ...sticker });
          } else {
            const polys = [{ ...meta, part: "plastic", ...projected }];
            if (sticker)
              polys.push({
                ...meta,
                part: "sticker",
                ...sticker,
                ...this._decalBasis(f, M, view, pts3, proj),
                depth: projected.depth - 1e-6,
              });
            units.push({ depth: projected.depth, polys });
          }
        } else {
          units.push({ depth: projected.depth, polys: [{ ...meta, part: "sticker", ...projected }] });
        }
      }

      if (grouped && (grouped.backs.length || grouped.sticks.length)) {
        grouped.backs.sort((a, b) => b.depth - a.depth);
        grouped.sticks.sort((a, b) => b.depth - a.depth);
        const depth = Math.min(
          ...grouped.backs.map((p) => p.depth),
          ...grouped.sticks.map((p) => p.depth),
        );
        units.push({ depth, polys: [...grouped.backs, ...grouped.sticks] });
      }

      const c = place(M, T, piece.centroid);
      rendered.push({
        units,
        hulls,
        moving,
        bbox: [minX, minY, maxX, maxY],
        depth: proj.depth(c[0], c[1], c[2]),
      });
    }

    // Pass 2 — order whole pieces back-to-front. Pieces are disjoint convex
    // solids, so a separating plane always exists; sorting pieces (not
    // individual faces) by which side of it the camera sits on eliminates the
    // interleaving artifacts a per-face centroid sort produces when blocks
    // protrude past each other (Mirror cube, mid-turn layers).
    const out = [];
    for (const idx of this._paintOrder(rendered, proj.eye)) {
      const r = rendered[idx];
      r.units.sort((a, b) => b.depth - a.depth);
      for (const u of r.units) out.push(...u.polys);
    }
    return out;
  }

  /** Topological back-to-front piece order via separating-plane tests. */
  _paintOrder(rendered, eye) {
    const n = rendered.length;
    const after = Array.from({ length: n }, () => []);
    const indeg = new Array(n).fill(0);

    // -1: hull hp drawn first (behind hq), +1: hq first, 0: undetermined
    const sepConvex = (hp, hq) => {
      for (const { n: m, p0 } of hp.planes) {
        let minSide = Infinity;
        for (const v of hq.verts) {
          const s = dot(m, sub(v, p0));
          if (s < minSide) minSide = s;
          if (minSide < -1e-7) break;
        }
        if (minSide >= -1e-7) {
          const camSide =
            eye && eye.type === "point"
              ? dot(m, sub(eye.v, p0))
              : -dot(m, eye ? eye.v : [0, 0, 1]);
          if (Math.abs(camSide) < 1e-9) continue; // plane edge-on to the view
          return camSide > 0 ? -1 : 1; // camera on hq's side → hp is behind
        }
      }
      return 0;
    };

    // Pieces may be non-convex unions of convex fragments; an order is only
    // asserted when every fragment pair agrees in both directions. A genuine
    // occlusion makes all separators agree; any contradiction or unknown
    // proves the pieces don't occlude and needs no constraint. (Asserting an
    // order from one arbitrary separator creates spurious cycles that stall
    // the topological sort.)
    const relate = (P, Q) => {
      let agreed = 0;
      for (const hp of P.hulls)
        for (const hq of Q.hulls) {
          const fwd = sepConvex(hp, hq);
          const back = sepConvex(hq, hp);
          const bwd = back === 0 ? 0 : -back;
          let r;
          if (fwd !== 0 && bwd !== 0) r = fwd === bwd ? fwd : 0;
          else r = fwd || bwd;
          if (r === 0) return 0;
          if (agreed === 0) agreed = r;
          else if (agreed !== r) return 0;
        }
      return agreed;
    };

    for (let a = 0; a < n; a++) {
      if (!rendered[a].units.length) continue;
      const [ax0, ay0, ax1, ay1] = rendered[a].bbox;
      for (let b = a + 1; b < n; b++) {
        if (!rendered[b].units.length) continue;
        const [bx0, by0, bx1, by1] = rendered[b].bbox;
        if (ax1 < bx0 || bx1 < ax0 || ay1 < by0 || by1 < ay0) continue;
        let rel = relate(rendered[a], rendered[b]);
        // Mid-turn on a shape-shifted puzzle, the sweeping layer can pass
        // through protruding static pieces — no consistent order exists, so
        // draw the moving piece on top: the eye reads the turning layer as
        // being in front, instead of a hatched interleave.
        if (rel === 0 && rendered[a].moving !== rendered[b].moving)
          rel = rendered[a].moving ? 1 : -1;
        if (rel === -1) {
          after[a].push(b);
          indeg[b]++;
        } else if (rel === 1) {
          after[b].push(a);
          indeg[a]++;
        }
      }
    }

    // Kahn's algorithm, farthest-first among ready nodes; a stall (cycle,
    // which separating planes shouldn't produce) falls back to depth order.
    const order = [];
    const done = new Array(n).fill(false);
    for (let step = 0; step < n; step++) {
      let pick = -1;
      for (let i = 0; i < n; i++)
        if (!done[i] && indeg[i] === 0 && (pick === -1 || rendered[i].depth > rendered[pick].depth))
          pick = i;
      if (pick === -1)
        for (let i = 0; i < n; i++)
          if (!done[i] && (pick === -1 || rendered[i].depth > rendered[pick].depth)) pick = i;
      done[pick] = true;
      order.push(pick);
      for (const b of after[pick]) indeg[b]--;
    }
    return order;
  }

  /**
   * Render the puzzle to an SVG string. Options match the Erno cube:
   * padding, viewBox, fitSphere, turn, prepend, append.
   */
  toSVG(options = {}) {
    const faces = this.getFaces(options.turn, options.pieces);
    const pad = options.padding === undefined ? 20 : options.padding;

    let vb;
    if (options.viewBox) vb = options.viewBox;
    else if (options.fitSphere) {
      // A number frames to that radius instead of the puzzle's own, so a set
      // of puzzles can share one frame. Two 3×3s draw the same geometry but
      // reserve different room — a Mirror shape-shifts and needs it — and
      // side by side in one control the difference reads as the puzzle
      // changing size when only the frame did.
      // The centre is where toRender placed the puzzle — always its own
      // radius — while the RADIUS may be borrowed. Passing the borrowed one
      // as the centre too slides the puzzle off its own frame.
      const C = this._radius;
      const R = typeof options.fitSphere === "number" ? options.fitSphere : C;
      vb = sphereViewBox(this._project(), C, C, C, R, pad);
    } else vb = boundsViewBox(faces, pad);

    const parts = [openSvgTag(vb)];
    if (options.prepend) parts.push(options.prepend);

    for (const face of faces) {
      const pa = pointsAttr(face.points);

      if (face.part === "core") {
        parts.push(
          `<polygon points="${pa}" fill="${this.plastic}" stroke="${this.plastic}" stroke-width="0.5" data-part="core" />`,
        );
        continue;
      }
      if (face.part === "plastic") {
        parts.push(
          `<polygon points="${pa}" fill="${this.plastic}" stroke="${this.plastic}" stroke-width="0.5" data-part="plastic" data-face="${face.face}" data-index="${face.index}" data-piece="${face.piece}" />`,
        );
        continue;
      }
      // a sticker tint (per-piece color, e.g. Tetris cubies) beats face color
      let style = { fill: face.tint || this.colors[face.letter] };
      // grouped (curved) stickers: self-colored stroke hides the seams
      // between the facets that make up one tile
      if (this._stickerGroup) {
        style.stroke = style.fill;
        style.strokeWidth = 1;
      }
      if (this._styleObj) style = { ...style, ...this._styleObj };
      if (this._styleFn) {
        const custom = this._styleFn({
          face: face.face,
          index: face.index,
          letter: face.letter,
          piece: face.piece,
          tint: face.tint,
        });
        if (custom) style = { ...style, ...custom };
      }
      parts.push(
        `<polygon points="${pa}"${buildSvgAttributes(style)} data-part="sticker" data-face="${face.face}" data-index="${face.index}" data-color="${face.letter}" data-piece="${face.piece}" />`,
      );
      if (face.decal) {
        const mark = face.decal;
        const t = unitSquareTo(face.points, face.decalU, face.decalV);
        // A decal needs a quadrilateral to sit on. Four-sided stickers are
        // every cube and cuboid; a Skewb's pentagon or a Megaminx's kite has
        // no unit square to map, so it is left bare rather than smeared.
        if (mark && t) parts.push(`<g transform="${t}" data-part="decal">${mark}</g>`);
      }
    }

    if (options.append) parts.push(options.append);
    parts.push("</svg>");
    return parts.join("");
  }
}
