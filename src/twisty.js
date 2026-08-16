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

const matVec = (m, v) => [dot(m[0], v), dot(m[1], v), dot(m[2], v)];

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
    this._styleFn = null;
    this._styleObj = null;
    if (options.style) this.style(options.style);

    this._build();
    this.reset();
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

    // Circumradius about the origin: rotating about the pivot keeps every
    // point within |pivot| + max distance-from-pivot.
    let reach = 0;
    for (const solid of solids)
      for (const f of solid)
        for (const p of f.pts) reach = Math.max(reach, vlen(sub(p, this._pivot)));
    this._radius = vlen(this._pivot) + reach;

    // normal → position face letter
    this._faceOfNormal = new Map();
    for (const solid of solids)
      for (const f of solid)
        if (f.letter) this._faceOfNormal.set(keyOf(polygonNormal(f.pts)), f.letter);

    const cells = solids.flatMap((solid) => slicePieces(solid, def.cuts));

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
      piece.centroid = centroidOf(piece.allVerts);
      delete piece.allVerts;
      // Internal walls between fragments of one rigid piece (coincident
      // plastic faces) can never be seen — hide them from rendering while
      // keeping them for the fragment hulls.
      if (piece.fragments.length > 1) {
        const counts = new Map();
        const faceKey = (f) => f.pts.map(keyOf).sort().join("|");
        for (const f of piece.faces)
          if (!f.letter) counts.set(faceKey(f), (counts.get(faceKey(f)) || 0) + 1);
        for (const f of piece.faces)
          if (!f.letter && counts.get(faceKey(f)) > 1) f.hidden = true;
      }
      this.pieces.push(piece);
    }

    // Optional per-piece decoration: lets a puzzle tint stickers by piece
    // (solid-colored cubies like Rubik's Tetris) rather than by face.
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
      const key = `${keyOf(this.pieces[s.piece].slotPoint)}|${keyOf(s.face.normal)}`;
      this._faceletIndex.set(key, { index: idx, posLetter: s.face.letter });
      if (idx > 0 && s.face.letter !== stickers[idx - 1].face.letter) {
        this._faceRanges.push([rangeStart, idx]);
        rangeStart = idx;
      }
    });
    this._faceRanges.push([rangeStart, stickers.length]);
  }

  _faceletAt(slotPoint, normal) {
    return this._faceletIndex.get(`${keyOf(slotPoint)}|${keyOf(normal)}`);
  }

  // ── State ────────────────────────────────────────────────────────────────

  /** Reset to the solved state and clear the move history. */
  reset() {
    this._rot = this.pieces.map(() => IDENT);
    this.history = [];
    return this;
  }

  /** True if every face is a single color. */
  isSolved() {
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
      const slot = matVec(rot, piece.slotPoint);
      for (const f of piece.faces) {
        if (!f.letter) continue;
        const pos = this._faceletAt(slot, matVec(rot, f.normal));
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
      const slot = matVec(rot, piece.slotPoint);
      for (const f of piece.faces) {
        if (!f.letter) continue;
        const pos = this._faceletAt(slot, matVec(rot, f.normal));
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
    return { axis: spec.axis, angle: spec.angle * times, min: spec.min, max: spec.max };
  }

  _selected(i, spec) {
    const cur = matVec(this._rot[i], this.pieces[i].slotPoint);
    const d = dot(cur, spec.axis);
    return d > spec.min && (spec.max === undefined || d < spec.max);
  }

  /**
   * Apply a sequence of moves in the puzzle's notation.
   * @returns {Twisty} this (chainable)
   */
  move(sequence) {
    for (const token of tokenize(sequence)) {
      const spec = this.parseMove(token);
      if (spec.angle !== 0) {
        const M = snapMatrix(rotationMatrix(spec.axis, spec.angle));
        for (let i = 0; i < this.pieces.length; i++)
          if (this._selected(i, spec)) this._rot[i] = matMul(M, this._rot[i]);
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
      spin = { spec, mat: rotationMatrix(spec.axis, spec.angle * turn.progress) };
    }

    const inset = Math.max(0, Math.min(0.45, this.stickerInset));
    const pivot = this._pivot;
    const toRender = (p) => [p[0] + R, R - p[1], R - p[2]];
    // physical placement: rotate about the mechanism pivot, then orient for
    // display — p' = V · (M·(p − pivot) + pivot)
    const place = (M, p) => {
      const q = matVec(M, sub(p, pivot));
      return toRender(
        matVec(view, [q[0] + pivot[0], q[1] + pivot[1], q[2] + pivot[2]]),
      );
    };

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
      let moving = false;
      if (spin && this._selected(i, spin.spec)) {
        M = matMul(spin.mat, rot);
        moving = true;
      }
      const placed = piece.faces.map((f) => ({
        f,
        pts3: f.pts.map((p) => place(M, p)),
      }));
      for (const u of placed) {
        if (u.f.letter || u.f.hidden) continue;
        const key = u.pts3.map(keyOf).sort().join("|");
        u.normal3 = polygonNormal(u.pts3);
        const list = wallsAt.get(key);
        if (list) list.push(u);
        else wallsAt.set(key, [u]);
      }
      staged.push({ i, piece, rot, M, moving, placed });
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
    for (const { i, piece, rot, M, moving, placed } of staged) {
      const slot = matVec(rot, piece.slotPoint);
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

      // Curved stickers (def.stickerGroup) span several facets per piece;
      // Grouped (curved multi-facet) tiles: shrinking every facet toward the
      // shared group centroid keeps their common edges coincident, so the
      // inset border only appears around the whole tile. The center is
      // lifted to surface level so the sticker hugs the curve instead of
      // sinking beneath its own ridges.
      let groupCenter = null;
      let grouped = null;
      if (this.def.stickerGroup) {
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
              polys.push({ ...meta, part: "sticker", ...sticker, depth: projected.depth - 1e-6 });
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

      const c = place(M, piece.centroid);
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
      const R = this._radius;
      vb = sphereViewBox(this._project(), R, R, R, R, pad);
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
      if (this.def.stickerGroup) {
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
    }

    if (options.append) parts.push(options.append);
    parts.push("</svg>");
    return parts.join("");
  }
}
