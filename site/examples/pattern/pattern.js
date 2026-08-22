/* ─────────────────────────────────────────────────────────────────────────
   Pattern: an example of erno driving a game, not part of the library.

   Two halves of one idea. In WRITE you give a function of a cubie's
   position and get back a cube: that is the whole of the puzzle's paint,
   the same shape of thing Replicube asks you for. In SOLVE that cube is
   scrambled and you have to bring the pattern back.

   The join between them is what makes it a game rather than two demos. The
   target is the cube your function produced, at rest, so it is reachable by
   construction: whatever sequence scrambled it, its inverse restores it.
   Nothing here needs a solver, and nothing here can ask for a pattern the
   mechanism cannot reach.
   ───────────────────────────────────────────────────────────────────── */

import {
  Cube, Cuboid, Void, Siamese, Fused,
  SCHEMES, Twisty, expand, parse, isAlgebra,
} from "../../../src/erno.js";
import { enhanceRange } from "../../controls.js";

// ── What a colour is called ─────────────────────────────────────────────────
//
// Two vocabularies, and the first one is the cube's.
//
// A cube already names six colours, and it does not name them red and blue:
// it names them U, R, F, D, L and B, which is the same alphabet its moves
// are written in. So `return y > 0 ? U : D` reads like a cube, and
// `return y > 0 ? 7 : 3` reads like an index into a list you cannot see.
// Both work; the first is the one to reach for.
//
// It is worth being plain about where the notation stops. Cubers' notation
// says how to TURN a cube, and there is none for how to PAINT one, because
// nobody needed one until a game asked. Solve speaks the real thing exactly.
// Write borrows the only part of it that is about colour, which is the face
// letters, and is otherwise ordinary JavaScript, on purpose.
const FACES = SCHEMES.classic;

// And a wider palette for the pictures a cube's own six cannot make: ink and
// paper, and the site's accents.
const PALETTE = [
  "#17110c", // 0 ink
  "#cc2823", // 1 red
  "#00489f", // 2 blue
  "#f6ba00", // 3 yellow
  "#f4efe7", // 4 paper
  "#009b48", // 5 green
  "#ff5800", // 6 orange
  "#ffffff", // 7 white
];

// ── The puzzles you can point it at ─────────────────────────────────────────
//
// Cubes and cuboids, and cubes stuck together. The game is a function of a
// cubie's PLACE on a lattice, so it wants a lattice: on a Megaminx there is
// no x, y, z a writer could reason about, and the same code that reads well
// on a cube would be guesswork there.
//
// The welded pair earns its slot for the opposite reason. A Siamese blocks:
// most of its turns are not available most of the time, and the page has
// been claiming since it was written that it asks the puzzle rather than
// assuming. This is where that claim is worth something.
// The composed one is not a sixth puzzle beside these. It is the answer to
// "what happens if I add another body", which is a question the dropdown
// could not ask: one body is a cube and turns freely, two are welded and
// most of their turns stop existing, three leave almost nothing. You do not
// read that, you watch it happen and the code underneath rewrites itself
// from `new Cube` to `new Fused`.
function composed(options) {
  const bodies = game.bodies;
  if (bodies.length === 1) {
    const [a, b, c] = bodies[0].size;
    return a === b && b === c
      ? new Cube({ ...options, size: a })
      : new Cuboid({ ...options, size: [a, b, c] });
  }
  return new Fused({ ...options, bodies });
}

const PUZZLES = {
  compose: { label: "Compose", sized: false, make: (o) => composed(o) },
  cube: { label: "Cube", sized: true, make: (o, n) => new Cube({ ...o, size: n }) },
  cuboid: {
    label: "Cuboid",
    sized: true,
    // The slider drives the odd axis, so the family is 3×3×2 up to 3×3×6 and
    // a quarter turn of the long one is refused rather than offered.
    make: (o, n) => new Cuboid({ ...o, size: [3, 3, n] }),
  },
  void: { label: "Void", sized: false, make: (o) => new Void(o) },
  siamese: { label: "Siamese", sized: false, make: (o) => new Siamese(o) },
  fused: {
    label: "Fused",
    sized: false,
    make: (o) =>
      new Fused({
        ...o,
        bodies: [
          { size: [3, 3, 3], at: [0, 0, 0] },
          { size: [2, 2, 2], at: [1.5, 1.5, 0.5] },
        ],
      }),
  },
};

// ── Challenges ──────────────────────────────────────────────────────────────
//
// The half this page was missing. Writing your own target and then reaching
// it is a sandbox: you cannot lose. A challenge hands you the picture and
// keeps the function to itself, and scores you on how few characters you
// needed, which is the game Replicube is actually playing, and the reason
// insight beats brute force there. `par` is the length of the solution this
// page knows; shorter than par is a real win over the author.
const CHALLENGES = [
  { name: "Sky and ground", kind: "cube", size: 3, solution: "return y > 0 ? B : F" },
  { name: "Quadrants", kind: "cube", size: 3, solution: "return (x > 0) == (z > 0) ? L : B" },
  { name: "Cage", kind: "cube", size: 3, solution: "return abs(x) > 0.9 && abs(z) > 0.9 ? 0 : D" },
  { name: "Onion", kind: "cube", size: 5, solution: "return round(hypot(x, y, z)) % 2 ? R : U" },
  { name: "Barber pole", kind: "cube", size: 4, solution: "return (x + y) % 2 ? R : U" },
  { name: "Long caps", kind: "cuboid", size: 5, solution: "return abs(z) > 1.5 ? D : U" },
  // The two that need the sticker: neither is a function of the cubie.
  { name: "Almost solved", kind: "cube", size: 3, solution: "return kind == 3 ? 0 : face" },
  { name: "Face checker", kind: "cube", size: 3, solution: "return (row + col) % 2 ? face : 0" },
];

const PRESETS = {
  Solved: "return face",
  Bands: "return y > 0 ? U : D",
  Checker: "return (x + y + z) % 2 ? F : B",
  Corners: "return abs(x) + abs(y) + abs(z) > n - 1.5 ? R : U",
  Ring: "return abs(y) < 0.5 ? L : B",
  Diagonal: "return floor((x + z) / 2) % 2 ? F : U",
  Shell: "return hypot(x, y, z) > n - 1.2 ? R : 0",
};

const $ = (id) => document.getElementById(id);

// ── The function ────────────────────────────────────────────────────────────

// Compiled in the page, against the page's own maths. It is the reader's own
// browser and their own code, so there is nothing here to sandbox; what it
// does need is to fail softly, because a half-typed function is the normal
// state of a text box someone is typing in.
function compile(source, n) {
  const body = `"use strict";
    const {abs, floor, ceil, round, min, max, hypot, sign, sqrt, sin, cos, atan2, PI} = Math;
    const {U, R, F, D, L, B} = FACES;
    ${source}`;
  // The function sees the STICKER, not just the cubie. The engine always
  // painted per facelet - a corner gets three calls - and this page used to
  // throw that away, which made the solved cube itself inexpressible: no
  // function of the cubie alone can give one cubie three colours. The new
  // arguments are appended, so every old link and every old par still
  // evaluates exactly as it did.
  const fn = new Function("x", "y", "z", "n", "face", "row", "col", "kind", "FACES", body);
  fn(0, 0, 0, n, "U", 0, 0, 1, FACES); // fail here rather than once per cubie
  return (x, y, z, m, face, row, col, kind) => fn(x, y, z, m, face, row, col, kind, FACES);
}

// How far the lattice reaches, measured rather than assumed. On a cube it is
// the half width and could have been computed; on a Megaminx the slots are
// wherever the geometry put them, and the only honest way to tell a writer
// what `n` means is to go and look. One throwaway build, cached.
const reach = new Map();
function halfWidth(kind, size) {
  const key =
    kind === "compose"
      ? `compose:${game.bodies.map((b) => `${b.size}@${b.at}`).join("+")}`
      : `${kind}:${size}`;
  if (reach.has(key)) return reach.get(key);
  const probe = PUZZLES[kind].make({}, size);
  let n = 0;
  for (const piece of probe.pieces)
    for (const v of piece.slotPoint) n = Math.max(n, Math.abs(v));
  reach.set(key, n);
  return n;
}

function build(source, kind, size) {
  const n = halfWidth(kind, size);
  game.usesPalette = false;
  const f = compile(source, n);
  const options = {
    paint: ({ slot: [x, y, z], letter, row, col, piece }) => {
      const kind = piece.faces.filter((q) => q.letter).length;
      const v = f(x, y, z, n, letter, row, col, kind);
      // Returning a face letter is returning its colour: `return face` is
      // the solved cube, eleven characters, and was inexpressible before
      // the function could see the sticker.
      if (typeof v === "string") return (v.length === 1 && FACES[v]) || v;
      // Remembered so the generated code can carry the palette only when the
      // function actually reaches for it. An import of something unused is
      // the first sign an example was never run.
      game.usesPalette = true;
      const i = Math.floor(Number(v)) || 0;
      return PALETTE[((i % PALETTE.length) + PALETTE.length) % PALETTE.length];
    },
    stickerInset: 0.1,
  };
  return PUZZLES[kind].make(options, size);
}

// Can this pattern be a puzzle at all? Some cannot, and the reason is worth
// saying out loud: a turn permutes pieces but never changes what KIND of
// piece one is, so a pattern that only ever asks about the kind (parity of
// x+y+z is the classic) is the same however you turn it. It is a perfectly
// good picture and a completely empty game.
function scrambleDepth(puzzle) {
  const target = puzzle.getPattern();
  const home = puzzle.getPosition();
  let worst = 0;
  for (let k = 0; k < 40; k++) {
    const open = puzzle.legalMoves();
    if (!open.length) break;
    puzzle.move(open[Math.floor(Math.random() * open.length)]);
    worst = Math.max(worst, puzzle.distanceTo(target));
  }
  puzzle.setPosition(home);
  return worst;
}

// ── Drawing ─────────────────────────────────────────────────────────────────

// The same highlighter the guide uses, fetched the same way. The page does
// not depend on it: until the import lands the code is plain text, which is
// only a duller shade of correct, so a CDN outage costs colour and nothing
// else.
let highlight = null;
import("https://esm.sh/sugar-high")
  .then((m) => { highlight = m.highlight; renderCode(); })
  .catch(() => { /* offline: plain text stands */ });

const draw = (host, puzzle, turn) => {
  host.innerHTML = puzzle.toSVG({ fitSphere: true, turn, padding: 8 });
};

