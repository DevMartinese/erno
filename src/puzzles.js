/**
 * erno/puzzles.js — the classic variants, defined declaratively on top of
 * the generic piece engine (twisty.js). Mirrors heerich's shapes.js role:
 * each puzzle is a base solid + cut planes + notation, and the engine
 * derives pieces, stickers and state from that.
 *
 * - Skewb: corner-turning cube, WCA Fixed Corner Notation (R U L B, 120°
 *   turns; U = up-back-left corner, R = down-back-right, L = down-front-left,
 *   B = down-back-left, clockwise seen from outside the corner).
 * - Pyraminx: tetrahedron; U L R B turn a vertex's two layers, lowercase
 *   u l r b turn just the trivial tips.
 * - Mirror: a 3×3 with uneven cuts and uniform "silver" stickers — it
 *   shape-shifts when scrambled. Standard cube notation; getState() still
 *   reports virtual URFDLB facelets (it is isomorphic to the 3×3).
 * - Void: a 3×3 without centers — you can see straight through the holes.
 *   Standard cube notation; 48 facelets (8 per face).
 */

import {
  Twisty,
  CUBE_COLORS,
  FACES,
  FACE_AXIS,
  SLICE_AXIS,
  parseCubeMove,
  parseBoxMove,
  rotationMatrix,
  slicePieces,
} from "./twisty.js";

// ── Small vector helpers (local) ────────────────────────────────────────────

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const norm = (a) => {
  const l = Math.sqrt(dot(a, a));
  return [a[0] / l, a[1] / l, a[2] / l];
};
const matVec = (m, v) => [dot(m[0], v), dot(m[1], v), dot(m[2], v)];
const matMul = (a, b) => {
  const r = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++)
      r[i][j] = a[i][0] * b[0][j] + a[i][1] * b[1][j] + a[i][2] * b[2][j];
  return r;
};
const transpose = (m) => [
  [m[0][0], m[1][0], m[2][0]],
  [m[0][1], m[1][1], m[2][1]],
  [m[0][2], m[1][2], m[2][2]],
];

/** Rotation taking unit vector a onto unit vector b. */
function rotateAlign(a, b) {
  const axis = cross(a, b);
  const s = Math.sqrt(dot(axis, axis));
  const c = dot(a, b);
  if (s < 1e-12)
    return c > 0
      ? [[1, 0, 0], [0, 1, 0], [0, 0, 1]]
      : rotationMatrix([1, 0, 0], Math.PI);
  return rotationMatrix(norm(axis), Math.atan2(s, c));
}

// ── Base solids ─────────────────────────────────────────────────────────────

/** Axis-aligned box of half-extents (hx, hy, hz), faces lettered URFDLB. */
function boxSolid(hx, hy, hz) {
  return [
    { letter: "U", pts: [[-hx, hy, -hz], [-hx, hy, hz], [hx, hy, hz], [hx, hy, -hz]] },
    { letter: "D", pts: [[-hx, -hy, -hz], [hx, -hy, -hz], [hx, -hy, hz], [-hx, -hy, hz]] },
    { letter: "R", pts: [[hx, -hy, -hz], [hx, hy, -hz], [hx, hy, hz], [hx, -hy, hz]] },
    { letter: "L", pts: [[-hx, -hy, -hz], [-hx, -hy, hz], [-hx, hy, hz], [-hx, hy, -hz]] },
    { letter: "F", pts: [[-hx, -hy, hz], [hx, -hy, hz], [hx, hy, hz], [-hx, hy, hz]] },
    { letter: "B", pts: [[-hx, -hy, -hz], [-hx, hy, -hz], [hx, hy, -hz], [hx, -hy, -hz]] },
  ];
}

/** Axis-aligned cube of half-extent h, faces lettered URFDLB. */
function cubeSolid(h) {
  return boxSolid(h, h, h);
}

// Within-face reading order for cube-shaped puzzles, matching the Erno
// facelet layout (row 0 = top of each face as you look straight at it):
// sort ascending by primary dot, then secondary dot, of the sticker centroid.
const CUBE_SORT_DIRS = {
  U: [[0, 0, 1], [1, 0, 0]],
  R: [[0, -1, 0], [0, 0, -1]],
  F: [[0, -1, 0], [1, 0, 0]],
  D: [[0, 0, -1], [1, 0, 0]],
  L: [[0, -1, 0], [0, 0, 1]],
  B: [[0, -1, 0], [-1, 0, 0]],
};

// The whole move vocabulary of a three-layer cube in face notation. A
// definition declares it so legalMoves() can enumerate what is available
// from here; without it the puzzle can still be turned, but nothing can ask
// it what its moves are.
const CUBE3_TOKENS = ["U", "R", "F", "D", "L", "B"].flatMap((f) =>
  ["", "'", "2"].map((s) => f + s),
);

// The 24 ways of holding a cube: pick which face is up (six choices, and the
// six sequences below are one per face), then spin about the vertical (four).
// A definition lists these so a pattern can be recognised however the puzzle
// is held, which is what a player means by "the same pattern".
const CUBE_ORIENTATIONS = ["", "x", "x2", "x'", "z", "z'"].flatMap((tip) =>
  ["", "y", "y2", "y'"].map((spin) => [tip, spin].filter(Boolean).join(" ")),
);

// ── Shared scramblers ───────────────────────────────────────────────────────

function pickScramble(rand, letters, suffixes, count) {
  const tokens = [];
  let last = null;
  while (tokens.length < count) {
    const t = letters[Math.floor(rand() * letters.length)];
    if (t === last) continue;
    last = t;
    tokens.push(t + suffixes[Math.floor(rand() * suffixes.length)]);
  }
  return tokens;
}

// Cube-notation parser factory for box-shaped puzzles: maps {axis, lo, hi,
// quarters} onto the piece engine's {axis vector, angle, slot-dot range}.
// A positive quarter turn (R/U/F sense) is clockwise seen from outside the
// face, i.e. -90° right-handed about the outward axis. Slot points live on
// the uniform grid of cell centers, so layers [lo..hi] span the open
// interval (lo - N/2, hi + 1 - N/2).
/**
 * A quarter turn about an axis whose cross-section is not square leaves a
 * cuboid misshapen. Both answers to that are real puzzles: some cuboids are
 * built so the move simply cannot be made, and others — a 3×3×5, a 2×3×4 —
 * are sold precisely because it can, and shape-shifting is the point. So it
 * is a policy, not a law: `shapeShift` picks which puzzle you are holding.
 */
function makeBoxParser(dims, shapeShift = false) {
  const square = [
    dims[1] === dims[2],
    dims[0] === dims[2],
    dims[0] === dims[1],
  ];
  return (token) => {
    const { axis, lo, hi, quarters } = parseBoxMove(token, dims);
    if (!shapeShift && !square[axis] && ((quarters % 2) + 2) % 2 !== 0)
      throw new Error(
        `erno: '${token}' would leave this cuboid misshapen. Only half turns about that axis (use ${token.replace(/['\d]+$/, "")}2), or build it with { shapeShift: true }`,
      );
    const u = [0, 0, 0];
    u[axis] = 1;
    return {
      axis: u,
      angle: -(Math.PI / 2) * quarters,
      min: lo - dims[axis] / 2,
      max: hi + 1 - dims[axis] / 2,
    };
  };
}

const cubeParse3 = makeBoxParser([3, 3, 3]);

/**
 * Several puzzles are built at one fixed size. Passing `size` to them used to
 * do nothing at all — you asked for a 5×5 Void and got a 3×3 without a word,
 * which is worse than an error because the result looks plausible. Say so
 * instead, and name the ones that do take a size.
 */
function fixedSize(name, options) {
  if (options.size)
    throw new Error(
      `erno: ${name} is built at 3×3 only. For other sizes use Erno or Cuboid, which take { size }`,
    );
}

// ── Skewb ───────────────────────────────────────────────────────────────────

function buildSkewbDef() {
  const h = 1.5;
  const cuts = [
    [1, 1, 1],
    [1, 1, -1],
    [1, -1, 1],
    [1, -1, -1],
  ].map((n) => ({ n: norm(n), d: 0 }));

  // WCA Fixed Corner Notation: fixed corner is the one facing the viewer
  // (up-front-right); moves turn 120° clockwise seen from outside the corner.
  const CORNERS = {
    U: [-1, 1, -1], // up-back-left
    R: [1, -1, -1], // down-back-right
    L: [-1, -1, 1], // down-front-left
    B: [-1, -1, -1], // down-back-left
  };
  const moves = {};
  for (const [letter, v] of Object.entries(CORNERS))
    moves[letter] = { axis: norm(v), angle: (-2 * Math.PI) / 3, min: 0.05 };

  return {
    name: "skewb",
    solid: cubeSolid(h),
    cuts,
    moves,
    faceOrder: ["U", "R", "F", "D", "L", "B"],
    faceSortDirs: CUBE_SORT_DIRS,
    colors: { ...CUBE_COLORS },
    scramble: (rand, length) =>
      pickScramble(rand, ["R", "U", "L", "B"], ["", "'"], length || 9).join(" "),
  };
}

let _skewbDef;

export class Skewb extends Twisty {
  constructor(options = {}) {
    fixedSize("Skewb", options);
    super(_skewbDef || (_skewbDef = buildSkewbDef()), options);
  }
}

// ── Skewb Diamond ───────────────────────────────────────────────────────────

/**
 * In-plane reading directions for a face, given its outward normal: rows run
 * downward, columns rightward, each projected onto the face. When the face
 * lies flat (its normal is vertical, so "down" has nowhere to go in-plane)
 * the rows fall back to running backward instead.
 */
function planeDirs(outward) {
  const inPlane = (dir) =>
    norm([
      dir[0] - outward[0] * dot(dir, outward),
      dir[1] - outward[1] * dot(dir, outward),
      dir[2] - outward[2] * dot(dir, outward),
    ]);
  const flat = Math.abs(dot([0, -1, 0], outward)) > 0.9;
  return [inPlane(flat ? [0, 0, -1] : [0, -1, 0]), inPlane([1, 0, 0])];
}

/**
 * Regular octahedron with vertices on the axes at distance R. Faces are
 * lettered A–D around the top and E–H beneath them: the engine reads one
 * character per facelet, so a face letter has to be a single character.
 */
function octaSolid(R) {
  const faces = [];
  let i = 0;
  for (const sy of [1, -1])
    for (const [sx, sz] of [[1, 1], [1, -1], [-1, -1], [-1, 1]])
      faces.push({
        letter: "ABCDEFGH"[i++],
        pts: [
          [sx * R, 0, 0],
          [0, sy * R, 0],
          [0, 0, sz * R],
        ],
      });
  return faces;
}

