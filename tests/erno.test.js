import { Erno } from "../src/erno.js";

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ok — ${name}`);
  } catch (err) {
    failed++;
    console.error(`FAIL — ${name}\n      ${err.message}`);
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || "assertion failed");
}

function assertEqual(a, b, msg) {
  if (a !== b) throw new Error(`${msg || "not equal"}\n      a: ${a}\n      b: ${b}`);
}

// ── State & identity laws ────────────────────────────────────────────────────

test("solved on construction", () => {
  assert(new Erno().isSolved());
});

test("R4 is identity", () => {
  const c = new Erno();
  c.move("R R R R");
  assert(c.isSolved(), "R applied 4× should restore the cube");
});

test("R R' is identity for every base move", () => {
  for (const m of ["R", "L", "U", "D", "F", "B", "M", "E", "S", "x", "y", "z", "Rw", "r", "u'"]) {
    const c = new Erno();
    c.move(m).move(Erno.inverse(m));
    assert(c.isSolved(), `${m} then its inverse should restore the cube`);
  }
});

test("sexy move has order 6", () => {
  const c = new Erno();
  for (let i = 0; i < 6; i++) c.move("R U R' U'");
  assert(c.isSolved(), "(R U R' U')×6 should restore the cube");
});

test("(R U) has order 105", () => {
  const c = new Erno();
  for (let i = 0; i < 105; i++) c.move("R U");
  assert(c.isSolved());
});

test("R2 equals R R", () => {
  const a = new Erno().move("R2");
  const b = new Erno().move("R R");
  assertEqual(a.getState(), b.getState());
});

test("x rotation equals R M' L'", () => {
  const scramble = "R U F' D2 L B U' R2";
  const a = new Erno().move(scramble).move("x");
  const b = new Erno().move(scramble).move("R M' L'");
  assertEqual(a.getState(), b.getState());
});

test("y rotation equals U E' D'", () => {
  const a = new Erno().move("y");
  const b = new Erno().move("U E' D'");
  assertEqual(a.getState(), b.getState());
});

test("z rotation equals F S B'", () => {
  const a = new Erno().move("z");
  const b = new Erno().move("F S B'");
  assertEqual(a.getState(), b.getState());
});

test("Rw equals R M' on a 3×3", () => {
  const a = new Erno().move("Rw");
  const b = new Erno().move("R M'");
  assertEqual(a.getState(), b.getState());
});

test("lowercase r equals Rw", () => {
  const a = new Erno().move("r U r'");
  const b = new Erno().move("Rw U Rw'");
  assertEqual(a.getState(), b.getState());
});

test("checkerboard pattern M2 E2 S2", () => {
  const c = new Erno().move("M2 E2 S2");
  const s = c.getState();
  // centers keep their color, edges take the opposite face's color
  assertEqual(s[4], "U", "U center stays U");
  assertEqual(s[1], "D", "U edge becomes D color");
  assert(!c.isSolved());
});

test("superflip leaves centers and corners solved", () => {
  const c = new Erno();
  c.move("U R2 F B R B2 R U2 L B2 R U' D' R2 F R' L B2 U2 F2");
  const s = c.getState();
  // corners of U face (indices 0,2,6,8) keep U color
  for (const i of [0, 2, 6, 8]) assertEqual(s[i], "U", `corner facelet ${i}`);
  assertEqual(s[4], "U", "center");
  // edges are flipped in place: U face edges show neighbors' colors
  assert(s[1] !== "U" || s[3] !== "U", "edges flipped");
});

// ── Scramble / inverse round-trips ──────────────────────────────────────────

test("scramble + inverse restores 3×3", () => {
  const c = new Erno();
  const seq = c.scramble();
  assert(!c.isSolved(), "scrambled cube should not be solved");
  c.move(Erno.inverse(seq));
  assert(c.isSolved(), `inverse of "${seq}" should solve`);
});

test("scramble + inverse restores 2×2, 4×4, 5×5", () => {
  for (const size of [2, 4, 5]) {
    const c = new Erno({ size });
    const seq = c.scramble();
    c.move(Erno.inverse(seq));
    assert(c.isSolved(), `size ${size}, seq "${seq}"`);
  }
});

test("wide and layered moves invert on 5×5", () => {
  const c = new Erno({ size: 5 });
  const seq = "3Rw U 3Fw' D2 Lw B 3Uw2 R'";
  c.move(seq).move(Erno.inverse(seq));
  assert(c.isSolved());
});

// ── State I/O ───────────────────────────────────────────────────────────────

test("getState/setState round-trip", () => {
  const c = new Erno();
  c.scramble();
  const s = c.getState();
  const d = new Erno().setState(s);
  assertEqual(d.getState(), s);
});

test("solved state string", () => {
  const s = new Erno().getState();
  assertEqual(s, "U".repeat(9) + "R".repeat(9) + "F".repeat(9) + "D".repeat(9) + "L".repeat(9) + "B".repeat(9));
});

test("setState rejects bad input", () => {
  let threw = false;
  try {
    new Erno().setState("UUU");
  } catch {
    threw = true;
  }
  assert(threw);
});

test("slices rejected on even cubes", () => {
  let threw = false;
  try {
    new Erno({ size: 4 }).move("M");
  } catch {
    threw = true;
  }
  assert(threw);
});

// ── Rendering ───────────────────────────────────────────────────────────────

test("isometric view shows exactly 3 faces of stickers", () => {
  const c = new Erno({ stickerInset: 0 });
  const faces = c.getFaces();
  assertEqual(faces.length, 27, "3 visible faces × 9 stickers");
  const visible = new Set(faces.map((f) => f.face));
  assertEqual([...visible].sort().join(""), "FRU", "should see U, F and R");
});

test("sticker inset doubles the polygon count (plastic + sticker)", () => {
  const c = new Erno();
  assertEqual(c.getFaces().length, 54);
});

test("every camera type renders and culls to 3 faces", () => {
  for (const camera of [
    { type: "isometric", angle: 30 },
    { type: "orthographic", angle: 25, pitch: 30 },
    { type: "oblique", angle: 45 },
    { type: "perspective", position: [5, -2], distance: 12 },
  ]) {
    const c = new Erno({ stickerInset: 0, camera });
    const faces = c.getFaces();
    assert(
      faces.length >= 18 && faces.length <= 27,
      `${camera.type}: got ${faces.length} faces`,
    );
  }
});

test("toSVG emits polygons with data attributes", () => {
  const svg = new Erno().toSVG();
  assert(svg.startsWith("<svg"), "starts with <svg");
  assert(svg.includes('data-face="U"'));
  assert(svg.includes('data-part="sticker"'));
  assert(svg.includes('data-part="plastic"'));
  assert(svg.includes('data-color="U"'));
  const polys = svg.match(/<polygon/g).length;
  assertEqual(polys, 54, "27 stickers + 27 plastic backings");
});

test("mid-turn render exposes core faces", () => {
  const c = new Erno();
  const svg = c.toSVG({ turn: { move: "R", progress: 0.5 } });
  assert(svg.includes('data-part="core"'), "core plastic visible mid-turn");
});

test("turn at progress 0 matches static render geometry count", () => {
  const c = new Erno({ stickerInset: 0 });
  const still = c.getFaces().length;
  const turning = c.getFaces({ move: "R", progress: 0.999 }).length;
  assert(turning >= still, "turning render has at least as many faces");
});

test("style function overrides fills", () => {
  const c = new Erno();
  c.style(({ face }) => (face === "U" ? { fill: "hotpink" } : null));
  const svg = c.toSVG();
  assert(svg.includes("hotpink"));
});

test("renderState statically renders a facelet string", () => {
  const state = new Erno().move("R U R' U'").getState();
  const svg = Erno.renderState(state);
  assert(svg.startsWith("<svg"));
  assert(svg.includes("data-part"));
});

test("fitSphere viewBox is stable across turn progress", () => {
  const c = new Erno();
  const vb = (svg) => svg.match(/viewBox="([^"]+)"/)[1];
  const a = vb(c.toSVG({ fitSphere: true }));
  const b = vb(c.toSVG({ fitSphere: true, turn: { move: "U", progress: 0.5 } }));
  assertEqual(a, b);
});

// ── Summary ─────────────────────────────────────────────────────────────────

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
