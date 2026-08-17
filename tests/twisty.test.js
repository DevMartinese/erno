import {
  Erno,
  Twisty,
  Skewb,
  Pyraminx,
  Mirror,
  Void,
  Tetris,
  Cuboid,
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
  SCHEMES,
  generateScheme,
  schemeFrom,
  generateRamp,
  nameScheme,
  tetrisPaint,
  Megaminx,
  SkewbDiamond,
  Puzzle,
  buildPuzzle,
  Cube,
  Fused,
  Siamese,
  dicePips,
  dominoPips,
  sudokuDigits,
  DICE_CUBE,
  SUDOKU_CUBE,
  DOMINO_PRINT,
  Squished,
  squash,
} from "../src/erno.js";

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

// ── Generated geometry ──────────────────────────────────────────────────────

test("piece and facelet counts", () => {
  assertEqual(new Skewb().pieces.length, 14, "skewb pieces");
  assertEqual(new Skewb().getState().length, 30, "skewb facelets");
  assertEqual(new Pyraminx().pieces.length, 14, "pyraminx pieces");
  assertEqual(new Pyraminx().getState().length, 36, "pyraminx facelets");
  assertEqual(new Mirror().pieces.length, 26, "mirror pieces");
  assertEqual(new Mirror().getState().length, 54, "mirror facelets");
  assertEqual(new Void().pieces.length, 20, "void pieces (no centers, no core)");
  assertEqual(new Void().getState().length, 48, "void facelets (8 per face)");
});

test("solved on construction", () => {
  for (const C of [Skewb, Pyraminx, Mirror, Void]) assert(new C().isSolved());
});

test("solved state strings are face-uniform", () => {
  assertEqual(new Skewb().getState(), "U".repeat(5) + "R".repeat(5) + "F".repeat(5) + "D".repeat(5) + "L".repeat(5) + "B".repeat(5));
  assertEqual(new Pyraminx().getState(), "F".repeat(9) + "L".repeat(9) + "R".repeat(9) + "D".repeat(9));
});

// ── Group identity laws ─────────────────────────────────────────────────────

test("skewb: every 120° move has order 3", () => {
  for (const m of ["R", "U", "L", "B"]) {
    const s = new Skewb().move(`${m} ${m} ${m}`);
    assert(s.isSolved(), `${m}³ should restore the skewb`);
  }
});

test("skewb: move then inverse is identity", () => {
  for (const m of ["R", "U'", "L", "B'"]) {
    const s = new Skewb().move(m).move(Twisty.inverse(m));
    assert(s.isSolved(), `${m} then inverse`);
  }
});

test("skewb: U turn moves half the puzzle", () => {
  const s = new Skewb().move("U");
  assert(!s.isSolved());
  const solved = new Skewb().getState();
  const now = s.getState();
  let changed = 0;
  for (let i = 0; i < now.length; i++) if (now[i] !== solved[i]) changed++;
  assert(changed > 6, `a 120° turn should displace many stickers (got ${changed})`);
});

test("pyraminx: layer and tip moves have order 3", () => {
  for (const m of ["U", "L", "R", "B", "u", "l", "r", "b"]) {
    const p = new Pyraminx().move(`${m} ${m} ${m}`);
    assert(p.isSolved(), `${m}³ should restore the pyraminx`);
  }
});

test("pyraminx: tip move changes exactly 3 facelets", () => {
  const solved = new Pyraminx().getState();
  const now = new Pyraminx().move("u").getState();
  let changed = 0;
  for (let i = 0; i < now.length; i++) if (now[i] !== solved[i]) changed++;
  assertEqual(changed, 3, "a tip turn twists one 3-sticker piece in place");
});

test("mirror: R4 is identity, (R U) has order 105", () => {
  assert(new Mirror().move("R R R R").isSolved(), "R⁴");
  const m = new Mirror();
  for (let i = 0; i < 105; i++) m.move("R U");
  assert(m.isSolved(), "(R U)×105");
});

test("void: slices work and sexy move has order 6", () => {
  assert(new Void().move("M M M M").isSolved(), "M⁴");
  const v = new Void();
  for (let i = 0; i < 6; i++) v.move("R U R' U'");
  assert(v.isSolved(), "(R U R' U')×6");
});

// ── Scramble / inverse round-trips (exact state, no drift) ─────────────────

test("scramble + inverse restores every puzzle exactly", () => {
  for (const [name, C] of [["skewb", Skewb], ["pyraminx", Pyraminx], ["mirror", Mirror], ["void", Void]]) {
    const x = new C();
    const seq = x.scramble();
    assert(!x.isSolved(), `${name} should be scrambled by "${seq}"`);
    x.move(Twisty.inverse(seq));
    assert(x.isSolved(), `${name}: inverse of "${seq}" should solve`);
  }
});

// ── Mirror ↔ 3×3 isomorphism ────────────────────────────────────────────────

test("mirror facelets match the Erno 3×3 for all notation", () => {
  for (const seq of ["R", "U'", "F2", "D' L2 B", "R U R' U'", "M E S", "x y z", "Rw U' r"]) {
    assertEqual(
      new Mirror().move(seq).getState(),
      new Erno().move(seq).getState(),
      `sequence "${seq}"`,
    );
  }
});

// ── Rendering ───────────────────────────────────────────────────────────────

test("default view culls to the expected sticker counts", () => {
  const stickers = (svg) => (svg.match(/data-part="sticker"/g) || []).length;
  assertEqual(stickers(new Skewb({ stickerInset: 0 }).toSVG()), 15, "skewb: 3 faces × 5");
  assertEqual(stickers(new Pyraminx({ stickerInset: 0 }).toSVG()), 18, "pyraminx: 2 faces × 9");
  assertEqual(stickers(new Mirror({ stickerInset: 0 }).toSVG()), 27, "mirror: 3 faces × 9");
  assertEqual(stickers(new Void({ stickerInset: 0 }).toSVG()), 24, "void: 3 faces × 8");
});

test("toSVG emits piece-level data attributes", () => {
  const svg = new Skewb().toSVG();
  assert(svg.startsWith("<svg"));
  assert(svg.includes('data-part="sticker"'));
  assert(svg.includes('data-part="plastic"'));
  assert(svg.includes("data-piece="));
  assert(svg.includes("data-index="));
  assert(svg.includes('data-color="U"'));
});

test("void renders interior walls and no center stickers", () => {
  const svg = new Void({ stickerInset: 0 }).toSVG();
  assert(svg.includes('data-part="core"'), "interior plastic visible through the holes");
  // center facelet of a visible face would carry index 4 of that face's 9 — but
  // void faces have 8 stickers, so every rendered face shows exactly 8
  const perFace = {};
  for (const m of svg.matchAll(/data-part="sticker" data-face="(\w)"/g))
    perFace[m[1]] = (perFace[m[1]] || 0) + 1;
  for (const f of Object.keys(perFace)) assertEqual(perFace[f], 8, `face ${f}`);
});

test("mirror shape-shifts: same colors, different geometry after a turn", () => {
  const solved = new Mirror().toSVG();
  const turned = new Mirror().move("R").toSVG();
  assert(solved !== turned, "geometry must change even though stickers are uniform");
  const again = new Mirror().move("R").toSVG();
  assertEqual(turned, again, "rendering is deterministic");
});

