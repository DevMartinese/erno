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

  // while a paint that distinguishes pieces behaves like a real puzzle
  const striped = new Erno({ paint: ({ slot }) => (slot[1] > 0 ? "#cc2823" : "#00489f") });
  assert(striped.isSolved(), "starts solved");
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

// ── Summary ─────────────────────────────────────────────────────────────────

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