// One turn, animated. The whole reason a turning layer has to be drawn in the
// right order lives in these few frames.
//
// Unless the reader asked not to be animated, in which case the turn simply
// happens. A puzzle that snaps is still the whole game; a page that ignores
// the request is just a page that did not listen.
const still = window.matchMedia("(prefers-reduced-motion: reduce)");

function animate(host, puzzle, move, done) {
  if (still.matches) {
    // `done` in a finally: it is what clears the busy flag, and a turn that
    // throws used to leave the page holding it, with every button disabled
    // and no way back.
    try {
      puzzle.move(move);
      draw(host, puzzle);
    } finally {
      done();
    }
    return;
  }
  const ms = 190;
  const start = performance.now();
  const step = (now) => {
    const t = Math.min(1, (now - start) / ms);
    // ease out, so the layer arrives rather than stops
    const progress = 1 - (1 - t) * (1 - t);
    draw(host, puzzle, { move, progress });
    if (t < 1) requestAnimationFrame(step);
    else {
      puzzle.move(move);
      draw(host, puzzle);
      done();
    }
  };
  requestAnimationFrame(step);
}

// ── State ───────────────────────────────────────────────────────────────────

const game = {
  source: PRESETS.Bands,
  kind: "cube",
  challenge: null, // index into CHALLENGES, or null for free play
  usesPalette: false, // did the reader's function return a number?
  scramble: "", // the walk that dealt this board, kept so the code can say it
  dealt: "", // a position that arrived whole, from a link, with no walk to tell
  bodies: [{ size: [3, 3, 3], at: [0, 0, 0] }], // for the composed puzzle
  size: 3,
  target: null, // the pattern to reach
  targetPos: null, // and the position that wears it
  puzzle: null,
  worst: 1, // the distance a scramble reaches, so progress has a scale
  busy: false,
};

// ── Write ───────────────────────────────────────────────────────────────────

function refreshWrite() {
  const code = $("write-code");
  renderBodies();
  let puzzle;
  try {
    puzzle = build(code.value, game.kind, game.size);
    code.removeAttribute("data-bad");
  } catch (err) {
    // Two different failures wearing one message before this: a function
    // that will not compile is yours, and bodies that do not line up are
    // the puzzle's. Marking the code box red for the second was pointing at
    // the wrong thing.
    const mine = !/erno:/.test(err.message);
    if (mine) code.setAttribute("data-bad", "");
    else code.removeAttribute("data-bad");
    $("write-status").textContent = err.message;
    $("play-start").disabled = true;
    return;
  }
  game.source = code.value;
  draw($("write-canvas"), puzzle);
  renderChallenge(puzzle);
  renderCode();

  const depth = scrambleDepth(puzzle);
  const stickers = puzzle.getPattern().length;
  const colours = new Set(puzzle.getPattern()).size;
  // Named against offered, because that gap IS the weld: a single cube shows
  // 18 and 18, and the moment a second body is welded on most of them stop
  // being turns at all.
  const names = puzzle.vocabulary().length;
  const offers = puzzle.legalMoves().length;
  const welded =
    offers < names ? ` Names ${names} moves, offers ${offers} from here.` : "";
  $("write-status").textContent =
    `${puzzle.pieces.length} cubies, ${stickers} stickers, ${colours} colours.${welded} ` +
    (depth === 0
      ? "This pattern is the same however you turn it, so there is nothing to solve. It asks only what kind of piece a cubie is, and turning never changes that."
      : `Scrambles to ${depth} stickers out of place.`);
  $("play-start").disabled = depth === 0;
  $("write-depth").textContent = depth === 0 ? "not a puzzle" : "playable";
  $("write-depth").dataset.state = depth === 0 ? "flat" : "ok";

  game.targetPos = puzzle.getPosition();
  game.target = puzzle.getPattern();
  game.worst = Math.max(1, depth);
  draw($("play-target"), puzzle);
  // Scrambled from the start: a solved board is a finished game, and that is
  // not what anyone should be shown first.
  startGame(depth > 0);
}

// ── Challenges ──────────────────────────────────────────────────────────────

const targets = new Map();

// Compared by TINT, not by pattern.
//
// `getPattern` asks which stickers match each other, which is the right
// question for solving a puzzle and the wrong one for hitting a picture: it
// cannot tell blue-over-green from white-over-yellow, so a challenge showing
// one was quietly accepting the other. Found by a bench that asked whether a
// challenge starts unsolved, and was told it was already done.
const shownOn = (puzzle) => puzzle.getTints().join("|");

function targetOf(i) {
  if (!targets.has(i)) {
    const c = CHALLENGES[i];
    targets.set(i, shownOn(build(c.solution, c.kind, c.size)));
  }
  return targets.get(i);
}

/** Show the challenge picture, and say whether the function matches it. */
function renderChallenge(puzzle) {
  const panel = $("goal-panel");
  if (game.challenge === null) {
    panel.dataset.state = "free";
    $("write-kind").disabled = false;
    $("write-size").disabled = false;
    $("goal-status").textContent =
      "Free play: whatever you write becomes the target.";
    $("goal-art").innerHTML = "";
    return;
  }
  const c = CHALLENGES[game.challenge];
  draw($("goal-art"), build(c.solution, c.kind, c.size));
  // A challenge names its own board, so the board is not yours to change
  // while it is up. Leaving it open meant you could select a challenge, type
  // its exact answer, switch the puzzle underneath it and be told "not it
  // yet" forever, with no way to see why. Free play is one option away.
  $("write-kind").disabled = true;
  $("write-size").disabled = true;
  const hit = shownOn(puzzle) === targetOf(game.challenge);
  const mine = game.source.trim().length;
  const par = c.solution.length;
  panel.dataset.state = hit ? "hit" : "miss";
  $("goal-status").textContent = hit
    ? `Matched, in ${mine} characters. Par is ${par}` +
      (mine < par ? ", and you beat it." : mine === par ? ", exactly." : ".")
    : `Not it yet. Par is ${par} characters; you are at ${mine}.`;
}

// ── Solve ───────────────────────────────────────────────────────────────────

function startGame(scramble) {
  game.puzzle = build(game.source, game.kind, game.size);
  game.build = null; // a fresh board is whole; Reset heals a bin left open
  game.scramble = "";
  game.dealt = "";
  locNames.clear();
  if (scramble) {
    // Walk the scramble one move at a time out of what is legal from here.
    // On a plain cube every move always is; the moment this example is
    // pointed at a bandaged or welded puzzle it stops being true, and asking
    // is the only thing that keeps working.
    const walk = [];
    for (let k = 0; k < 18; k++) {
      const open = game.puzzle.legalMoves();
      if (!open.length) break;
      const token = open[Math.floor(Math.random() * open.length)];
      game.puzzle.move(token);
      walk.push(token);
    }
    // Kept, because the generated code claims to hand you the board you are
    // looking at and could not: the scramble is deliberately absent from
    // history, being the board rather than anything the player did, so
    // without this the snippet reproduced a solved cube and called it yours.
    game.scramble = walk.join(" ");
    // A scramble that happens to land on the pattern is not a scramble
    if (game.puzzle.matches(game.target)) return startGame(true);
    // The scramble is the board, not the player's doing, so the move count
    // starts at zero. history is the player's record from here on.
    game.puzzle.history = [];
  }
  renderGame();
}

function renderGame() {
  const p = game.puzzle;
  if (game.build) {
    // The board is in pieces: both canvases show only what is standing,
    // every control that turns or judges waits for the last piece, and
    // Reset stays alive as the healer.
    const veil = {
      fitSphere: true,
      padding: 8,
      pieces: (i) => game.build.placed.has(i),
    };
    $("play-canvas").innerHTML = p.toSVG(veil);
    $("script-canvas").innerHTML = p.toSVG(veil);
    renderMoves();
    for (const id of ["play-start", "play-undo", "play-share"])
      $(id).disabled = true;
    $("play-status").textContent =
      `In pieces: ${game.build.tray.length} in the bin. ` +
      `The turns wait for the last place(); Reset heals it.`;
    $("play-panel").removeAttribute("data-won");
    if ($("seq-input")) renderSequence();
    renderCode();
    return;
  }
  for (const id of ["play-start", "play-undo", "play-share"])
    $(id).disabled = false;
  draw($("play-canvas"), p);
  // The Script plate shows the same board, not a copy: one game object,
  // drawn twice, so the console's result is visible where it is typed.
  draw($("script-canvas"), p);
  renderMoves();
  renderProgress();
  const distance = p.distanceTo(game.target);
  const won = p.matches(game.target);
  // The judge speaks here, because this is where the borrowed-cube tragedy
  // is felt: tamper with the board and no sequence will ever reach the
  // pattern again, and the page says WHICH law was broken instead of
  // letting you turn forever. A welded board has no written laws yet, and
  // the try respects that silence.
  // Only when the picture is NOT reached: this game judges patterns, and a
  // twisted corner under a one-colour-per-cubie paint changes nothing a
  // player can see - all three of its stickers match. Paint `return face`
  // and the same twist ruins the picture, and then this line says why no
  // sequence will ever mend it.
  let verdict = "";
  if (!won) {
    try {
      const law = p.lawful();
      if (!law.lawful) verdict = ` Unsolvable: ${law.breaks[0]}. Reset heals it.`;
    } catch {
      /* a puzzle whose laws are not written; nothing to add */
    }
  }
  $("play-status").textContent = (won
    ? `Pattern reached in ${p.history.length} moves.`
    : `${distance} stickers out of place, ${p.history.length} moves made.`) + verdict;
  if (won) $("play-panel").setAttribute("data-won", "");
  else $("play-panel").removeAttribute("data-won");
  // What a sequence does depends on where the puzzle is standing, which on
  // a puzzle that blocks is not a formality, so the readout follows it.
  if ($("seq-input")) renderSequence();
  renderCode();
}

function renderMoves() {
  const host = $("play-moves");
  const vocabulary = game.puzzle.vocabulary();
  // Rebuilt when the alphabet CHANGES, not when its length does. Keying on
  // the count left a Void wearing a Cube's keypad, since both name eighteen
  // moves, and every button on it was refused.
  if (host.dataset.vocabulary !== vocabulary.join(" ")) {
    host.dataset.vocabulary = vocabulary.join(" ");
    host.innerHTML = "";
    for (const token of vocabulary) {
      const b = document.createElement("button");
      b.textContent = token;
      b.addEventListener("click", () => play(token));
      host.append(b);
    }
  }
  // Ask the puzzle, every time. A move being in the vocabulary is not the
  // same as a move being available, and only the puzzle knows which.
  [...host.children].forEach((b, i) => {
    b.disabled = game.busy || !!game.build || !game.puzzle.canMove(vocabulary[i]);
  });
}

