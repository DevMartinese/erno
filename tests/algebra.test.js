/* ─────────────────────────────────────────────────────────────────────────
   The algebra, and what it says a sequence does.
   ───────────────────────────────────────────────────────────────────── */

import { Cube, Cuboid, Erno, Fisher, Fused, Twisty, Void, Kilominx, Megaminx, Pyraminx, Siamese, Tetris, Twist, expand, parse, isAlgebra } from "../src/erno.js";

let passed = 0;
let failed = 0;
const test = (name, fn) => {
  try {
    fn();
    passed++;
    console.log(`  ok — ${name}`);
  } catch (err) {
    failed++;
    console.error(`FAIL — ${name}\n      ${err.message}`);
  }
};
const assert = (cond, msg) => {
  if (!cond) throw new Error(msg || "assertion failed");
};
const assertEqual = (a, b, msg) => {
  if (a !== b) throw new Error(`${msg || "not equal"}\n      a: ${a}\n      b: ${b}`);
};

test("the brackets expand to what cubers write them for", () => {
  for (const [src, want] of [
    ["[R, U]", "R U R' U'"], // a commutator
    ["[R: U]", "R U R'"], // a conjugate
    ["(R U)3", "R U R U R U"],
    ["(R U)'", "U' R'"],
    ["[R, U]'", "U R U' R'"],
    ["[R: [U, D]]", "R U D U' D' R'"], // nesting
    ["[[R, U], D]", "R U R' U' D U R U' R' D'"],
    ["(R U)2'", "U' R' U' R'"], // suffixes stack, in either order
    ["R U2 F", "R U2 F"], // plain notation passes through
    ["3Rw U", "3Rw U"], // and so do the odd tokens
    // The inverse of X2 is X2', never X2. On a cube the two are the same
    // rotation, which is exactly how the cube-only shortcut survived here:
    // on a face of order three or five they are not, and treating a double
    // as its own inverse broke [U2, R] on a Pyraminx.
    ["(R U2)'", "U2' R'"],
  ])
    assertEqual(expand(src), want, src);
});

test("a commutator and its reverse cancel on every face order", () => {
  // [A, B] [B, A] is the identity by construction — IF inversion is right.
  // Order four hid the bug: X2 undoes X2 there. Orders three and five do
  // not, and this is the law the shortcut broke.
  for (const [make, a, b] of [
    [() => new Cube({ size: 3 }), "R2", "U"], // faces of order 4
    [() => new Pyraminx(), "U2", "R"], // order 3
    [() => new Kilominx(), "C2", "E"], // order 5
  ]) {
    const p = make();
    p.move(`[${a}, ${b}] [${b}, ${a}]`);
    assert(p.isSolved(), `${p.name}: [${a},${b}][${b},${a}] is not the identity`);
  }
});

test("insight compresses, which is the point of having it", () => {
  assertEqual(expand("(R U)105").split(" ").length, 210);
  assert("(R U)105".length === 8, "eight characters");
});

test("a bad sequence says where and why", () => {
  for (const [src, wanted] of [
    ["[R, U", "expected ']'"],
    ["(R U", "expected ')'"],
    ["R U)", "unexpected ')'"],
    ["[R U]", "unexpected ']'"],
    ["[R: ]", "is empty"],
    ["[, U]", "is empty"],
    ["R @ U", "does not start a move"],
  ]) {
    let message = "";
    try {
      expand(src);
    } catch (err) {
      message = err.message;
    }
    assert(message.includes(wanted), `"${src}" should say ${wanted}, said: ${message}`);
    assert(message.includes("^"), `"${src}" should point at the character`);
  }
});

test("only the algebra's own characters trigger it", () => {
  assert(isAlgebra("[R, U]") && isAlgebra("(R U)2"), "brackets are the algebra");
  assert(!isAlgebra("R U R' U'") && !isAlgebra("3Rw U2"), "plain notation is not");
  // and no puzzle's notation uses them, which is why the two cannot collide
  for (const make of [() => new Cube(), () => new Megaminx(), () => new Siamese()]) {
    const p = make();
    for (const token of p.def.tokens || Object.keys(p.def.moves || {}))
      assert(!isAlgebra(token), `${p.def.name} has a token the algebra would claim: ${token}`);
  }
});