/**
 * Skewb Diamond — the Skewb's dual. The Skewb's four cuts run perpendicular
 * to the cube's body diagonals, and those same four axes pass through the
 * octahedron's opposite face pairs, so the identical mechanism carves an
 * octahedron into six vertex pieces and eight face centres.
 */
function buildSkewbDiamondDef() {
  const R = 2.2;
  const solid = octaSolid(R);
  const cuts = [
    [1, 1, 1],
    [1, 1, -1],
    [1, -1, 1],
    [1, -1, -1],
  ].map((n) => ({ n: norm(n), d: 0 }));

  const moves = {};
  for (const [letter, v] of Object.entries({
    U: [-1, 1, -1],
    R: [1, -1, -1],
    L: [-1, -1, 1],
    B: [-1, -1, -1],
  }))
    moves[letter] = { axis: norm(v), angle: (-2 * Math.PI) / 3, min: 0.05 };

  const faceOrder = solid.map((f) => f.letter);
  const faceSortDirs = {};
  const colors = {};
  const PALETTE = [
    "#f0f0f0", "#ffd500", "#0046ad", "#c41e3a",
    "#009b48", "#7b2d8b", "#ff8c00", "#8fd6ff",
  ];
  solid.forEach((f, i) => {
    const n = norm(centroid3(f.pts));
    faceSortDirs[f.letter] = planeDirs(n);
    colors[f.letter] = PALETTE[i];
  });

  return {
    name: "skewb-diamond",
    solid,
    cuts,
    moves,
    faceOrder,
    faceSortDirs,
    colors,
    scramble: (rand, length) =>
      pickScramble(rand, ["R", "U", "L", "B"], ["", "'"], length || 9).join(" "),
  };
}

let _skewbDiamondDef;

/** Skewb Diamond — an octahedron on the Skewb mechanism. */
export class SkewbDiamond extends Twisty {
  constructor(options = {}) {
    fixedSize("SkewbDiamond", options);
    super(_skewbDiamondDef || (_skewbDiamondDef = buildSkewbDiamondDef()), options);
  }
}

// ── Megaminx family ─────────────────────────────────────────────────────────

const PHI = (1 + Math.sqrt(5)) / 2;

/**
 * Regular dodecahedron with circumradius R: the twenty vertices are the cube
 * (±1,±1,±1) together with three rectangles built from the golden ratio, and
 * the twelve face normals point at the vertices of the dual icosahedron.
 * Each face is read off as the five vertices furthest along its normal, wound
 * around it by angle. Faces are lettered A–L (one character per facelet is
 * the engine's contract).
 */
function dodecaSolid(R) {
  const raw = [];
  for (const sx of [1, -1])
    for (const sy of [1, -1])
      for (const sz of [1, -1]) raw.push([sx, sy, sz]);
  for (const s1 of [1, -1])
    for (const s2 of [1, -1]) {
      raw.push([0, s1 / PHI, s2 * PHI]);
      raw.push([s1 / PHI, s2 * PHI, 0]);
      raw.push([s2 * PHI, 0, s1 / PHI]);
    }
  const scale = R / Math.sqrt(3); // |(1,1,1)| is this construction's circumradius
  const verts = raw.map((v) => v.map((c) => c * scale));

  // Face normals follow the SAME cyclic order as the vertices above. The
  // other rotation of (φ,1) — the one every table quotes for the dual
  // icosahedron — lands on this dodecahedron's vertices instead, and each
  // "face" then collapses to a single point.
  const normals = [];
  for (const s1 of [1, -1])
    for (const s2 of [1, -1]) {
      normals.push(norm([0, s1 * PHI, s2]));
      normals.push(norm([s1 * PHI, s2, 0]));
      normals.push(norm([s2, 0, s1 * PHI]));
    }

  return normals.map((n, i) => {
    const reach = verts.map((v) => dot(v, n));
    const far = Math.max(...reach);
    const ring = verts.filter((v, k) => reach[k] > far - 1e-6 * R);
    const c = centroid3(ring);
    const u = norm([ring[0][0] - c[0], ring[0][1] - c[1], ring[0][2] - c[2]]);
    const w = cross(n, u);
    const angle = (p) => {
      const d = [p[0] - c[0], p[1] - c[1], p[2] - c[2]];
      return Math.atan2(dot(d, w), dot(d, u));
    };
    return {
      letter: "ABCDEFGHIJKL"[i],
      pts: [...ring].sort((a, b) => angle(a) - angle(b)),
      normal: n,
    };
  });
}

const MINX_COLORS = [
  "#f0f0f0", "#ffd500", "#0046ad", "#c41e3a", "#009b48", "#7b2d8b",
  "#b8b8b8", "#fff7a0", "#8fd6ff", "#ff8c00", "#8fe28f", "#ff9ec4",
];

/**
 * Face-turning dodecahedra. `reach` is how far the cut sits from the centre
 * as a fraction of the face's own distance: shallow leaves the full Megaminx
 * (centres, edges and corners), deep enough and the edges vanish and only
 * the corners survive, which is the Kilominx.
 */
