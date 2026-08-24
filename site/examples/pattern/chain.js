/* ─────────────────────────────────────────────────────────────────────────
   PATTERN - the chain (CHAIN.md, made to run)

   One fluent value, transformed link by link. rubik() is the source, the
   links are the story of what you did to a sound cube, the reads are the
   leaves, and out() routes a value to a screen slot. Values are immutable
   and frozen, like the alg value: every link returns a NEW value, which is
   what lets one base chain branch into a goal and a table.

   This module is DOM-free on purpose: it builds and judges boards, and
   hands whoever is listening the finished value. Drawing is the page's
   business.
   ───────────────────────────────────────────────────────────────────── */

import { boardOf, algOf, SCHEMES } from "../../../src/erno.js";

const FACES = SCHEMES.classic;

// The wider palette, for the pictures a cube's own six colours cannot make.
const PALETTE = [
  "#17110c", "#cc2823", "#00489f", "#f6ba00",
  "#f4efe7", "#009b48", "#ff5800", "#ffffff",
];

// ── The outputs ─────────────────────────────────────────────────────────────
//
// hydra's gift: a chain ends by being routed somewhere. The page subscribes;
// this module only keeps the registry. `goal` doubles as the reference the
// distance reads measure against.
const outputs = new Map(); // slot name → chain value
let listener = null;

export function onOut(fn) {
  listener = fn;
}

export function takeOutputs() {
  return outputs;
}

export function resetOutputs() {
  outputs.clear();
}

// ── The materializer ────────────────────────────────────────────────────────
//
// A value is its ops, replayed whole against the engine every time - the
// code you watch is the code that runs. Eager: every link materializes on
// the spot, so a refusal fires at the link that earned it.

const paintFnOf = (paint, n) => {
  if (typeof paint === "string") {
    const scheme = SCHEMES[paint];
    if (!scheme)
      throw new Error(
        `erno: no scheme called '${paint}' (there are ${Object.keys(SCHEMES).join(", ")})`,
      );
    return ({ letter }) => scheme[letter];
  }
  return ({ slot: [x, y, z], letter, row, col, piece }) => {
    const kind = piece.faces.filter((q) => q.letter).length;
    const v = paint(x, y, z, n, letter, row, col, kind);
    if (typeof v === "string") return (v.length === 1 && FACES[v]) || v;
    const i = Math.floor(Number(v)) || 0;
    return PALETTE[((i % PALETTE.length) + PALETTE.length) % PALETTE.length];
  };
};

function materialize(ops) {
  const spec = ops.find((o) => o.link === "rubik").spec;
  const paint = ops.find((o) => o.link === "paint");
  const options = { stickerInset: 0.1 };
  if (paint) {
    // n is the board's half-reach, the same n Write always passed.
    const probe = boardOf(spec);
    const n = probe.getRadius() / Math.sqrt(3);
    options.paint = paintFnOf(paint.paint, n);
  }
  let board = boardOf(spec, options);
  for (const op of ops)
    if (op.link === "carve") board = board.carve(...op.names);
  const rest = board.getPattern();

  // The build road. deal() opens the bin on a fresh board: centres ride
  // the spider, a weld's shared pieces ride the weld, and everything else
  // is yours to place - body-first on welds, like the moves. The board
  // stands whole again when the last piece lands.
  let build = null; // { tray: Set(idx), nameOf(idx), locOf: Map(idx→slotName) }
  const weld = !!board.bodies;
  const nameFor = (i) => {
    if (!weld) return board.nameOf(i);
    const b = board._bodyOf(i);
    return b < 0 ? null : String.fromCharCode(65 + b) + board.nameOf(i);
  };
  const openBin = () => {
    const tray = new Set();
    const names = new Map();
    const locOf = new Map();
    board.pieces.forEach((piece, i) => {
      const stickers = piece.faces.filter((f) => f.letter).length;
      const name = nameFor(i);
      if (stickers < 2 || name === null) return; // held by the frame
      tray.add(i);
      names.set(i, name);
      names.set(name, i);
      locOf.set(i, name);
    });
    build = { tray, names, locOf };
  };
  const kindLen = (name) => name.length - (weld ? 1 : 0);
  const placeOne = (op) => {
    const name = String(op.piece);
    const idx = build.names.get(name);
    if (idx === undefined)
      throw new Error(
        weld
          ? `${name} is not a piece here: a welded board spells pieces body-first`
          : `${name} is not a piece here`,
      );
    if (!build.tray.has(idx)) throw new Error(`${name} is not in the bin`);
    const slot = op.slot === undefined ? name : String(op.slot);
    if (build.names.get(slot) === undefined)
      throw new Error(`${slot} is not a slot here`);
    if (kindLen(slot) !== kindLen(name))
      throw new Error(`${name} cannot stand in ${slot}: wrong kind of slot`);
    for (const [i, at] of build.locOf)
      if (at === slot && !build.tray.has(i))
        throw new Error(`${slot} is already taken`);
    const from = build.locOf.get(idx);
    if (from !== slot) {
      const other = [...build.locOf].find(([, at]) => at === slot);
      board.swapPieces(from, slot);
      build.locOf.set(idx, slot);
      if (other) build.locOf.set(other[0], from);
    }
    const spins = ((Math.round(op.spin || 0) % 3) + 3) % 3;
    for (let k = 0; k < spins; k++)
      if (kindLen(name) === 3) board.twistCorner(slot);
      else board.flipEdge(slot);
    build.tray.delete(idx);
    if (!build.tray.size) {
      build = null; // the last piece lands: whole, and the judge may speak
      board.history = [];
    }
  };

  let base = 0;
  for (const op of ops) {
    if (op.link === "scramble") {
      board.scramble(18, op.seed);
      board.history = [];
      base = 0;
    } else if (op.link === "turn") {
      board.move(op.seq);
    } else if (op.link === "deal") {
      openBin();
    } else if (op.link === "place") {
      placeOne(op);
    }
  }
  return { board, rest, moves: board.history.length - base, build };
}