test("move() takes it, on every puzzle", () => {
  assert(new Cube({ size: 3 }).move("[R, U]6").isSolved(), "the sexy move has order 6");
  assert(new Cube({ size: 3 }).move("(R U)105").isSolved(), "(R U) has order 105");
  assert(!new Megaminx().move("[A, C]2").isSolved(), "a Megaminx takes it");
  assert(!new Siamese().move("[AD, AL]2").isSolved(), "so does a welded puzzle");
  assert(!new Twist().move("[R, U]").isSolved(), "and a shape mod");
  // The facelet engine has no pieces, but the algebra is only expansion,
  // so the quick start's own cube takes it like everything else.
  assert(new Erno({ size: 3 }).move("(R U)105").isSolved(), "the facelet engine takes it");
  assertEqual(
    new Erno({ size: 3 }).move("[R, U]").getState(),
    new Erno({ size: 3 }).move("R U R' U'").getState(),
    "and expands to the same facelets",
  );
});

test("the algebra is state, so both renderers see the same thing", () => {
  // It expands to moves and stops. Nothing downstream is told, which is why
  // SVG and WebGL cannot disagree about it.
  for (const [label, make, seq] of [
    ["3×3", () => new Cube({ size: 3 }), "[R, U]2"],
    ["Twist", () => new Twist(), "[R, U]2"],
    ["Megaminx", () => new Megaminx(), "[A, C]2"],
  ]) {
    const viaAlgebra = make().move(seq);
    const viaTokens = make().move(expand(seq));
    assertEqual(
      viaAlgebra.toSVG({ fitSphere: true }),
      viaTokens.toSVG({ fitSphere: true }),
      `${label} draws the same SVG`,
    );
    assertEqual(
      JSON.stringify(viaAlgebra.getPieces().map((p) => p.matrix)),
      JSON.stringify(viaTokens.getPieces().map((p) => p.matrix)),
      `${label} hands WebGL the same matrices`,
    );
  }
});

test("effectOf reads a sequence as a permutation", () => {
  const p = new Cube({ size: 3 });
  const shape = (e) =>
    e.cycles
      .map((c) => c.length)
      .sort((a, b) => b - a)
      .join("+");

  // A single turn: four corners round, four edges round, the centre spins.
  const r = p.effectOf("R");
  assertEqual(shape(r), "4+4", "R is two four-cycles");
  assertEqual(r.turnedInPlace.length, 1, "and one centre turned in place");
  assertEqual(r.order, 4, "R has order 4");

  // The whole reason commutators are taught: three pieces, nothing else.
  const three = p.effectOf("[R U' R', D]");
  assertEqual(shape(three), "3", "a commutator is a three-cycle");
  assertEqual(three.moved, 3, "and moves exactly three pieces");
  assertEqual(three.order, 3);

  // U and D commute, so their commutator is nothing, and so is any
  // conjugate of it. A list of six moves does not show you that.
  const nothing = p.effectOf("[R: [U, D]]");
  assertEqual(nothing.moved, 0, "[U, D] is the identity");
  assertEqual(nothing.turnedInPlace.length, 0);
  assertEqual(nothing.order, 1);

  const checker = p.effectOf("U2 D2 F2 B2 L2 R2");
  assertEqual(shape(checker), "2+2+2+2+2+2", "the checkerboard swaps six pairs");
  assertEqual(checker.order, 2);
});

