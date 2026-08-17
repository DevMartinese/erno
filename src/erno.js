/**
 * erno.js — a tiny engine for Rubik's cubes rendered to SVG.
 *
 * Sibling of heerich.js (voxels → SVG), sharing its philosophy: a small
 * dependency-free core, declarative API, and crisp SVG output with
 * per-sticker data attributes for styling and interactivity.
 *
 * Named after Ernő Rubik.
 *
 * This file holds the N×N×N facelet cube — the specialized, solver-friendly
 * representation — and is the package entry. The generic piece engine and
 * the classic variants (Skewb, Pyraminx, Mirror, Void) live in twisty.js
 * and puzzles.js, mirroring heerich's core + shapes.js structure, and are
 * re-exported here.
 *
 * Model conventions (internal):
 * - Cube spans [0, 2N] per axis in "doubled" integer coordinates so every
 *   sticker center, quad corner and rotation stays exact integer math.
 * - Model space is right-handed: +x right, +y up, +z toward the viewer.
 * - State is a flat facelet array in URFDLB face order (Kociemba layout);
 *   each move is a precomputed permutation of facelet indices, derived once
 *   from exact 3D quarter-turn rotations and cached.
 * - Render space converts to screen conventions (y down, z away) and uses
 *   the shared camera/projection pipeline in render.js.
 */

import {
  makeProjector,
  buildSvgAttributes,
  projectPolygon,
  pointsAttr,
  boundsViewBox,
  sphereViewBox,
  openSvgTag,
} from "./render.js";
import {
  FACES,
  CUBE_COLORS,
  FACE_AXIS,
  SPIN_SIGN,
  parseCubeMove,
  tokenize,
  inverseSequence,
} from "./twisty.js";

const DEFAULT_COLORS = CUBE_COLORS;

/**
 * Apply one positive discrete quarter turn (R/U/F sense) about `axis` to a
 * doubled-coordinate point, in place. `n2` is 2N (the doubled cube span).
 */
function quarterPoint(p, axis, n2) {
  const [x, y, z] = p;
  if (axis === 0) {
    p[1] = z;
    p[2] = n2 - y;
  } else if (axis === 1) {
    p[0] = n2 - z;
    p[2] = x;
  } else {
    p[0] = y;
    p[1] = n2 - x;
  }
}

/** Same quarter turn, linear part only (for normals). */
function quarterNormal(n, axis) {
  const [x, y, z] = n;
  if (axis === 0) {
    n[1] = z;
    n[2] = -y;
  } else if (axis === 1) {
    n[0] = -z;
    n[2] = x;
  } else {
    n[0] = y;
    n[1] = -x;
  }
}

export class Erno {
  /**
   * @param {Object} [options]
   * @param {number} [options.size=3] - Cube dimension N (2 for 2×2, 3 for 3×3…)
   * @param {number} [options.tile=40] - Pixels per cubie
   * @param {Object} [options.camera] - Camera spec, see setCamera()
   * @param {Object} [options.colors] - Face letter → fill (U R F D L B)
   * @param {string} [options.plastic="#0d0d0d"] - Cube body color (gaps, insides)
   * @param {number} [options.stickerInset=0.12] - Sticker inset as a fraction
   *   of the cell (0 = stickerless, stickers touch edge to edge)
   * @param {Object|Function} [options.style] - Static style merged into every
   *   sticker, or a per-sticker callback ({face,row,col,letter}) → style
   */
  constructor(options = {}) {
    this.size = options.size || 3;
    if (this.size < 1 || this.size > 32)
      throw new Error(`erno: unsupported size ${this.size}`);
    this.tile = options.tile || 40;
    this.colors = { ...DEFAULT_COLORS, ...(options.colors || {}) };
    this.plastic = options.plastic || "#0d0d0d";
    this.stickerInset =
      options.stickerInset === undefined ? 0.12 : options.stickerInset;
    if (options.paint)
      throw new Error(
        "erno: Erno is the facelet cube and has no pieces to paint — use Cube({ paint }) for a piece-based 3×3",
      );
    this._styleFn = null;
    this._styleObj = null;
    if (options.style) this.style(options.style);

    this._permCache = new Map();
    this._initGeometry();
    this.reset();
    this.setCamera(options.camera || { type: "isometric", angle: 30 });
  }

  // ── Geometry tables ──────────────────────────────────────────────────────