test("mid-turn render works on every puzzle", () => {
  for (const [C, mv] of [[Skewb, "R"], [Pyraminx, "U"], [Mirror, "F"], [Void, "M"]]) {
    const svg = new C().toSVG({ turn: { move: mv, progress: 0.5 } });
    assert(svg.startsWith("<svg"), `${C.name} mid-turn renders`);
    // Plastic shows wherever a turn pulls two pieces apart. Sample several
    // angles rather than one: a puzzle can seal again at a particular
    // angle (the Skewb's cut surfaces meet flush at exactly 60°, half of
    // its 120° turn), and a sealed instant has no interior to draw.
    assert(
      [0.25, 0.5, 0.75].some((p) =>
        new C().toSVG({ turn: { move: mv, progress: p } }).includes('data-part="core"'),
      ),
      `${C.name} exposes plastic mid-turn`,
    );
  }
});

test("fitSphere viewBox is stable across turn progress", () => {
  const vb = (svg) => svg.match(/viewBox="([^"]+)"/)[1];
  for (const [C, mv] of [[Skewb, "U"], [Pyraminx, "R"]]) {
    const x = new C();
    assertEqual(
      vb(x.toSVG({ fitSphere: true })),
      vb(x.toSVG({ fitSphere: true, turn: { move: mv, progress: 0.5 } })),
      C.name,
    );
  }
});

test("every camera type renders every puzzle", () => {
  for (const C of [Skewb, Pyraminx, Mirror, Void])
    for (const camera of [
      { type: "isometric", angle: 30 },
      { type: "orthographic", angle: 25, pitch: 30 },
      { type: "oblique", angle: 45 },
      { type: "perspective", position: [8, -3], distance: 20 },
    ]) {
      const svg = new C({ camera }).toSVG();
      assert(svg.includes("<polygon"), `${C.name} / ${camera.type}`);
    }
});

test("style function overrides fills", () => {
  const s = new Skewb();
  s.style(({ face }) => (face === "U" ? { fill: "hotpink" } : null));
  assert(s.toSVG().includes("hotpink"));
});

test("color schemes apply", () => {
  // x2 brings the D face up into view — in the japanese scheme it is blue
  const svg = new Void({ colors: SCHEMES.japanese, stickerInset: 0 }).move("x2").toSVG();
  assert(svg.includes("#0046ad"), "japanese scheme paints D blue");
  assert(!svg.includes("#ffffff"), "white U face is hidden after x2");
  const gold = new Mirror({ colors: SCHEMES.gold }).toSVG();
  assert(gold.includes("#d9b64c"));
});

// ── Rubik's Tetris ──────────────────────────────────────────────────────────

test("tetris: counts, identities and scramble round-trip", () => {
  const t = new Tetris();
  assertEqual(t.pieces.length, 26, "26 solid cubies");
  assertEqual(t.getState().length, 54);
  assert(t.isSolved(), "solved on construction");
  assert(!new Tetris().move("R").isSolved());
  assert(new Tetris().move("R R R R").isSolved(), "R⁴");
  const x = new Tetris();
  const seq = x.scramble();
  assert(!x.isSolved(), `scrambled by "${seq}"`);
  x.move(Twisty.inverse(seq));
  assert(x.isSolved());
});

test("tetris: every face shows its exact tetromino when solved", () => {
  const t = new Tetris();
  const tints = t.getTints();
  const COLOR = { S: "#3fbf5a", Z: "#ef4444", L: "#f59e0b", J: "#2e3fae", T: "#8f4fc4", O: "#f5d90a" };
  const SHAPES = {
    U: ["S", [[1, 1], [1, 2], [2, 0], [2, 1]]],
    R: ["L", [[1, 0], [1, 1], [1, 2], [0, 2]]],
    F: ["T", [[2, 2], [2, 1], [2, 0], [1, 1]]],
    D: ["J", [[1, 0], [1, 1], [1, 2], [2, 2]]],
    L: ["Z", [[0, 0], [0, 1], [1, 1], [1, 2]]],
    B: ["O", [[1, 1], [1, 2], [2, 1], [2, 2]]],
  };
  ["U", "R", "F", "D", "L", "B"].forEach((f, fi) => {
    const [shape, cells] = SHAPES[f];
    const inShape = new Set(cells.map(([r, c]) => r * 3 + c));
    for (let j = 0; j < 9; j++) {
      const isShapeColor = tints[fi * 9 + j] === COLOR[shape];
      assertEqual(isShapeColor, inShape.has(j), `face ${f} cell ${j}`);
    }
  });
});

test("tetris: solid cubies render on adjacent faces (5 purple, 4 white visible)", () => {
  const svg = new Tetris().toSVG();
  const count = (c) => (svg.match(new RegExp(`fill="${c}"`, "g")) || []).length;
  assertEqual(count("#8f4fc4"), 5, "T shape + DFR corner peeking on R");
  assertEqual(count("#f5f3ee"), 4, "white UFR corner ×3 + UB edge");
});

// ── Cuboids ─────────────────────────────────────────────────────────────────

test("cuboids: piece and facelet counts", () => {
  assertEqual(new Domino().pieces.length, 18, "domino 3×2×3 pieces");
  assertEqual(new Domino().getState().length, 42, "domino facelets");
  assertEqual(new Tower().pieces.length, 12, "tower 2×3×2 pieces");
  assertEqual(new Tower().getState().length, 32, "tower facelets");
  assertEqual(new Floppy().pieces.length, 9, "floppy 3×1×3 pieces");
  assertEqual(new Floppy().getState().length, 30, "floppy facelets");
  assertEqual(new Cuboid({ size: [3, 4, 3] }).pieces.length, 34, "3×4×3 minus interior");
});

test("cuboids: quarter turns only about square axes", () => {
  assert(new Domino().move("U U U U").isSolved(), "domino U⁴");
  assert(new Domino().move("R2 R2").isSolved(), "domino R2²");
  assert(new Tower().move("U' U").isSolved(), "tower U quarter legal");
  for (const [C, bad] of [[Domino, "R"], [Domino, "x"], [Tower, "F"], [Floppy, "R"]]) {
    let threw = false;
    try {
      new C().move(bad);
    } catch {
      threw = true;
    }
    assert(threw, `${C.name} should reject '${bad}'`);
  }
  assert(new Domino().move("y y y y").isSolved(), "y rotation legal on domino");
});

test("cuboids: scramble + inverse restores exactly", () => {
  for (const [name, C] of [["domino", Domino], ["tower", Tower], ["floppy", Floppy]]) {
    const x = new C();
    const seq = x.scramble();
    assert(!x.isSolved(), `${name} scrambled by "${seq}"`);
    x.move(Twisty.inverse(seq));
    assert(x.isSolved(), `${name}: inverse of "${seq}"`);
  }
});