test("the order is how long until it LOOKS solved", () => {
  // 105 is the number this file's own notes quote and every cuber knows,
  // and it is only 105 if you do not count what cannot be seen. Counting
  // pieces gives 420: the centres come back turned a quarter, which shows
  // on a picture cube and on nothing else.
  assertEqual(new Cube({ size: 3 }).effectOf("R U").order, 105, "(R U) is 105");

  // And on a 4×4 it is still 105, for the second reason: the four U centres
  // are the same sticker four times, so cycling them is invisible too.
  assertEqual(new Cube({ size: 4 }).effectOf("R U").order, 105, "and on a 4×4");
  assertEqual(new Cube({ size: 5 }).effectOf("R U").order, 105, "and on a 5×5");

  // Checked against the only authority there is: repeat it and look.
  for (const seq of ["R", "R U", "R U R' U R U2 R'", "[R, U]", "R U2 D' B D'"]) {
    const said = new Cube({ size: 3 }).effectOf(seq).order;
    const p = new Cube({ size: 3 });
    const home = p.getState();
    let saw = null;
    for (let n = 1; n <= 2000; n++) {
      p.move(seq);
      if (p.getState() === home) { saw = n; break; }
    }
    assertEqual(said, saw, `"${seq}" says ${said}, repeating it gives ${saw}`);
  }

  // A shape mod has no such permutation to read, so it is counted instead,
  // and must still come out right.
  assertEqual(new Fisher().effectOf("R U").order, 420, "the Fisher too");
});

test("a painted puzzle is a picture cube, and its order says so", () => {
  // A paint travels with the cubie, so what shows at a place is not the face
  // the sticker came from. Reading home faces gives 105 for (R U) on any
  // 3×3; reading what SHOWS gives 35 once the cube is painted in bands,
  // because pieces that read alike are alike and the picture comes back long
  // before the mechanism does. Found by a game built on `paint` reporting a
  // sequence home when the board plainly was not.
  const bands = () =>
    new Cube({ size: 3, paint: ({ slot: [, y] }) => (y > 0 ? "#cc2823" : "#00489f") });
  assertEqual(bands().effectOf("R U").order, 35, "painted in two bands");
  assertEqual(new Cube({ size: 3 }).effectOf("R U").order, 105, "and unpainted");

  const one = new Cube({ size: 3, paint: () => "#cc2823" });
  assertEqual(one.effectOf("R U").order, 1, "one colour is solved always");

  // Checked the only way that settles it: repeat it and look.
  for (const make of [bands, () => new Tetris(), () => new Cube({ size: 3 })]) {
    const said = make().effectOf("R U").order;
    const p = make();
    const home = p.getPattern();
    let saw = null;
    for (let n = 1; n <= 2000; n++) {
      p.move("R U");
      if (p.getPattern() === home) { saw = n; break; }
    }
    assertEqual(said, saw, `says ${said}, repeating it gives ${saw}`);
  }
});

test("a refused look leaves the puzzle exactly as it stood", () => {
  // A look that throws must still be a look. On a puzzle that blocks, a
  // sequence can open legally and hit a refused turn halfway; effectOf let
  // that throw escape with the puzzle part-turned and the history carrying
  // moves the caller never made. The error is right — the sequence cannot
  // be played from here — but the puzzle must come back untouched.
  const p = new Siamese();
  const open = p.legalMoves()[0];
  const shut = p.vocabulary().find((t) => !p.canMove(t));
  const home = p.getPosition();
  const trail = p.history.length;
  let threw = false;
  try {
    p.effectOf(`${open} ${shut}`);
  } catch {
    threw = true;
  }
  assert(threw, "the refusal still surfaces");
  assertEqual(p.getPosition(), home, "position untouched");
  assertEqual(p.history.length, trail, "history untouched");
});

test("looking at a sequence does not move the puzzle", () => {
  const p = new Cube({ size: 3 });
  p.move("R U F");
  const position = p.getPosition();
  const history = p.history.join(" ");
  p.effectOf("[R U' R', D]");
  assertEqual(p.getPosition(), position, "position");
  assertEqual(p.history.join(" "), history, "history");
});

