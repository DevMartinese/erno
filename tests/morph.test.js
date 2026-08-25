// The morph (voyage.js): how one board becomes another on screen.
//
// Four relatos, and they compose. The engine already knows what changed;
// this module says what STORY that change is, so the page can tell it.
import { boardOf } from "../src/erno.js";
import { pairKey, storyOf, waves, screenDelta } from "../site/examples/pattern/morph.js";

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

// ── The pairing ─────────────────────────────────────────────────────────────

test("a corner is a corner at any resolution", () => {
  const three = boardOf("3");
  const five = boardOf("5");
  const keyAt = (b, at) => pairKey(b.pieces.find((p) => p.slotPoint.join() === at), b);
  const k3 = keyAt(three, "1,1,1");
  const k5 = keyAt(five, "2,2,2");
  assert(typeof k3 === "string" && k3.length, `a key is a string, got ${k3}`);
  assert(k3 === k5, `the URF corner of a 3 and of a 5 is one key: ${k3} vs ${k5}`);
  // and it is a key, not a constant: the DLB corner is a different one
  assert(k3 !== keyAt(three, "-1,-1,-1"), "URF and DLB are told apart");
});

test("the cell key told them apart, which is the bug", () => {
  const three = boardOf("3");
  const five = boardOf("5");
  const cell = (p) => p.slotPoint.map((v) => Math.round(v * 2)).join(",");
  const A = new Set(three.pieces.map(cell));
  const shared = five.pieces.filter((p) => A.has(cell(p))).length;
  assert(shared === 0, "absolute cells share nothing between a 3 and a 5");
});

// ── The relatos ─────────────────────────────────────────────────────────────

test("the same board twice is a repaint, and nothing moves", () => {
  const s = storyOf(boardOf("3"), boardOf("3"));
  assert(s.acts.join() === "repaint", `acts = ${s.acts}`);
  assert(s.leaving.length === 0 && s.arriving.length === 0, "nobody comes or goes");
  assert(s.staying.every((p) => p.delta.every((v) => v === 0)), "and nobody moves");
});

test("a bigger cube subdivides: the shell stays, the cuts multiply", () => {
  const s = storyOf(boardOf("3"), boardOf("5"));
  assert(s.acts.includes("subdivide"), `acts = ${s.acts}`);
  assert(s.leaving.length === 0, `nothing is peeled off a 3 to make a 5, got ${s.leaving.length}`);
  assert(s.staying.length === 26, `all 26 pieces of the 3 find their counterpart, got ${s.staying.length}`);
  assert(s.arriving.length === 98 - 26, `only the new cuts arrive, got ${s.arriving.length}`);
});

test("a carve is pure subtraction, and it is its own story", () => {
  for (const [whole, carved, gone] of [
    ["3", "3 - centers", 6],
    ["5", "5 - centers", 6],
    ["3x3x5", "3x3x5 - centers", 6],
    ["3 + 3 @ 2,2,0", "3 + 3 @ 2,2,0 - centers", 14],
  ]) {
    const s = storyOf(boardOf(whole), boardOf(carved));
    assert(s.acts.join() === "subtract", `${carved}: acts = ${s.acts}`);
    assert(s.arriving.length === 0, `${carved}: nothing arrives`);
    assert(s.leaving.length === gone, `${carved}: ${gone} pieces lift out, got ${s.leaving.length}`);
  }
});

test("a box stretches along the axes that changed, and only those", () => {
  const s = storyOf(boardOf("5"), boardOf("3x3x5"));
  assert(s.acts.includes("stretch"), `acts = ${s.acts}`);
  const moved = s.staying.filter((p) => p.delta.some((v) => v !== 0));
  assert(moved.length > 0, "the survivors travel");
  assert(moved.every((p) => p.delta[2] === 0), "z kept its five layers, so nothing moves along z");
  assert(moved.some((p) => p.delta[0] !== 0 || p.delta[1] !== 0), "x and y went 5 → 3, so they do");
});

test("a second body docks, and the story carries the vector it arrives on", () => {
  const s = storyOf(boardOf("3x3x5"), boardOf("3 + 3 @ 2,2,0"));
  assert(s.acts.includes("dock"), `acts = ${s.acts}`);
  assert(s.dock, "the dock is described");
  assert(s.dock.offset.join() === "2,2,0", `body B arrives on 2,2,0, got ${s.dock.offset}`);
  assert(s.dock.pieces.length > 0, "and it names the pieces that ride in");
  assert(
    s.dock.pieces.every((i) => s.arriving.includes(i)),
    "everything that docks is something that arrives",
  );
});

test("a body that leaves undocks, the way it arrived", () => {
  const s = storyOf(boardOf("3 + 3 @ 2,2,0"), boardOf("3"));
  assert(s.acts.includes("undock"), `acts = ${s.acts}`);
  assert(s.undock, "the departure is described");
  assert(s.undock.offset.join() === "2,2,0", `body B leaves on 2,2,0, got ${s.undock.offset}`);
  assert(
    s.undock.pieces.every((i) => s.leaving.includes(i)),
    "everything that undocks is something that leaves",
  );
  assert(
    s.acts.indexOf("undock") < s.acts.indexOf("subtract"),
    "the body pulls away before the rest sheds",
  );
});

