/* ─────────────────────────────────────────────────────────────────────────
   The morph: what STORY one board becoming another is.

   The page used to ask a single question - which cells does the new board
   not have, and which are new - and answer it with a single relato: peel
   the old shell off, grow the new one. That question is asked in ABSOLUTE
   slot coordinates, and absolute coordinates are exactly what a change of
   shape does not preserve. A 3's corner sits at (-1,-1,-1) and a 5's at
   (-2,-2,-2): the same corner of the same object, told apart. So a cube
   becoming a bigger cube shared NOTHING, and the voyage played it as a
   death and a birth.

   Two changes, then. Pieces are paired by their NORMALIZED place - their
   slot divided by the half-extent of the body they belong to - so a corner
   is a corner at any resolution and a face centre is a face centre in any
   proportion. And what comes out is not a set difference but a list of
   relatos, in the order they must be played:

     subtract   pieces lift out and leave a hollow behind - the carve
     stretch    survivors travel to a new place - the change of proportion
     dock       a whole body arrives from outside, on a known vector
     subdivide  new cuts appear inside a shell that is already standing
     repaint    nothing came, went or moved; only the colours changed

   They compose: a carved weld is a subtract and a dock, and the order is
   the point - what leaves goes before what arrives, so the stage is never
   crowded with two stories at once.

   DOM-free on purpose, like chain.js beside it: this module decides, the
   page draws.
   ───────────────────────────────────────────────────────────────────── */

const round4 = (v) => Math.round(v * 1e4) / 1e4;

// ── Where a piece lives, in its own body's terms ─────────────────────────────
//
// A body is a cube of some size sitting at some place on the lattice; on a
// plain board there is one, unnamed, centred at the origin. Measured from
// the pieces rather than assumed, so a carved board - which has lost some
// of them - still reports the extent its shell still spans.

const extentCache = new WeakMap();

function bodiesOf(board) {
  let found = extentCache.get(board);
  if (found) return found;
  if (board.bodies) {
    found = board.bodies.map((b) => ({
      at: b.at,
      half: b.size.map((s) => (s - 1) / 2),
    }));
  } else {
    const half = [0, 1, 2].map((k) =>
      board.pieces.reduce((m, p) => Math.max(m, Math.abs(p.slotPoint[k])), 0),
    );
    found = [{ at: [0, 0, 0], half }];
  }
  extentCache.set(board, found);
  return found;
}

/**
 * The identity of a piece across a change of shape: which body it belongs
 * to, and where in that body it sits once the body is measured as one.
 *
 * A weld's body A and a lone cube share the empty tag, so a box collapsing
 * into the first body of a weld is a journey and not a replacement. Pieces
 * two bodies both produce belong to neither and answer to `*`.
 */
export function pairKey(piece, board) {
  const bodies = bodiesOf(board);
  const home = piece.slotPoint;
  const owners = [];
  for (const [j, b] of bodies.entries())
    if (home.every((v, k) => Math.abs(v - b.at[k]) <= b.half[k] + 0.01)) owners.push(j);

  const shared = owners.length !== 1;
  const b = shared ? { at: [0, 0, 0], half: bodies[0].half } : bodies[owners[0]];
  const tag = shared ? "*" : owners[0] === 0 ? "" : String.fromCharCode(65 + owners[0]);
  const at = home.map((v, k) =>
    b.half[k] ? round4((v - b.at[k]) / b.half[k]) : 0,
  );
  return `${tag}|${at.join(",")}`;
}

const indexBy = (board) => {
  const m = new Map();
  board.pieces.forEach((p, i) => m.set(pairKey(p, board), i));
  return m;
};

// ── The relatos ─────────────────────────────────────────────────────────────

/**
 * What happened between two boards, as a story the page can play.
 *
 * @returns {{acts: string[], staying: {from:number,to:number,delta:number[]}[],
 *            leaving: number[], arriving: number[],
 *            dock: null | {body:number, offset:number[], pieces:number[]},
 *            undock: null | {body:number, offset:number[], pieces:number[]}}}
 *   `leaving` and `undock.pieces` index into prev.pieces; everything else
 *   indexes into next.pieces. `delta` is the travel in slot units, which
 *   is what `screenDelta` turns into a displacement on screen.
 */