test("the algebra keeps its laws on the family this library is for", () => {
  // Cubes, cuboids and welded cubes are the stated priority, so the
  // language is held to its laws THERE, by construction rather than by
  // hand-picked numbers: a sequence and its inverse cancel, a commutator
  // and its reverse cancel, the order effectOf declares really brings the
  // pattern back, and inverting a conjugate is conjugating the inverse.
  const family = [
    () => new Cube({ size: 3 }),
    () => new Cuboid({ size: [3, 3, 5] }),
    () => new Siamese(),
    () => new Fused({
      bodies: [
        { size: [3, 3, 3], at: [0, 0, 0] },
        { size: [2, 2, 2], at: [1.5, 1.5, 0.5] },
      ],
    }),
  ];
  const tryMove = (p, seq) => {
    try {
      p.move(seq);
      return true;
    } catch {
      return false; // a blocked stage: nothing to assert, the law needs all stages
    }
  };
  for (const make of family) {
    const open = make().legalMoves();
    const [A, B] = [open[0], open[Math.min(3, open.length - 1)]];
    const name = make().name;

    const p1 = make();
    const seq = `${A} [${B}: ${A}] ${B}`;
    if (tryMove(p1, seq) && tryMove(p1, `(${seq})'`))
      assert(p1.isSolved(), `${name}: seq then (seq)' is not the identity`);

    const p2 = make();
    if (tryMove(p2, `[${A}, ${B}] [${B}, ${A}]`))
      assert(p2.isSolved(), `${name}: [A,B][B,A] is not the identity`);

    const e = make().effectOf(`${A} ${B}`);
    if (e.order && e.order <= 500) {
      const p3 = make();
      if (tryMove(p3, `(${A} ${B})${e.order}`))
        assert(
          p3.getPattern() === make().getPattern(),
          `${name}: (A B)^${e.order} does not bring the pattern back`,
        );
    }

    const p4 = make();
    const p5 = make();
    if (tryMove(p4, `([${A}: ${B}])'`) && tryMove(p5, `[${A}: (${B})']`))
      assert(
        p4.getPosition() === p5.getPosition(),
        `${name}: inverting a conjugate is not conjugating the inverse`,
      );
  }

  // and every token the family can actually make has an inverse that
  // parses and undoes it, which is what the X2 -> X2' spelling has to keep
  for (const make of family) {
    const probe = make();
    for (const tok of probe.vocabulary()) {
      try {
        probe.parseMove(tok);
      } catch {
        continue; // the token itself is refused by policy: consistent pair
      }
      const inv = Twisty.inverse(tok);
      probe.parseMove(inv); // throws if the spelling is unparseable
      const p = make();
      if (!p.canMove(tok)) continue;
      const home = p.getPosition();
      p.move(tok);
      p.move(inv);
      assertEqual(p.getPosition(), home, `${make().name}: ${tok} ${inv} does not come home`);
    }
  }
});

test("the megaminx speaks WCA scramble notation", () => {
  // R++ R-- D++ D-- U U': the notation every scramble sheet is written in.
  // R and D are not face turns — each grips one face and rotates the other
  // ELEVEN layers two clicks about its axis — so they cannot be spelled in
  // face letters and had to be their own tokens. The letter moves survive
  // untouched: 'D' alone is still the letter-D face.
  const total = new Megaminx().pieces.length;
  const layer = new Megaminx()
    .getPieces({ turn: { move: "H", progress: 0.1 } })
    .filter((x) => x.moving).length;
  const big = new Megaminx()
    .getPieces({ turn: { move: "R++", progress: 0.1 } })
    .filter((x) => x.moving).length;
  assertEqual(big, total - layer, "R++ moves everything but the grip layer");

  for (const [seq, n] of [["R++", 5], ["D++", 5], ["U", 5]]) {
    const p = new Megaminx();
    for (let i = 0; i < n; i++) p.move(seq);
    assert(p.isSolved(), `${seq} five times over is not the identity`);
  }
  const back = new Megaminx();
  back.move("R++ R-- D++ D-- U U'");
  assert(back.isSolved(), "each move against its inverse");

  // D++ spins everything about the vertical, so the face it grips - the
  // top - stays put; R++ grips elsewhere and carries the top along.
  const still = new Megaminx();
  const crown = (q) => q.getState().slice(0, 11);
  const rest = crown(still);
  still.move("D++");
  assertEqual(crown(still), rest, "D++ leaves the top face alone");

  // The spelling is its own inverse pair, and the algebra rides on it.
  assertEqual(Twisty.inverse("R++"), "R--");
  assertEqual(expand("[R++, D++]"), "R++ D++ R-- D--");
  const comm = new Megaminx();
  comm.move("[R++, D++] [D++, R++]");
  assert(comm.isSolved(), "the commutator law holds on the WCA moves");

  // A WCA scramble sheet: lines of ten alternating R/D closed by U or U',
  // and its inverse restores. The order of (R++ D++) is 5130 - which is
  // exactly the kind of number the old counted-with-a-cap order returned
  // null for, and the algebraic order handles without noticing.
  const p = new Megaminx();
  const seq = p.scramble();
  assert(/^([RD][+-]{2} ){10}U'?( ([RD][+-]{2} ){10}U'?)*$/.test(seq), seq.slice(0, 44));
  p.move(Twisty.inverse(seq));
  assert(p.isSolved(), "a WCA scramble inverts exactly");
  assertEqual(new Megaminx().effectOf("R++ D++").order, 5130);

  // and the kilominx keeps its letters: WCA notation is the megaminx's
  const kilo = new Kilominx();
  assert(!kilo.vocabulary().includes("R++"), "kilominx has no WCA tokens");
});