// Progress as the site draws a quantity: a row of cells, not a bar.
function renderProgress() {
  const cells = $("play-cells");
  const total = 24;
  const distance = game.puzzle.distanceTo(game.target);
  const filled = Math.round(total * (1 - Math.min(1, distance / game.worst)));
  if (cells.childElementCount !== total) {
    cells.innerHTML = "";
    for (let i = 0; i < total; i++) cells.append(document.createElement("i"));
  }
  [...cells.children].forEach((cell, i) => {
    if (i < filled) cell.setAttribute("data-on", "");
    else cell.removeAttribute("data-on");
    if (i === filled - 1 && filled < total) cell.setAttribute("data-head", "");
    else cell.removeAttribute("data-head");
  });
}

function play(token) {
  if (game.busy || !game.puzzle.canMove(token)) return;
  game.busy = true;
  renderMoves();
  animate($("play-canvas"), game.puzzle, token, () => {
    game.busy = false;
    renderGame();
  });
}

function undo() {
  const last = game.puzzle.history.pop();
  if (!last) return;
  const history = game.puzzle.history.slice();
  game.puzzle.move(Twisty.inverse(last));
  game.puzzle.history = history;
  renderGame();
}

// ── Stamp: a pattern arrives, your cube is blank ────────────────────────────
//
// The first mode where the target is HANDED to you. Write lets you invent a
// picture; here one arrives - curated, or grown from a seed anyone can
// share - your cube is solid blank, and you recreate the picture sticker
// by sticker. The stickers were always clickable: every polygon the SVG
// draws carries data-face and data-index, put there for styling long
// before a game needed them.
//
// Two views, because a cube has six faces and a picture shows three: the
// top view reads U R F, the belly view reads D L B, and the target and
// your canvas always show the same side, so what you are copying is always
// what you are looking at.
//
// Scored in brushstrokes against the pattern's own minimum - the stickers
// that differ from blank - so painting well is seeing well: every stroke
// beyond the minimum was a stroke taken back.

const BLANK = "#f4efe7";
const stamp = {
  size: 3,
  paint: new Map(), // "F:4" -> colour
  strokes: 0,
  brush: null, // selected colour, null until picked
  view: 0, // 0 = top (U R F), 1 = belly (D L B)
  targetSource: null,
  targetTints: null,
  seed: null,
  curated: -1,
};

// The curated album, easy to hard: each is a hidden function, never shown.
const STAMP_ALBUM = [
  { name: "Half and half", source: "return y > 0 ? R : B" },
  { name: "The cap", source: "return face == 'U' ? F : 0" },
  { name: "Solved", source: "return face" },
  { name: "Corners out", source: "return kind == 3 ? 0 : face" },
  { name: "Checkerboard", source: "return (x + y + z) % 2 ? U : R" },
  { name: "Pinstripes", source: "return (row + col) % 2 ? face : 0" },
  { name: "The wrap", source: "return abs(x) > 0.5 ? L : (y > 0 ? U : D)" },
];

// A seed grows a pattern: templates with drawn parameters, so the same
// seed is the same picture on any machine, and the link can carry it.
function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function grownPattern(seed) {
  const r = mulberry(seed);
  const pick = (list) => list[Math.floor(r() * list.length)];
  const C = () => pick(["U", "R", "F", "D", "L", "B", "0", "7"]);
  const axis = () => pick(["x", "y", "z"]);
  const rules = [
    () => `return ${axis()} > 0 ? ${C()} : ${C()}`,
    () => `return (x + y + z) % 2 ? ${C()} : ${C()}`,
    () => `return abs(${axis()}) > 0.5 ? ${C()} : ${C()}`,
    () => `return (row + col) % 2 ? ${C()} : ${C()}`,
    () => `return kind == 3 ? ${C()} : ${C()}`,
    () => `return face == '${pick(["U", "R", "F", "D", "L", "B"])}' ? ${C()} : ${C()}`,
    () => `return (${axis()} > 0) == (${axis()} > 0) ? ${C()} : ${C()}`,
  ];
  // one rule, or two nested: enough variety to surprise, small enough to see
  const a = pick(rules)();
  if (r() < 0.45) {
    const b = pick(rules)().replace("return ", "");
    return a.replace(/return (.*)$/, (m, tail) => {
      const [cond, rest] = tail.split(" ? ");
      return `return ${cond} ? ${rest.split(" : ")[0]} : (${b})`;
    });
  }
  return a;
}

function stampTargetTints(source) {
  return build(source, "cube", stamp.size).getTints().join("|");
}

function stampCanvas() {
  return new Cube({
    size: stamp.size,
    paint: ({ letter, index }) => stamp.paint.get(`${letter}:${index}`) || BLANK,
    stickerInset: 0.1,
  });
}

const STAMP_VIEWS = [
  { type: "isometric", angle: 30 },
  { type: "orthographic", angle: 210, pitch: -35 },
];

function drawStamp() {
  const cam = STAMP_VIEWS[stamp.view];
  const target = build(stamp.targetSource, "cube", stamp.size);
  target.setCamera(cam);
  $("stamp-target").innerHTML = target.toSVG({ fitSphere: true, padding: 8 });
  const canvas = stampCanvas();
  canvas.setCamera(cam);
  $("stamp-canvas").innerHTML = canvas.toSVG({ fitSphere: true, padding: 8 });

  const mine = canvas.getTints().join("|");
  const want = stamp.targetTints.split("|");
  const have = mine.split("|");
  let right = 0;
  for (let i = 0; i < want.length; i++) if (want[i] === have[i]) right++;
  const total = want.length;
  // the pattern's own minimum: what a perfect painter would spend
  const min = want.filter((t, i) => t !== BLANK).length;
  const done = right === total;
  $("stamp-status").textContent = done
    ? `Pattern stamped: ${stamp.strokes} strokes, the pattern's minimum is ${min}.` +
      (stamp.strokes <= min ? " Not one wasted." : "")
    : `${right} of ${total} stickers right. ${stamp.strokes} strokes; the minimum is ${min}.`;
  $("stamp-panel").dataset.state = done ? "hit" : "miss";
}

function newStamp({ curated, seed } = {}) {
  stamp.paint.clear();
  stamp.strokes = 0;
  if (curated !== undefined && curated >= 0) {
    stamp.curated = curated;
    stamp.seed = null;
    stamp.targetSource = STAMP_ALBUM[curated].source;
  } else {
    stamp.curated = -1;
    stamp.seed = seed ?? Math.floor(Math.random() * 1e9);
    stamp.targetSource = grownPattern(stamp.seed);
    $("stamp-seed").textContent = `seed ${stamp.seed}`;
  }
  if (stamp.curated >= 0) $("stamp-seed").textContent = "";
  stamp.targetTints = stampTargetTints(stamp.targetSource);
  drawStamp();
}

function wireStamp() {
  // the palette: the six face colours, ink, and back to blank
  const palette = $("stamp-palette");
  const swatches = [
    ["U", FACES.U], ["R", FACES.R], ["F", FACES.F],
    ["D", FACES.D], ["L", FACES.L], ["B", FACES.B],
    ["ink", PALETTE[0]], ["blank", BLANK],
  ];
  for (const [label, colour] of swatches) {
    const b = document.createElement("button");
    b.className = "stamp-swatch";
    b.style.setProperty("--swatch", colour);
    b.title = label;
    b.addEventListener("click", () => {
      stamp.brush = colour;
      [...palette.children].forEach((x) => x.removeAttribute("data-on"));
      b.setAttribute("data-on", "");
    });
    palette.append(b);
  }
  palette.children[0].click();

  // paint by click: the polygon under the pointer names its own facelet.
  // The SVG's data-index runs over the WHOLE state string - U is 0 to 8, R
  // is 9 to 17 - while paint's index restarts per face, and the first cut
  // of this handler keyed one against the other: fifty-four clicks, and
  // exactly the nine on U landed, because U is the face where the two
  // numberings happen to agree.
  const faceStart = {};
  {
    let at = 0;
    for (const L of ["U", "R", "F", "D", "L", "B"]) {
      faceStart[L] = at;
      at += stamp.size * stamp.size;
    }
  }
  $("stamp-canvas").addEventListener("click", (e) => {
    const poly = e.target.closest("polygon[data-face]");
    if (!poly || stamp.brush === null) return;
    const face = poly.dataset.face;
    const key = `${face}:${+poly.dataset.index - faceStart[face]}`;
    const now = stamp.paint.get(key) || BLANK;
    if (now === stamp.brush) return; // painting a sticker its own colour is free
    if (stamp.brush === BLANK) stamp.paint.delete(key);
    else stamp.paint.set(key, stamp.brush);
    stamp.strokes++;
    drawStamp();
  });

  $("stamp-flip").addEventListener("click", () => {
    stamp.view = 1 - stamp.view;
    $("stamp-flip").textContent = stamp.view ? "See U R F" : "See D L B";
    drawStamp();
  });
  $("stamp-new").addEventListener("click", () => newStamp({}));
  $("stamp-clear").addEventListener("click", () => {
    stamp.paint.clear();
    stamp.strokes = 0;
    drawStamp();
  });
  const album = $("stamp-album");
  STAMP_ALBUM.forEach((c, i) => {
    const o = document.createElement("option");
    o.value = String(i);
    o.textContent = c.name;
    album.append(o);
  });
  album.addEventListener("input", () => {
    if (album.value !== "") newStamp({ curated: +album.value });
  });

  // a link can carry a seeded pattern
  const saved = new URLSearchParams(location.hash.slice(1));
  if (saved.get("stamp")) newStamp({ seed: +saved.get("stamp") || 1 });
  else newStamp({ curated: 0 });
}