function buildMinxDef(name, reach, scrambleLen) {
  const R = 2.6;
  const solid = dodecaSolid(R);
  const inradius = dot(centroid3(solid[0].pts), solid[0].normal);
  const depth = inradius * reach;

  const cuts = solid.map((f) => ({ n: f.normal, d: depth }));
  const moves = {};
  for (const f of solid)
    moves[f.letter] = { axis: f.normal, angle: (-2 * Math.PI) / 5, min: depth + 1e-3 };

  // ── WCA scramble notation, on the megaminx only ───────────────────────
  //
  // The notation every scramble sheet is written in: R++ R-- D++ D-- U U'.
  // R and D are not face turns. Each one grips a single face and rotates
  // the OTHER ELEVEN LAYERS two clicks about that face's axis, which is
  // how a scrambler reaches the whole puzzle with two grips: the engine's
  // half-space selection says that directly, as everything past the grip
  // face's own cut, seen from the other side.
  //
  // The convention, since the letters had to land somewhere: U is the top
  // face as the puzzle is drawn (our A), the face D±± holds still while
  // the rest spins about the vertical; R±± holds the upper-left face (our
  // H) and rolls the rest to the right, the way a right hand does it. A
  // click is 72°; ++ is two clicks clockwise as seen from the moving
  // side, -- the other way. The letter moves stay exactly what they were:
  // 'D' alone is still the letter-D face, only 'D++'/'D--' are WCA.
  const wca = name === "megaminx";
  const up = solid.find((f) => f.letter === "A");
  const grip = solid.find((f) => f.letter === "H");
  const wcaMove = (fixed, clicks) => ({
    axis: fixed.normal.map((v) => -v),
    angle: ((-2 * Math.PI) / 5) * clicks,
    min: -(depth + 1e-3),
  });
  const WCA_RE = /^(R|D)(\+\+|--)$/;
  const parseWca = (token) => {
    if (token === "U" || token === "U'")
      return { ...moves.A, angle: moves.A.angle * (token === "U" ? 1 : -1) };
    const m = WCA_RE.exec(token);
    if (!m) return null;
    return wcaMove(m[1] === "D" ? up : grip, m[2] === "++" ? 2 : -2);
  };

  const faceSortDirs = {};
  const colors = {};
  solid.forEach((f, i) => {
    faceSortDirs[f.letter] = planeDirs(f.normal);
    colors[f.letter] = MINX_COLORS[i];
  });

  const letters = solid.map((f) => f.letter);
  return {
    name,
    solid: solid.map(({ letter, pts }) => ({ letter, pts })),
    cuts,
    moves,
    tokens: [
      ...letters.flatMap((l) => ["", "'", "2"].map((x) => l + x)),
      ...(wca ? ["R++", "R--", "D++", "D--", "U", "U'"] : []),
    ],
    ...(wca
      ? {
          parseMove(token) {
            const w = parseWca(token);
            if (w) return w;
            const m = /^([A-L])(\d*)('?)$/.exec(token);
            const spec = m && moves[m[1]];
            if (!spec) throw new Error(`erno: bad ${name} move '${token}'`);
            const times = (m[2] ? parseInt(m[2], 10) : 1) * (m[3] ? -1 : 1);
            return { ...spec, angle: spec.angle * times };
          },
        }
      : {}),
    faceOrder: letters,
    faceSortDirs,
    colors,
    scramble: wca
      ? (rand, length) => {
          // The WCA sheet: lines of ten R/D moves, alternating, each ++ or
          // -- at random, closed by a U or U'. Seventy-seven moves flat.
          const lines = Math.max(1, Math.round((length || 77) / 11));
          const out = [];
          for (let l = 0; l < lines; l++) {
            for (let i = 0; i < 10; i++)
              out.push((i % 2 ? "D" : "R") + (rand() < 0.5 ? "++" : "--"));
            out.push(rand() < 0.5 ? "U" : "U'");
          }
          return out.join(" ");
        }
      : (rand, length) =>
          pickScramble(rand, letters, ["", "'"], length || scrambleLen).join(" "),
  };
}

let _megaminxDef, _kilominxDef;

/** Megaminx — the dodecahedral 3×3: 12 centres, 30 edges, 20 corners. */
export class Megaminx extends Twisty {
  constructor(options = {}) {
    fixedSize("Megaminx", options);
    // 0.62–0.75 all give the true 62 pieces / 11 stickers per face; sit in
    // the middle of that band so no cut lands on a vertex by rounding
    super(_megaminxDef || (_megaminxDef = buildMinxDef("megaminx", 0.68, 30)), options);
  }
}

/** Kilominx — the dodecahedral 2×2: corners only, no edges. */
export class Kilominx extends Twisty {
  constructor(options = {}) {
    fixedSize("Kilominx", options);
    super(_kilominxDef || (_kilominxDef = buildMinxDef("kilominx", 0.0, 20)), options);
  }
}

// ── Pyraminx ────────────────────────────────────────────────────────────────

// Shared tetrahedral frame: a regular tetrahedron on alternate cube corners
// (every symmetry rotation is an exact signed-permutation matrix), with a
// display-only `view` rotation putting the U vertex up and B at the back,
// faces lettered for the WCA layout (D opposite the U vertex, F opposite B,
// L/R faces opposite the R/L vertices) and view-derived reading order.
const TETRA_COLORS = { F: "#009b48", L: "#b71234", R: "#0046ad", D: "#ffd500" };

function tetraFrame(s) {
  const VU = [s, s, s];
  const VB = [s, -s, -s];
  const rest = [
    [-s, s, -s],
    [-s, -s, s],
  ];

  const tilt = rotateAlign(norm(VU), [0, 1, 0]);
  const b1 = matVec(tilt, VB);
  const view = matMul(rotationMatrix([0, 1, 0], Math.atan2(b1[0], -b1[2])), tilt);
  const viewT = transpose(view);

  const [pa, pb] = rest.map((v) => matVec(view, v));
  const VR = pa[0] > pb[0] ? rest[0] : rest[1];
  const VL = VR === rest[0] ? rest[1] : rest[0];
  const vertices = { U: VU, R: VR, L: VL, B: VB };

  const solid = [
    { letter: "F", pts: [vertices.U, vertices.R, vertices.L] },
    { letter: "L", pts: [vertices.U, vertices.L, vertices.B] },
    { letter: "R", pts: [vertices.U, vertices.B, vertices.R] },
    { letter: "D", pts: [vertices.R, vertices.B, vertices.L] },
  ];

  // Rows run downward in view (for D: from the front edge backward),
  // columns rightward.
  const faceSortDirs = {};
  for (const f of solid) {
    const n = norm(cross(
      [f.pts[1][0] - f.pts[0][0], f.pts[1][1] - f.pts[0][1], f.pts[1][2] - f.pts[0][2]],
      [f.pts[2][0] - f.pts[0][0], f.pts[2][1] - f.pts[0][1], f.pts[2][2] - f.pts[0][2]],
    ));
    const outward = dot(n, centroid3(f.pts)) >= 0 ? n : [-n[0], -n[1], -n[2]];
    const inPlane = (dir) => {
      const w = matVec(viewT, dir);
      const proj = [
        w[0] - outward[0] * dot(w, outward),
        w[1] - outward[1] * dot(w, outward),
        w[2] - outward[2] * dot(w, outward),
      ];
      return norm(proj);
    };
    const down = matVec(viewT, [0, -1, 0]);
    const flat = Math.abs(dot(down, outward)) > 0.9; // D face: "down" ⊥ plane
    faceSortDirs[f.letter] = [
      inPlane(flat ? [0, 0, -1] : [0, -1, 0]),
      inPlane([1, 0, 0]),
    ];
  }

  return { vertices, solid, view, faceSortDirs };
}

/**
 * Vertex-turning tetrahedra with `layers` layers per axis (Pyraminx = 3,
 * Master Pyraminx = 4). Tokens per vertex: lowercase turns the tip,
 * uppercase two layers, uppercase+w three (Master only).
 */
function buildTetraTurnDef(name, layers) {
  const s = 1.5;
  const { vertices, solid, view, faceSortDirs } = tetraFrame(s);

  const apex = s * Math.sqrt(3);
  const height = apex + s / Math.sqrt(3);
  const cutAt = (k) => apex - (k * height) / layers;

  const cuts = [];
  const moves = {};
  for (const [letter, v] of Object.entries(vertices)) {
    const u = norm(v);
    const spec = (min) => ({ axis: u, angle: (-2 * Math.PI) / 3, min });
    for (let k = 1; k < layers; k++) cuts.push({ n: u, d: cutAt(k) });
    moves[letter.toLowerCase()] = spec(cutAt(1) + 0.1);
    moves[letter] = spec(cutAt(2) + 0.1);
    if (layers > 3) moves[letter + "w"] = spec(cutAt(3) + 0.1);
  }

  const mains = Object.keys(moves).filter((t) => t !== t.toLowerCase());
  return {
    name,
    solid,
    cuts,
    moves,
    view,
    faceOrder: ["F", "L", "R", "D"],
    faceSortDirs,
    colors: { ...TETRA_COLORS },
    scramble: (rand, length) => {
      const tokens = pickScramble(rand, mains, ["", "'"], length || 4 * layers - 1);
      for (const tip of ["u", "l", "r", "b"])
        if (rand() < 0.5) tokens.push(tip + (rand() < 0.5 ? "'" : ""));
      return tokens.join(" ");
    },
  };
}

const buildPyraminxDef = () => buildTetraTurnDef("pyraminx", 3);

function centroid3(pts) {
  let x = 0,
    y = 0,
    z = 0;
  for (const p of pts) {
    x += p[0];
    y += p[1];
    z += p[2];
  }
  return [x / pts.length, y / pts.length, z / pts.length];
}

let _pyraminxDef;

export class Pyraminx extends Twisty {
  constructor(options = {}) {
    fixedSize("Pyraminx", options);
    super(_pyraminxDef || (_pyraminxDef = buildPyraminxDef()), options);
  }
}

let _masterPyraminxDef;

/** Master Pyraminx — the 4-layer Pyraminx: u tips, U two layers, Uw three. */
export class MasterPyraminx extends Twisty {
  constructor(options = {}) {
    fixedSize("MasterPyraminx", options);
    super(
      _masterPyraminxDef ||
        (_masterPyraminxDef = buildTetraTurnDef("master-pyraminx", 4)),
      options,
    );
  }
}

// ── Morphix family (cube mechanisms in a tetrahedral shell) ─────────────────

// A 2×2 (Pyramorphix) or 3×3 (Mastermorphix) mechanism inside the
// tetrahedron: quarter turns are legal but the shell is not symmetric under
// them, so the puzzle shape-shifts wildly; misaligned stickers report `?`.
function buildMorphixDef(name, n) {
  const { solid, view, faceSortDirs } = tetraFrame(1.5);
  const cuts = [];
  for (let axis = 0; axis < 3; axis++) {
    const u = [0, 0, 0];
    u[axis] = 1;
    if (n === 2) cuts.push({ n: u, d: 0 });
    else cuts.push({ n: u, d: -0.5 }, { n: u, d: 0.5 });
  }
  const band =
    n === 2
      ? (v) => (v < 0 ? -0.5 : 0.5)
      : (v) => (v < -0.5 ? -1 : v < 0.5 ? 0 : 1);
  return {
    name,
    solid,
    cuts,
    parseMove: n === 2 ? makeBoxParser([2, 2, 2]) : cubeParse3,
    slotPointOf: (c) => c.map(band),
    view,
    faceOrder: ["F", "L", "R", "D"],
    faceSortDirs,
    colors: { ...TETRA_COLORS },
    // A 2×2 body has no opposite-face turns to name: U, R and F reach every
    // layer there is.
    tokens:
      n === 2
        ? ["U", "R", "F"].flatMap((f) => ["", "'", "2"].map((s) => f + s))
        : CUBE3_TOKENS,
    scramble: (rand, length) =>
      n === 2
        ? pickScramble(rand, ["U", "R", "F"], ["", "'", "2"], length || 11).join(" ")
        : pickScramble(rand, ["U", "R", "F", "D", "L", "B"], ["", "'", "2"], length || 25).join(" "),
  };
}

let _pyramorphixDef, _mastermorphixDef;

export class Pyramorphix extends Twisty {
  constructor(options = {}) {
    fixedSize("Pyramorphix", options);
    super(
      _pyramorphixDef || (_pyramorphixDef = buildMorphixDef("pyramorphix", 2)),
      options,
    );
  }
}

export class Mastermorphix extends Twisty {
  constructor(options = {}) {
    fixedSize("Mastermorphix", options);
    super(
      _mastermorphixDef ||
        (_mastermorphixDef = buildMorphixDef("mastermorphix", 3)),
      options,
    );
  }
}

// ── Mirror cube ─────────────────────────────────────────────────────────────

// A mirror cube is a regular 3×3 mechanism sitting OFF-CENTER inside the
// cube: the middle layer has the same thickness on every axis (the cut
// planes sit at pivot ± ½), only the mechanism pivot is displaced. Turns
// rotate about the pivot, so the cut planes map onto each other exactly —
// blocks stay flush at the cuts while the outer surfaces protrude and
// recess. Rotating about the geometric center instead would slice through
// pieces and open impossible gaps.
const MIRROR_PIVOT = [0.3, -0.45, 0.15];

function buildMirrorDef() {
  const pivot = MIRROR_PIVOT;
  const cuts = [];
  pivot.forEach((c, axis) => {
    const u = [0, 0, 0];
    u[axis] = 1;
    cuts.push({ n: u, d: c - 0.5 }, { n: u, d: c + 0.5 });
  });

  // Logical slots live on the uniform grid regardless of the uneven layers:
  // classify the physical centroid per axis, then snap to {-1, 0, 1}.
  const slotPointOf = (centroid) =>
    centroid.map((c, axis) => {
      const p = pivot[axis];
      return c < p - 0.5 ? -1 : c < p + 0.5 ? 0 : 1;
    });

  const silver = "#c9ccd1";
  return {
    name: "mirror",
    solid: cubeSolid(1.5),
    cuts,
    pivot,
    parseMove: cubeParse3,
    slotPointOf,
    faceOrder: ["U", "R", "F", "D", "L", "B"],
    faceSortDirs: CUBE_SORT_DIRS,
    colors: { U: silver, R: silver, F: silver, D: silver, L: silver, B: silver },
    tokens: CUBE3_TOKENS,
    orientations: CUBE_ORIENTATIONS,
    scramble: (rand, length) =>
      pickScramble(rand, ["U", "R", "F", "D", "L", "B"], ["", "'", "2"], length || 25).join(" "),
  };
}

let _mirrorDef;

export class Mirror extends Twisty {
  constructor(options = {}) {
    fixedSize("Mirror", options);
    super(_mirrorDef || (_mirrorDef = buildMirrorDef()), options);
  }
}

// ── Void cube ───────────────────────────────────────────────────────────────

function buildVoidDef() {
  const cuts = [];
  for (let axis = 0; axis < 3; axis++) {
    const u = [0, 0, 0];
    u[axis] = 1;
    cuts.push({ n: u, d: -0.5 }, { n: u, d: 0.5 });
  }

  return {
    name: "void",
    solid: cubeSolid(1.5),
    cuts,
    parseMove: cubeParse3,
    // Drop the six face centers (two zero coordinates in slot space) — the
    // engine renders interior plastic walls, so the holes go all the way
    // through like the real puzzle.
    keepPiece: (slotPoint) =>
      slotPoint.filter((v) => Math.abs(v) < 1e-6).length < 2,
    faceOrder: ["U", "R", "F", "D", "L", "B"],
    faceSortDirs: CUBE_SORT_DIRS,
    colors: { ...CUBE_COLORS },
    tokens: CUBE3_TOKENS,
    orientations: CUBE_ORIENTATIONS,
    scramble: (rand, length) =>
      pickScramble(rand, ["U", "R", "F", "D", "L", "B"], ["", "'", "2"], length || 25).join(" "),
  };
}

let _voidDef;

export class Void extends Twisty {
  constructor(options = {}) {
    fixedSize("Void", options);
    super(_voidDef || (_voidDef = buildVoidDef()), options);
  }
}

// ── Cuboids ─────────────────────────────────────────────────────────────────

// Non-cubic nx×ny×nz boxes (dims ordered x = R–L, y = U–D, z = F–B). Layers
// are unit cells; quarter turns are legal only about axes with a square
// cross section, half turns everywhere — so the puzzle always stays a box.
// The classics: Domino 3×2×3 (Rubik's pre-cube 1978 puzzle), Tower 2×3×2,
// Floppy 3×1×3 (only 180° flips exist).
/**
 * Every move a box this size can name, sized to the box in hand.
 *
 * All cubes used to share a 3×3's eighteen face tokens, which meant a 5×5
 * could not SAY most of what it could DO: parseMove turned `Uw`, `3Uw` and
 * `M` happily, but vocabulary() never named them, so legalMoves() withheld
 * them, keypads never drew them, and a 7×7 scramble moved nothing but its
 * outer skin. The parser was never the gap; the naming was.
 *
 * Faces always; wide blocks two deep and deeper, up to half the axis, the
 * way big-cube notation spells them (`Uw`, then `3Uw`); and the middle
 * slice letter where an odd axis has a middle. Single inner layers need no
 * tokens of their own: `3Uw Uw'` reaches any of them, which is why big-cube
 * notation never named them either.
 */
function boxTokens(dims) {
  const suffixes = ["", "'", "2"];
  const faces = [];
  const wides = [];
  const slices = [];
  for (const f of FACES) for (const x of suffixes) faces.push(f + x);
  for (const f of FACES) {
    const m = dims[FACE_AXIS[f][0]];
    for (let k = 2; k <= Math.floor(m / 2); k++)
      for (const x of suffixes) wides.push((k === 2 ? "" : k) + f + "w" + x);
  }
  for (const [sl, [axis]] of Object.entries(SLICE_AXIS))
    if (dims[axis] >= 3 && dims[axis] % 2 === 1)
      for (const x of suffixes) slices.push(sl + x);
  // faces first, so the first eighteen stay what they have always been
  return [...faces, ...wides, ...slices];
}

function buildCuboidDef(dims, shapeShift = false) {
  const [nx, ny, nz] = dims;
  const cuts = [];
  for (let axis = 0; axis < 3; axis++) {
    const u = [0, 0, 0];
    u[axis] = 1;
    for (let k = 1; k < dims[axis]; k++) cuts.push({ n: u, d: k - dims[axis] / 2 });
  }

  const square = [ny === nz, nx === nz, nx === ny];
  const AXIS_OF = { R: 0, L: 0, U: 1, D: 1, F: 2, B: 2 };

  return {
    name: `cuboid-${nx}x${ny}x${nz}${shapeShift ? "-shift" : ""}`,
    solid: boxSolid(nx / 2, ny / 2, nz / 2),
    cuts,
    // the sized vocabulary, so legalMoves() can answer on any box
    tokens: boxTokens(dims),
    // Only a cube can be held every way up. Tip a Domino onto its side and
    // the layer counts no longer match the axes, so the rotation is not a
    // way of holding the puzzle — it is a different puzzle.
    orientations: nx === ny && ny === nz ? CUBE_ORIENTATIONS : undefined,
    parseMove: makeBoxParser(dims, shapeShift),
    faceOrder: ["U", "R", "F", "D", "L", "B"],
    faceSortDirs: CUBE_SORT_DIRS,
    colors: { ...CUBE_COLORS },
    scramble: (rand, length) => {
      // Faces and wide blocks, the way big-cube scrambles are written: a
      // 5×5 scrambled with face turns alone moves nothing but its outer
      // skin. Slices stay out of scrambles, as they do in cubers' own,
      // being spans of what the wides already reach; they are in the
      // vocabulary for hands and algebra, not for shuffling. The quarter
      // versus half policy is the same one the faces answer to, because a
      // wide block misshapes a box exactly as its face does.
      const bases = [];
      for (const f of "URFDLB") {
        const axis = AXIS_OF[f];
        if (dims[axis] === 1) continue;
        bases.push({ base: f, axis });
        for (let k = 2; k <= Math.floor(dims[axis] / 2); k++)
          bases.push({ base: (k === 2 ? "" : k) + f + "w", axis });
      }
      const count = length || Math.min(30, 3 * (nx + ny + nz));
      const tokens = [];
      let last = null;
      while (tokens.length < count) {
        const pick = bases[Math.floor(rand() * bases.length)];
        if (pick.base === last) continue;
        last = pick.base;
        tokens.push(
          square[pick.axis] || shapeShift
            ? pick.base + ["", "'", "2"][Math.floor(rand() * 3)]
            : pick.base + "2",
        );
      }
      return tokens.join(" ");
    },
  };
}

const _cuboidDefs = new Map();

export class Cuboid extends Twisty {
  /**
   * @param {import('./twisty.js').TwistyOptions & {
   *   size?: [number, number, number],
   *   shapeShift?: boolean,
   * }} [options] - Twisty options plus `size`, layers per axis
   *   (x = R–L, y = U–D, z = F–B, default [3,2,3]), and `shapeShift`,
   *   which allows the quarter turns
   *   that leave the box misshapen. Off, the puzzle refuses them the way a
   *   Domino's mechanism does; on, it shifts shape the way a 3×3×5 does.
   */
  constructor(options = {}) {
    const dims = (options.size || [3, 2, 3]).map((v) => Math.round(v));
    if (dims.length !== 3 || dims.some((v) => v < 1 || v > 8))
      throw new Error(`erno: bad cuboid size [${dims}] (1–8 layers per axis)`);
    // the flag changes the definition, so it has to key the cache too
    const key = dims.join("x") + (options.shapeShift ? "+shift" : "");
    let def = _cuboidDefs.get(key);
    if (!def) {
      def = buildCuboidDef(dims, !!options.shapeShift);
      _cuboidDefs.set(key, def);
    }
    super(def, options);
    this.dims = dims;
  }
}

/** Rubik's Domino — 3×2×3, Ernő Rubik's 1978 pre-cube puzzle. */
export class Domino extends Cuboid {
  constructor(options = {}) {
    super({ ...options, size: [3, 2, 3] });
  }
}

/** Tower cube — 2×3×2: quarter turns about the tall axis only. */
export class Tower extends Cuboid {
  constructor(options = {}) {
    super({ ...options, size: [2, 3, 2] });
  }
}

/** Floppy cube — 3×1×3: nothing but 180° flips. */
export class Floppy extends Cuboid {
  constructor(options = {}) {
    super({ ...options, size: [3, 1, 3] });
  }
}

/**
 * A plain cube on the piece engine — the thing you want when a 3×3 has to
 * carry a paint, since `Erno` is the facelet representation and has no
 * pieces to paint. `Cuboid` could stand in, but only written out as
 * `new Cuboid({ size: [3, 3, 3] })`: its own default is a 3×2×3, which
 * nobody would guess.
 *
 *   new Cube({ paint: tetrisPaint })   // the Tetris cube, from a plain 3×3
 */
export class Cube extends Cuboid {
  /**
   * @param {Object} [options] - Cuboid options, except `size` is a single
   *   number: the cube's dimension (default 3).
   */
  constructor(options = {}) {
    const n = options.size === undefined ? 3 : options.size;
    if (typeof n !== "number")
      throw new Error(
        `erno: Cube takes a single number for size, not [${n}]: use Cuboid for uneven sides`,
      );
    super({ ...options, size: [n, n, n] });
  }
}

// ── Deformation ─────────────────────────────────────────────────────────────

/**
 * A compression along `axis` by factor `k` — the linear map that turns a cube
 * into a rhombohedron.
 *
 * `I + (k − 1)·nnᵀ` leaves everything perpendicular to the axis alone and
 * scales what lies along it, so the six faces become rhombi and the cubies
 * parallelepipeds while the 3×3 structure is untouched. Pass it as `deform`.
 *
 *   new Cube({ deform: squash(0.6) })
 */
export function squash(k, axis = [1, 1, 1]) {
  const len = Math.hypot(...axis) || 1;
  const n = axis.map((v) => v / len);
  const m = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++) m[i][j] += (k - 1) * n[i] * n[j];
  return m;
}