test("cuboids: render and animate", () => {
  const svg = new Domino({ stickerInset: 0 }).toSVG();
  const stickers = (svg.match(/data-part="sticker"/g) || []).length;
  assertEqual(stickers, 9 + 6 + 6, "domino default view: U(9) + F(6) + R(6)");
  for (const [C, mv] of [[Domino, "U"], [Tower, "R2"], [Floppy, "F2"]]) {
    const turn = new C().toSVG({ turn: { move: mv, progress: 0.5 } });
    assert(turn.includes('data-part="core"'), `${C.name} exposes plastic mid-turn`);
  }
});

// ── Shape mods (Fisher, Windmill, Twist, Penrose) ───────────────────────────

test("shape mods: piece counts and turn orders", () => {
  assertEqual(new Fisher().pieces.length, 26, "fisher");
  assertEqual(new Windmill().pieces.length, 26, "windmill");
  assertEqual(new Twist().pieces.length, 26, "twist");
  assertEqual(new Penrose().pieces.length, 26, "penrose");
  assert(new Fisher().move("U U U U").isSolved(), "fisher U⁴");
  assert(new Fisher().move("R R R R").isSolved(), "fisher R⁴");
  assert(new Windmill().move("F F F F").isSolved(), "windmill F⁴");
  assert(new Twist().move("M M M M").isSolved(), "twist M⁴");
  assert(new Penrose().move("R R R R").isSolved(), "penrose R⁴");
});

test("shape mods: shape-shifted stickers report ? until they realign", () => {
  assert(new Fisher().move("R").getState().includes("?"), "fisher R");
  assert(new Twist().move("R").getState().includes("?"), "twist R");
  assert(!new Fisher().move("U").getState().includes("?"), "fisher U keeps alignment");
});

test("shape mods: scramble + inverse restores", () => {
  for (const [name, C] of [["fisher", Fisher], ["windmill", Windmill], ["twist", Twist], ["penrose", Penrose]]) {
    const x = new C();
    const seq = x.scramble();
    assert(!x.isSolved(), `${name} scrambled`);
    x.move(Twisty.inverse(seq));
    assert(x.isSolved(), `${name}: inverse of "${seq}"`);
  }
});

// ── Corner & edge turners (Dino, Helicopter) ────────────────────────────────

test("dino: 12 edges, corner moves turn three of them", () => {
  const d = new Dino();
  assertEqual(d.pieces.length, 12);
  assertEqual(d.getState().length, 24);
  assert(new Dino().move("URF URF URF").isSolved(), "URF³");
  assertEqual(
    new Dino().move("RUF").getState(),
    new Dino().move("URF").getState(),
    "corner names normalize by letter sort",
  );
  const solved = new Dino().getState();
  const turned = new Dino().move("UFR").getState();
  let changed = 0;
  for (let i = 0; i < turned.length; i++) if (turned[i] !== solved[i]) changed++;
  assertEqual(changed, 6, "three 2-sticker edges move");
});

test("helicopter: 32 pieces, edge flips move 2 corners + 4 petals", () => {
  const h = new Helicopter();
  assertEqual(h.pieces.length, 32);
  assertEqual(h.getState().length, 48);
  assert(new Helicopter().move("UF UF").isSolved(), "UF²");
  const solved = new Helicopter().getState();
  const turned = new Helicopter().move("UF").getState();
  let changed = 0;
  for (let i = 0; i < turned.length; i++) if (turned[i] !== solved[i]) changed++;
  assertEqual(changed, 10, "2 corners × 3 + 4 petals");
});

test("turners: scramble + inverse restores", () => {
  for (const [name, C] of [["dino", Dino], ["helicopter", Helicopter]]) {
    const x = new C();
    const seq = x.scramble();
    assert(!x.isSolved(), `${name} scrambled`);
    x.move(Twisty.inverse(seq));
    assert(x.isSolved(), `${name}: inverse of "${seq}"`);
  }
});

test("new puzzles all render with core exposed mid-turn", () => {
  for (const [C, mv] of [[Fisher, "R"], [Windmill, "F"], [Twist, "R"], [Penrose, "U"], [Dino, "URF"], [Helicopter, "UF"]]) {
    const svg = new C().toSVG({ turn: { move: mv, progress: 0.5 } });
    assert(svg.startsWith("<svg"), `${C.name} renders`);
    assert(svg.includes('data-part="core"'), `${C.name} shows plastic mid-turn`);
  }
});

// ── Second wave: corner turners, conjugated mods, tetra family ─────────────

test("corner turners: depth decides the piece count", () => {
  assertEqual(new Compy().pieces.length, 21, "compy: 8 caps + 12 wings + fixed center block");
  assertEqual(new MasterSkewb().pieces.length, 50, "master skewb: 8+24+12+6");
  for (const C of [Compy, MasterSkewb]) {
    assert(new C().move("URF URF URF").isSolved(), `${C.name} URF³`);
    assertEqual(
      new C().move("RUF").getState(),
      new C().move("URF").getState(),
      `${C.name} corner-name normalization`,
    );
  }
});

test("axis & ghost: conjugated 3×3 mechanisms", () => {
  for (const C of [Axis, Ghost]) {
    assertEqual(new C().pieces.length, 26, C.name);
    assert(new C().move("U U U U").isSolved(), `${C.name} U⁴`);
    assert(new C().move("R").getState().includes("?"), `${C.name} shape-shifts`);
  }
});

test("tetra family: master pyraminx layers and morphix shape-shifting", () => {
  const mp = new MasterPyraminx();
  assertEqual(mp.pieces.length, 30, "master pyraminx pieces");
  for (const m of ["u", "U", "Uw"])
    assert(new MasterPyraminx().move(`${m} ${m} ${m}`).isSolved(), `${m}³`);
  assertEqual(new Pyramorphix().pieces.length, 8, "pyramorphix = 2×2 in a tetra");
  assert(new Pyramorphix().move("R R R R").isSolved(), "pyramorphix R⁴");
  assert(new Pyramorphix().move("R").getState().includes("?"), "pyramorphix shape-shifts");
  assert(new Mastermorphix().move("M M M M").isSolved(), "mastermorphix M⁴");
});

test("second wave: scramble + inverse restores every puzzle", () => {
  for (const [name, C] of [
    ["compy", Compy],
    ["master-skewb", MasterSkewb],
    ["axis", Axis],
    ["ghost", Ghost],
    ["master-pyraminx", MasterPyraminx],
    ["pyramorphix", Pyramorphix],
    ["mastermorphix", Mastermorphix],
  ]) {
    const x = new C();
    const seq = x.scramble();
    assert(!x.isSolved(), `${name} scrambled by "${seq}"`);
    x.move(Twisty.inverse(seq));
    assert(x.isSolved(), `${name}: inverse of "${seq}"`);
  }
});

test("second wave: all render, with core exposed mid-turn", () => {
  for (const [C, mv] of [
    [Compy, "URF"],
    [MasterSkewb, "DBL"],
    [Axis, "R"],
    [Ghost, "U"],
    [MasterPyraminx, "Uw"],
    [Pyramorphix, "R"],
    [Mastermorphix, "U"],
  ]) {
    const svg = new C().toSVG({ turn: { move: mv, progress: 0.5 } });
    assert(svg.startsWith("<svg"), `${C.name} renders`);
    assert(svg.includes('data-part="core"'), `${C.name} shows plastic mid-turn`);
  }
});