// ── Assemble: the cube piece by piece, under two crowns ─────────────────────
//
// The Replicube move, made mechanical: the pattern arrives, the pieces are
// dealt one at a time, and for each you choose a slot and a spin. Centres
// come pre-placed, because on the real thing they are bolted to the core -
// disassemble a 3×3 and the six centres stay on the spider.
//
// The reason this mode exists is what happens at the end. Matching the
// picture is one crown; the second is lawful(), and it is the crown a
// blind assembler loses eleven times out of twelve: a random reassembly of
// a 3×3 is solvable with probability 1/12, one factor 3 for corner twist,
// one factor 2 for edge flip, one factor 2 for parity. You can build the
// PERFECT PICTURE and an impossible cube, and no other builder game can
// even ask the question.
//
// Everything here is the public API: swapPieces carries the dealt piece to
// its slot, twistCorner and flipEdge are the spin, the pieces option draws
// the half-built cube, and lawful() crowns or convicts.

const asm = {
  puzzle: null,
  targetSource: null,
  placed: new Set(), // piece indices already standing
  tray: [], // piece indices still to deal, corners and edges only
  dealt: null, // the piece in hand
  spins: 0,
  view: 0,
  locOf: null, // piece index -> its current LOCATION name
};

function asmLocNames() {
  // location names, from a resting twin: where each piece of THIS build rests
  const twin = build(asm.targetSource, "cube", 3);
  const names = new Map();
  for (const pc of twin.getPieces())
    names.set(pc.slot.map((v) => Math.round(v * 2)).join(","), twin.nameOf(pc.index));
  return (puzzle, i) => {
    const at = puzzle.getPieces().find((x) => x.index === i);
    return names.get(at.slot.map((v) => Math.round(v * 2)).join(","));
  };
}

function newAssembly({ source } = {}) {
  asm.targetSource = source || stamp.targetSource || STAMP_ALBUM[0].source;
  asm.puzzle = build(asm.targetSource, "cube", 3);
  asm.locOf = asmLocNames();
  asm.placed = new Set();
  asm.tray = [];
  asm.spins = 0;
  const kinds = new Map();
  asm.puzzle.pieces.forEach((_, i) => {
    const k = new Set(asm.puzzle.pieces[i].faces.filter((f) => f.letter).map((f) => f.letter)).size;
    kinds.set(i, k);
    if (k === 1) asm.placed.add(i); // centres ride the spider
    else asm.tray.push(i);
  });
  asm.kinds = kinds;
  // dealt in a shuffled order, like a parts bin
  for (let i = asm.tray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [asm.tray[i], asm.tray[j]] = [asm.tray[j], asm.tray[i]];
  }
  asm.dealt = asm.tray.shift();
  drawAssembly();
}

function openSlotsFor(kind) {
  // the LOCATIONS not yet holding a placed piece, of the right kind
  const standing = new Set(
    [...asm.placed].map((i) => asm.locOf(asm.puzzle, i)),
  );
  return asm.puzzle.pieces
    .map((_, i) => i)
    .filter((i) => asm.kinds.get(i) === kind)
    .map((i) => asm.puzzle.nameOf(i))
    .filter((name) => !standing.has(name));
}

function drawAssembly() {
  const cam = STAMP_VIEWS[asm.view];
  const target = build(asm.targetSource, "cube", 3);
  target.setCamera(cam);
  $("asm-target").innerHTML = target.toSVG({ fitSphere: true, padding: 8 });
  asm.puzzle.setCamera(cam);
  $("asm-canvas").innerHTML = asm.puzzle.toSVG({
    fitSphere: true,
    padding: 8,
    pieces: (i) => asm.placed.has(i),
  });

  const slots = $("asm-slot");
  slots.innerHTML = "";
  const done = asm.dealt === null;
  if (!done) {
    const kind = asm.kinds.get(asm.dealt);
    for (const name of openSlotsFor(kind)) {
      const o = document.createElement("option");
      o.value = name;
      o.textContent = name;
      slots.append(o);
    }
    const tints = asm.puzzle.pieces[asm.dealt].faces
      .filter((f) => f.letter)
      .map((f) => f.tint || FACES[f.letter]);
    $("asm-dealt").innerHTML =
      (kind === 3 ? "a corner: " : "an edge: ") +
      tints.map((t) => `<i class="asm-chip" style="--chip:${t}"></i>`).join("");
    // DOM transparency, in the data-face tradition: the hand names its
    // piece for anything reading the page, without printing a spoiler.
    $("asm-dealt").dataset.home = asm.puzzle.nameOf(asm.dealt);
    $("asm-status").textContent = `${asm.placed.size - 6} of 20 placed.`;
  } else {
    $("asm-dealt").textContent = "all placed";
    delete $("asm-dealt").dataset.home;
    // The verdicts. Both crowns or neither, and each in its own words.
    const picture = asm.puzzle.matches(build(asm.targetSource, "cube", 3).getPattern());
    const law = asm.puzzle.lawful();
    const crowns = [];
    crowns.push(picture ? "\u{1F3AF} the picture is exact" : "the picture is off");
    crowns.push(
      law.lawful
        ? "\u2696\uFE0F lawful: a solver could reach this"
        : `unlawful: ${law.breaks[0]}`,
    );
    $("asm-status").textContent = crowns.join(" \u00b7 ") +
      (picture && law.lawful ? " \u00b7 both crowns." : "");
  }
  $("asm-place").disabled = done;
  $("asm-spin").disabled = done;
  $("asm-panel").dataset.state = done ? "done" : "building";
}

function wireAssembly() {
  $("asm-place").addEventListener("click", () => {
    if (asm.dealt === null) return;
    const slot = $("asm-slot").value;
    if (!slot) return;
    const from = asm.locOf(asm.puzzle, asm.dealt);
    if (from !== slot) asm.puzzle.swapPieces(from, slot);
    asm.placed.add(asm.dealt);
    asm.lastSlot = slot;
    asm.dealt = asm.tray.length ? asm.tray.shift() : null;
    drawAssembly();
  });
  $("asm-spin").addEventListener("click", () => {
    // spin what you LAST placed, in place, and watch it
    if (!asm.lastSlot) return;
    const standing = [...asm.placed].find((i) => asm.locOf(asm.puzzle, i) === asm.lastSlot);
    if (standing === undefined) return;
    if (asm.kinds.get(standing) === 3) asm.puzzle.twistCorner(asm.lastSlot);
    else asm.puzzle.flipEdge(asm.lastSlot);
    drawAssembly();
  });
  $("asm-flip").addEventListener("click", () => {
    asm.view = 1 - asm.view;
    $("asm-flip").textContent = asm.view ? "See U R F" : "See D L B";
    drawAssembly();
  });
  $("asm-new").addEventListener("click", () => newAssembly({}));
  newAssembly({ source: STAMP_ALBUM[2].source }); // "Solved": the honest first build
}

// ── Composing a puzzle out of bodies ────────────────────────────────────────
//
// One body is a cube and every turn is open. Add a second and the two are
// welded: the class underneath changes from Cube to Fused, most of the turns
// stop existing, and the keypad greys out to show which. Add a third and
// almost nothing is left. None of that is asserted anywhere on this page;
// it is the mechanism, and the point of the control is that you can watch it
// rather than be told.

const clampBody = (b) => ({
  size: b.size.map((v) => Math.max(2, Math.min(5, Math.round(v)))),
  at: b.at.map((v) => Math.round(v * 2) / 2),
});

function renderBodies() {
  const host = $("body-list");
  if (!host) return;
  host.innerHTML = "";
  game.bodies.forEach((body, i) => {
    const row = document.createElement("div");
    row.className = "body-row";
    row.innerHTML = `<span class="body-tag">${String.fromCharCode(65 + i)}</span>`;

    const field = (label, value, onChange, step = 1, min = -6, max = 6) => {
      const wrap = document.createElement("label");
      wrap.className = "body-field";
      wrap.innerHTML = `<span>${label}</span>`;
      const input = document.createElement("input");
      input.type = "number";
      input.value = String(value);
      input.step = String(step);
      input.min = String(min);
      input.max = String(max);
      input.addEventListener("input", () => onChange(parseFloat(input.value)));
      wrap.append(input);
      return wrap;
    };

    for (const ax of [0, 1, 2])
      row.append(
        field("wxyz"[ax + 1] || "", body.size[ax], (v) => {
          game.bodies[i].size[ax] = v;
          game.bodies[i] = clampBody(game.bodies[i]);
          refreshWrite();
        }, 1, 2, 5),
      );
    const at = document.createElement("span");
    at.className = "body-at";
    at.textContent = "at";
    row.append(at);
    for (const ax of [0, 1, 2])
      row.append(
        field("xyz"[ax], body.at[ax], (v) => {
          game.bodies[i].at[ax] = v;
          game.bodies[i] = clampBody(game.bodies[i]);
          refreshWrite();
        }, 0.5),
      );

    if (game.bodies.length > 1) {
      const drop = document.createElement("button");
      drop.className = "body-drop";
      drop.textContent = "remove";
      drop.addEventListener("click", () => {
        game.bodies.splice(i, 1);
        refreshWrite();
      });
      row.append(drop);
    }
    host.append(row);
  });
}

// ── Turning by code ─────────────────────────────────────────────────────────
//
// The third verb. You could paint by function and turn by hand or by
// sentence; this is turning by FUNCTION: a script that reads the cube,
// decides, and calls turn(), against the same board and target the keypad
// plays. The nouns are the cube's own - turn takes the whole algebra,
// at() answers in cubers' letters - and the control flow is JavaScript's,
// because inventing loops would be inventing a worse JavaScript.
//
// Scored twice, because they are different virtues: the fewest characters
// is insight about the WRITING, the fewest moves is insight about the
// CUBE, and a long script can turn very little.

