/* ─────────────────────────────────────────────────────────────────────────
   The thirteen steps: the voyage's content, and nothing of its stage.

   Two pages tell this voyage - the SVG route and the glass one - and a
   step edited in one that quietly said something else in the other would
   be the exact drift this file exists to prevent. Data only: captions,
   the sketch in segments, the effects a stage may honour, and the read
   that becomes the verdict. How any of it is DRAWN is the stage's business.
   ───────────────────────────────────────────────────────────────────── */

import { rubik, alg } from "./chain.js";

// Lines are arrays of SEGMENTS: the segment is the unit a stage animates.
// Joined, they are the exact sketch that runs.
const HALVES = 'const halves = (x, y, z) => y > 0 ? "B" : "F"';
const SEXY6 = "R U R' U' ".repeat(6).trim();

const STEPS = [
  {
    title: "i · a cube exists",
    caption: "One source word. The defaults are the healthy object: whole, at rest, classic colours.",
    lines: [["rubik()", ".out()"]],
    read: (t) => `${t.board.pieces.length} pieces, whole and at rest.`,
  },
  {
    title: "ii · it turns",
    caption: "A link joins the chain. The string is the notation cubers already write.",
    lines: [["rubik()", '.turn("R")', ".out()"]],
    fx: { rest: "rubik().out()", seq: "R" },
    read: (t) => `${t.moves()} move made.`,
  },
  {
    title: "iii · the string grows",
    caption: "The same link, a longer sentence: four turns cubers call the sexy move.",
    lines: [["rubik()", ".turn(\"R U R' U'\")", ".out()"]],
    fx: { rest: "rubik().out()", seq: "R U R' U'" },
    read: (t) => `${t.moves()} moves made.`,
  },
  {
    title: "iv · the algebra declares",
    caption: "alg() studies a sequence without turning anything. Its order is a theorem; watch it walk home.",
    lines: [['const sexy = alg("[R, U]")'], ["rubik()", ".turn(sexy.times(6))", ".out()"]],
    fx: { rest: "rubik().out()", seq: SEXY6 },
    read: () => `alg("[R, U]").order = ${alg("[R, U]").order}: six rounds close the loop.`,
  },
  {
    title: "v · paint rides upstream",
    caption: "A link inserted above repaints everything below: the chain is a pipeline, and now you can see it.",
    lines: [[HALVES], [], ["rubik()", ".paint(halves)", ".out()"]],
    // The step teaches the pipeline; the paint's own mechanism was left
    // assumed, and it is two inferences deep. `halves` returns a FACE, not a
    // colour - the scheme is what turns "B" into blue - and it reads the
    // CUBIE's coordinates, not the sticker's, which is why a cubie above the
    // line comes back painted on every side it shows. Counted off the board
    // that just ran, so the sentence is true of whatever body it is pointed at.
    read: (t) => {
      const up = t.board.pieces.filter((p) => p.slotPoint[1] > 0).length;
      return (
        'halves returns a FACE, not a colour: "B" or "F", and the scheme is what ' +
        "turns a face into paint. It reads the CUBIE's x, y, z, never the " +
        "sticker's, so a cubie wears one colour on every side it shows - " +
        `${up} of ${t.board.pieces.length} here sit above y = 0.`
      );
    },
  },
  {
    title: "vi · the brush reads finer",
    caption: "The same paint, four more arguments: face, row and col say WHICH sticker is asking. Answer them and one cubie wears more than one colour.",
    lines: [
      ["const checker = (x, y, z, n, face, row, col) =>"],
      ['  (row + col) % 2 ? "U" : "D"'],
      [],
      ["rubik()", ".paint(checker)", ".out()"],
    ],
    read: (t) => {
      const stickers = t.board.getTints().length;
      return (
        `paint ran ${stickers} times: once per STICKER, never per cubie. ` +
        `halves ignored face, row and col, so its cubies came back whole; ` +
        `checker reads them, and now a corner answers three times.`
      );
    },
  },
  {
    title: "vii · paint by number",
    caption: "The third vocabulary: a number indexes the page's eight-colour palette. kind counts a cubie's stickers, so the piece TYPES paint themselves.",
    lines: [
      ["const kinds = (x, y, z, n, face, row, col, kind) => kind"],
      [],
      ["rubik()", ".paint(kinds)", ".out()"],
    ],
    read: (t) => {
      const per = { 1: 0, 2: 0, 3: 0 };
      t.board.pieces.forEach((p) => per[p.faces.filter((f) => f.letter).length]++);
      return (
        `kind is 1, 2 or 3 - ${per[1]} centres, ${per[2]} edges, ${per[3]} corners - ` +
        `and each number picks a palette colour. Three vocabularies, one link: a ` +
        `FACE letter through the scheme, a NUMBER through the palette, or any ` +
        `colour string, raw.`
      );
    },
  },
  {
    title: "viii · carve",
    caption: "Holes are real: the absences are piece-shaped and they travel under turns.",
    lines: [[HALVES], [], ["rubik()", ".paint(halves)", '.carve("centers")', ".out()"]],
    read: (t) => `${t.board.pieces.length} pieces stand; the centres are gone.`,
  },
  {
    title: "ix · one character",
    caption: "The source string is the mini-notation of shapes. Edit one character, meet another beast.",
    lines: [[HALVES], [], ['rubik("5")', ".paint(halves)", '.carve("centers")', ".out()"]],
    // One line of code, re-answering. On a three "above y = 0" was a single
    // layer; on a five it is two, and the reader can watch the same halves
    // mean something else without a character of it changing.
    read: (t) => {
      const up = t.board.pieces.filter((p) => p.slotPoint[1] > 0);
      const layers = new Set(up.map((p) => p.slotPoint[1])).size;
      return (
        `${t.board.pieces.length} pieces now - and the same halves, untouched, ` +
        `answers differently: above y = 0 is ${layers} layers on a five, ` +
        `${up.length} of ${t.board.pieces.length} cubies.`
      );
    },
  },
  {
    title: "x · a box has laws",
    caption: "The mechanism refuses what would misshape it, and the refusal is the lesson.",
    lines: [
      [HALVES],
      [],
      ["const box = ", 'rubik("3x3x5")', ".paint(halves)"],
      ["box", ".turn(\"F R2 F' U2\")", ".out()"],
    ],
    fx: { rest: HALVES + '\nrubik("3x3x5").paint(halves).out()', seq: "F R2 F' U2" },
    read: () => {
      try {
        rubik("3x3x5").turn("R");
      } catch (err) {
        return `box.can("R") → false. ${err.message.replace(/^erno: /, "")}`;
      }
    },
  },
  {
    title: "xi · a second cube joins",
    caption: "Weld another body on and it is one mechanism: the moves spell the body first, and most turns stopped existing.",
    lines: [
      [HALVES],
      [],
      ["const weld = ", 'rubik("3 + 3 @ 2,2,0")', ".paint(halves)"],
      ["weld", ".turn(\"AD BU AD' BU'\")", ".out()"],
    ],
    fx: {
      rest: HALVES + '\nrubik("3 + 3 @ 2,2,0").paint(halves).out()',
      seq: "AD BU AD' BU'",
    },
    // Slot geometry only, deliberately: this board has been TURNED, and
    // slotPoint is the slot rather than the piece - a tally of painted
    // cubies would come back unchanged while meaning something else. The
    // geometry is what survives a turn, so the geometry is what is said.
    read: (t) => {
      const at = (t.board.bodies || [])[1];
      const welded = at
        ? ` B sits at ${at.at.join(",")}: the classic Siamese, and one lattice under both.`
        : "";
      return `${t.legend()} · ${t.legal().length} of 54 turns exist here.${welded}`;
    },
  },
  {
    title: "xii · displace it",
    caption: "Three numbers place the second body. Stagger it half a height and push it a full column off in BOTH directions: barely joined, and still one mechanism.",
    lines: [
      [HALVES],
      [],
      ["const weld = ", 'rubik("3 + 3 @ 2,1,-2")', ".paint(halves)"],
      ["weld", ".out()"],
    ],
    // No fx: the displacement IS the morph. B steps to half height and a
    // single shared column - staggered vertically AND perpendicular, the
    // two bodies reading as two cubes that barely touch. The z runs
    // NEGATIVE so B lands toward the viewer: pushed the other way it
    // eclipses behind A at the default camera, and the flat route has no
    // orbit to rescue it. A displaced weld must LOOK displaced.
    read: (t) => {
      const flat = rubik("3 + 3 @ 1,2,0").legal().length;
      const corner = rubik("3 + 3 @ 2,2,2").legal().length;
      return (
        `${t.legend()} · ${t.legal().length} of 54 turns exist here - staggered ` +
        `flat at 1,2,0 it would be ${flat}, and corner to corner at 2,2,2, ` +
        `${corner}. Where you weld decides how much of the language survives.`
      );
    },
  },
  {
    title: "xiii · the bodies need not match",
    caption: "A two FUSES into the three - one corner cubie belongs to both bodies. Half-step address, smaller body, same law: one mechanism.",
    lines: [
      [HALVES],
      [],
      ["const weld = ", 'rubik("3 + 2 @ 1.5,1.5,-1.5")', ".paint(halves)"],
      ["weld", ".out()"],
    ],
    // The half-step offsets are not decoration: a 2x2's cubies live on the
    // half-integers of a 3x3's lattice, and the spec refuses any address
    // that puts a body off the shared grid - the refusal names the axis
    // and the distance, which is how this address was found. At 1.5 on
    // every axis the overlap is exactly one cubie: the corner belongs to
    // BOTH bodies, the way the shelf puzzles fuse - not resting on top,
    // welded through. The z runs negative so the two lands toward the
    // viewer instead of eclipsing behind the three.
    read: (t) => {
      const both = rubik("3 + 3 @ 2,2,0");
      return (
        `${t.legend()} · ${t.board.pieces.length} pieces and ${t.legal().length} ` +
        `of 54 turns - the twin threes had ${both.board.pieces.length} and ` +
        `${both.legal().length}. Unequal bodies, one lattice, laws recomputed.`
      );
    },
  },
  {
    title: "xiv · the seed",
    caption: "scramble() walks the board's own legal moves. A seed makes it the same walk on every machine.",
    lines: [
      [HALVES],
      [],
      ["const weld = ", 'rubik("3 + 3 @ 2,2,0")', ".paint(halves)"],
      ["weld", ".scramble(7)", ".out()"],
    ],
    fx: { rest: HALVES + '\nrubik("3 + 3 @ 2,2,0").paint(halves).out()', seed: 7 },
    read: () => "Seed 7: everyone faces this exact position.",
  },
  {
    title: "xv · it comes apart",
    caption: "deal() opens the bin; place() sets from it. The centres ride the spider, and the last piece lands whole.",
    lines: [
      ["let v = ", "rubik()", ".deal()"],
      ["for (const q of v.bin()) v = v.place(q)"],
      ["v.out()"],
    ],
    fx: { reveal: true },
    read: (t) => `Whole again, and ${t.lawful().lawful ? "lawful" : "unlawful"}.`,
  },
  {
    title: "xvi · the borrowed cube",
    caption: "One corner placed with a spin: the picture of a cube, and the judge knows it is a lie.",
    lines: [
      ["let v = ", "rubik()", ".deal()"],
      ["for (const q of v.bin())"],
      ['  v = v.place(q, q, q === "URF" ? 1 : 0)'],
      ["v.out()"],
    ],
    read: (t) => {
      const law = t.lawful();
      return `lawful() → ${law.lawful}. ${law.breaks[0] || ""}`;
    },
  },
  {
    title: "xvii · the goal",
    caption: "One base chain branches: the picture to reach, and the board that must reach it. That is the whole game.",
    lines: [
      [HALVES],
      ["const base = ", "rubik()", ".paint(halves)"],
      [],
      ["base", ".out(goal)"],
      ["base", ".scramble(7)", ".out()"],
    ],
    read: (t) => `off() → ${t.off()} stickers between you and the picture. The album is next.`,
  },
];

const sourceOf = (s) => s.lines.map((segs) => segs.join("")).join("\n");

export { HALVES, SEXY6, STEPS, sourceOf };