test("an in-place turn is named the way a cuber names it", () => {
  // "2 turned in place" names a count; "URF twisted clockwise, UF flipped"
  // names the fact. The classification is verified against the stickers
  // themselves: paint every facelet its own tint, apply the sequence, and
  // read where each tint went.
  const homes = [];
  const paint = ({ letter, pieceIndex }) => {
    const tint = "#" + (100000 + homes.length).toString(16).padStart(6, "0");
    homes.push({ letter, pieceIndex, tint });
    return tint;
  };
  const p = new Cube({ size: 3, paint });
  const before = p.getTints().slice();
  const e = p.effectOf("(R' D' R D)2");
  p.move("(R' D' R D)2");
  const after = p.getTints();
  const wears = (piece, at) => {
    const h = homes.find((q) => q.pieceIndex === piece && q.letter === at);
    return homes.find((q) => q.tint === after[before.indexOf(h.tint)]).letter;
  };

  // four corners, two each way: the twist law (sum ≡ 0 mod 3) in the open
  const cw = e.turns.filter((t) => t.spin === "twisted clockwise");
  const ccw = e.turns.filter((t) => t.spin === "twisted counterclockwise");
  assertEqual(cw.length, 2);
  assertEqual(ccw.length, 2);

  // and the DIRECTIONS are physical, not nominal: counterclockwise about
  // the corner's outward axis carries the R sticker to the U spot on URF,
  // clockwise carries L to D on DLB. Read off the tints, not believed.
  const urf = e.turns.find((t) => t.name === "URF");
  assertEqual(urf.spin, "twisted counterclockwise");
  assertEqual(wears(urf.piece, "U"), "R", "ccw: the U spot wears the R sticker");
  const dlb = e.turns.find((t) => t.name === "DLB");
  assertEqual(dlb.spin, "twisted clockwise");
  assertEqual(wears(dlb.piece, "D"), "L", "cw: the D spot wears the L sticker");

  // edges flip, centres rotate, and both say so
  const q = new Cube({ size: 3 });
  const flips = q.effectOf("M' U M' U M' U2 M U M U M U2").turns;
  assert(
    flips.some((t) => t.name === "UF" && t.spin === "flipped"),
    "UF reports flipped",
  );
  assert(
    flips.some((t) => t.name.length === 1 && /rotated 180/.test(t.spin)),
    "a centre reports its rotation",
  );
});