// ── The value ───────────────────────────────────────────────────────────────

const ACTS = new Set(["turn", "scramble", "deal", "place"]);

function value(ops) {
  const acted = ops.some((o) => ACTS.has(o.link));
  const made = materialize(ops);
  const grow = (op) => value([...ops, op]);
  // A board in pieces neither turns nor judges: the nouns that need a
  // whole cube say so instead of moving ghosts.
  const whole = (word) => {
    if (made.build)
      throw new Error(
        `the cube is in pieces: ${made.build.tray.size} still in the bin (${word} waits for the last place())`,
      );
  };
  const self = {
    // the engine board underneath, for whoever draws it
    board: made.board,
    // while in pieces, the veil: which pieces stand (the page draws only these)
    veil: made.build ? (i) => !made.build.tray.has(i) : null,

    // ── Shape ───────────────────────────────────────────────────────────
    paint(fn) {
      if (acted)
        throw new Error("you paint on the bench, not mid-solve: paint before turning");
      if (ops.some((o) => o.link === "paint"))
        throw new Error("the board is painted once, on the bench: start the chain again to repaint");
      return grow({ link: "paint", paint: fn });
    },
    carve(...names) {
      if (acted)
        throw new Error("you carve on the bench, not mid-solve: carve before turning");
      if (!names.length)
        throw new Error("point the drill: carve takes slot names, or 'centers'");
      return grow({ link: "carve", names: names.flat().map(String) });
    },

    // ── Act ─────────────────────────────────────────────────────────────
    turn(seq) {
      whole("turn");
      const src = seq && seq.alg !== undefined ? seq.alg : String(seq);
      return grow({ link: "turn", seq: src });
    },
    scramble(seed) {
      whole("scramble");
      return grow({
        link: "scramble",
        seed: seed === undefined ? undefined : Math.round(Number(seed)) || 0,
      });
    },

    // ── Build ───────────────────────────────────────────────────────────
    deal() {
      if (acted)
        throw new Error("you deal on the bench: a fresh cube comes apart, not a played one");
      if (ops.some((o) => o.link === "carve") || made.board._remove)
        throw new Error("a carved board is missing the pieces a bin would promise");
      if (made.build) throw new Error("the cube is already in pieces");
      return grow({ link: "deal" });
    },
    place(piece, slot, spin) {
      if (!made.build) throw new Error("nothing is in pieces: deal() first");
      return grow({ link: "place", piece: String(piece), slot, spin });
    },
    bin() {
      if (!made.build) return [];
      return [...made.build.tray].map((i) => made.build.names.get(i));
    },

    // ── Route ───────────────────────────────────────────────────────────
    out(slot = "table") {
      const name = String(slot);
      outputs.set(name, self);
      if (listener) listener(name, self);
      return self;
    },

    // ── Declare ─────────────────────────────────────────────────────────
    alg(seq) {
      return algOf(made.board, seq);
    },

    // ── Reads: the leaves ───────────────────────────────────────────────
    legal: () => made.board.legalMoves(),
    can(seq) {
      const home = made.board.getPosition();
      try {
        made.board.move(seq && seq.alg !== undefined ? seq.alg : String(seq));
        return true;
      } catch {
        return false;
      } finally {
        made.board.setPosition(home);
      }
    },
    at(name) {
      const { i } = made.board._atRestSlotOf(String(name));
      return made.board.nameOf(i);
    },
    pieces: () =>
      made.board.getPieces().map((pc) => ({
        at: made.board.nameOf(pc.index),
      })),
    cycles: (seq) => algOf(made.board, seq).cycleNames,
    lawful() {
      whole("the judge");
      return made.board.lawful();
    },
    legend: () =>
      made.board.legend
        ? made.board.legend()
        : "one body, at the origin: it needs no introductions",
    moves: () => made.moves,
    solved() {
      whole("solved");
      return made.board.matches(made.rest);
    },
    off() {
      whole("the count");
      const goal = outputs.get("goal");
      if (!goal)
        throw new Error("route a goal first: out(goal) on the chain to reach");
      return made.board.distanceTo(goal.board.getPattern());
    },
    distance() {
      return self.off();
    },
  };
  return Object.freeze(self);
}

// ── The source ──────────────────────────────────────────────────────────────

/**
 * The one source word. The library carries the man's first name; the
 * chains open with his surname. The defaults are the healthy object:
 * shape "3", classic colours, whole and at rest, no seed.
 */
export function rubik(spec = "3") {
  return value([{ link: "rubik", spec: String(spec) }]);
}

/** The alg value in the box dialect, for chains that turn plain boards. */
export function alg(seq) {
  return algOf(boardOf("3"), seq);
}