function runScript(source) {
  // let, not const: deal() replaces the board, and every noun must follow
  // it to the new one.
  let p = game.puzzle;
  // Fuel bounds every injected call, so a runaway loop that keeps asking
  // dies with a clear message instead of hanging the page. A loop that
  // never asks anything cannot be stopped from here; the page says so in
  // the docs rather than pretending.
  let fuel = 20000;
  const spend = () => {
    if (--fuel < 0) throw new Error("out of fuel: 20,000 calls is a runaway loop");
  };
  let before = p.history.length;
  // A board in pieces neither turns nor judges: the nouns that need a whole
  // cube say so instead of moving ghosts.
  const whole = () => {
    if (game.build)
      throw new Error(
        `the cube is in pieces: ${game.build.tray.length} still in the bin`,
      );
  };

  // per-face ranges of the state string, measured off a solved twin
  const twin = build(game.source, game.kind, game.size);
  const rested = twin.getState();
  const ranges = {};
  {
    let i = 0;
    for (const L of twin.def.faceOrder || []) {
      let j = i;
      while (j < rested.length && rested[j] === L) j++;
      if (j > i) ranges[L] = [i, j];
      i = j;
    }
  }

  const occupant = (name) => {
    const home = twin.pieceNamed(name);
    const restKey = twin
      .getPieces()
      .find((x) => x.index === home)
      .slot.map((v) => Math.round(v * 1e4))
      .join(",");
    const there = p
      .getPieces()
      .find((x) => x.slot.map((v) => Math.round(v * 1e4)).join(",") === restKey);
    return there ? p.nameOf(there.index) : "?";
  };

  const api = {
    turn: (seq) => {
      spend();
      whole();
      p.move(desugar(seq));
      renderCode();
    },
    // ── Construction: the cube itself is code ──────────────────────────
    // deal() takes the board apart the way Assemble does: a fresh cube at
    // rest, six centres bolted to the core, everything else in the bin.
    deal: () => {
      spend();
      const fresh = build(game.source, game.kind, game.size);
      if (fresh.constructor !== Cube)
        throw new Error("only a plain cube comes apart; weld or carve it and the pieces stop being free");
      game.puzzle = fresh;
      game.scramble = "";
      game.dealt = "";
      p = fresh;
      const placed = new Set();
      const tray = [];
      fresh.pieces.forEach((_, i) => {
        const k = new Set(fresh.pieces[i].faces.filter((f) => f.letter).map((f) => f.letter)).size;
        if (k === 1) placed.add(i); // centres ride the spider
        else tray.push(i);
      });
      for (let i = tray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [tray[i], tray[j]] = [tray[j], tray[i]];
      }
      const locOf = (i) =>
        nameSlot(p.getPieces().find((x) => x.index === i).slot);
      game.build = { placed, tray, locOf };
      renderGame();
      return tray.map((i) => p.nameOf(i));
    },
    bin: () => (spend(), game.build ? game.build.tray.map((i) => p.nameOf(i)) : []),
    // place(piece) sets it in its home slot, solved. place(piece, slot,
    // spin) is the whole of Assemble's power in one call: any free slot of
    // the right kind, spun on the spot, so a script can build the perfect
    // cube or an impossible one and let lawful() say which.
    place: (pieceName, slotName, spin = 0) => {
      spend();
      if (!game.build) throw new Error("nothing is in pieces: deal() first");
      const idx = p.pieceNamed(pieceName);
      if (!game.build.tray.includes(idx))
        throw new Error(`${pieceName} is not in the bin`);
      const home = p.nameOf(idx);
      const slot = slotName || home;
      if (String(slot).length !== home.length)
        throw new Error(`${home} cannot stand in ${slot}: wrong kind of slot`);
      const standing = new Set([...game.build.placed].map((i) => game.build.locOf(i)));
      if (standing.has(slot)) throw new Error(`${slot} is already taken`);
      const from = game.build.locOf(idx);
      if (from !== slot) p.swapPieces(from, slot);
      const spins = ((Math.round(spin) % 3) + 3) % 3;
      for (let k = 0; k < spins; k++)
        if (home.length === 3) p.twistCorner(slot);
        else p.flipEdge(slot);
      game.build.tray.splice(game.build.tray.indexOf(idx), 1);
      game.build.placed.add(idx);
      if (!game.build.tray.length) {
        // The build IS the board, like the scramble is: the move count
        // starts at zero from here, and the judge may now speak.
        game.build = null;
        p.history = [];
        before = 0;
      }
      renderGame();
    },
    at: (name) => (spend(), whole(), occupant(name)),
    // The cube as something to iterate: every slot by its cubers' name,
    // and who is standing in it right now.
    pieces: () => {
      spend();
      // Mid-build it walks only what is standing; ghosts in the bin have
      // no address worth reporting.
      const standing = game.build
        ? new Set([...game.build.placed].map((i) => game.build.locOf(i)))
        : null;
      return twin
        .getPieces()
        .map((pc) => {
          const slot = twin.nameOf(pc.index);
          return { at: slot, is: occupant(slot) };
        })
        .filter((e) => e.at.length > 1) // centres never travel
        .filter((e) => !standing || standing.has(e.at));
    },
    // A sequence read as the permutation it drives, in cycle notation over
    // slot names: [["UB","UR","RF"]] is the whole story of a commutator.
    cycles: (seq) => {
      spend();
      whole();
      const e = p.effectOf(desugar(seq));
      return e.cycles.map((c) => c.map(nameSlot));
    },
    face: (L) => {
      spend();
      whole();
      const r = ranges[L];
      if (!r) throw new Error(`no face '${L}' on this puzzle`);
      return p.getState().slice(r[0], r[1]);
    },
    solved: () => (spend(), whole(), p.matches(game.target)),
    distance: () => (spend(), whole(), p.distanceTo(game.target)),
    moves: () => Math.max(0, p.history.length - before),
  };

  const fn = new Function(...Object.keys(api), `"use strict";\n${source}`);
  fn(...Object.values(api));
  return { moves: p.history.length - before, chars: source.trim().length };
}

function runScriptButton() {
  const src = $("script-code").value;
  const out = $("script-status");
  if (!src.trim()) {
    out.textContent = "";
    return;
  }
  let result;
  try {
    result = runScript(src);
  } catch (err) {
    renderGame();
    out.textContent = err.message;
    return;
  }
  renderGame();
  // A script may end with the board still in pieces; saying "reached the
  // pattern" about a hidden whole state would be a lie about a veil.
  if (game.build) {
    out.textContent = `${result.chars} characters; the board is in pieces, ${game.build.tray.length} in the bin.`;
    return;
  }
  const hit = game.puzzle.matches(game.target);
  out.textContent = hit
    ? `Reached the pattern: ${result.chars} characters, ${result.moves} moves.`
    : `${result.chars} characters, ${result.moves} moves, ${game.puzzle.distanceTo(game.target)} stickers still out of place.`;
  // Two boards, because they are two different virtues.
  if (hit && game.challenge !== null) {
    const key = `erno-pattern-best-${game.challenge}`;
    let best = {};
    try {
      best = JSON.parse(localStorage.getItem(key)) || {};
    } catch { /* a hand-edited record; start fresh */ }
    best.chars = Math.min(best.chars ?? Infinity, result.chars);
    best.moves = Math.min(best.moves ?? Infinity, result.moves);
    localStorage.setItem(key, JSON.stringify(best));
    out.textContent += ` Best here: ${best.chars} characters, ${best.moves} moves.`;
  }
}

// ── The code for what you are looking at ────────────────────────────────────
//
// Not an example written once and left to rot beside the thing it claims to
// describe. It is generated from the same state the page is drawing from, so
// it cannot drift: change the puzzle and the constructor changes, weld two
// bodies and the bodies appear, turn a face and the move shows up.
//
// It is meant to run. Paste it into a file next to erno.js and you get the
// puzzle on screen, in the position on screen. That is the claim, and there
// is a test that pastes it into node and checks.

/** Print a value the way you would write it. */
const lit = (v) =>
  Array.isArray(v) ? `[${v.join(", ")}]` : typeof v === "string" ? JSON.stringify(v) : String(v);

/** How this puzzle is built, in the words you would use to build it. */
function constructorFor() {
  const kind = game.kind;
  const body = game.source.trim().replace(/\n/g, "\n      ");
  // The exact wrapper the page runs, sticker arguments and all, because
  // the snippet's claim is that it reproduces the screen, and it is checked
  // against the screen polygon by polygon.
  const paint = [
    "  paint: ({ slot: [x, y, z], letter: face, row, col, piece }) => {",
    "    const kind = piece.faces.filter((q) => q.letter).length;",
    "    const v = (() => {",
    `      ${body}`,
    "    })();",
    "    return colour(v);",
    "  },",
  ].join("\n");
  // Everything the page passes, including the one it would rather not think
  // about: the snippet left stickerInset out and drew a puzzle that was the
  // right puzzle and not the right picture. An example is not honest at
  // "close enough" when it claims to be what you are looking at.
  const inset = "  stickerInset: 0.1,";
  if (kind === "compose") {
    const bodies = game.bodies;
    if (bodies.length === 1) {
      const [a, b, c] = bodies[0].size;
      return a === b && b === c
        ? { name: "Cube", args: [`  size: ${a},`, paint, inset] }
        : { name: "Cuboid", args: [`  size: ${lit([a, b, c])},`, paint, inset] };
    }
    return {
      name: "Fused",
      args: [
        "  bodies: [",
        ...bodies.map((b) => `    { size: ${lit(b.size)}, at: ${lit(b.at)} },`),
        "  ],",
        paint,
        inset,
      ],
      note: "welded where they meet, which is what takes the turns away",
    };
  }
  if (kind === "cube")
    return { name: "Cube", args: [`  size: ${game.size},`, paint, inset] };
  if (kind === "cuboid")
    return { name: "Cuboid", args: [`  size: ${lit([3, 3, game.size])},`, paint, inset] };
  if (kind === "void") return { name: "Void", args: [paint, inset] };
  if (kind === "siamese")
    return {
      name: "Siamese",
      args: [paint, inset],
      // Two 3×3s sharing a slab. The default offset is the interesting one:
      // where the second cube sits decides how much of either can still turn.
      note: "two cubes sharing a slab; most turns are refused, and which ones changes as it moves",
    };
  return {
    name: "Fused",
    args: [
      "  bodies: [",
      "    { size: [3, 3, 3], at: [0, 0, 0] },",
      "    { size: [2, 2, 2], at: [1.5, 1.5, 0.5] },",
      "  ],",
      paint,
      inset,
    ],
    note: "any number of bodies on one lattice, welded where they meet",
  };
}

