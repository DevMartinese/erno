// The chain (CHAIN.md): one fluent value, links, leaves and routing.
import { rubik, alg, resetOutputs, takeOutputs } from "../site/examples/pattern/chain.js";

let passed = 0;
let failed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ok — ${name}`);
  } catch (err) {
    failed++;
    console.error(`  FAIL — ${name}\n      ${err.message}`);
  }
}
function assert(cond, msg) {
  if (!cond) throw new Error(msg || "assertion failed");
}

test("the defaults are the healthy object", () => {
  const r = rubik();
  assert(r.board.pieces.length === 26, "rubik() is the 3×3");
  assert(r.solved(), "whole and at rest");
  assert(r.moves() === 0, "with no history");
  assert(Object.isFrozen(r), "and frozen, like the alg value");
});

test("every link returns a new value, so chains branch", () => {
  const base = rubik("3").paint((x, y, z) => (y > 0 ? "B" : "F"));
  const shaken = base.scramble(7);
  assert(base.solved(), "the base is untouched");
  assert(!shaken.solved(), "the branch is shaken");
  assert(base !== shaken, "and they are different values");
});

test("the chain is deterministic under its seeds", () => {
  const a = rubik("3").scramble(11).board.getPosition();
  const b = rubik("3").scramble(11).board.getPosition();
  assert(a === b, "same seed, same walk");
  assert(a !== rubik("3").scramble(12).board.getPosition(), "another seed walks elsewhere");
});

test("the alg value rides inside turn", () => {
  const r = rubik().turn(alg("R U").times(3));
  assert(r.moves() === 6, "(R U)3 is six moves");
  assert(rubik().turn(alg("R U").times(3)).turn(alg("(R U)3").inverse()).solved(),
    "and its inverse brings the board home");
});

test("the order is the law: bench links refuse after acts", () => {
  let said = "";
  try { rubik().turn("R").carve("centers"); } catch (e) { said = e.message; }
  assert(/bench/.test(said), "carve after turn is refused with the lesson");
  try { rubik().scramble(3).paint((x) => "U"); } catch (e) { said = e.message; }
  assert(/bench/.test(said), "paint after scramble too");
});

test("paint takes the eight arguments Write always passed, or a scheme", () => {
  const inked = rubik().paint((x, y, z, n, face, row, col, kind) => (kind === 3 ? 0 : face));
  assert(inked.board.getTints().includes("#17110c"), "numbers reach the wider palette");
  const jp = rubik().paint("japanese");
  assert(jp.board.getTints().join() !== rubik().board.getTints().join(), "a scheme by name repaints");
  let said = "";
  try { rubik().paint("neon"); } catch (e) { said = e.message; }
  assert(/no scheme called/.test(said), "an unknown scheme is refused by name");
});

test("the refusals come from the mechanism, at the link that earned them", () => {
  let said = "";
  try { rubik("3x3x5").turn("R"); } catch (e) { said = e.message; }
  assert(/R2/.test(said), "the cuboid teaches R2");
  try { rubik("3 + 3 @ 2,2,0").turn("AU"); } catch (e) { said = e.message; }
  assert(/cannot turn/.test(said), "the weld refuses what its shape refuses");
});

test("the reads are leaves", () => {
  const weld = rubik("3 + 3 @ 2,2,0");
  assert(weld.legal().length === 24, "legal() counts the weld's open turns");
  assert(weld.can("AD") && !weld.can("AU"), "can() asks without turning");
  assert(weld.legend().startsWith("A: 3 at the origin"), "legend() says who is who");
  assert(rubik().legend().includes("no introductions"), "a lone cube needs none");
  assert(rubik().at("URF") === "URF", "at() answers home letters at rest");
  assert(rubik().cycles("[R, U]").length > 0, "cycles() reads the twin");
  assert(rubik("3 - centers").lawful().lawful, "the judge speaks on the chain");
});

test("out() routes, and the goal is what distance measures against", () => {
  resetOutputs();
  let said = "";
  try { rubik().scramble(1).off(); } catch (e) { said = e.message; }
  assert(/route a goal first/.test(said), "no goal, and it says how to get one");
  const base = rubik("3").paint((x, y, z) => (y > 0 ? "B" : "F"));
  base.out("goal");
  const table = base.scramble(7).out();
  assert(takeOutputs().get("table") === table, "out() lands on the table");
  assert(table.off() > 0, "the shaken board is off the goal");
  assert(base.off() === 0, "and the goal is zero from itself");
});

test("the build road: deal opens the bin, the last place lands whole", () => {
  const dealt = rubik().deal();
  assert(dealt.bin().length === 20, "a 3×3 deals eight corners and twelve edges");
  assert(typeof dealt.veil === "function", "in pieces, the value wears the veil");
  let v = dealt;
  for (const q of dealt.bin()) v = v.place(q);
  assert(v.veil === null && v.solved() && v.lawful().lawful, "placed home: whole, solved, lawful");
});

test("the borrowed cube, as a chain", () => {
  let v = rubik().deal();
  for (const q of v.bin()) v = v.place(q, q, q === "URF" ? 1 : 0);
  const law = v.lawful();
  assert(!law.lawful && /mod 3/.test(law.breaks[0]), "the judge names the twisted corner");
});

test("in pieces, the whole-board words wait with the bin count", () => {
  const dealt = rubik().deal();
  for (const word of ["turn", "scramble", "solved", "lawful"]) {
    let said = "";
    try { dealt[word]("R"); } catch (e) { said = e.message; }
    assert(/20 still in the bin/.test(said), `${word}() names the bin`);
  }
  let said = "";
  try { rubik().turn("R").deal(); } catch (e) { said = e.message; }
  assert(/bench/.test(said), "deal after a turn is refused: a fresh cube comes apart");
  try { rubik("3 - centers").deal(); } catch (e) { said = e.message; }
  assert(/bin would promise/.test(said), "a carved board refuses the bin");
});

test("the weld builds body-first on the chain", () => {
  const dealt = rubik("3 + 3 @ 2,2,0").deal();
  assert(dealt.bin().every((q) => /^[AB]/.test(q)), "every free piece spells its body");
  let v = dealt;
  for (const q of dealt.bin()) v = v.place(q);
  assert(v.lawful().lawful && v.lawful().complete, "built home, the weld judge crowns it");
  let said = "";
  try { rubik("3 + 3 @ 2,2,0").deal().place("DLB"); } catch (e) { said = e.message; }
  assert(/body-first/.test(said), "a bare name is refused with the lesson");
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