/**
 * A twist: rotate about the vertical by an amount that grows with height.
 *
 * `squash` is a matrix, because a squash is linear. This cannot be: the
 * angle depends on where the point is, and no 3×3 matrix says that. So it
 * is a function, which `deform` also takes.
 *
 * It is a way of LOOKING, which is the whole point. The mechanism under it
 * is an ordinary cube: straight cuts, a clean 3×3 on every face, one colour
 * per face, six turns, and a scramble that inverts exactly. Only the picture
 * is wrung. That is what a twist cube is, and the reason this file spent a
 * while trying to mould one out of twisted material instead is that the
 * shape looked like the puzzle. It is not; the shape is a shell.
 *
 * @param {number} degrees - total turn from bottom to top
 * @param {number} [reach] - the height over which it is spread
 */
export function twist(degrees, reach = 1.5) {
  const total = (degrees * Math.PI) / 180;
  return ([x, y, z]) => {
    const a = ((y + reach) / (2 * reach) - 0.5) * total;
    const c = Math.cos(a);
    const s = Math.sin(a);
    return [x * c + z * s, y, -x * s + z * c];
  };
}

// ── Printed faces: dice, dominoes, sudoku ───────────────────────────────────

// Three more puzzles that are not puzzles. A dice cube, a Sudokube and the
// spots on Ernő's own Domino are the same mechanisms underneath, printed
// differently — the argument that made Tetris a paint, one step further: a
// paint sets a sticker's colour, a decal puts a MARK on it. Marks are
// printed at build time, so they belong to the cubie and travel with it.

// Pip positions on a 3×3 grid, 1 through 9. Six and up are the domino
// patterns; a die stops at six.
const PIPS = {
  1: [[1, 1]],
  2: [[0, 0], [2, 2]],
  3: [[0, 0], [1, 1], [2, 2]],
  4: [[0, 0], [0, 2], [2, 0], [2, 2]],
  5: [[0, 0], [0, 2], [1, 1], [2, 0], [2, 2]],
  6: [[0, 0], [0, 2], [1, 0], [1, 2], [2, 0], [2, 2]],
  7: [[0, 0], [0, 2], [1, 0], [1, 1], [1, 2], [2, 0], [2, 2]],
  8: [[0, 0], [0, 1], [0, 2], [1, 0], [1, 2], [2, 0], [2, 1], [2, 2]],
  9: [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2], [2, 0], [2, 1], [2, 2]],
};

// Opposite faces of a die sum to seven, so the cube's own opposites carry it.
const DIE_FACE = { U: 1, D: 6, F: 2, B: 5, R: 3, L: 4 };