function renderCode() {
  const host = $("code-out");
  if (!host) return;
  const ctor = constructorFor();

  // Only what is actually used, and everything that IS. The snippet said
  // `y > 0 ? U : D` while importing neither U nor D, so it read well and
  // would not have run: those letters are handed to the box by this page,
  // and a reader pasting it elsewhere has no such thing. They come from the
  // library, so the snippet says where.
  const names = [ctor.name, "SCHEMES"];
  const lines = [];
  lines.push(`import { ${names.join(", ")} } from "erno.js";`, "");
  lines.push("// a cube names its six colours after its faces");
  lines.push("const { U, R, F, D, L, B } = SCHEMES.classic;");
  // The box hands your function Math unpacked, so `hypot` works there and
  // did not in what this printed: six of seven snippets died on exactly
  // that, and only the one that happened not to use any of it survived.
  // Named one by one rather than dumped, so the line says what is used.
  const MATHS = "abs floor ceil round min max hypot sign sqrt sin cos atan2 PI".split(" ");
  const used = MATHS.filter((m) => new RegExp(`\\b${m}\\b`).test(game.source));
  if (used.length) lines.push(`const { ${used.join(", ")} } = Math;`);
  lines.push(`const n = ${halfWidth(game.kind, game.size)};   // how far the lattice reaches`);
  lines.push("");
  lines.push("// a returned face letter is that face's colour; numbers reach the palette");
  if (game.usesPalette) lines.push(`const PALETTE = ${JSON.stringify(PALETTE)};`);
  lines.push("const colour = (v) =>");
  lines.push(
    game.usesPalette
      ? '  typeof v === "string" ? (v.length === 1 && SCHEMES.classic[v]) || v : PALETTE[((Math.floor(v) % 8) + 8) % 8];'
      : '  (v.length === 1 && SCHEMES.classic[v]) || v;',
  );
  lines.push("");
  lines.push(`const puzzle = new ${ctor.name}({`);
  for (const a of ctor.args) lines.push(a);
  lines.push("});");

  if (ctor.note) lines.push(`// ${ctor.note}`);

  // The turns. history is what the player has done since the board was set,
  // in the puzzle's own notation, which is the same string move() takes.
  const done = game.puzzle ? game.puzzle.history : [];
  lines.push("");
  if (game.dealt) {
    // A board that came from a link has no walk to tell: its position
    // arrived whole. Without this line the snippet said "nothing turned
    // yet" over a half-solved board - printing the pattern and calling it
    // the position. setPosition is how it got here, so that is what it says.
    lines.push("// the position this link carried");
    lines.push(`puzzle.setPosition(${lit(game.dealt)});`);
  } else if (game.scramble) {
    lines.push("// the walk this board was dealt");
    lines.push(`puzzle.move(${lit(game.scramble)});`);
  }
  if (done.length) {
    lines.push(game.scramble || game.dealt ? "// and what you have turned since" : "");
    lines.push(`puzzle.move(${lit(done.join(" "))});`);
  } else if (!game.scramble && !game.dealt) {
    lines.push(`// nothing turned yet. Every move it will take, from here:`);
    const open = game.puzzle ? game.puzzle.legalMoves() : [];
    const all = game.puzzle ? game.puzzle.vocabulary() : [];
    lines.push(`// ${open.join(" ")}`);
    if (open.length < all.length)
      lines.push(`// and ${all.length - open.length} more it names but will not turn from here`);
  }

  // The sequence, if one is written, and what it is.
  const typed = $("seq-input") ? $("seq-input").value.trim() : "";
  if (typed) {
    const read = readSequence(typed);
    if (!read.error && !read.empty) {
      const e = read.effect;
      // Written, not run. Emitting it as a move made the snippet a liar:
      // paste it and you would get a board a turn ahead of the one on
      // screen. Commented, so it still shows what the notation is for, and
      // pressing Run moves it up into the moves above where it belongs.
      lines.push("");
      lines.push("// written but not run yet:");
      lines.push(`// puzzle.move(${lit(typed)});   // ${read.flat}`);
      lines.push(`// ${e.cycles.length ? e.cycles.map((c) => `${c.length}-cycle`).join(" + ") : "nothing moves"}, order ${e.order}`);
    }
  }

  lines.push("");
  lines.push(`puzzle.toSVG({ fitSphere: true });`);
  const text = lines.join("\n");
  if (highlight) host.innerHTML = highlight(text);
  else host.textContent = text;
}

// ── The sequence console ────────────────────────────────────────────────────
//
// The buttons turn one face. This turns a SENTENCE, in the notation cubers
// have written for fifty years: `[R, U]` for a commutator, `[R: U]` for a
// conjugate, `(R U)3` for a repeat, `'` to undo. It is the same parser the
// library exports, so anything that works here works in `move`.
//
// The half that makes it worth having is the readout beside it. A sequence
// is not its list of moves, it is what it DOES, and effectOf says that in
// the terms the notation was invented for: which pieces travel together,
// how many are touched at all, and how many repeats bring it home. Type
// `[R, U]` and watch it move three pieces and nothing else. That is the
// whole argument for commutators, and it is one line rather than a lecture.

/**
 * Macros: `let sexy = R U R' U'; (sexy)3`.
 *
 * Cubers name their algorithms, and naming is the one thing the algebra
 * lacked against how they actually write. A line is self-contained - the
 * definitions travel with the expression, so a shared line still means
 * what it meant - and the engine never sees a name: substitution happens
 * here, textually, before expand.
 */
function desugar(text) {
  const parts = String(text).split(";");
  const defs = [];
  let body = "";
  for (const part of parts) {
    const m = /^\s*let\s+([A-Za-z_]\w*)\s*=\s*(\S[\s\S]*?)\s*$/.exec(part);
    if (m) defs.push([m[1], m[2]]);
    else body += " " + part;
  }
  body = body.trim();
  // Earlier names may appear inside later definitions, so substitute in
  // order of definition, into everything that follows.
  for (let i = 0; i < defs.length; i++) {
    const [name, seq] = defs[i];
    const re = new RegExp(`\\b${name}\\b`, "g");
    for (let j = i + 1; j < defs.length; j++) defs[j][1] = defs[j][1].replace(re, seq);
    body = body.replace(re, seq);
  }
  return body;
}

/** A location's name, cubers' spelling, from the piece that rests there. */
const locNames = new Map();
function nameSlot(slot) {
  const key = slot.map((v) => Math.round(v * 1e4)).join(",");
  if (!locNames.has(key)) {
    // built once per board: where every piece RESTS, named by its stickers
    const twin = build(game.source, game.kind, game.size);
    for (const pc of twin.getPieces())
      locNames.set(pc.slot.map((v) => Math.round(v * 1e4)).join(","), twin.nameOf(pc.index));
  }
  return locNames.get(key) || "?";
}

/** Read a sequence without running it. Returns what to show. */
function readSequence(text) {
  const source = desugar(text);
  if (!source) return { empty: true };
  let flat;
  try {
    parse(source);
    flat = expand(source);
  } catch (err) {
    return { error: err.message };
  }
  const tokens = flat.split(/\s+/).filter(Boolean);
  // The puzzle's own words, not a summary of them. This used to answer every
  // refusal with "this puzzle has no move 'R'", which on a 3×3×5 is simply
  // false: it has R and will not turn it, and the library already says so
  // far better: that a quarter turn of that axis would leave it misshapen,
  // and that R2 is the one to reach for.
  for (const t of tokens) {
    try {
      game.puzzle.parseMove(t);
    } catch (err) {
      return { error: err.message };
    }
  }
  // effectOf can refuse too: every token may parse and the sequence still
  // be unplayable from HERE, on a puzzle that blocks. The library restores
  // itself before throwing, so all this has to do is show its words.
  try {
    return { flat, tokens, effect: game.puzzle.effectOf(source) };
  } catch (err) {
    return { error: err.message };
  }
}

function renderSequence() {
  const read = readSequence($("seq-input").value);
  const out = $("seq-read");
  renderCode();
  const run = $("seq-run");
  $("seq-input").toggleAttribute("data-bad", !!read.error);
  run.disabled = game.busy || !!game.build || !!read.error || !!read.empty;
  if (read.empty) {
    out.textContent = "";
    return;
  }
  if (read.error) {
    out.textContent = read.error;
    return;
  }
  const e = read.effect;
  // Named, because this is how a cuber reads a permutation: UFR to URB to
  // ULB says which pieces travel together; a list of coordinate triples
  // says only that something does.
  const named = e.cycles
    .map((c) => c.map(nameSlot).join(" \u2192 "))
    .slice(0, 3);
  const shape = e.cycles.map((c) => c.length).sort((a, b) => b - a);
  // A commutator's whole point is the shape of this line.
  const permutation = e.cycles.length
    ? named.join("   ") + (e.cycles.length > 3 ? ` (+${e.cycles.length - 3} more)` : "")
    : "nothing moves";
  // In cubers' words, because that is who is reading: "URF twisted cw" and
  // "UF flipped" are facts they already have names for.
  const spun = e.turns && e.turns.length
    ? ", " + e.turns.slice(0, 4).map((t) =>
        `${t.name} ${t.spin.replace("twisted counterclockwise", "ccw").replace("twisted clockwise", "cw")}`,
      ).join(", ") + (e.turns.length > 4 ? ` (+${e.turns.length - 4})` : "")
    : "";
  out.textContent =
    `${read.tokens.length} moves: ${read.flat}\n` +
    `${permutation}${spun}, touching ${e.moved} pieces\n` +
    `order ${e.order}: repeat it ${e.order} times and it is back`;
}

/** Run it. Short ones are animated; a long one would be a wait, not a show. */
function runSequence() {
  const read = readSequence($("seq-input").value);
  if (read.error || read.empty || game.busy) return;
  const tokens = read.tokens;
  game.busy = true;
  renderMoves();
  renderSequence();

  const stopped = (i) => {
    game.busy = false;
    renderGame();
    renderSequence();
    if (i < tokens.length)
      $("play-status").textContent =
        `Stopped at "${tokens[i]}": this puzzle will not make that turn from here.`;
  };

  // Animating two hundred and ten moves is not a demonstration, it is a
  // wait. Past a dozen it is applied at once and the page says so.
  if (tokens.length > 12) {
    for (let i = 0; i < tokens.length; i++) {
      if (!game.puzzle.canMove(tokens[i])) return stopped(i);
      game.puzzle.move(tokens[i]);
    }
    return stopped(tokens.length);
  }
  const step = (i) => {
    if (i >= tokens.length) return stopped(i);
    if (!game.puzzle.canMove(tokens[i])) return stopped(i);
    animate($("play-canvas"), game.puzzle, tokens[i], () => step(i + 1));
  };
  step(0);
}

// ── Wiring ──────────────────────────────────────────────────────────────────

// ── Watch: the overture ─────────────────────────────────────────────────────
//
// The whole loop played once by itself when the plate first scrolls into
// view. Nothing is recorded: every line is executed against the engine the
// moment it finishes typing, the board beside it is the real result, and
// the line underneath speaks each move in plain notation and nothing else.
// The overture keeps its own puzzle and its own pattern; the game below is
// never touched.