test("the laws of the possible, and the verbs that break them", () => {
  // The fundamental theorem of the cube in street clothes: corner twists
  // sum to a multiple of three, edges flip in pairs, and the corner and
  // edge permutations agree in parity. move() cannot break them, by
  // theorem; twistCorner, flipEdge and swapPieces are the prankster's
  // verbs - what a thumb does to a borrowed cube - and lawful() is the
  // judge that names the broken law in the words a cuber would use.
  for (let i = 0; i < 5; i++) {
    const p = new Cube({ size: 3 });
    p.scramble();
    assert(p.lawful().lawful, "every reachable position is lawful");
  }
  const one = (cube, law) => {
    const b = cube.lawful().breaks;
    assert(b.length === 1 && new RegExp(law).test(b[0]), `${law}: ${b.join(" / ")}`);
  };
  one(new Cube({ size: 3 }).twistCorner("URF"), "twist");
  one(new Cube({ size: 3 }).flipEdge("UF"), "flip");
  one(new Cube({ size: 3 }).swapPieces("URF", "ULB"), "parity");
  one(new Cube({ size: 3 }).swapPieces("UF", "DB"), "parity");

  // tampers cancel in pairs, exactly as the laws say they must
  assert(
    new Cube({ size: 3 }).twistCorner("URF").twistCorner("ULB", "counterclockwise").lawful().lawful,
    "cw and ccw twists cancel",
  );
  assert(new Cube({ size: 3 }).flipEdge("UF").flipEdge("UB").lawful().lawful, "flips pair up");
  assert(
    new Cube({ size: 3 }).swapPieces("URF", "ULB").swapPieces("UF", "UB").lawful().lawful,
    "a corner swap and an edge swap restore parity",
  );

  // unlawfulness is an INVARIANT: no amount of scrambling launders it
  const damaged = new Cube({ size: 3 }).twistCorner("URF");
  damaged.scramble();
  assert(!damaged.lawful().lawful, "a twisted corner survives any sequence");

  // a swap rides a real cube symmetry, so the stickers stay on the faces
  assert(
    !new Cube({ size: 3 }).swapPieces("URF", "DLB").getState().includes("?"),
    "swapped pieces still read as stickers",
  );

  // the three can break together, and each is named
  const chaos = new Cube({ size: 3 }).twistCorner("URF").flipEdge("UF").swapPieces("UL", "UB");
  assertEqual(chaos.lawful().breaks.length, 3, "three laws, three charges");

  // the whole priority family answers: any cube, any cuboid. The twist
  // law is sound everywhere a face can turn, so "unlawful" is final; the
  // full three-law verdict is the 3×3 census's own, and `complete` says
  // which kind of answer you were given.
  assert(new Cube({ size: 3 }).lawful().complete, "the 3×3's verdict is the whole theorem");
  assert(!new Cube({ size: 2 }).lawful().complete, "a 2×2's is the twist law only, and says so");
  assert(!new Cube({ size: 2 }).twistCorner("URF").lawful().lawful, "a 2×2 twist is final");
  assert(!new Cube({ size: 4 }).twistCorner("URF").lawful().lawful, "a 4×4 twist is final");
  assert(!new Cuboid({ size: [3, 3, 5] }).twistCorner("URF").lawful().lawful, "a 3×3×5 twist is final");
  for (const make of [() => new Cube({ size: 2 }), () => new Cube({ size: 5 }), () => new Cuboid({ size: [3, 3, 5] })]) {
    const p = make();
    p.scramble();
    assert(p.lawful().lawful, `${p.name}: every reachable position stays lawful`);
  }
  // welded assemblies get the verbs but not yet the judge, honestly
  new Siamese().twistCorner("DLB"); // does not throw
  let welded = "";
  try {
    new Siamese().lawful();
  } catch (e) {
    welded = e.message;
  }
  assert(/welded/.test(welded), "a weld's laws are not written, and it says so");

  // the Void is under the law; the Megaminx says its laws are not written
  assert(!new Void().flipEdge("UF").lawful().lawful, "the Void answers to it");
  let said = "";
  try {
    new Megaminx().lawful();
  } catch (e) {
    said = e.message;
  }
  assert(/not written here/.test(said), "and the Megaminx is refused honestly");
});

test("parse hands back a tree, not just a string", () => {
  const tree = parse("[R, U]2");
  assertEqual(tree.type, "seq");
  assertEqual(tree.parts[0].type, "repeat");
  assertEqual(tree.parts[0].times, 2);
  assertEqual(tree.parts[0].of.type, "commutator");
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