test("a lone cube gaining nothing has no body to undock", () => {
  const s = storyOf(boardOf("3"), boardOf("3 - centers"));
  // the story has to BE one first, or "no undock" is true of nothing at all
  assert(s.acts.join() === "subtract", `a carve is a subtract, got ${s.acts}`);
  assert(s.leaving.length === 6, `with six pieces gone, got ${s.leaving.length}`);
  assert(!s.undock, "and no departure: a carve is not a body leaving");
  assert(!s.acts.includes("undock"), `acts = ${s.acts}`);
});

test("a carved weld tells both stories, in the order they must be played", () => {
  const s = storyOf(boardOf("3x3x5"), boardOf("3 + 3 @ 2,2,0 - centers"));
  assert(s.acts.includes("subtract"), `acts = ${s.acts}`);
  assert(s.acts.includes("dock"), `acts = ${s.acts}`);
  assert(
    s.acts.indexOf("subtract") < s.acts.indexOf("dock"),
    "what leaves goes before what arrives",
  );
});

// ── The slide ───────────────────────────────────────────────────────────────

test("the slide vector is the renderer's own, not an approximation of it", () => {
  const w = boardOf("3 + 3 @ 2,2,0");
  const frame = { center: [0, 0, 0], radius: 6 };

  // What the renderer actually did: body B's stickers against body A's
  // congruent ones - same face letter, same place within their own body.
  const centre = (pts) => {
    let x = 0, y = 0;
    for (let i = 0; i < pts.length; i += 2) { x += pts[i]; y += pts[i + 1]; }
    return [x / (pts.length / 2), y / (pts.length / 2)];
  };
  const rows = new Map();
  for (const f of w.getFaces(undefined, undefined, frame)) {
    if (f.part !== "sticker") continue;
    const home = w.pieces[f.piece].slotPoint;
    const at = pairKey(w.pieces[f.piece], w).startsWith("B|") ? [2, 2, 0] : [0, 0, 0];
    const key = `${f.face}|${home.map((v, k) => v - at[k]).join(",")}`;
    if (!rows.has(key)) rows.set(key, {});
    rows.get(key)[at.join()] = centre(f.points);
  }
  const seen = [...rows.values()].filter((r) => r["0,0,0"] && r["2,2,0"]);
  assert(seen.length >= 12, `enough congruent stickers to measure, got ${seen.length}`);

  const [px, py] = screenDelta(w, [2, 2, 0]);
  for (const r of seen) {
    const mx = r["2,2,0"][0] - r["0,0,0"][0];
    const my = r["2,2,0"][1] - r["0,0,0"][1];
    assert(Math.abs(mx - px) < 0.01, `x: renderer moved it ${mx}, we predict ${px}`);
    assert(Math.abs(my - py) < 0.01, `y: renderer moved it ${my}, we predict ${py}`);
  }
});

test("the slide is exact under every parallel camera the page can hold", () => {
  // The projector's own extent is an additive offset, so it cancels in a
  // difference: the frame a board is drawn in cannot change how far an
  // offset travels. Pinned here so nobody reintroduces it as a parameter.
  for (const camera of [
    { type: "isometric", angle: 30 },
    { type: "isometric", angle: -12 },
    { type: "orthographic", angle: 20, pitch: 40 },
    { type: "oblique", angle: 45, depth: 0.5 },
  ]) {
    const w = boardOf("3 + 3 @ 2,2,0");
    w.camera = camera;
    const one = screenDelta(w, [2, 2, 0]);
    const two = screenDelta(w, [4, 4, 0]);
    // a module that answered [0,0] to everything would satisfy linearity
    assert(Math.hypot(...one) > 1, `${camera.type}: the offset really travels, got ${one}`);
    assert(
      Math.abs(two[0] - 2 * one[0]) < 1e-9 && Math.abs(two[1] - 2 * one[1]) < 1e-9,
      `${camera.type}: twice the offset must be twice the travel`,
    );
    assert(screenDelta(w, [0, 0, 0]).join() === "0,0", `${camera.type}: no offset, no travel`);
  }
});

test("a camera that is not parallel is refused, not silently mis-slid", () => {
  // Perspective is not affine: a difference of points is NOT a difference
  // of projections, so a layer slid by this vector would land wrong. The
  // page has no perspective camera today; the refusal is what keeps a
  // future one from failing quietly.
  const w = boardOf("3 + 3 @ 2,2,0");
  w.camera = { type: "perspective", distance: 40 };
  let said = "";
  try {
    screenDelta(w, [2, 2, 0]);
  } catch (err) {
    said = err.message;
  }
  assert(said, "it refuses");
  assert(/perspective/.test(said), `and names the camera: ${said}`);
});

// ── The waves ───────────────────────────────────────────────────────────────

test("waves radiate outward from the heart, or peel inward to it", () => {
  const b = boardOf("5");
  const items = b.pieces.map((p, i) => ({ at: p.slotPoint, idx: i }));
  const out = waves(items, { outward: true });
  const back = waves(items, { outward: false });
  assert(out.length >= 4 && out.length <= 10, `between four and ten waves, got ${out.length}`);
  assert(out.flat().length === items.length, "every piece rides exactly one wave");
  const far = (i) => Math.hypot(...b.pieces[i].slotPoint);
  const firstOut = Math.max(...out[0].map(far));
  const lastOut = Math.min(...out[out.length - 1].map(far));
  assert(firstOut <= lastOut, "outward: the near pieces go first");
  assert(back[0].some((i) => far(i) >= lastOut), "inward: the rim goes first");
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