const WATCH_PAINT = "return y > 0 ? U : D";
const WATCH_GREEDY = `for (const m of ["R", "U", "F", "D", "L", "B"]) {
  const d = distance()
  turn(m)
  if (distance() >= d) turn(m + "'")
}`;
const ov = { gen: 0, paused: false, started: false, code: "", board: null, pattern: null };

// build() remembers whether a pattern reached for the palette, so the
// generated code knows what to import; the overture's own builds must not
// overwrite what the player's pattern said.
function ovBuild(source) {
  const keep = game.usesPalette;
  const p = build(source, "cube", 3);
  game.usesPalette = keep;
  return p;
}

// A sleep that a restart cancels and an off-screen plate suspends: paused
// time does not count, so scrolling away mid-reel loses nothing.
const ovSleep = (gen, ms) =>
  new Promise((resolve, reject) => {
    let left = ms;
    let last = performance.now();
    const step = () => {
      if (gen !== ov.gen) return reject(new Error("watch-restart"));
      const now = performance.now();
      if (!ov.paused) left -= now - last;
      last = now;
      if (left <= 0) return resolve();
      setTimeout(step, 30);
    };
    step();
  });

async function ovType(gen, text, { reset = false } = {}) {
  const pre = $("watch-code");
  pre.classList.add("is-typing");
  if (reset && ov.code) {
    while (ov.code.length) {
      ov.code = ov.code.slice(0, -1);
      pre.textContent = ov.code;
      await ovSleep(gen, 7);
    }
  }
  for (const ch of text) {
    ov.code += ch;
    pre.textContent = ov.code;
    await ovSleep(gen, ch === "\n" ? 150 : 26);
  }
  if (highlight) pre.innerHTML = highlight(ov.code);
}

function ovTick(text, cls) {
  const el = document.createElement("span");
  el.textContent = text;
  if (cls) el.className = cls;
  $("watch-ticker").append(el);
  return el;
}

// The meaning of the line that just ran, in words. The ticker below never
// carries prose and this line never carries notation; two voices, one job
// each.
function ovSay(text) {
  $("watch-say").textContent = text;
}

// The cube arrives the way Assemble deals it: centres first, bolted to the
// core, then every edge and corner from the bottom up, each one named in
// the ticker as it lands.
async function ovAssemble(gen) {
  const host = $("watch-canvas");
  const pieces = ov.board.getPieces();
  const kindOf = (i) =>
    ov.board.pieces[i].faces.filter((f) => f.letter).length;
  const order = pieces
    .map((p) => p.index)
    .sort((a, b) => {
      const ka = kindOf(a) === 1 ? 0 : 1;
      const kb = kindOf(b) === 1 ? 0 : 1;
      if (ka !== kb) return ka - kb;
      const sa = pieces.find((p) => p.index === a).slot;
      const sb = pieces.find((p) => p.index === b).slot;
      return sa[1] - sb[1] || sa[2] - sb[2] || sa[0] - sb[0];
    });
  const shown = new Set();
  const name = ovTick("", "is-live");
  for (const i of order) {
    shown.add(i);
    name.textContent = ov.board.nameOf(i);
    host.innerHTML = ov.board.toSVG({
      fitSphere: true,
      padding: 8,
      pieces: (k) => shown.has(k),
    });
    await ovSleep(gen, 85);
  }
  name.className = "";
}

// One turn on the overture board, eased like every other turn on the page,
// but answering to the reel's own clock: a restart aborts it and a paused
// plate freezes it mid-air.
function ovTurn(gen, move, ms = 190) {
  return new Promise((resolve, reject) => {
    const host = $("watch-canvas");
    let t = 0;
    let last = performance.now();
    const step = (now) => {
      if (gen !== ov.gen) return reject(new Error("watch-restart"));
      if (!ov.paused) t += (now - last) / ms;
      last = now;
      const k = Math.min(1, t);
      draw(host, ov.board, { move, progress: 1 - (1 - k) * (1 - k) });
      if (k < 1) requestAnimationFrame(step);
      else {
        ov.board.move(move);
        draw(host, ov.board);
        resolve();
      }
    };
    requestAnimationFrame(step);
  });
}

// A slot's cubers' name on the overture's own board, cached from a twin at
// rest. Watch cannot borrow the game's nameSlot: that cache belongs to
// whatever puzzle the player composed below.
const ovLocNames = new Map();
function ovNameSlot(slot) {
  if (!ovLocNames.size) {
    const twin = ovBuild(WATCH_PAINT);
    for (const pc of twin.getPieces())
      ovLocNames.set(
        pc.slot.map((v) => Math.round(v * 1e4)).join(","),
        twin.nameOf(pc.index),
      );
  }
  return ovLocNames.get(slot.map((v) => Math.round(v * 1e4)).join(",")) || "?";
}

// Who stands where a piece rests, in home letters: the same reading the
// script console's at() gives, against the overture's own board.
function ovOccupant(name) {
  const twin = ovBuild(WATCH_PAINT);
  const home = twin.pieceNamed(name);
  const restKey = twin
    .getPieces()
    .find((x) => x.index === home)
    .slot.map((v) => Math.round(v * 1e4))
    .join(",");
  const there = ov.board
    .getPieces()
    .find((x) => x.slot.map((v) => Math.round(v * 1e4)).join(",") === restKey);
  return there ? ov.board.nameOf(there.index) : "?";
}

async function ovRun(gen) {
  const canvas = $("watch-canvas");
  const ticker = $("watch-ticker");
  ov.code = "";
  ticker.textContent = "";
  canvas.innerHTML = "";
  $("watch-say").textContent = "";
  $("watch-code").textContent = "";
  $("watch-goal").hidden = true;
  $("watch-again").hidden = true;
  $("watch-sig").textContent = "deal(), bin(), place(piece)";

  // I. FIRST the cube is created, in the console's own syntax: deal()
  // opens the bin, place() sets each cubie, and the loop below is executed
  // as written, one landing per iteration.
  ov.board = ovBuild("return face");
  ovSay("First the cube, and the cube is code: deal() opens the bin of twenty six cubies, place() sets each one in its slot. Centres first, bolted to the core, then every edge and corner, named below as it lands.");
  await ovType(gen, "deal()\nfor (const p of bin()) place(p)");
  await ovAssemble(gen);
  await ovSleep(gen, 900);

  // II. THEN, on the standing cube, the syntax that creates the pattern:
  // one function of every sticker.
  $("watch-sig").textContent = "f(x, y, z, n, face, row, col, kind)";
  ovSay("The cube stands, so now the pattern: one function, run once per sticker, paints it. Above the middle every sticker answers U, below it D.");
  await ovType(gen, "return y > 0 ? U : D", { reset: true });
  ov.board = ovBuild(WATCH_PAINT);
  draw(canvas, ov.board);
  ticker.textContent = "";
  ovTick("U");
  ovTick("/");
  ovTick("D");
  await ovSleep(gen, 1200);

  // II. The picture becomes the target.
  ovSay("The picture you wrote is now the goal to chase.");
  ov.pattern = ov.board.getPattern();
  $("watch-target").innerHTML = ov.board.toSVG({ fitSphere: true, padding: 8 });
  $("watch-goal").hidden = false;
  await ovSleep(gen, 1000);

  // III. The deal: scrambled for real, one turn at a time. The walk is
  // taken silently first and then replayed in the open, so every token in
  // the ticker is a turn the reader watched happen.
  ovSay("The scramble: ten real turns walk the picture away.");
  ticker.textContent = "";
  const seq = ov.board.scramble(10);
  ov.board.move("(" + seq + ")'");
  draw(canvas, ov.board);
  for (const tok of seq.split(/\s+/)) {
    const el = ovTick(tok, "is-live");
    await ovTurn(gen, tok);
    el.className = "";
  }
  await ovSleep(gen, 800);

  // IV. The nouns, one by one, in the console's own language.
  $("watch-sig").textContent = "solve()";
  ovSay("turn() speaks the whole algebra: one commutator, and the line below is its four turns.");
  await ovType(gen, 'turn("[R, U]")', { reset: true });
  ticker.textContent = "";
  for (const tok of expand("[R, U]").split(" ")) {
    const el = ovTick(tok, "is-live");
    await ovTurn(gen, tok);
    el.className = "";
  }
  await ovSleep(gen, 600);

  ovSay("cycles() reads a sequence as the permutation it drives: the commutator moves exactly one cycle of three pieces, and six repeats bring them home.");
  await ovType(gen, '\ncycles("[R, U]")');
  {
    const eff = ov.board.effectOf("[R, U]");
    for (const c of eff.cycles.slice(0, 3))
      ovTick(c.map(ovNameSlot).join(" → "));
  }
  await ovSleep(gen, 1300);

  ovSay("at() answers who is standing in a corner, in the letters of its home.");
  await ovType(gen, '\nat("UFR")');
  ovTick(`UFR → ${ovOccupant("UFR")}`);
  await ovSleep(gen, 1100);

  ovSay("distance() counts the stickers still away from the picture.");
  await ovType(gen, "\ndistance()");
  ovTick(`${ov.board.distanceTo(ov.pattern)} / 54`);
  await ovSleep(gen, 1200);

  // V. The greedy plays: every try appears, and a move that widened the
  // distance is struck out the moment it is taken back.
  ovSay("A first script: try every face, keep a turn only if the picture gets closer. The struck moves were tried and taken back.");
  await ovType(gen, WATCH_GREEDY, { reset: true });
  ticker.textContent = "";
  let kept = 0;
  for (const m of ["R", "U", "F", "D", "L", "B"]) {
    const before = ov.board.distanceTo(ov.pattern);
    const el = ovTick(m, "is-live");
    await ovTurn(gen, m);
    if (ov.board.distanceTo(ov.pattern) >= before) {
      el.className = "is-struck";
      await ovTurn(gen, m + "'", 110);
    } else {
      el.className = "";
      kept++;
    }
  }

  // VI. The ending must read itself out loud: what the strikes were, what
  // the count is, and where the reader goes next.
  const left = ov.board.distanceTo(ov.pattern);
  ovSay(
    `Six faces tried, ${kept} kept; the struck turns were taken back. ` +
      `${left} of 54 stickers still off the picture, and the rest is yours: ` +
      `the same nouns wait in the Script plate below.`,
  );
  ovTick(`→ ${left} / 54`);
  $("watch-code").classList.remove("is-typing");
  $("watch-again").hidden = false;
}