  /**
   * Build the facelet ↔ 3D tables: sticker centers, normals, quad corners
   * (all in doubled integer coordinates) and the reverse position → index map.
   */
  _initGeometry() {
    const N = this.size;
    const n2 = 2 * N;
    const count = 6 * N * N;
    this._pos = new Int32Array(count * 3); // sticker centers
    this._nrm = new Int8Array(count * 3); // outward normals
    this._corners = new Int32Array(count * 12); // 4 corners × xyz
    this._keyToIndex = new Map();

    const inv = (v) => 2 * (N - 1 - v) + 1; // mirrored odd coordinate
    const odd = (v) => 2 * v + 1;

    for (let f = 0; f < 6; f++) {
      for (let r = 0; r < N; r++) {
        for (let c = 0; c < N; c++) {
          const i = f * N * N + r * N + c;
          let p, n;
          // Facelet layout follows the standard URFDLB unfolding: row 0 is
          // the top of each face as you look straight at it (for U, the B
          // edge; for D, the F edge).
          if (f === 0) (p = [odd(c), n2, odd(r)]), (n = [0, 1, 0]); // U
          else if (f === 1) (p = [n2, inv(r), inv(c)]), (n = [1, 0, 0]); // R
          else if (f === 2) (p = [odd(c), inv(r), n2]), (n = [0, 0, 1]); // F
          else if (f === 3) (p = [odd(c), 0, inv(r)]), (n = [0, -1, 0]); // D
          else if (f === 4) (p = [0, inv(r), odd(c)]), (n = [-1, 0, 0]); // L
          else (p = [inv(c), inv(r), 0]), (n = [0, 0, -1]); // B

          this._pos.set(p, i * 3);
          this._nrm.set(n, i * 3);
          this._keyToIndex.set(this._posKey(p, n), i);

          // Quad corners: sticker cell spans ±1 doubled unit along the two
          // tangent axes, wound counterclockwise seen from outside.
          const a = n[0] !== 0 ? 1 : 0; // first tangent axis
          const b = n[2] === 0 ? 2 : 1; // second tangent axis
          const corners = [];
          for (const [sa, sb] of [
            [-1, -1],
            [1, -1],
            [1, 1],
            [-1, 1],
          ]) {
            const q = [...p];
            q[a] += sa;
            q[b] += sb;
            corners.push(q);
          }
          this._orient(corners, n);
          for (let k = 0; k < 4; k++)
            this._corners.set(corners[k], i * 12 + k * 3);
        }
      }
    }
  }

  /** Ensure quad winding is counterclockwise seen from outside (along n). */
  _orient(corners, n) {
    const [c0, c1, , c3] = corners;
    const e1 = [c1[0] - c0[0], c1[1] - c0[1], c1[2] - c0[2]];
    const e2 = [c3[0] - c0[0], c3[1] - c0[1], c3[2] - c0[2]];
    const cx = e1[1] * e2[2] - e1[2] * e2[1];
    const cy = e1[2] * e2[0] - e1[0] * e2[2];
    const cz = e1[0] * e2[1] - e1[1] * e2[0];
    if (cx * n[0] + cy * n[1] + cz * n[2] < 0) {
      const tmp = corners[1];
      corners[1] = corners[3];
      corners[3] = tmp;
    }
  }

  _posKey(p, n) {
    const s = 2 * this.size + 1;
    const ni = n[0] !== 0 ? (n[0] > 0 ? 0 : 1) : n[1] !== 0 ? (n[1] > 0 ? 2 : 3) : n[2] > 0 ? 4 : 5;
    return ((p[0] * s + p[1]) * s + p[2]) * 6 + ni;
  }

  /** Cubie layer index (0..N-1) of a sticker along `axis`. */
  _layerOf(i, axis) {
    const v = this._pos[i * 3 + axis];
    if (v === 0) return 0;
    if (v === 2 * this.size) return this.size - 1;
    return (v - 1) >> 1;
  }

  // ── State ────────────────────────────────────────────────────────────────

  /** Reset to the solved state and clear the move history. */
  reset() {
    const N = this.size;
    this.state = new Uint8Array(6 * N * N);
    for (let i = 0; i < this.state.length; i++)
      this.state[i] = Math.floor(i / (N * N));
    this.history = [];
    return this;
  }

  /** True if every face is a single color. */
  isSolved() {
    const NN = this.size * this.size;
    for (let f = 0; f < 6; f++) {
      const first = this.state[f * NN];
      for (let j = 1; j < NN; j++)
        if (this.state[f * NN + j] !== first) return false;
    }
    return true;
  }

  /**
   * Facelet string in URFDLB face order, row-major per face, one letter per
   * sticker naming its home face (54 chars for a 3×3, 6N² in general).
   */
  getState() {
    let s = "";
    for (let i = 0; i < this.state.length; i++) s += FACES[this.state[i]];
    return s;
  }