// ── Generative palettes ─────────────────────────────────────────────────────

test("generateScheme: deterministic, distinct, valid", () => {
  const FACES = ["U", "R", "F", "D", "L", "B"];
  assertEqual(
    JSON.stringify(generateScheme(FACES, { seed: 42 })),
    JSON.stringify(generateScheme(FACES, { seed: 42 })),
    "same seed, same scheme",
  );
  for (let seed = 0; seed < 100; seed++)
    for (const letters of [FACES, ["F", "L", "R", "D"], ["X", "Y", "Z"]]) {
      const s = generateScheme(letters, { seed });
      assertEqual(new Set(Object.values(s)).size, letters.length, `seed ${seed} distinct`);
      assert(Object.values(s).every((c) => /^#[0-9a-f]{6}$/.test(c)), `seed ${seed} hex`);
    }
  const named = generateScheme(FACES, { seed: 7 });
  assert(typeof named.name === "string" && named.name.includes(" "), "two-word name");
  assert(typeof nameScheme(named) === "string");
});

test("schemeFrom anchors the input color exactly", () => {
  const s = schemeFrom("#e63946", ["U", "R", "F", "D", "L", "B"]);
  assertEqual(s.U, "#e63946");
  assertEqual(new Set(Object.values(s)).size, 6);
});

test("generateRamp: right length, open ends, paints a puzzle", () => {
  const ramp = generateRamp(20, { seed: 3 });
  assertEqual(ramp.length, 20);
  assert(ramp[0] !== ramp[19], "ramp doesn't close on itself");
  const v = new Void();
  v.style(({ piece }) => ({ fill: ramp[piece] }));
  const svg = v.toSVG();
  assert(svg.includes(ramp[0]) || svg.includes(ramp[5]), "ramp colors reach the SVG");
});

test("generated schemes drive any puzzle", () => {
  const cube = new Erno({ colors: generateScheme(["U", "R", "F", "D", "L", "B"], { seed: 9 }) });
  assert(cube.toSVG().startsWith("<svg"));
  const pyra = new Pyraminx({ colors: generateScheme(["F", "L", "R", "D"], { seed: 9 }) });
  assert(pyra.toSVG().startsWith("<svg"));
});

// ── Painting ────────────────────────────────────────────────────────────────

test("paint tints stickers on any mechanism, not just Tetris", () => {
  // the Tetris layout lifted onto a different mechanism entirely
  const m = new Mirror({ paint: tetrisPaint });
  assert(m.isSolved(), "painted mirror starts solved");
  assert(m.toSVG().startsWith("<svg"), "painted mirror renders");
  assert(!new Mirror({ paint: tetrisPaint }).move("R").isSolved(), "R breaks it");

  // a paint may tint only what it wants; the rest keeps its face colour
  const one = new Skewb({ paint: ({ letter }) => (letter === "U" ? "#cc2823" : undefined) });
  const reds = one.getTints().filter((t) => t === "#cc2823").length;
  assertEqual(reds, 5, "every U sticker of a skewb tinted, and only those");

  // and it reaches puzzles that never had a painted variant
  const mega = new Megaminx({ paint: ({ index }) => (index % 2 ? "#00489f" : "#f6ba00") });
  assertEqual(new Set(mega.getTints().filter(Boolean)).size, 2, "megaminx takes two tints");
});

test("a painted puzzle is solved by pattern, not by facelets", () => {
  // Same-coloured pieces are interchangeable, so a paint that gives every
  // piece one colour can never be unsolved however it is scrambled.
  const flat = new SkewbDiamond({ paint: () => "#17110c" });
  flat.scramble();
  assert(flat.isSolved(), "a single-colour paint is always solved");

  // while a paint that distinguishes pieces behaves like a real puzzle.
  // (This used `Erno` until the facelet cube learned to refuse `paint`,
  // which is when it turned out to have been asserting nothing: the option
  // was dropped and the test was checking an unpainted cube.)
  const striped = new Cube({ paint: ({ slot }) => (slot[1] > 0 ? "#cc2823" : "#00489f") });
  assert(striped.isSolved(), "starts solved");
  assertEqual(new Set(striped.getTints().filter(Boolean)).size, 2, "two tints, as painted");
  striped.scramble();
  assert(!striped.isSolved(), "and a two-tint paint really can be unsolved");
});

test("Tetris still works exactly as before", () => {
  const t = new Tetris();
  assert(t.isSolved(), "solved at birth");
  assert(!new Tetris().move("R").isSolved(), "R breaks it");
  const q = new Tetris();
  const seq = q.scramble();
  q.move(Twisty.inverse(seq));
  assert(q.isSolved(), `inverse of "${seq}" restores it`);
});

// ── Building a puzzle from a description ───────────────────────────────────

test("the builder reproduces the shelf puzzles exactly", () => {
  // If a description can rebuild the hand-written definitions piece for
  // piece, then those twenty-six puzzles really are configurations rather
  // than kinds — which is the whole claim the builder makes.
  const cases = [
    ["skewb", { turn: "corners", depth: 0 }, new Skewb().pieces.length],
    ["dino", { turn: "corners", depth: 1 / 3 }, new Dino().pieces.length],
    ["compy", { turn: "corners", depth: 1.15 / (1.5 * Math.sqrt(3)) }, new Compy().pieces.length],
    ["master skewb", { turn: "corners", depth: 0.52 / (1.5 * Math.sqrt(3)) }, new MasterSkewb().pieces.length],
    ["helicopter", { turn: "edges", depth: 0.5 }, new Helicopter().pieces.length],
    ["3×3", { turn: "faces", size: [3, 3, 3] }, 26],
    ["megaminx", { shape: "dodecahedron", depth: 0.32 }, new Megaminx().pieces.length],
    ["skewb diamond", { shape: "octahedron" }, new SkewbDiamond().pieces.length],
  ];
  for (const [name, spec, want] of cases)
    assertEqual(new Puzzle(spec).pieces.length, want, `${name} rebuilt from a spec`);
});

test("a built puzzle turns by the order of its axis, and inverts exactly", () => {
  // The angle is not a free parameter: only a full turn divided by the
  // axis's rotational order maps the solid back onto itself.
  for (const [spec, token, order] of [
    [{ turn: "corners", depth: 0 }, "FRU", 3],
    [{ turn: "edges", depth: 0.5 }, "FU", 2],
    [{ turn: "faces", size: [3, 3, 3] }, "R", 4],
  ]) {
    const p = new Puzzle(spec);
    assert(p.isSolved(), "starts solved");
    for (let i = 0; i < order; i++) p.move(token);
    assert(p.isSolved(), `${token}^${order} is the identity`);

    const q = new Puzzle(spec);
    const seq = q.scramble();
    assert(!q.isSolved(), `scrambled by "${seq}"`);
    q.move(Twisty.inverse(seq));
    assert(q.isSolved(), `inverse of "${seq}" restores it`);
  }
});

test("the builder makes puzzles that are not on the shelf", () => {
  // Depths nobody manufactures still have to produce a working mechanism.
  for (const depth of [0.15, 0.55, 0.65, 0.8]) {
    const p = new Puzzle({ turn: "corners", depth });
    assert(p.pieces.length > 0, `corners at ${depth} builds pieces`);
    assert(p.isSolved(), `corners at ${depth} starts solved`);
    const seq = p.scramble();
    p.move(Twisty.inverse(seq));
    assert(p.isSolved(), `corners at ${depth}: inverse of "${seq}"`);
    assert(new Puzzle({ turn: "corners", depth }).toSVG().startsWith("<svg"), "renders");
  }
});

test("the builder refuses an axis family a cube does not have", () => {
  let threw = false;
  try {
    buildPuzzle({ turn: "diagonals" });
  } catch {
    threw = true;
  }
  assert(threw, "an unknown axis family is an error, not a silent empty puzzle");
});

// ── Cuboids that change shape ──────────────────────────────────────────────

test("a cuboid refuses the misshaping turn by default", () => {
  let threw = false;
  try {
    new Domino().move("R");
  } catch {
    threw = true;
  }
  assert(threw, "R on a 3×2×3 is refused unless asked for");
  assert(new Domino().move("R2").isSolved() === false, "R2 is always legal");
});

test("shapeShift turns the same cuboid into the kind that deforms", () => {
  // Both are real puzzles: a Domino's mechanism cannot make the move, while
  // a 3×3×5 is sold precisely because it can. The engine already handled the
  // deformed state — only the parser stood in the way.
  for (const size of [[3, 2, 3], [3, 3, 5], [2, 3, 4]]) {
    const p = new Cuboid({ size, shapeShift: true });
    p.move("R");
    assert(!p.isSolved(), `${size.join("×")} deforms on R`);
    assert(p.toSVG().startsWith("<svg"), `${size.join("×")} still renders deformed`);

    const q = new Cuboid({ size, shapeShift: true });
    q.move("R");
    q.move("R'");
    assert(q.isSolved(), `${size.join("×")}: R then R' comes back`);

    const r = new Cuboid({ size, shapeShift: true });
    for (let i = 0; i < 4; i++) r.move("R");
    assert(r.isSolved(), `${size.join("×")}: R⁴ is the identity`);

    const t = new Cuboid({ size, shapeShift: true });
    const seq = t.scramble();
    t.move(Twisty.inverse(seq));
    assert(t.isSolved(), `${size.join("×")}: inverse of "${seq}"`);
  }
});

test("the two policies are separate puzzles, cached apart", () => {
  const strict = new Cuboid({ size: [3, 2, 3] });
  const shifty = new Cuboid({ size: [3, 2, 3], shapeShift: true });
  assert(strict.def !== shifty.def, "one definition must not be reused for the other");
  let threw = false;
  try {
    strict.move("R");
  } catch {
    threw = true;
  }
  assert(threw, "the strict one is still strict after the other was built");
});

test("a fixed-size puzzle says so instead of ignoring the option", () => {
  // Passing size used to do nothing at all: you asked for a 5×5 Void and got
  // a 3×3 without a word, which is worse than an error because the result
  // looks plausible.
  for (const [name, C] of [["Void", Void], ["Mirror", Mirror], ["Tetris", Tetris],
                           ["Fisher", Fisher], ["Skewb", Skewb], ["Megaminx", Megaminx]]) {
    let threw = false;
    try {
      new C({ size: [5, 5, 5] });
    } catch {
      threw = true;
    }
    assert(threw, `${name} must refuse a size it cannot honour`);
  }
  // and the ones that do take a size still do
  assertEqual(new Cuboid({ size: [5, 5, 5] }).pieces.length, 98, "5×5 cuboid");
});

test("paint reaches every granularity, down to one sticker", () => {
  const size = [3, 3, 3];
  // a whole named pattern
  assertEqual(new Set(new Cuboid({ size, paint: tetrisPaint }).getTints().filter(Boolean)).size, 7,
    "the Tetris layout carries its seven colours onto a plain 3×3");
  // one face
  assertEqual(
    new Cuboid({ size, paint: ({ letter }) => (letter === "U" ? "#c00" : undefined) })
      .getTints().filter((t) => t === "#c00").length,
    9, "one face");
  // one sticker, addressed the way getState() addresses it
  assertEqual(
    new Cube({ paint: ({ face, row, col }) => (face === "U" && row === 1 && col === 1 ? "#c00" : undefined) })
      .getTints().filter((t) => t === "#c00").length,
    1, "the centre of U, and nothing else");
  // one row
  assertEqual(
    new Cube({ paint: ({ face, row }) => (face === "F" && row === 0 ? "#c00" : undefined) })
      .getTints().filter((t) => t === "#c00").length,
    3, "the top row of F");
});

test("paint takes a hand-written map as well as a callback", () => {
  // the by-hand form: face letter → colours in the same reading order the
  // state string uses, with a hole wherever a sticker keeps its face colour
  const m = new Cube({ paint: { U: ["#c00", null, "#00f", null, "#fc0", null, null, null, "#0a0"] } });
  assertEqual(m.getTints().filter(Boolean).length, 4, "only the four named stickers");
  assertEqual(m.getTints().filter((t) => t === "#c00").length, 1, "the first one");

  // a bare colour paints the whole face
  assertEqual(new Cube({ paint: { U: "#111" } }).getTints().filter((t) => t === "#111").length,
    9, "a face given one colour takes it whole");

  // row/col are withheld where a grid would be a lie: a Skewb face holds five
  const seen = new Set();
  new Skewb({ paint: ({ face, row }) => { seen.add(row); return undefined; } });
  assert(seen.size === 1 && seen.has(undefined), "no row/col on a non-square face");
});

test("Cube is the piece-based 3×3, and a paint turns it into any pattern", () => {
  assertEqual(new Cube().dims.join("×"), "3×3×3", "Cube defaults to a 3×3");
  assertEqual(new Cube({ size: 4 }).dims.join("×"), "4×4×4", "and takes a plain number");

  // the whole point: the Tetris cube IS a plain 3×3 wearing a paint, so the
  // two must be indistinguishable down to the markup
  assertEqual(
    new Cube({ paint: tetrisPaint }).toSVG(),
    new Tetris().toSVG(),
    "Cube + tetrisPaint renders identically to the Tetris class",
  );

  // options that cannot work must say so rather than be swallowed
  for (const [label, make] of [
    ["Erno has no pieces to paint", () => new Erno({ paint: tetrisPaint })],
    ["Cube takes a number, not a triple", () => new Cube({ size: [3, 3, 3] })],
  ]) {
    let threw = false;
    try {
      make();
    } catch {
      threw = true;
    }
    assert(threw, label);
  }
});

// ── Subtraction ────────────────────────────────────────────────────────────

test("remove: 'centers' rebuilds the Void from an ordinary cube", () => {
  // The Void is a 3×3 with its face centres taken out, so subtraction on a
  // plain cube must give it back exactly — markup included.
  const v = new Cube({ remove: "centers" });
  assertEqual(v.pieces.length, new Void().pieces.length, "same pieces");
  assertEqual(v.getState().length, new Void().getState().length, "same facelets");
  assertEqual(v.toSVG(), new Void().toSVG(), "same markup");
});

test("subtraction leaves a working puzzle, on any mechanism", () => {
  for (const [label, make] of [
    ["cube", () => new Cube({ remove: "centers" })],
    ["5×5", () => new Cube({ size: 5, remove: "centers" })],
    ["cuboid", () => new Cuboid({ size: [3, 2, 3], remove: "centers" })],
    ["megaminx", () => new Megaminx({ remove: "centers" })],
    ["skewb", () => new Skewb({ remove: "centers" })],
    ["a whole layer", () => new Cube({ remove: ({ slot }) => Math.abs(slot[1]) < 1e-6 })],
    ["one corner", () => new Cube({ remove: ({ slot }) => slot.every((v) => v > 0) })],
    ["a box region", () => new Cube({ remove: { box: [[0, 0, 0], [2, 2, 2]] } })],
  ]) {
    const p = make();
    assert(p.pieces.length > 0, `${label} keeps pieces`);
    assert(p.isSolved(), `${label} starts solved`);
    assert(p.toSVG().includes('data-part="core"'), `${label} shows the walls behind the hole`);
    const q = make();
    const seq = q.scramble();
    q.move(Twisty.inverse(seq));
    assert(q.isSolved(), `${label}: inverse of "${seq}"`);
  }
});

test("remove refuses a shape it does not understand", () => {
  let threw = false;
  try {
    new Cube({ remove: "everything" });
  } catch {
    threw = true;
  }
  assert(threw, "an unknown region is an error, not a silently whole cube");
});

// ── Fusion ──────────────────────────────────────────────────────────────────

test("fusion welds two cubes into one body, seam and all", () => {
  const s = new Siamese();
  // 26 + 26 cubies, less the 3 they share, less the one of those three that
  // ends up buried inside the union with no face left to show
  assertEqual(s.pieces.length, 48, "pieces");
  assert(s.isSolved(), "starts solved");
  assert(!s.getState().includes("?"), "every sticker lands on the facelet grid");
  // the weld is not skin: two separate cubes would carry 108 stickers
  assert(s.getState().length < 108, `${s.getState().length} stickers, fewer than two loose cubes`);
});

test("the Siamese refuses exactly the turns its mechanism cannot make", () => {
  // The shared bar runs along z at the +x +y corner of cube A. Every turn
  // that would drag it away from cube B is impossible, which leaves each
  // cube the two faces furthest from the weld — and nothing in the engine
  // says so anywhere: it falls out of the layer having to come back to
  // itself.
  const s = new Siamese();
  assertEqual(
    s.legalMoves().filter((t) => !/['2]/.test(t)).join(" "),
    "AD AL BU BR",
    "free faces",
  );
  let threw = false;
  try {
    s.move("AF");
  } catch {
    threw = true;
  }
  assert(threw, "a blocked turn is an error, not a silent tear");
  assert(s.isSolved(), "and it left the puzzle where it was");
});

test("a fused puzzle turns, scrambles and inverts like any other", () => {
  for (const [label, make] of [
    ["1×1×3", () => new Siamese()],
    ["2×1×3", () => new Siamese({ offset: [1, 2, 0] })],
    ["2×2×3", () => new Siamese({ offset: [1, 1, 0] })],
    ["2×2 on a 3×3", () =>
      new Fused({
        bodies: [
          { size: [3, 3, 3], at: [0, 0, 0] },
          { size: [2, 2, 2], at: [1.5, 1.5, 0.5] },
        ],
      })],
    ["three in a row", () =>
      new Fused({
        bodies: [
          { size: [3, 3, 3], at: [0, 0, 0] },
          { size: [3, 3, 3], at: [2, 2, 0] },
          { size: [3, 3, 3], at: [4, 4, 0] },
        ],
      })],
  ]) {
    const p = make();
    assert(p.isSolved(), `${label} starts solved`);
    assert(p.legalMoves().length > 0, `${label} has somewhere to go`);
    assert(p.toSVG().startsWith("<svg"), `${label} renders`);
    const seq = p.scramble(12);
    assert(!p.isSolved(), `${label} scrambles to something`);
    p.move(Twisty.inverse(seq));
    assert(p.isSolved(), `${label}: inverse of "${seq}"`);
  }
});

test("a chain of three keeps only the turns its symmetry allows", () => {
  // A at (0,0), B at (2,2), C at (4,4): a staircase with a half-turn
  // symmetry about B. The outer cubes keep the two faces facing away from
  // the chain. The middle one is gripped at both ends and keeps no quarter
  // turn at all — but its front and back slabs span the whole staircase,
  // and a half turn about B swaps A with C and maps that slab onto itself,
  // so those two survive. Nothing here was reasoned out in code: the layer
  // test found the symmetry on its own.
  const make = () =>
    new Fused({
      bodies: [
        { size: [3, 3, 3], at: [0, 0, 0] },
        { size: [3, 3, 3], at: [2, 2, 0] },
        { size: [3, 3, 3], at: [4, 4, 0] },
      ],
    });
  const p = make();
  assertEqual(p.legalMoves().filter((t) => t[0] === "B").join(" "), "BF2 BB2", "B");
  assert(
    !p.legalMoves().some((t) => t[0] === "B" && !t.endsWith("2")),
    "B has no quarter turn left",
  );
  const q = make();
  q.move("BF2");
  assert(!q.isSolved(), "and BF2 is a real move, not a no-op");
  q.move("BF2");
  assert(q.isSolved(), "twice over, it is the identity");
});

test("blocking derives the cuboid policy nobody has to write down", () => {
  // A Domino refuses its quarter turns because a 3×1×3 layer spun about x
  // comes back 3×3×1. That rule lives in makeBoxParser as a hand-written
  // policy; switch on `blocking` over a cuboid that is allowed to deform
  // and the same law reproduces it, size for size.
  for (const size of [[3, 2, 3], [3, 3, 2], [5, 3, 3], [3, 3, 3], [4, 4, 4]]) {
    const byLaw = new Cuboid({ size, shapeShift: true, blocking: true }).legalMoves();
    const byPolicy = new Cuboid({ size }).legalMoves();
    assertEqual(byLaw.join(" "), byPolicy.join(" "), `${size.join("×")}`);
  }
});

test("blocking takes nothing away from a puzzle that is not bandaged", () => {
  for (const [label, make] of [
    ["3×3", () => new Cube({ blocking: true })],
    ["5×5", () => new Cube({ size: 5, blocking: true })],
    ["Skewb", () => new Skewb({ blocking: true })],
    ["Megaminx", () => new Megaminx({ blocking: true })],
  ]) {
    const p = make();
    const vocab = p.def.tokens || Object.keys(p.def.moves || {});
    assertEqual(p.legalMoves().length, vocab.length, `${label} keeps every move`);
    const seq = p.scramble();
    p.move(Twisty.inverse(seq));
    assert(p.isSolved(), `${label} still inverts`);
  }
});

test("fused bodies have to line up cubie to cubie", () => {
  let threw = false;
  try {
    new Fused({
      bodies: [
        { size: [3, 3, 3], at: [0, 0, 0] },
        { size: [3, 3, 3], at: [1.4, 0, 0] },
      ],
    });
  } catch {
    threw = true;
  }
  assert(threw, "a body off the shared lattice is an error, not a sliced neighbour");
});

// ── Deformation ─────────────────────────────────────────────────────────────

test("the Squished is the Mirror's mechanism wearing colours", () => {
  // Its layers are of different thickness — the cuts sit off centre — which
  // is exactly the Mirror cube. What separates them is the paint: silver and
  // you solve by shape, six colours and you solve by colour. Same finding as
  // Tetris, one more time.
  const p = new Squished();
  assertEqual(p.pieces.length, new Mirror().pieces.length, "same pieces as a Mirror");
  assertEqual(p.getState().length, 54, "and a 3×3's facelets");
  assert(p.isSolved(), "starts solved");
  const seq = "R U R' U' F2 D L'";
  assertEqual(
    new Squished().move(seq).getState(),
    new Cube().move(seq).getState(),
    "isomorphic to a plain 3×3, facelet for facelet",
  );
  const s2 = p.scramble();
  p.move(Twisty.inverse(s2));
  assert(p.isSolved(), `inverse of "${s2}"`);
});

test("the Squished shifts shape, which is the point of it", () => {
  // A thin layer landing where a thick one was cannot leave the outline
  // alone. If it did not shift, the uneven cuts would not be doing anything.
  const bounds = (svg) => {
    let x0 = 1e9, x1 = -1e9;
    for (const m of svg.matchAll(/points="([^"]*)"/g))
      for (const q of m[1].trim().split(" ")) {
        const x = +q.split(",")[0];
        x0 = Math.min(x0, x);
        x1 = Math.max(x1, x);
      }
    return x1 - x0;
  };
  const solved = new Squished();
  const turned = new Squished().move("R U'");
  assert(
    Math.abs(bounds(solved.toSVG()) - bounds(turned.toSVG())) > 1,
    "the outline changes when it turns",
  );
});

test("a Squished refuses a cut it cannot make", () => {
  let threw = false;
  try {
    new Squished({ offset: 0.6 });
  } catch {
    threw = true;
  }
  assert(threw, "an offset past half a cubie is an error, not a broken puzzle");
});

test("a deformation is a way of looking, so it composes with everything", () => {
  for (const [label, make] of [
    ["cube", () => new Cube({ deform: squash(0.6) })],
    ["5×5", () => new Cube({ size: 5, deform: squash(0.55) })],
    ["megaminx", () => new Megaminx({ deform: squash(0.6) })],
    ["siamese", () => new Siamese({ deform: squash(0.6) })],
    ["stretched", () => new Cube({ deform: squash(1.6) })],
    ["with a paint", () => new Cube({ paint: tetrisPaint, deform: squash(0.6) })],
    ["with a decal", () => new Cube({ decal: dicePips, deform: squash(0.6) })],
  ]) {
    const p = make();
    assert(p.toSVG().startsWith("<svg"), `${label} renders`);
    assert(p.isSolved(), `${label} starts solved`);
  }
});

test("a deformation changes the picture and nothing else", () => {
  const plain = new Cube({ camera: { type: "orthographic", angle: 20, pitch: 55 } });
  const bent = new Cube({
    camera: { type: "orthographic", angle: 20, pitch: 55 },
    deform: squash(0.6),
  });
  assert(plain.toSVG() !== bent.toSVG(), "it is visible");
  assertEqual(plain.getState(), bent.getState(), "and the state is untouched");
});

test("a stretch is given room rather than clipped", () => {
  // The frame is sized on the undeformed points, so a map that stretches
  // would push the puzzle out of it.
  const svg = new Cube({ deform: squash(1.8) }).toSVG({ fitSphere: true });
  const vb = svg.match(/viewBox="([^"]*)"/)[1].split(" ").map(Number);
  let over = 0;
  for (const m of svg.matchAll(/points="([^"]*)"/g))
    for (const q of m[1].trim().split(" ")) {
      const [x, y] = q.split(",").map(Number);
      over = Math.max(over, vb[0] - x, x - (vb[0] + vb[2]), vb[1] - y, y - (vb[1] + vb[3]));
    }
  assert(over <= 0.01, `nothing leaves the frame (worst ${over.toFixed(2)}px)`);
});

// ── Decals ──────────────────────────────────────────────────────────────────

test("a decal is printed on the cubie, not painted on the position", () => {
  // The distinction is the whole point. Deciding a mark at draw time nails it
  // to a place on the face, so a scramble would shuffle the colours and leave
  // the marks sitting still. Mark exactly one sticker and follow it.
  const one = { decal: ({ face, index }) => (face === "U" && index === 0 ? "<circle/>" : null) };
  const p = new Cube(one);
  assertEqual((p.toSVG().match(/data-part="decal"/g) || []).length, 1, "one mark");
  // U0 is the UBL corner; y' brings it round to a face that is still in view,
  // and the mark has to come with it
  p.move("y'");
  assertEqual(
    (p.toSVG().match(/data-part="decal"/g) || []).length,
    1,
    "the mark travelled with its cubie",
  );
});

test("marks on one face all read the same way up", () => {
  // Each cubie's polygon is wound by the slicing, not by the reading order,
  // so taking the transform from the corner order gives four different
  // orientations on one face. The basis comes from the face's own reading
  // directions instead; on a solved face every mark must therefore share one
  // orientation.
  const p = new Cube({ decal: () => "<circle/>" });
  const svg = p.toSVG();
  const byFace = {};
  for (const m of svg.matchAll(
    /data-face="([A-Z])"[^>]*\/>\s*<g transform="matrix\(([^)]*)\)"/g,
  )) {
    const [a, b] = m[2].trim().split(/\s+/).map(Number);
    (byFace[m[1]] ||= []).push(`${Math.round(a)},${Math.round(b)}`);
  }
  const faces = Object.keys(byFace);
  assert(faces.length >= 3, `found ${faces.length} faces`);
  for (const f of faces)
    assertEqual(new Set(byFace[f]).size, 1, `face ${f} has one orientation`);
});

test("every cubie of the dice cube is a die, and opposites sum to seven", () => {
  // The real puzzle prints a whole die on EVERY sticker, so a solved face is
  // nine identical dice — not one die spread across nine stickers, which is
  // the tidier version and is not what the thing looks like.
  const pips = {};
  new Cube({
    decal: (ctx) => {
      const mark = dicePips(ctx);
      if (!mark) return mark;
      const n = (mark.match(/<circle/g) || []).length;
      (pips[ctx.face] ||= new Set()).add(n);
      return mark;
    },
  });
  for (const f of ["U", "R", "F", "D", "L", "B"])
    assertEqual(pips[f].size, 1, `every sticker of ${f} shows the same die`);
  const n = (f) => [...pips[f]][0];
  for (const f of ["U", "R", "F", "D", "L", "B"])
    assert(n(f) >= 1 && n(f) <= 6, `${f} is a real die face (${n(f)})`);
  for (const [a, b] of [["U", "D"], ["R", "L"], ["F", "B"]])
    assertEqual(n(a) + n(b), 7, `${a}+${b}`);
  assert(new Cube(DICE_CUBE).toSVG().includes('data-part="decal"'), "and it renders");
});

test("the printings carry their own colour, because that is what they are", () => {
  for (const [label, make, ink] of [
    ["dice", () => new Cube(DICE_CUBE), "#f4efe7"],
    ["sudoku", () => new Cube(SUDOKU_CUBE), "#17110c"],
    ["domino", () => new Domino(DOMINO_PRINT), "#17110c"],
  ]) {
    const svg = make().toSVG();
    assert(svg.includes('data-part="decal"'), `${label} prints`);
    assert(svg.includes(ink), `${label} marks read against their own ground`);
  }
});

test("the sudokube reads one to nine on every face", () => {
  const digits = {};
  new Cube({
    decal: (ctx) => {
      const mark = sudokuDigits(ctx);
      if (mark) (digits[ctx.face] ||= []).push(mark.replace(/.*>(\d+)<.*/, "$1"));
      return mark;
    },
  });
  for (const f of ["U", "R", "F", "D", "L", "B"])
    assertEqual(digits[f].join(""), "123456789", `face ${f}`);
});

test("the Domino wears its spots, and only where a face is square", () => {
  // Rubik's 1978 puzzle prints one to nine on its two 3×3 faces; the 3×2
  // sides have no square to lay a pip grid on and stay bare.
  const seen = {};
  new Domino({
    decal: (ctx) => {
      const mark = dominoPips(ctx);
      seen[ctx.face] = (seen[ctx.face] || 0) + (mark ? 1 : 0);
      return mark;
    },
  });
  assertEqual(seen.U, 9, "U carries nine");
  assertEqual(seen.D, 9, "D carries nine");
  for (const f of ["R", "L", "F", "B"]) assertEqual(seen[f], 0, `${f} stays bare`);
});

test("a decal skips a sticker it cannot sit on", () => {
  // A Skewb's faces are triangles and squares, a Megaminx's are kites: there
  // is no unit square to map, so those are left bare rather than smeared.
  const skewb = new Skewb({ decal: () => "<circle/>" });
  const svg = skewb.toSVG();
  const marks = (svg.match(/data-part="decal"/g) || []).length;
  const stickers = (svg.match(/data-part="sticker"/g) || []).length;
  assert(marks < stickers, `${marks} marks on ${stickers} stickers`);
  assert(svg.startsWith("<svg"), "and it still renders");
});

test("decals compose with paint, subtraction and welding", () => {
  for (const [label, make] of [
    ["paint", () => new Cube({ paint: tetrisPaint, decal: sudokuDigits })],
    ["subtraction", () => new Cube({ remove: "centers", decal: dicePips })],
    ["welding", () => new Siamese({ decal: dicePips })],
    ["bandaging", () =>
      new Cube({
        bandage: ({ slot }) => (slot.every((v) => v >= 0) ? "b" : null),
        decal: dicePips,
      })],
  ]) {
    const p = make();
    assert(p.toSVG().startsWith("<svg"), `${label} renders`);
    const seq = p.scramble(8);
    p.move(Twisty.inverse(seq));
    assert(p.isSolved(), `${label}: inverse of "${seq}"`);
  }
});

// ── Bandaging ───────────────────────────────────────────────────────────────

test("bandaging glues cubies, and the glue is what blocks the turns", () => {
  // The Fused Cube: a 2×2×2 block set into a 3×3. The block reaches the
  // middle layer on all three axes, so U, R and F all try to take part of
  // it and cannot — leaving the three faces furthest from it. That is the
  // real puzzle, and again nothing here lists the blocked moves.
  const block = { bandage: ({ slot }) => (slot.every((v) => v >= 0) ? "block" : null) };
  const p = new Cube(block);
  assertEqual(p.pieces.length, 20, "seven cubies became one");
  assertEqual(
    p.legalMoves().filter((t) => !/['2]/.test(t)).join(" "),
    "D L B",
    "free faces",
  );
  assert(p.isSolved(), "starts solved");
  assert(!p.getState().includes("?"), "a glued sticker still knows its own slot");
  const q = new Cube(block);
  const seq = q.scramble(15);
  q.move(Twisty.inverse(seq));
  assert(q.isSolved(), `inverse of "${seq}"`);
});

test("bandaging takes a list of slots as readily as a rule", () => {
  // Glue the U centre to the UF edge: the pair straddles the F layer, so F
  // is gone and nothing else is.
  const p = new Cube({ bandage: [[[0, 1, 1], [0, 1, 0]]] });
  assertEqual(p.pieces.length, 25, "two cubies became one");
  assertEqual(
    p.legalMoves().filter((t) => !/['2]/.test(t)).join(" "),
    "U R D L B",
    "F is the only casualty",
  );
});

test("a bandaged block wears one sticker per face, not a grid", () => {
  // Grouped stickers are what make the glue visible. It does not remove any
  // tiles or change how much colour is on show — each facet keeps its area
  // and simply moves in until it meets its neighbour, so the block reads as
  // one piece. Measure exactly that: corners shared between tiles.
  const corners = (svg) => {
    const seen = new Map();
    for (const m of svg.matchAll(/<polygon points="([^"]*)"[^>]*data-part="sticker"/g))
      for (const p of new Set(m[1].trim().split(" ")))
        seen.set(p, (seen.get(p) || 0) + 1);
    return [...seen.values()].filter((n) => n > 1).length;
  };
  const opt = { bandage: ({ slot }) => (slot.every((v) => v >= 0) ? "b" : null) };
  assertEqual(corners(new Cube().toSVG()), 0, "a plain cube shares none");
  assertEqual(corners(new Cube(opt).toSVG()), 0, "nor does a bandaged one left loose");
  assertEqual(corners(new Cube({ stickerGroup: true }).toSVG()), 0, "nor grouping alone");
  assert(
    corners(new Cube({ ...opt, stickerGroup: true }).toSVG()) > 0,
    "but a grouped bandaged block does",
  );
});

test("bandage refuses a shape it does not understand", () => {
  for (const bad of ["corners", [[[0, 1, 1]]], 7]) {
    let threw = false;
    try {
      new Cube({ bandage: bad });
    } catch {
      threw = true;
    }
    assert(threw, `${JSON.stringify(bad)} is an error, not a silently plain cube`);
  }
});

test("an animated turn lands exactly where the move leaves it", () => {
  // The weld forced every piece's placement to carry a translation as well as a
  // rotation, because each body turns about its own centre. If that
  // transport were wrong the animation would drift away from the state.
  const pointsOf = (svg) =>
    svg
      .match(/points="[^"]*"/g)
      .map((s) => s.replace(/[\d.]+/g, (m) => Math.round(+m)))
      .sort()
      .join(";");
  for (const [label, make, mv] of [
    ["3×3", () => new Cube(), "U"],
    ["Skewb", () => new Skewb(), "R"],
    ["Siamese", () => new Siamese(), "BU"],
    ["Siamese half", () => new Siamese(), "AL2"],
  ]) {
    const a = make();
    a.move(mv);
    const b = make();
    assertEqual(
      pointsOf(a.toSVG({ fitSphere: true })),
      pointsOf(b.toSVG({ fitSphere: true, turn: { move: mv, progress: 1 } })),
      `${label} animation endpoint`,
    );
  }
});

// ── Summary ─────────────────────────────────────────────────────────────────

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