function wireWatch() {
  if (!$("watch-panel")) return;
  const start = () => {
    ov.gen++;
    ovRun(ov.gen).catch((e) => {
      if (e.message !== "watch-restart") throw e;
    });
  };
  $("watch-again").addEventListener("click", start);

  if (still.matches) {
    // A reader who asked for stillness gets the finished tableau, whole and
    // at once: the pattern, the deal, the greedy's keeps, the count.
    ov.board = ovBuild(WATCH_PAINT);
    ov.pattern = ov.board.getPattern();
    $("watch-target").innerHTML = ov.board.toSVG({ fitSphere: true, padding: 8 });
    $("watch-goal").hidden = false;
    ov.board.scramble(10);
    const kept = [];
    for (const m of ["R", "U", "F", "D", "L", "B"]) {
      const d = ov.board.distanceTo(ov.pattern);
      ov.board.move(m);
      if (ov.board.distanceTo(ov.pattern) >= d) ov.board.move(m + "'");
      else kept.push(m);
    }
    draw($("watch-canvas"), ov.board);
    const pre = $("watch-code");
    pre.textContent = WATCH_GREEDY;
    if (highlight) pre.innerHTML = highlight(WATCH_GREEDY);
    $("watch-sig").textContent = "solve()";
    const left = ov.board.distanceTo(ov.pattern);
    ovSay(
      `The finished run, all at once: the pattern written, the board dealt, ` +
        `the ${kept.length} turns the greedy kept, and ${left} of 54 stickers ` +
        `still off the picture.`,
    );
    for (const m of kept) ovTick(m);
    ovTick(`→ ${left} / 54`);
    return;
  }

  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting && !ov.started) {
          ov.started = true;
          start();
        }
        ov.paused = ov.started && !e.isIntersecting;
      }
    },
    { threshold: 0.35 },
  );
  io.observe($("watch-panel"));
}

// ── The mode nav ────────────────────────────────────────────────────────────
//
// Scroll-spy plus hash-preserving clicks. The one decision that matters is
// what a click does NOT do: it does not assign location.hash, because the
// hash here is a query string of game state - a shared board, a stamp seed
// - and a nav that wrote its anchor over it would eat somebody's link.
function wireModeNav() {
  const nav = document.querySelector(".mode-nav");
  if (!nav) return;
  const links = [...nav.querySelectorAll("a[href^='#']")];
  const sections = links
    .map((a) => document.getElementById(a.getAttribute("href").slice(1)))
    .filter(Boolean);

  const mark = (id) => {
    for (const a of links)
      if (a.getAttribute("href") === `#${id}`) a.setAttribute("aria-current", "true");
      else a.removeAttribute("aria-current");
  };

  for (const a of links)
    a.addEventListener("click", (e) => {
      e.preventDefault();
      const id = a.getAttribute("href").slice(1);
      document.getElementById(id).scrollIntoView({ block: "start" });
      // marked here as well as by the scroll listener, because a click's
      // intent is already known and a smooth scroll reports late
      mark(id);
    });

  // the CURRENT section is the last one whose top has passed under the bar
  const spy = () => {
    const bar = nav.getBoundingClientRect().bottom + 8;
    let current = sections[0];
    for (const sec of sections)
      if (sec.getBoundingClientRect().top <= bar) current = sec;
    mark(current.id);
  };
  window.addEventListener("scroll", spy, { passive: true });
  spy();
}

function init() {
  const code = $("write-code");
  code.value = game.source;

  let typing;
  code.addEventListener("input", () => {
    clearTimeout(typing);
    typing = setTimeout(refreshWrite, 220);
  });

  const presets = $("write-presets");
  for (const [name, source] of Object.entries(PRESETS)) {
    const b = document.createElement("button");
    b.textContent = name;
    b.addEventListener("click", () => {
      code.value = source;
      refreshWrite();
    });
    presets.append(b);
  }

  const size = $("write-size");
  enhanceRange(size);
  size.addEventListener("input", () => {
    game.size = +size.value;
    refreshWrite();
  });

  // Which puzzle. A size only means something on a cube, so the control for
  // it goes away rather than sitting there doing nothing.
  const kind = $("write-kind");
  for (const [id, def] of Object.entries(PUZZLES)) {
    const o = document.createElement("option");
    o.value = id;
    o.textContent = def.label;
    kind.append(o);
  }
  const syncKind = () => {
    game.kind = kind.value;
    $("write-size-row").hidden = !PUZZLES[game.kind].sized;
    $("compose-row").hidden = game.kind !== "compose";
  };
  kind.addEventListener("input", () => {
    syncKind();
    refreshWrite();
  });

  // Which challenge, or none.
  const goal = $("write-goal");
  for (const [i, c] of CHALLENGES.entries()) {
    const o = document.createElement("option");
    o.value = String(i);
    o.textContent = c.name;
    goal.append(o);
  }
  goal.addEventListener("input", () => {
    game.challenge = goal.value === "" ? null : +goal.value;
    if (game.challenge !== null) {
      // A challenge names its own puzzle: matching a picture drawn on a
      // 3×3×5 by painting a 3×3 is not the same game.
      const c = CHALLENGES[game.challenge];
      kind.value = c.kind;
      game.size = c.size;
      size.value = String(c.size);
      size.dispatchEvent(new Event("input"));
      syncKind();
    }
    refreshWrite();
  });
  syncKind();

  $("body-add").addEventListener("click", () => {
    // Placed a body's width along the diagonal, which is where two cubes
    // meet on a shared lattice: the offset has to land cubie on cubie or the
    // library refuses it, and refusing is the interesting half.
    const last = game.bodies[game.bodies.length - 1];
    game.bodies.push({
      size: [3, 3, 3],
      at: [last.at[0] + 2, last.at[1] + 2, last.at[2]],
    });
    refreshWrite();
  });

  // The sequence console.
  const seq = $("seq-input");
  seq.addEventListener("input", renderSequence);
  seq.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      runSequence();
    }
  });
  $("seq-run").addEventListener("click", runSequence);
  $("script-run").addEventListener("click", runScriptButton);
  wireStamp();
  wireAssembly();
  wireModeNav();
  wireWatch();
  for (const b of document.querySelectorAll("[data-script]"))
    b.addEventListener("click", () => {
      $("script-code").value = b.dataset.script;
    });
  for (const b of document.querySelectorAll("[data-seq]"))
    b.addEventListener("click", () => {
      seq.value = b.dataset.seq;
      renderSequence();
      seq.focus();
    });

  // The prankster's row: what a thumb does to a borrowed cube. Each verb
  // picks a random piece of the right kind, by name, and the status line
  // then names the broken law. move() cannot break the laws, by theorem;
  // these can, which is the whole lesson.
  const randomPiece = (kind) => {
    const p = game.puzzle;
    const names = p.pieces
      .map((_, i) => i)
      .filter((i) => new Set(p.pieces[i].faces.filter((f) => f.letter).map((f) => f.letter)).size === kind)
      .map((i) => p.nameOf(i));
    return names[Math.floor(Math.random() * names.length)];
  };
  const tamper = (fn) => {
    try {
      fn();
    } catch (err) {
      $("play-status").textContent = err.message;
      return;
    }
    renderGame();
  };
  $("tamper-twist").addEventListener("click", () =>
    tamper(() => game.puzzle.twistCorner(randomPiece(3))));
  $("tamper-flip").addEventListener("click", () =>
    tamper(() => game.puzzle.flipEdge(randomPiece(2))));
  $("tamper-swap").addEventListener("click", () =>
    tamper(() => {
      const kind = Math.random() < 0.5 ? 3 : 2;
      let a = randomPiece(kind);
      let b = randomPiece(kind);
      for (let tries = 0; a === b && tries < 8; tries++) b = randomPiece(kind);
      game.puzzle.swapPieces(a, b);
    }));

  $("play-start").addEventListener("click", () => startGame(true));
  $("play-reset").addEventListener("click", () => startGame(false));
  $("play-undo").addEventListener("click", undo);

  // A position is a string, so a game fits in a link. This is the whole of
  // what getPosition gives you that a facelet string could not: it comes
  // back exactly, down to which cubie is where.
  $("play-share").addEventListener("click", () => {
    const url = new URL(location.href);
    // The whole board, not most of it. This carried size, function and
    // position but not WHICH PUZZLE, so a link made on a Siamese opened as
    // whatever the dropdown's first option was, the position failed to fit,
    // and the reader got a fresh scramble under a claim of exactness.
    const state = {
      kind: game.kind,
      size: String(game.size),
      f: game.source,
      at: game.puzzle.getPosition(),
    };
    if (game.kind === "compose") state.bodies = JSON.stringify(game.bodies);
    url.hash = new URLSearchParams(state).toString();
    history.replaceState(null, "", url);
    navigator.clipboard?.writeText(url.href);
    $("play-status").textContent = "Link copied. It carries the function and the exact position.";
  });

  // and read one back
  const saved = new URLSearchParams(location.hash.slice(1));
  if (saved.get("f")) {
    // The puzzle first: everything after it is read against the board it
    // names. A link from before this carried no kind and still opens, as a
    // cube, which is what those links were always of.
    kind.value = PUZZLES[saved.get("kind")] ? saved.get("kind") : "cube";
    if (saved.get("bodies")) {
      try {
        const bodies = JSON.parse(saved.get("bodies"));
        if (Array.isArray(bodies) && bodies.length) game.bodies = bodies.map(clampBody);
      } catch {
        /* a hand-edited hash; the default bodies stand */
      }
    }
    syncKind();
    game.size = +saved.get("size") || 3;
    size.value = String(game.size);
    size.dispatchEvent(new Event("input"));
    code.value = saved.get("f");
  }
  refreshWrite();
  renderSequence();
  if (saved.get("at")) {
    try {
      game.puzzle.setPosition(saved.get("at"));
      game.dealt = saved.get("at");
      renderGame();
      renderCode();
    } catch {
      /* a link from another size, or an older one; the fresh game stands */
    }
  }

  document.addEventListener("keydown", (e) => {
    if (e.target.tagName === "TEXTAREA" || e.metaKey || e.ctrlKey) return;
    const token = e.key.toUpperCase();
    if (game.puzzle.vocabulary().includes(token)) {
      play(e.shiftKey ? `${token}'` : token);
      e.preventDefault();
    }
  });
}

init();
