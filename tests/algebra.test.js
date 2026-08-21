/* ─────────────────────────────────────────────────────────────────────────
   The algebra, and what it says a sequence does.
   ───────────────────────────────────────────────────────────────────── */

import { Cube, Cuboid, Fisher, Fused, Twisty, Kilominx, Megaminx, Pyraminx, Siamese, Tetris, Twist, expand, parse, isAlgebra } from "../src/erno.js";

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

test("parse hands back a tree, not just a string", () => {
  const tree = parse("[R, U]2");
  assertEqual(tree.type, "seq");
  assertEqual(tree.parts[0].type, "repeat");
  assertEqual(tree.parts[0].times, 2);
  assertEqual(tree.parts[0].of.type, "commutator");
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