export function storyOf(prev, next) {
  const A = indexBy(prev);
  const B = indexBy(next);

  const leaving = [];
  for (const [k, i] of A) if (!B.has(k)) leaving.push(i);

  const staying = [];
  const arriving = [];
  for (const [k, j] of B) {
    const i = A.get(k);
    if (i === undefined) {
      arriving.push(j);
      continue;
    }
    const from = prev.pieces[i].slotPoint;
    const to = next.pieces[j].slotPoint;
    staying.push({ from: i, to: j, delta: to.map((v, k2) => round4(v - from[k2])) });
  }

  // A body every one of whose pieces is unpaired is a body that was not
  // on the other side at all: it arrives whole, or it leaves whole, and
  // either way it travels on the vector its own place names.
  const dock = wholeBody(next, arriving);
  const undock = wholeBody(prev, leaving);

  const moved = staying.some((p) => p.delta.some((v) => v !== 0));
  const docked = new Set(dock ? dock.pieces : []);
  const undocked = new Set(undock ? undock.pieces : []);
  const grown = arriving.some((i) => !docked.has(i));
  const shed = leaving.some((i) => !undocked.has(i));

  // The order is the story: what leaves, then what travels, then what
  // arrives - the stage never carries two of them at once.
  const acts = [];
  if (undock) acts.push("undock");
  if (shed) acts.push("subtract");
  if (moved) acts.push("stretch");
  if (dock) acts.push("dock");
  if (grown) acts.push("subdivide");
  if (!acts.length) acts.push("repaint");

  return { acts, staying, leaving, arriving, dock, undock };
}

/**
 * The body of `board` - never the first, which is where a bodiless board
 * lands - none of whose pieces found a counterpart. Such a body is not
 * being reshaped; it is coming or going in one piece.
 */
function wholeBody(board, unpaired) {
  if (!board.bodies) return null;
  const free = new Set(unpaired);
  for (const [j, body] of board.bodies.entries()) {
    if (j === 0) continue;
    const tag = `${String.fromCharCode(65 + j)}|`;
    const mine = board.pieces
      .map((p, i) => (pairKey(p, board).startsWith(tag) ? i : -1))
      .filter((i) => i >= 0);
    if (mine.length && mine.every((i) => free.has(i)))
      return { body: j, offset: [...body.at], pieces: mine };
  }
  return null;
}

// ── The waves ───────────────────────────────────────────────────────────────

/**
 * Order pieces into waves around the heart of what they are: growth
 * radiates outward from what already stands, departure peels inward from
 * the rim. Four waves at least, ten at most, so a six-piece carve and a
 * seventy-piece subdivision both read at a human speed.
 *
 * @param {{at:number[], idx:number}[]} items
 * @returns {number[][]} the indices, wave by wave
 */
export function waves(items, { outward = true, heart } = {}) {
  if (!items.length) return [];
  const h = heart || [0, 1, 2].map(
    (k) => items.reduce((s, it) => s + it.at[k], 0) / items.length,
  );
  const far = (it) =>
    (it.at[0] - h[0]) ** 2 + (it.at[1] - h[1]) ** 2 + (it.at[2] - h[2]) ** 2;
  const sorted = [...items].sort((a, b) => (outward ? far(a) - far(b) : far(b) - far(a)));
  const count = Math.max(4, Math.min(10, Math.ceil(sorted.length / 6)));
  const per = Math.ceil(sorted.length / count);
  const out = [];
  for (let i = 0; i < sorted.length; i += per)
    out.push(sorted.slice(i, i + per).map((it) => it.idx));
  return out;
}

// ── The slide ───────────────────────────────────────────────────────────────

/**
 * Where a world offset lands on screen, in viewBox units.
 *
 * A body that docks travels on a known vector, and the page has to move a
 * layer by exactly what the renderer would have moved the geometry by -
 * otherwise the slide ends a few pixels off its own destination and the
 * landing blinks. The cameras this page uses are parallel, so the map from
 * world to screen is affine: a difference of points is a difference of
 * projections, and one projection of the offset is the whole answer.
 *
 * Model space is y-up and z-toward-the-viewer; render space, which the
 * projector speaks, is y-down and z-away. For a VECTOR that whole
 * conversion is a flip of the last two components.
 */
export function screenDelta(board, offset, span) {
  const proj = board._project(span);
  const o = proj.point(0, 0, 0);
  const q = proj.point(offset[0], -offset[1], -offset[2]);
  // not rounded: this feeds a transform, not a key, and a tween wants the
  // exact linearity that rounding would cost.
  return [q[0] - o[0], q[1] - o[1]];
}
