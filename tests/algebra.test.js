/* ─────────────────────────────────────────────────────────────────────────
   The algebra, and what it says a sequence does.
   ───────────────────────────────────────────────────────────────────── */

import { Cube, Megaminx, Siamese, Twist, expand, parse, isAlgebra } from "../src/erno.js";

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
  ])
    assertEqual(expand(src), want, src);
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
  const r = p.effectOf("R", { order: true });
  assertEqual(shape(r), "4+4", "R is two four-cycles");
  assertEqual(r.turnedInPlace.length, 1, "and one centre turned in place");
  assertEqual(r.order, 4, "R has order 4");

  // The whole reason commutators are taught: three pieces, nothing else.
  const three = p.effectOf("[R U' R', D]", { order: true });
  assertEqual(shape(three), "3", "a commutator is a three-cycle");
  assertEqual(three.moved, 3, "and moves exactly three pieces");
  assertEqual(three.order, 3);

  // U and D commute, so their commutator is nothing, and so is any
  // conjugate of it. A list of six moves does not show you that.
  const nothing = p.effectOf("[R: [U, D]]", { order: true });
  assertEqual(nothing.moved, 0, "[U, D] is the identity");
  assertEqual(nothing.turnedInPlace.length, 0);
  assertEqual(nothing.order, 1);

  const checker = p.effectOf("U2 D2 F2 B2 L2 R2", { order: true });
  assertEqual(shape(checker), "2+2+2+2+2+2", "the checkerboard swaps six pairs");
  assertEqual(checker.order, 2);
});

test("looking at a sequence does not move the puzzle", () => {
  const p = new Cube({ size: 3 });
  p.move("R U F");
  const position = p.getPosition();
  const history = p.history.join(" ");
  p.effectOf("[R U' R', D]", { order: true });
  assertEqual(p.getPosition(), position, "position");
  assertEqual(p.history.join(" "), history, "history");
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