  /** Set the state from a facelet string (see getState). Clears history. */
  setState(str) {
    const clean = str.replace(/\s+/g, "");
    if (clean.length !== this.state.length)
      throw new Error(
        `erno: expected ${this.state.length} facelets, got ${clean.length}`,
      );
    const next = new Uint8Array(clean.length);
    for (let i = 0; i < clean.length; i++) {
      const f = FACES.indexOf(clean[i].toUpperCase());
      if (f === -1) throw new Error(`erno: bad facelet '${clean[i]}' at ${i}`);
      next[i] = f;
    }
    this.state = next;
    this.history = [];
    return this;
  }

  // ── Moves ────────────────────────────────────────────────────────────────

  /**
   * Parse a single move token into {axis, lo, hi, quarters}.
   * Supported: face turns (R U F D L B), primes and doubles (R', R2, R2'),
   * wide turns (Rw, r, 3Rw, 3r), slices (M E S, odd cubes only) and whole-cube
   * rotations (x y z).
   */
  parseMove(token) {
    return parseCubeMove(token, this.size);
  }

  /**
   * Apply a sequence of moves in standard notation, e.g. "R U R' U'".
   * @returns {Erno} this (chainable)
   */
  move(sequence) {
    for (const token of tokenize(sequence)) {
      this._apply(this.parseMove(token));
      this.history.push(token);
    }
    return this;
  }

  _apply({ axis, lo, hi, quarters }) {
    const q = ((quarters % 4) + 4) % 4;
    if (q === 0) return;
    const key = `${axis},${lo},${hi},${q}`;
    let perm = this._permCache.get(key);
    if (!perm) {
      perm = this._buildPerm(axis, lo, hi, q);
      this._permCache.set(key, perm);
    }
    const next = new Uint8Array(this.state.length);
    for (let i = 0; i < perm.length; i++) next[perm[i]] = this.state[i];
    this.state = next;
  }

  /** perm[i] = destination index of the sticker currently at facelet i. */
  _buildPerm(axis, lo, hi, q) {
    const n2 = 2 * this.size;
    const perm = new Int32Array(this.state.length);
    for (let i = 0; i < perm.length; i++) {
      const layer = this._layerOf(i, axis);
      if (layer < lo || layer > hi) {
        perm[i] = i;
        continue;
      }
      const p = [this._pos[i * 3], this._pos[i * 3 + 1], this._pos[i * 3 + 2]];
      const n = [this._nrm[i * 3], this._nrm[i * 3 + 1], this._nrm[i * 3 + 2]];
      for (let k = 0; k < q; k++) {
        quarterPoint(p, axis, n2);
        quarterNormal(n, axis);
      }
      const j = this._keyToIndex.get(this._posKey(p, n));
      if (j === undefined)
        throw new Error("erno: internal error, sticker left the cube");
      perm[i] = j;
    }
    return perm;
  }

  /**
   * Scramble with random moves (avoiding trivially redundant successors).
   * @param {number} [length] - Move count; defaults per cube size
   * @returns {string} the scramble sequence applied
   */
  scramble(length) {
    const N = this.size;
    const count =
      length || (N === 2 ? 11 : N === 3 ? 25 : Math.min(120, N * 12));
    const faces = "URFDLB";
    const suffixes = ["", "'", "2"];
    const maxWide = Math.max(1, Math.floor(N / 2));
    const tokens = [];
    let lastFace = -1;
    let lastAxis = -1;
    let axisRun = 0;
    while (tokens.length < count) {
      const f = Math.floor(Math.random() * 6);
      const axis = FACE_AXIS[faces[f]][0];
      if (f === lastFace) continue;
      if (axis === lastAxis && axisRun >= 2) continue;
      axisRun = axis === lastAxis ? axisRun + 1 : 1;
      lastAxis = axis;
      lastFace = f;
      const wideN =
        N > 3 && Math.random() < 0.4
          ? 2 + Math.floor(Math.random() * (maxWide - 1))
          : 1;
      const prefix = wideN > 2 ? String(wideN) : "";
      const wide = wideN > 1 ? "w" : "";
      const suffix = suffixes[Math.floor(Math.random() * 3)];
      tokens.push(prefix + faces[f] + wide + suffix);
    }
    const seq = tokens.join(" ");
    this.move(seq);
    return seq;
  }

  /** Invert a move sequence: Erno.inverse("R U2 f'") → "f U2 R'". */
  static inverse(sequence) {
    return inverseSequence(sequence);
  }