/** Ink or paper, whichever the sticker underneath can carry. */
function inkOn(fill) {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(String(fill || "").trim());
  if (!m) return "#17110c";
  const n = parseInt(m[1], 16);
  const lum =
    (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
  return lum > 0.5 ? "#17110c" : "#f4efe7";
}

/** A cluster of `n` pips laid out inside one sticker. */
function pipCluster(n, fill, r = 0.082, spread = 0.64) {
  const c = inkOn(fill);
  const lo = (1 - spread) / 2;
  return (PIPS[n] || [])
    .map(
      ([row, k]) =>
        `<circle cx="${(lo + ((k + 0.5) / 3) * spread).toFixed(3)}" cy="${(
          lo +
          ((row + 0.5) / 3) * spread
        ).toFixed(3)}" r="${r}" fill="${c}"/>`,
    )
    .join("");
}

/**
 * The dice cube: every cubie IS a die, so every sticker carries a whole face
 * of one — not one die spread across nine stickers, which is the version
 * that looks tidier and is not the puzzle. Each little die reads its home
 * face's number, and the cube's opposite faces sum to seven exactly as a
 * die's do, so a solved face is nine identical dice and a scrambled one is
 * the jumble of counts you see on the real thing.
 *
 *   new Cube(DICE_CUBE)              // with its black-and-white printing
 *   new Cube({ decal: dicePips })    // the marks alone
 */
export function dicePips({ face, row, fill }) {
  const n = DIE_FACE[face];
  if (!n || row === undefined) return null;
  return pipCluster(n, fill, 0.115, 0.72);
}

/**
 * Ernő Rubik's Domino (1978), printed the way it shipped: its two square
 * faces carry the numbers one to nine as domino pips. The 3×2 sides stay
 * bare, which is why this asks for a square face and passes on the rest.
 *
 *   new Domino({ decal: dominoPips })
 */
export function dominoPips({ index, row, fill }) {
  if (row === undefined) return null;
  return pipCluster(index + 1, fill);
}

/**
 * The Sudokube: one to nine on every face, so a solved face reads 1–9 and
 * the colours stop being the puzzle. Set it on any square-faced mechanism.
 *
 *   new Cube({ decal: sudokuDigits })
 */
export function sudokuDigits({ index, row, fill }) {
  if (row === undefined) return null;
  return `<text x="0.5" y="0.54" text-anchor="middle" dominant-baseline="central" font-family="ui-monospace, monospace" font-size="0.62" font-weight="700" fill="${inkOn(
    fill,
  )}">${index + 1}</text>`;
}

/**
 * The printings. A dice cube is black with white pips, a Sudokube white with
 * black numerals, the Domino cream tiles on black — the colour is not a
 * scheme choice on these, it is what the puzzle looks like. Spread one into
 * the constructor.
 *
 *   new Cube(DICE_CUBE)
 *   new Cube(SUDOKU_CUBE)
 *   new Domino(DOMINO_PRINT)
 */
const allFaces = (fill) =>
  Object.fromEntries(FACES.map((f) => [f, fill]));

export const DICE_CUBE = {
  colors: allFaces("#1b1b1b"),
  plastic: "#0a0a0a",
  decal: dicePips,
};

export const SUDOKU_CUBE = {
  colors: allFaces("#f2f0eb"),
  plastic: "#141414",
  decal: sudokuDigits,
};

export const DOMINO_PRINT = {
  colors: { U: "#efdfba", D: "#efdfba", R: "#1b1b1b", L: "#1b1b1b", F: "#1b1b1b", B: "#1b1b1b" },
  plastic: "#0a0a0a",
  decal: dominoPips,
};

// ── Fused puzzles ───────────────────────────────────────────────────────────

// Fusion is the union, the sibling of `remove`'s subtraction: two or more
// boxes welded into one body. The classics are the Siamese cubes — two 3×3s
// sharing a bar of cubies — and the corner-mounted odd sizes people build by
// gluing a 2×2 onto a 3×3.
//
// The geometry is the easy half. What makes a Siamese cube a puzzle rather
// than a diorama is which turns it REFUSES: a layer of one cube reaches into
// the other, and the two together no longer add up to a shape that spins. The
// engine already knows the law that decides this — a turn is only possible if
// its layer comes back to itself — so the definitions below just switch it
// on, and the blocked moves fall out. Nothing here enumerates them.
//
// Bodies must share one unit lattice; otherwise a body's wall would slice its
// neighbour's cubies in half, and the result would be a shape, not a puzzle.
const BODY_LETTERS = "ABCDEFGH";
const FUSED_RE = /^([A-H])([URFDLBEMS])(\d*)('?)$/;

function buildFusedDef(name, bodies) {
  bodies.forEach((b, i) => {
    if (!Array.isArray(b.size) || b.size.length !== 3)
      throw new Error(`erno: body ${i} needs a size [nx,ny,nz]`);
    if (b.size.some((v) => !Number.isInteger(v) || v < 1 || v > 8))
      throw new Error(`erno: body ${i} has a bad size [${b.size}] (1–8 layers)`);
  });
  // shared lattice check: every body's grid must land on the same integers
  const originOf = (b, ax) => b.at[ax] - b.size[ax] / 2;
  for (let ax = 0; ax < 3; ax++)
    for (let i = 1; i < bodies.length; i++) {
      const shift = originOf(bodies[i], ax) - originOf(bodies[0], ax);
      if (Math.abs(shift - Math.round(shift)) > 1e-9)
        throw new Error(
          `erno: body ${i} is off the shared lattice on axis ${"xyz"[ax]} by ${shift.toFixed(3)}. Fused bodies must line up cubie to cubie`,
        );
    }

  const solids = bodies.map((b) =>
    boxSolid(b.size[0] / 2, b.size[1] / 2, b.size[2] / 2).map((f) => ({
      ...f,
      pts: f.pts.map((p) => [p[0] + b.at[0], p[1] + b.at[1], p[2] + b.at[2]]),
    })),
  );

  // Every layer boundary of every body, walls included, so a cut of one body
  // also parts its neighbour where they overlap.
  const cuts = [];
  const seenCut = new Set();
  for (const b of bodies)
    for (let ax = 0; ax < 3; ax++)
      for (let k = 0; k <= b.size[ax]; k++) {
        const d = originOf(b, ax) + k;
        const key = `${ax}:${Math.round(d * 1e5)}`;
        if (seenCut.has(key)) continue;
        seenCut.add(key);
        const n = [0, 0, 0];
        n[ax] = 1;
        cuts.push({ n, d });
      }

  const letters = BODY_LETTERS.slice(0, bodies.length);
  const tokens = [];
  for (const L of letters)
    for (const f of FACES) for (const s of ["", "'", "2"]) tokens.push(L + f + s);
  // The middle slices, per body, where a middle exists. A welded body cannot
  // rotate whole, so its slices are not composable from face turns the way a
  // cube's are: E is D's layerless remainder only if U and D both turn, and
  // on a welded body they mostly do not. The slice is the primitive here.
  // Even-sized axes have no middle layer, so they get no token rather than a
  // token that always refuses.
  letters.split("").forEach((L, bi) => {
    for (const [sl, [ax]] of Object.entries(SLICE_AXIS))
      if (bodies[bi].size[ax] >= 3 && bodies[bi].size[ax] % 2 === 1)
        for (const s of ["", "'", "2"]) tokens.push(L + sl + s);
  });

  return {
    name,
    solids,
    cuts,
    blocking: true,
    tokens,
    // each body turns about itself, so the frame has to allow for all of them
    turnCenters: bodies.map((b) => b.at),
    parseMove(token) {
      const m = FUSED_RE.exec(token);
      const bi = m ? letters.indexOf(m[1]) : -1;
      if (bi < 0)
        throw new Error(
          `erno: bad ${name} move '${token}': bodies are ${letters.split("").join("/")}, as in ${letters[0]}U or ${letters[0]}R2`,
        );
      const count = (m[3] ? parseInt(m[3], 10) : 1) * (m[4] ? -1 : 1);
      const body = bodies[bi];
      if (SLICE_AXIS[m[2]]) {
        // A middle slice: the band half a cubie either side of the body's
        // own mid-plane, following the cube's slice conventions (M with L,
        // E with D, S with F). The band is cut across the whole assembly,
        // like every turn here, and whether what it catches can actually
        // turn is the blocking law's ruling, not this function's: an AE
        // clears the weld and turns, an AS drags the neighbour's middle
        // slab along and is refused.
        const [ax, dir] = SLICE_AXIS[m[2]];
        if (body.size[ax] < 3 || body.size[ax] % 2 === 0)
          throw new Error(
            `erno: body ${m[1]} is ${body.size[ax]} layers deep on that axis, so it has no middle layer for ${m[2]}`,
          );
        const u = [0, 0, 0];
        u[ax] = dir;
        return {
          axis: u,
          angle: -(Math.PI / 2) * count,
          min: dir * body.at[ax] - 0.5,
          max: dir * body.at[ax] + 0.5,
          center: body.at,
        };
      }
      const [ax, dir] = FACE_AXIS[m[2]];
      const u = [0, 0, 0];
      u[ax] = dir;
      // A turn cleaves the whole assembly at the plane one layer in from
      // that face and spins everything beyond it about the body's own axis.
      return {
        axis: u,
        angle: -(Math.PI / 2) * count,
        min: dir * body.at[ax] + body.size[ax] / 2 - 1,
        center: body.at,
      };
    },
    faceOrder: ["U", "R", "F", "D", "L", "B"],
    faceSortDirs: CUBE_SORT_DIRS,
    colors: { ...CUBE_COLORS },
    scrambleLength: 20,
  };
}

const _fusedDefs = new Map();

/**
 * Two or more boxes welded into one puzzle.
 *
 * @param {import('./twisty.js').TwistyOptions & {
 *   bodies?: { size: [number, number, number], at: [number, number, number] }[],
 * }} [options] - Twisty options plus `bodies`: `[{ size: [nx,ny,nz], at: [x,y,z] }]` —
 *   each body's layer counts and the position of its centre, in cubies. The
 *   bodies must share a unit lattice.
 *
 * Notation prefixes the face with the body's letter: `AU`, `BR'`, `AF2`,
 * and each body's middle slices where a middle exists: `AE`, `AM'`, `BS2`.
 * Turns that would tear the weld throw; `legalMoves()` lists what is left.
 */
export class Fused extends Twisty {
  constructor(options = {}) {
    const bodies = options.bodies || [
      { size: [3, 3, 3], at: [0, 0, 0] },
      { size: [3, 3, 3], at: [2, 2, 0] },
    ];
    const key = bodies.map((b) => `${b.size}@${b.at}`).join("+");
    let def = _fusedDefs.get(key);
    if (!def) {
      // Named "fused", not named after its key. The two were the same string
      // and the key is a shape signature, so a reader who asked for a turn
      // this puzzle will not make was told `bad fused-3,3,3a0,0,0+2,2,2a...
      // move 'R'`. The Map already holds the key; the name is for people.
      def = buildFusedDef("fused", bodies);
      _fusedDefs.set(key, def);
    }
    super(def, options);
    this.bodies = bodies;
  }
}

/**
 * The Siamese cube: two cubes sharing a block of cubies.
 *
 * @param {import('./twisty.js').TwistyOptions & {
 *   size?: number,
 *   offset?: [number, number, number],
 * }} [options] - Twisty options plus `size` (layers per side of each cube,
 *   default 3) and `offset` (default [2,2,0]): how far the
 *   second cube is displaced, in cubies. The shared block is what is left
 *   where they overlap: the default gives the classic 1×1×3 bar, `[1,2,0]`
 *   the 2×1×3, `[2,0,0]` the 1×3×3 slab (which is really a 5×3×3 cuboid,
 *   and turns like one).
 */
export class Siamese extends Fused {
  constructor(options = {}) {
    const n = options.size === undefined ? 3 : options.size;
    const at = options.offset || [2, 2, 0];
    if (at.some((v) => !Number.isInteger(v) || Math.abs(v) > n))
      throw new Error(
        `erno: Siamese offset [${at}] must be whole cubies, no further than ${n}`,
      );
    if (at.every((v) => v === 0))
      throw new Error(`erno: a Siamese offset of [0,0,0] is one cube, not two`);
    super({
      ...options,
      bodies: [
        { size: [n, n, n], at: [0, 0, 0] },
        { size: [n, n, n], at },
      ],
    });
  }
}

// ── Rubik's Tetris ──────────────────────────────────────────────────────────

// The official Rubik's × Tetris cube: a standard 3×3 whose 26 cubies are
// SOLID-COLORED blocks. Solved, each face reveals one classic Tetrimino in
// its Tetris color, built around that face's colored center; the I-Tetrimino
// doesn't fit a 3×3 face (it ships as the display stand instead). Exactly
// two cubies stay white — on the real puzzle one of them carries the logo.
//
// The arrangement below was found by exact-cover search: every shape
// contains its face's center, no cubie serves two shapes, and the leftover
// is one white edge + one white corner. Faces: U=S, R=L, F=T, D=J, L=Z, B=O.
const TETRIS_COLORS = {
  S: "#3fbf5a", // green
  Z: "#ef4444", // red
  L: "#f59e0b", // orange
  J: "#2e3fae", // blue
  T: "#8f4fc4", // purple
  O: "#f5d90a", // yellow
  W: "#f5f3ee", // white filler
};

// cubie grid key "x,y,z" (0..2 per axis; 0 = L/D/B side) → tetromino
const TETRIS_CUBIES = {
  // centers anchor their face's shape
  "1,2,1": "S", "2,1,1": "L", "1,1,2": "T", "1,0,1": "J", "0,1,1": "Z", "1,1,0": "O",
  // S on U
  "2,2,1": "S", "0,2,2": "S", "1,2,2": "S",
  // L on R
  "2,1,2": "L", "2,1,0": "L", "2,2,0": "L",
  // T on F
  "2,0,2": "T", "1,0,2": "T", "0,0,2": "T",
  // J on D
  "0,0,1": "J", "2,0,1": "J", "2,0,0": "J",
  // Z on L
  "0,2,0": "Z", "0,2,1": "Z", "0,1,2": "Z",
  // O on B
  "0,1,0": "O", "1,0,0": "O", "0,0,0": "O",
  // white: UB edge ("1,2,0") and UFR corner ("2,2,2")
};

/**
 * The Tetris layout as a reusable paint. Mechanically the Tetris cube is an
 * ordinary 3×3 — same solid, same cuts, same notation — and everything that
 * makes it Tetris is this tinting. So it is published as a paint rather
 * than locked inside one class: `new Mirror({ paint: tetrisPaint })` works,
 * and so does any other 3×3 mechanism.
 *
 * The layout itself is a hand-found exact-cover solution: one tetromino per
 * face wrapped around its centre, no I piece, two white fillers. It does
 * NOT generalise to other sizes by formula — a 4×4 would need the search
 * run again — so this paint leaves anything outside the 3×3 grid untinted.
 */
export function tetrisPaint({ slot }) {
  const key = slot.map((v) => Math.round(v) + 1).join(",");
  const shape = TETRIS_CUBIES[key];
  return shape ? TETRIS_COLORS[shape] : TETRIS_COLORS.W;
}

/** The Tetris palette, keyed by tetromino letter. */
export const TETRIS_PALETTE = { ...TETRIS_COLORS };

function buildTetrisDef() {
  const cuts = [];
  for (let axis = 0; axis < 3; axis++) {
    const u = [0, 0, 0];
    u[axis] = 1;
    cuts.push({ n: u, d: -0.5 }, { n: u, d: 0.5 });
  }

  return {
    name: "tetris",
    solid: cubeSolid(1.5),
    cuts,
    parseMove: cubeParse3,
    paint: (pieces) => {
      for (const piece of pieces) {
        const key = piece.slotPoint.map((v) => Math.round(v) + 1).join(",");
        const tint = TETRIS_COLORS[TETRIS_CUBIES[key] || "W"];
        for (const f of piece.faces) if (f.letter) f.tint = tint;
      }
    },
    faceOrder: ["U", "R", "F", "D", "L", "B"],
    faceSortDirs: CUBE_SORT_DIRS,
    colors: {
      U: TETRIS_COLORS.S,
      R: TETRIS_COLORS.L,
      F: TETRIS_COLORS.T,
      D: TETRIS_COLORS.J,
      L: TETRIS_COLORS.Z,
      B: TETRIS_COLORS.O,
    },
    tokens: CUBE3_TOKENS,
    orientations: CUBE_ORIENTATIONS,
    scramble: (rand, length) =>
      pickScramble(rand, ["U", "R", "F", "D", "L", "B"], ["", "'", "2"], length || 25).join(" "),
  };
}

let _tetrisDef;

export class Tetris extends Twisty {
  constructor(options = {}) {
    fixedSize("Tetris", options);
    super(_tetrisDef || (_tetrisDef = buildTetrisDef()), options);
    this._solvedTints = this.getTints().join();
  }

  /**
   * Solved when the visible color pattern matches the factory state — the
   * cubies are solid-colored, so same-colored pieces are interchangeable
   * and orientation doesn't matter, exactly like the real puzzle.
   */
  isSolved() {
    return this.getTints().join() === this._solvedTints;
  }
}

// ── Conjugated-mechanism shape mods (Fisher, Windmill, Axis, Ghost) ─────────

// A 3×3 mechanism rotated by an arbitrary rotation R0 inside a normal cube
// shell: the logical slots are the mechanism's uniform grid (unit spacing
// along its own axes), while the physical pieces come from slicing the cube
// shell with the rotated cut planes. Turns about mechanism axes push pieces
// out at odd angles, so the puzzle shape-shifts; stickers caught mid-air
// face off-grid directions and report `?` in getState() until they realign.
function buildConjugatedDef(name, R0, options = {}) {
  const AX = [0, 1, 2].map((i) => [R0[0][i], R0[1][i], R0[2][i]]);

  const cuts = [];
  for (const n of AX) cuts.push({ n, d: -0.5 }, { n, d: 0.5 });

  const band = (v) => (v < -0.5 ? -1 : v < 0.5 ? 0 : 1);
  const slotPointOf = (c) => {
    const b = AX.map((a) => band(dot(c, a)));
    return [
      b[0] * AX[0][0] + b[1] * AX[1][0] + b[2] * AX[2][0],
      b[0] * AX[0][1] + b[1] * AX[1][1] + b[2] * AX[2][1],
      b[0] * AX[0][2] + b[1] * AX[1][2] + b[2] * AX[2][2],
    ];
  };

  const moves = {};
  const axes = {
    R: AX[0],
    L: AX[0].map((v) => -v),
    U: AX[1],
    D: AX[1].map((v) => -v),
    F: AX[2],
    B: AX[2].map((v) => -v),
  };
  for (const [letter, axis] of Object.entries(axes))
    moves[letter] = { axis, angle: -Math.PI / 2, min: 0.5 };

  return {
    name,
    solid: cubeSolid(1.5),
    cuts,
    moves,
    slotPointOf,
    faceOrder: ["U", "R", "F", "D", "L", "B"],
    faceSortDirs: CUBE_SORT_DIRS,
    colors: options.colors || { ...CUBE_COLORS },
    scramble: (rand, length) =>
      pickScramble(rand, ["U", "D", "R", "L", "F", "B"], ["", "'", "2"], length || 25).join(" "),
  };
}

const rotY = (deg) => rotationMatrix([0, 1, 0], (deg * Math.PI) / 180);

let _fisherDef, _windmillDef, _axisDef, _ghostDef;

/** Fisher Cube — 3×3 mechanism yawed 45°; R/L/F/B name the diagonal faces. */
export class Fisher extends Twisty {
  constructor(options = {}) {
    fixedSize("Fisher", options);
    super(_fisherDef || (_fisherDef = buildConjugatedDef("fisher", rotY(45))), options);
  }
}

// The Windmill's yaw is not a round number, it is a condition: the cut planes
// pass exactly through the cube's vertical edges. That is what the puzzle IS,
// and it is why the top face reads as a pinwheel instead of a rotated grid.
//
// A cut has normal (cos0, 0, sin0) and sits at 0.5; the edge it must meet is
// at (1.5, y, -1.5). So 1.5cos0 - 1.5sin0 = 0.5, which is cos0 - sin0 = 1/3,
// which is cos(0 + 45°) = sqrt(2)/6. All four vertical cuts satisfy it at
// once, by symmetry.
//
// Rounded to 30° instead, the second cut misses the edge by a whisker and
// leaves a sliver of a column one part in fifty wide down the side of every
// face: a hairline that is not on the real puzzle.
const WINDMILL_YAW = (Math.acos(Math.SQRT2 / 6) * 180) / Math.PI - 45; // 31.367°

/** Windmill Cube — the same idea as the Fisher, yawed until the cuts meet the
 *  cube's edges: pinwheel top, two columns of different widths on each side. */
export class Windmill extends Twisty {
  constructor(options = {}) {
    fixedSize("Windmill", options);
    super(
      _windmillDef || (_windmillDef = buildConjugatedDef("windmill", rotY(WINDMILL_YAW))),
      options,
    );
  }
}

/** Axis Cube — mechanism rotated 60° about a corner diagonal. */
export class Axis extends Twisty {
  constructor(options = {}) {
    fixedSize("Axis", options);
    super(
      _axisDef ||
        (_axisDef = buildConjugatedDef(
          "axis",
          rotationMatrix(norm([1, 1, 1]), Math.PI / 3),
        )),
      options,
    );
  }
}

/**
 * Ghost Cube — mechanism skewed by a compound odd angle, uniform pale
 * stickers: solved it is a monolith with strange seams; one move and it
 * shatters into apparent chaos.
 */
export class Ghost extends Twisty {
  constructor(options = {}) {
    fixedSize("Ghost", options);
    if (!_ghostDef) {
      const pale = "#eceae4";
      _ghostDef = buildConjugatedDef(
        "ghost",
        matMul(rotY(21), rotationMatrix([1, 0, 0], (24 * Math.PI) / 180)),
        { colors: { U: pale, R: pale, F: pale, D: pale, L: pale, B: pale } },
      );
    }
    super(_ghostDef, options);
  }
}

// ── Dino & Helicopter (corner- and edge-turning cubes) ──────────────────────

// Multi-letter move tokens (URF, UF…), normalized by letter sort so URF,
// RUF and FUR all name the same corner.
function namedMoveParser(name, moves) {
  return (token) => {
    const m = /^([A-Za-z]+)(\d*)('?)$/.exec(token);
    const key = m && [...m[1].toUpperCase()].sort().join("");
    const spec = key && moves[key];
    if (!spec) throw new Error(`erno: bad ${name} move '${token}'`);
    const times = (m[2] ? parseInt(m[2], 10) : 1) * (m[3] ? -1 : 1);
    return { axis: spec.axis, angle: spec.angle * times, min: spec.min };
  };
}

// Corner-turning cubes: eight cut planes perpendicular to the corner
// diagonals at a common depth. The depth decides the puzzle: through the
// face centers (1.5/√3) only 12 edges survive (Dino — the corner caps have
// no stickers and the engine drops them); shallower leaves corner caps and
// wings (Compy); deeper carves petals, edges and centers (Master Skewb).
// Moves are 120° turns named by their corner (URF, DBL'…, any letter order).
const CORNER_TOKENS = ["UFR", "UFL", "UBR", "UBL", "DFR", "DFL", "DBR", "DBL"];

function buildCornerTurnDef(name, depth, minSel, scrambleLen) {
  const cuts = [];
  const moves = {};
  for (const token of CORNER_TOKENS) {
    const v = [
      token.includes("R") ? 1 : -1,
      token[0] === "U" ? 1 : -1,
      token.includes("F") ? 1 : -1,
    ];
    const u = norm(v);
    cuts.push({ n: u, d: depth });
    moves[[...token].sort().join("")] = { axis: u, angle: (-2 * Math.PI) / 3, min: minSel };
  }
  return {
    name,
    solid: cubeSolid(1.5),
    cuts,
    moves,
    parseMove: namedMoveParser(name, moves),
    faceOrder: ["U", "R", "F", "D", "L", "B"],
    faceSortDirs: CUBE_SORT_DIRS,
    colors: { ...CUBE_COLORS },
    scramble: (rand, length) =>
      pickScramble(rand, CORNER_TOKENS, ["", "'"], length || scrambleLen).join(" "),
  };
}

let _dinoDef, _compyDef, _masterSkewbDef;

export class Dino extends Twisty {
  constructor(options = {}) {
    fixedSize("Dino", options);
    super(
      _dinoDef || (_dinoDef = buildCornerTurnDef("dino", 1.5 / Math.sqrt(3), 1.0, 14)),
      options,
    );
  }
}

/** Compy Cube — shallow corner turner: caps, wings and big plus centers. */
export class Compy extends Twisty {
  constructor(options = {}) {
    fixedSize("Compy", options);
    super(
      _compyDef || (_compyDef = buildCornerTurnDef("compy", 1.15, 1.27, 12)),
      options,
    );
  }
}

/** Master Skewb — deep corner turner: corners, petals, edges and centers. */
export class MasterSkewb extends Twisty {
  constructor(options = {}) {
    fixedSize("MasterSkewb", options);
    super(
      _masterSkewbDef ||
        (_masterSkewbDef = buildCornerTurnDef("master-skewb", 0.52, 0.62, 16)),
      options,
    );
  }
}

// Helicopter Cube: twelve edge axes, each turning 180° about a cut plane
// through the edge's two adjacent face centers. Pieces: 8 corners + 24
// single-sticker petals (four per face).
const HELI_TOKENS = ["UF", "UR", "UB", "UL", "DF", "DR", "DB", "DL", "FR", "FL", "BR", "BL"];

function buildHeliDef() {
  const AXIS_LETTER = { U: [0, 1, 0], D: [0, -1, 0], R: [1, 0, 0], L: [-1, 0, 0], F: [0, 0, 1], B: [0, 0, -1] };
  const cuts = [];
  const moves = {};
  for (const name of HELI_TOKENS) {
    const a = AXIS_LETTER[name[0]];
    const b = AXIS_LETTER[name[1]];
    const u = norm([a[0] + b[0], a[1] + b[1], a[2] + b[2]]);
    cuts.push({ n: u, d: 1.5 / Math.SQRT2 });
    moves[[...name].sort().join("")] = { axis: u, angle: Math.PI, min: 1.2 };
  }
  return {
    name: "helicopter",
    solid: cubeSolid(1.5),
    cuts,
    moves,
    parseMove: namedMoveParser("helicopter", moves),
    faceOrder: ["U", "R", "F", "D", "L", "B"],
    faceSortDirs: CUBE_SORT_DIRS,
    colors: { ...CUBE_COLORS },
    scramble: (rand, length) =>
      pickScramble(rand, HELI_TOKENS, [""], length || 18).join(" "),
  };
}

let _heliDef;

export class Helicopter extends Twisty {
  constructor(options = {}) {
    fixedSize("Helicopter", options);
    super(_heliDef || (_heliDef = buildHeliDef()), options);
  }
}

// ── Penrose cube ────────────────────────────────────────────────────────────

/**
 * Clip a convex solid by a half-space, keeping the inside; the new cap face
 * gets `letter`. Used to sculpt curved-looking shells out of facet planes.
 */
function clipKeep(faces, plane, letter) {
  const cells = slicePieces(faces, [plane]);
  if (cells.length === 1) return faces; // plane doesn't touch the solid
  const below = cells.find((cell) =>
    cell.every((f) =>
      f.pts.every((p) => dot(p, plane.n) - plane.d <= 1e-6),
    ),
  );
  return below.map((f) => (f.letter == null ? { ...f, letter } : f));
}

// The real Penrose cube: three pairs of adjacent faces share a color, and
// each pair's shared edge is rounded off with a big smooth fillet — three
// lobes with 3-fold symmetry about the main diagonal (the rounded edges UB,
// FL and DR are mutually skew). The rest of each face stays flat. Because
// 90° face turns are not symmetries of the shape, scrambling makes the
// surface jagged, while the mechanism stays a plain 3×3.
function buildPenroseDef() {
  const h = 1.5;
  // fillet radius: each lobe rounds off about half of its two faces, the
  // other half stays flat — bigger values read as a shapeless lens from
  // grazing angles
  const rho = 1.6;
  const FACETS = 18;

  // shells: letter, the two faces it covers, the wrapped edge's fillet
  // described by the tangent-arc frame: n(φ) = a·cosφ + b·sinφ sweeps from
  // face A's normal to face B's normal; the arc axis sits at corner − ρ·(a+b)
  const SHELLS = [
    { letter: "X", faces: ["U", "B"], a: [0, 1, 0], b: [0, 0, -1] },
    { letter: "Y", faces: ["F", "L"], a: [0, 0, 1], b: [-1, 0, 0] },
    { letter: "Z", faces: ["D", "R"], a: [0, -1, 0], b: [1, 0, 0] },
  ];

  let faces = cubeSolid(h).map((f) => {
    const shell = SHELLS.find((s) => s.faces.includes(f.letter));
    return { ...f, letter: shell.letter };
  });

  for (const { letter, a, b } of SHELLS) {
    // fillet axis: pulled in by ρ from both tangent planes
    const axis = [
      (a[0] + b[0]) * (h - rho),
      (a[1] + b[1]) * (h - rho),
      (a[2] + b[2]) * (h - rho),
    ];
    for (let k = 1; k < FACETS; k++) {
      const phi = (Math.PI / 2) * (k / FACETS);
      const c = Math.cos(phi);
      const s = Math.sin(phi);
      const n = [a[0] * c + b[0] * s, a[1] * c + b[1] * s, a[2] * c + b[2] * s];
      faces = clipKeep(faces, { n, d: dot(n, axis) + rho }, letter);
    }
  }

  const cuts = [];
  for (let axisIdx = 0; axisIdx < 3; axisIdx++) {
    const u = [0, 0, 0];
    u[axisIdx] = 1;
    cuts.push({ n: u, d: -0.5 }, { n: u, d: 0.5 });
  }

  const band = (v) => (v < -0.5 ? -1 : v < 0.5 ? 0 : 1);
  return {
    name: "penrose",
    solid: faces,
    cuts,
    parseMove: cubeParse3,
    slotPointOf: (c) => c.map(band),
    // each curved tile spans several facets — group them into one sticker
    // with a single plastic outline, like the real puzzle's sticker grid
    stickerGroup: true,
    faceOrder: ["X", "Y", "Z"],
    faceSortDirs: {
      X: [[1, 0, 0], [0, -1, 0]],
      Y: [[0, 1, 0], [0, 0, -1]],
      Z: [[0, 0, 1], [-1, 0, 0]],
    },
    colors: { X: "#f0c419", Y: "#2f6fce", Z: "#d9463e" },
    tokens: CUBE3_TOKENS,
    orientations: CUBE_ORIENTATIONS,
    scramble: (rand, length) =>
      pickScramble(rand, ["U", "R", "F", "D", "L", "B"], ["", "'", "2"], length || 25).join(" "),
  };
}

let _penroseDef;

export class Penrose extends Twisty {
  constructor(options = {}) {
    fixedSize("Penrose", options);
    super(_penroseDef || (_penroseDef = buildPenroseDef()), options);
  }
}

// ── Twist cube ──────────────────────────────────────────────────────────────

// A 3×3 whose body is molded with a CONTINUOUS twist about the vertical
// axis (−30° at the bottom to +30° at the top). Each slab is the convex
// hull between its lower and upper yawed square cross-sections, so adjacent
// slabs meet seamlessly when solved and the silhouette is a smoothly
// twisted column. U/D/E turns keep it coherent; any side turn sends twisted
// slabs across orientations and the shape goes wild. Full cube notation.
function buildTwistDef() {
  const h = 1.5;
  // A quarter turn spread evenly over the full height, with the bottom
  // square unrotated: top and bottom both sit axis-aligned (90° apart) and
  // all the twisting lives in the body.
  const TOTAL = (90 * Math.PI) / 180;
  const yawAt = (y) => ((y + 1.5) / 3) * TOTAL;

  // The body is waisted — wringing it pinches the middle. Both layers
  // meeting at an interface sample the same taper, so their cross-sections
  // still match and a U/D turn stays coherent.
  const WAIST = 0.12;
  const scaleAt = (y) => 1 - WAIST * (1 - (y / h) ** 2);

  // Yaw a local (x, z) cross-section point up to its height.
  const at = (x, y, z) => {
    const c = Math.cos(yawAt(y));
    const s = Math.sin(yawAt(y));
    const k = scaleAt(y);
    return [(x * c + z * s) * k, y, (-x * s + z * c) * k];
  };

  // The mold twists, so the mechanism's vertical cuts twist with it — a
  // cubie is a twisted chunk of material, not the intersection of the
  // twisted body with world-axis planes. Cutting with fixed planes chops
  // each face into shards spread over eleven cubies; here every cubie is
  // built directly, so each face stays a clean 3×3 grid that spirals with
  // the body. Each cubie is stacked from thin strips (the engine merges
  // cells sharing a slot back into one rigid piece) so the twist reads as
  // a smooth curve instead of one 30° kink per layer.
  const GRID = [-1.5, -0.5, 0.5, 1.5];
  const STRIPS = 6;
  // Any total order works, as long as both cubies sharing a wall agree.
  const cornerBefore = (p, q) => (p[0] !== q[0] ? p[0] < q[0] : p[1] < q[1]);
  const solids = [];
  for (let ly = 0; ly < 3; ly++) {
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        // local side letters: -z back, +x right, +z front, -x left, and
        // only the outer shell of the puzzle carries a sticker
        const sideLetters = [
          j === 0 ? "B" : null,
          i === 2 ? "R" : null,
          j === 2 ? "F" : null,
          i === 0 ? "L" : null,
        ];
        for (let s = 0; s < STRIPS; s++) {
          const yLo = ly - 1.5 + s / STRIPS;
          const yHi = yLo + 1 / STRIPS;
          const corner = [
            [GRID[i], GRID[j]],
            [GRID[i + 1], GRID[j]],
            [GRID[i + 1], GRID[j + 1]],
            [GRID[i], GRID[j + 1]],
          ];
          const bot = corner.map(([x, z]) => at(x, yLo, z));
          const top = corner.map(([x, z]) => at(x, yHi, z));
          const faces = [
            { letter: ly === 2 && s === STRIPS - 1 ? "U" : null, pts: [...top].reverse() },
            { letter: ly === 0 && s === 0 ? "D" : null, pts: bot },
          ];
          for (let k = 0; k < 4; k++) {
            const k2 = (k + 1) % 4;
            // The twisted side patch is not planar, so it has to be split
            // into two triangles — but the neighbouring cubie meets this
            // same patch from the other side and walks its corners in the
            // opposite order. Choosing the diagonal from local corner order
            // makes the two cubies triangulate one surface two different
            // ways, leaving a dart-shaped sliver of body between them that
            // renders as a black wedge. Pick the diagonal from the corner
            // coordinates instead, so both sides land on the same one.
            const [a, b] = cornerBefore(corner[k], corner[k2]) ? [k, k2] : [k2, k];
            faces.push(
              { letter: sideLetters[k], pts: [bot[a], bot[b], top[b]] },
              { letter: sideLetters[k], pts: [bot[a], top[b], top[a]] },
            );
          }
          solids.push(faces);
        }
      }
    }
  }

  // every solid is already a cubie strip — nothing left to slice
  const cuts = [];

  const band = (v) => (v < -0.5 ? -1 : v < 0.5 ? 0 : 1);
  // Undo the twist before quantizing, so the logical lattice is the clean
  // 3×3 grid the mechanism actually permutes (the trick Fisher/Windmill
  // use: slots live on the mechanism's own frame, not the shell's).
  const untwistedSlot = ([x, y, z]) => {
    const c = Math.cos(yawAt(y));
    const s = Math.sin(yawAt(y));
    const k = scaleAt(y);
    return [band((x * c - z * s) / k), band(y), band((x * s + z * c) / k)];
  };
  return {
    name: "twist",
    solids,
    cuts,
    parseMove: cubeParse3,
    slotPointOf: untwistedSlot,
    // each side sticker is a stack of hull triangles, grouped into one
    // clean tile per piece
    stickerGroup: true,
    faceOrder: ["U", "R", "F", "D", "L", "B"],
    faceSortDirs: CUBE_SORT_DIRS,
    colors: { ...CUBE_COLORS },
    tokens: CUBE3_TOKENS,
    orientations: CUBE_ORIENTATIONS,
    scramble: (rand, length) =>
      pickScramble(rand, ["U", "R", "F", "D", "L", "B"], ["", "'", "2"], length || 25).join(" "),
  };
}

let _twistDef;

export class Twist extends Twisty {
  constructor(options = {}) {
    fixedSize("Twist", options);
    super(_twistDef || (_twistDef = buildTwistDef()), options);
  }
}

// ── Color schemes ───────────────────────────────────────────────────────────

/**
 * Color presets for cube-shaped puzzles, usable as `colors` in any
 * constructor: classic (Western/WCA), japanese (blue down, yellow back),
 * and uniform silver/gold for mirror-style looks.
 */
export const SCHEMES = {
  classic: { ...CUBE_COLORS },
  japanese: {
    U: "#ffffff",
    R: "#b71234",
    F: "#009b48",
    D: "#0046ad",
    L: "#ff5800",
    B: "#ffd500",
  },
  silver: { U: "#c9ccd1", R: "#c9ccd1", F: "#c9ccd1", D: "#c9ccd1", L: "#c9ccd1", B: "#c9ccd1" },
  gold: { U: "#d9b64c", R: "#d9b64c", F: "#d9b64c", D: "#d9b64c", L: "#d9b64c", B: "#d9b64c" },
};

// ── Building a puzzle from scratch ──────────────────────────────────────────

/**
 * Every definition in this file is the same three things: a convex solid, a
 * set of cut planes, and a set of moves that rotate whatever sits beyond a
 * plane. The families differ only in WHICH AXES they turn about and by how
 * much — and the angle is not a free choice either, it is a full turn
 * divided by the rotational order of that axis. A cube's faces are 4-fold,
 * its corners 3-fold, its edges 2-fold; a dodecahedron's faces are 5-fold.
 *
 * So the twenty-six puzzles above are configurations, not kinds. This is the
 * builder that says so: pick a solid, pick which axes turn, pick how deep the
 * cuts go, and the rest follows.
 */

const SQ3 = Math.sqrt(3);

/** Axis families per solid, with the rotational order that sets the angle. */
const AXIS_FAMILIES = {
  cube: {
    faces: {
      order: 4,
      axes: [["U", [0, 1, 0]], ["R", [1, 0, 0]], ["F", [0, 0, 1]],
             ["D", [0, -1, 0]], ["L", [-1, 0, 0]], ["B", [0, 0, -1]]],
    },
    corners: {
      order: 3,
      axes: CORNER_TOKENS.map((t) => [
        [...t].sort().join(""),
        norm([t.includes("R") ? 1 : -1, t[0] === "U" ? 1 : -1, t.includes("F") ? 1 : -1]),
      ]),
    },
    edges: {
      order: 2,
      axes: HELI_TOKENS.map((t) => {
        const V = { U: [0, 1, 0], D: [0, -1, 0], R: [1, 0, 0], L: [-1, 0, 0], F: [0, 0, 1], B: [0, 0, -1] };
        const [a, b] = [V[t[0]], V[t[1]]];
        return [[...t].sort().join(""), norm([a[0] + b[0], a[1] + b[1], a[2] + b[2]])];
      }),
    },
  },
};

/**
 * Compose a puzzle definition from a description.
 *
 * @param {Object} spec
 * @param {string} [spec.shape="cube"] - "cube" | "box" | "octahedron" |
 *   "dodecahedron"
 * @param {number[]} [spec.size] - box dimensions, e.g. [3,2,3]
 * @param {string} [spec.turn="faces"] - which axis family turns:
 *   "faces" | "corners" | "edges"
 * @param {number} [spec.depth] - how far each cut sits from the centre, as a
 *   fraction of the distance from the centre to the solid's furthest point
 *   along that axis. 1 leaves nothing to turn, 0 cuts through the middle.
 * @param {number} [spec.angle] - degrees per turn; defaults to a full turn
 *   divided by the axis family's rotational order, which is the only angle
 *   that maps the solid back onto itself
 * @param {Object} [spec.colors] - face letter → fill
 * @returns {Object} a definition, ready for `new Twisty(def)` or `Puzzle`
 */
export function buildPuzzle(spec = {}) {
  const {
    shape = "cube",
    size,
    turn = "faces",
    depth = 0.5,
    angle,
    colors,
    name = `${shape}-${turn}`,
  } = spec;

  // A box, or a cube of any size, is the layered face-turning case the
  // cuboid builder already covers exactly.
  if (shape === "box" || (shape === "cube" && turn === "faces")) {
    const dims = size || [3, 3, 3];
    const def = buildCuboidDef(dims);
    return { ...def, name, ...(colors ? { colors: { ...colors } } : {}) };
  }

  if (shape === "dodecahedron") {
    // reach is measured from the centre outward, the opposite sense of depth
    return { ...buildMinxDef(name, 1 - depth, 30), ...(colors ? { colors: { ...colors } } : {}) };
  }

  if (shape === "octahedron") {
    return { ...buildSkewbDiamondDef(), name, ...(colors ? { colors: { ...colors } } : {}) };
  }

  const family = AXIS_FAMILIES.cube[turn];
  if (!family)
    throw new Error(
      `erno: a cube turns about "faces", "corners" or "edges", not "${turn}"`,
    );

  const h = 1.5;
  // How far the solid reaches along an axis of this family — a corner sits
  // at h√3, an edge at h√2, a face at h — so `depth` means the same fraction
  // of the available material whichever family is chosen.
  const reach = turn === "corners" ? h * SQ3 : turn === "edges" ? h * Math.SQRT2 : h;
  const d = reach * depth;
  const step = ((angle === undefined ? 360 / family.order : angle) * Math.PI) / 180;

  const cuts = [];
  const moves = {};
  for (const [token, u] of family.axes) {
    cuts.push({ n: u, d });
    // select everything beyond the cut, nudged off the plane itself
    moves[token] = { axis: u, angle: -step, min: d + 1e-3 };
  }

  const tokens = family.axes.map(([t]) => t);
  return {
    name,
    solid: cubeSolid(h),
    cuts,
    moves,
    parseMove: namedMoveParser(name, moves),
    faceOrder: ["U", "R", "F", "D", "L", "B"],
    faceSortDirs: CUBE_SORT_DIRS,
    colors: { ...(colors || CUBE_COLORS) },
    scramble: (rand, length) =>
      pickScramble(rand, tokens, family.order > 2 ? ["", "'"] : [""], length || 16).join(" "),
  };
}

/** A puzzle built from a description rather than picked off the shelf. */
export class Puzzle extends Twisty {
  constructor(spec = {}, options = {}) {
    super(buildPuzzle(spec), options);
    this.spec = spec;
  }
}