  // ── Styling ──────────────────────────────────────────────────────────────

  /**
   * Set the sticker style: a static object merged into every sticker, or a
   * callback ({face, row, col, letter}) → style object (falsy = defaults).
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

  // ── Camera ───────────────────────────────────────────────────────────────

  /**
   * Set the camera. Types share heerich's semantics:
   * - isometric (default): { angle } — pitch locked to 35.264°
   * - orthographic: { angle, pitch }
   * - oblique: { angle, depth } — parallel, z recedes at angle; depth is the
   *   fraction of a tile per cubie of depth (default 0.5)
   * - perspective: { position: [x, y], distance } in cubie units
   */
  setCamera(camera) {
    this.camera = { type: "isometric", ...camera };
    return this;
  }

  _makeProjector() {
    return makeProjector(this.camera, this.tile, this.size);
  }

  // ── Rendering ────────────────────────────────────────────────────────────

  /**
   * Build, project and depth-sort all visible faces.
   * @param {Object} [turn] - In-progress layer turn: { move: "R", progress: 0..1 }
   * @returns {Object[]} projected faces, back-to-front
   */
  getFaces(turn) {
    const N = this.size;
    const proj = this._makeProjector();
    let spin = null;
    if (turn && turn.progress) {
      const mv = this.parseMove(turn.move);
      const angle =
        SPIN_SIGN[mv.axis] * (Math.PI / 2) * mv.quarters * turn.progress;
      spin = { axis: mv.axis, lo: mv.lo, hi: mv.hi, angle };
    }

    const rotate = (p) => {
      // continuous rotation about the cube center in doubled model coords
      const { axis, angle } = spin;
      const c = Math.cos(angle),
        s = Math.sin(angle);
      const [a, b] = axis === 0 ? [1, 2] : axis === 1 ? [0, 2] : [0, 1];
      const u = p[a] - N,
        v = p[b] - N;
      const out = [...p];
      out[a] = u * c - v * s + N;
      out[b] = u * s + v * c + N;
      return out;
    };

    // model doubled coords → render space (cubie units, y down, z away)
    const toRender = (p) => [p[0] / 2, N - p[1] / 2, N - p[2] / 2];

    const faces = [];
    const pushQuad = (corners, meta) => {
      const projected = projectPolygon(corners.map(toRender), proj);
      if (projected) faces.push({ ...meta, ...projected });
    };

    const inset = Math.max(0, Math.min(0.45, this.stickerInset));
    for (let i = 0; i < this.state.length; i++) {
      const NN = N * N;
      const f = Math.floor(i / NN);
      const r = Math.floor((i % NN) / N);
      const c = i % N;
      const letter = FACES[this.state[i]];

      let corners = [];
      for (let k = 0; k < 4; k++)
        corners.push([
          this._corners[i * 12 + k * 3],
          this._corners[i * 12 + k * 3 + 1],
          this._corners[i * 12 + k * 3 + 2],
        ]);
      if (spin) {
        const layer = this._layerOf(i, spin.axis);
        if (layer >= spin.lo && layer <= spin.hi)
          corners = corners.map(rotate);
      }

      const meta = { face: FACES[f], row: r, col: c, letter };
      if (inset > 0) {
        // plastic backing (full cell) + inset sticker on top of it
        const mx =
          (corners[0][0] + corners[1][0] + corners[2][0] + corners[3][0]) / 4;
        const my =
          (corners[0][1] + corners[1][1] + corners[2][1] + corners[3][1]) / 4;
        const mz =
          (corners[0][2] + corners[1][2] + corners[2][2] + corners[3][2]) / 4;
        const shrunk = corners.map(([x, y, z]) => [
          x + (mx - x) * inset,
          y + (my - y) * inset,
          z + (mz - z) * inset,
        ]);
        pushQuad(corners, { ...meta, part: "plastic" });
        // sticker rides on its backing: share depth via a tiny bias so the
        // pair never splits during the sort
        const before = faces.length;
        pushQuad(shrunk, { ...meta, part: "sticker" });
        if (faces.length > before) faces[faces.length - 1].depth -= 1e-6;
      } else {
        pushQuad(corners, { ...meta, part: "sticker" });
      }
    }

    // Internal "core" faces exposed while a layer is mid-turn: one quad per
    // side of each boundary plane, full cross-section of the cube.
    if (spin) {
      const { axis, lo, hi } = spin;
      const bounds = [];
      if (lo > 0) bounds.push({ at: 2 * lo, slabNormal: -1 });
      if (hi < N - 1) bounds.push({ at: 2 * (hi + 1), slabNormal: 1 });
      for (const { at, slabNormal } of bounds) {
        for (const side of [slabNormal, -slabNormal]) {
          const isSlab = side === slabNormal;
          const center = [N, N, N];
          center[axis] = at;
          const nvec = [0, 0, 0];
          nvec[axis] = side;
          const [a, b] = axis === 0 ? [1, 2] : axis === 1 ? [0, 2] : [0, 1];
          let corners = [];
          for (const [sa, sb] of [
            [-1, -1],
            [1, -1],
            [1, 1],
            [-1, 1],
          ]) {
            const q = [...center];
            q[a] += sa * N;
            q[b] += sb * N;
            corners.push(q);
          }
          this._orient(corners, nvec);
          if (isSlab) corners = corners.map(rotate);
          pushQuad(corners, { part: "core" });
        }
      }
    }

    faces.sort((a, b) => b.depth - a.depth);
    return faces;
  }

  /**
   * Render the cube to an SVG string.
   * @param {Object} [options]
   * @param {number} [options.padding=20] - ViewBox padding in pixels
   * @param {[number,number,number,number]} [options.viewBox] - Explicit viewBox
   * @param {boolean} [options.fitSphere=false] - Size the viewBox to the
   *   cube's circumsphere so it stays stable across turns and animation frames
   * @param {Object} [options.turn] - Mid-turn snapshot: { move, progress: 0..1 }
   * @param {string} [options.prepend] - Raw SVG inserted before the faces
   * @param {string} [options.append] - Raw SVG inserted after the faces
   * @returns {string} SVG markup
   */
  toSVG(options = {}) {
    const faces = this.getFaces(options.turn);
    const pad = options.padding === undefined ? 20 : options.padding;

    let vb;
    if (options.viewBox) {
      vb = options.viewBox;
    } else if (options.fitSphere) {
      const N = this.size;
      vb = sphereViewBox(
        this._makeProjector(),
        N / 2,
        N / 2,
        N / 2,
        (Math.sqrt(3) / 2) * N,
        pad,
      );
    } else {
      vb = boundsViewBox(faces, pad);
    }

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
          `<polygon points="${pa}" fill="${this.plastic}" stroke="${this.plastic}" stroke-width="0.5" data-part="plastic" data-face="${face.face}" data-row="${face.row}" data-col="${face.col}" />`,
        );
        continue;
      }
      let style = { fill: this.colors[face.letter] };
      if (this._styleObj) style = { ...style, ...this._styleObj };
      if (this._styleFn) {
        const custom = this._styleFn({
          face: face.face,
          row: face.row,
          col: face.col,
          letter: face.letter,
        });
        if (custom) style = { ...style, ...custom };
      }
      parts.push(
        `<polygon points="${pa}"${buildSvgAttributes(style)} data-part="sticker" data-face="${face.face}" data-row="${face.row}" data-col="${face.col}" data-color="${face.letter}" />`,
      );
    }

    if (options.append) parts.push(options.append);
    parts.push("</svg>");
    return parts.join("");
  }

  /**
   * Stateless render: build the SVG for a facelet string without keeping an
   * instance around. Size is inferred from the string length (6N²).
   */
  static renderState(facelets, options = {}) {
    const clean = String(facelets).replace(/\s+/g, "");
    const size = Math.round(Math.sqrt(clean.length / 6));
    if (6 * size * size !== clean.length)
      throw new Error(`erno: facelet string length ${clean.length} is not 6N²`);
    const cube = new Erno({ ...options, size });
    cube.setState(clean);
    return cube.toSVG(options);
  }
}

// The generic piece engine and the classic variants share this entry point.
export { Twisty } from "./twisty.js";
export {
  Skewb,
  Pyraminx,
  Mirror,
  Void,
  Tetris,
  Cuboid,
  Cube,
  Domino,
  Tower,
  Floppy,
  Fisher,
  Windmill,
  Axis,
  Ghost,
  Dino,
  Compy,
  MasterSkewb,
  Helicopter,
  Penrose,
  Twist,
  MasterPyraminx,
  Pyramorphix,
  Mastermorphix,
  SkewbDiamond,
  Megaminx,
  Kilominx,
  tetrisPaint,
  TETRIS_PALETTE,
  buildPuzzle,
  Puzzle,
  SCHEMES,
} from "./puzzles.js";
export { generateScheme, schemeFrom, generateRamp, nameScheme, oklchToHex, hexToOklch } from "./palettes.js";
