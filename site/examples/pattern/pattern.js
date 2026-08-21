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
  Twisty, expand, parse, isAlgebra,
} from "../../../src/erno.js";
import { enhanceRange } from "../../controls.js";

// The page's own colours and the puzzle's, and nothing else. Replicube hands
// you sixteen; these eight are the ones this site already speaks.
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
const PUZZLES = {
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
// needed — which is the game Replicube is actually playing, and the reason
// insight beats brute force there. `par` is the length of the solution this
// page knows; shorter than par is a real win over the author.
const CHALLENGES = [
  { name: "Sky and ground", kind: "cube", size: 3, solution: "return y > 0 ? 2 : 5" },
  { name: "Quadrants", kind: "cube", size: 3, solution: "return (x > 0) == (z > 0) ? 6 : 2" },
  { name: "Cage", kind: "cube", size: 3, solution: "return abs(x) > 0.9 && abs(z) > 0.9 ? 0 : 3" },
  { name: "Onion", kind: "cube", size: 5, solution: "return round(hypot(x, y, z)) % 2 ? 1 : 7" },
  { name: "Barber pole", kind: "cube", size: 4, solution: "return (x + y) % 2 ? 1 : 7" },
  { name: "Long caps", kind: "cuboid", size: 5, solution: "return abs(z) > 1.5 ? 3 : 4" },
];

const PRESETS = {
  Bands: "return y + 1",
  Checker: "return (x + y + z) % 2 ? 1 : 0",
  Corners: "return abs(x) + abs(y) + abs(z) > n - 1.5 ? 1 : 4",
  Ring: "return abs(y) < 0.5 ? 2 : 3",
  Diagonal: "return floor((x + z) / 2) + 1",
  Shell: "return hypot(x, y, z) > n - 1.2 ? 6 : 0",
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
    ${source}`;
  const fn = new Function("x", "y", "z", "n", body);
  fn(0, 0, 0, n); // fail here rather than once per cubie
  return fn;
}

// How far the lattice reaches, measured rather than assumed. On a cube it is
// the half width and could have been computed; on a Megaminx the slots are
// wherever the geometry put them, and the only honest way to tell a writer
// what `n` means is to go and look. One throwaway build, cached.
const reach = new Map();
function halfWidth(kind, size) {
  const key = `${kind}:${size}`;
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
  const f = compile(source, n);
  const options = {
    paint: ({ slot: [x, y, z] }) => {
      const v = f(x, y, z, n);
      if (typeof v === "string") return v;
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
  let puzzle;
  try {
    puzzle = build(code.value, game.kind, game.size);
    code.removeAttribute("data-bad");
  } catch (err) {
    code.setAttribute("data-bad", "");
    $("write-status").textContent = `${err.message}`;
    return;
  }
  game.source = code.value;
  draw($("write-canvas"), puzzle);
  renderChallenge(puzzle);

  const depth = scrambleDepth(puzzle);
  const stickers = puzzle.getPattern().length;
  const colours = new Set(puzzle.getPattern()).size;
  $("write-status").textContent =
    `${puzzle.pieces.length} cubies, ${stickers} stickers, ${colours} colours. ` +
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
function targetOf(i) {
  if (!targets.has(i)) {
    const c = CHALLENGES[i];
    targets.set(i, build(c.solution, c.kind, c.size).getPattern());
  }
  return targets.get(i);
}

/** Show the challenge picture, and say whether the function matches it. */
function renderChallenge(puzzle) {
  const panel = $("goal-panel");
  if (game.challenge === null) {
    panel.dataset.state = "free";
    $("goal-status").textContent =
      "Free play: whatever you write becomes the target.";
    $("goal-art").innerHTML = "";
    return;
  }
  const c = CHALLENGES[game.challenge];
  draw($("goal-art"), build(c.solution, c.kind, c.size));
  const hit = puzzle.getPattern() === targetOf(game.challenge);
  const mine = game.source.trim().length;
  const par = c.solution.length;
  panel.dataset.state = hit ? "hit" : "miss";
  $("goal-status").textContent = hit
    ? `Matched, in ${mine} characters. Par is ${par}` +
      (mine < par ? " — you beat it." : mine === par ? " — exactly." : ".")
    : `Not it yet. Par is ${par} characters; you are at ${mine}.`;
}

// ── Solve ───────────────────────────────────────────────────────────────────

function startGame(scramble) {
  game.puzzle = build(game.source, game.kind, game.size);
  if (scramble) {
    // Walk the scramble one move at a time out of what is legal from here.
    // On a plain cube every move always is; the moment this example is
    // pointed at a bandaged or welded puzzle it stops being true, and asking
    // is the only thing that keeps working.
    for (let k = 0; k < 18; k++) {
      const open = game.puzzle.legalMoves();
      if (!open.length) break;
      game.puzzle.move(open[Math.floor(Math.random() * open.length)]);
    }
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
  draw($("play-canvas"), p);
  renderMoves();
  renderProgress();
  const distance = p.distanceTo(game.target);
  const won = p.matches(game.target);
  $("play-status").textContent = won
    ? `Pattern reached in ${p.history.length} moves.`
    : `${distance} stickers out of place, ${p.history.length} moves made.`;
  if (won) $("play-panel").setAttribute("data-won", "");
  else $("play-panel").removeAttribute("data-won");
  // What a sequence does depends on where the puzzle is standing, which on
  // a puzzle that blocks is not a formality, so the readout follows it.
  if ($("seq-input")) renderSequence();
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
    b.disabled = game.busy || !game.puzzle.canMove(vocabulary[i]);
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

/** Read a sequence without running it. Returns what to show. */
function readSequence(text) {
  const source = text.trim();
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
  // far better — that a quarter turn of that axis would leave it misshapen,
  // and that R2 is the one to reach for.
  for (const t of tokens) {
    try {
      game.puzzle.parseMove(t);
    } catch (err) {
      return { error: err.message };
    }
  }
  return { flat, tokens, effect: game.puzzle.effectOf(source) };
}

function renderSequence() {
  const read = readSequence($("seq-input").value);
  const out = $("seq-read");
  const run = $("seq-run");
  $("seq-input").toggleAttribute("data-bad", !!read.error);
  run.disabled = game.busy || !!read.error || !!read.empty;
  if (read.empty) {
    out.textContent = "";
    return;
  }
  if (read.error) {
    out.textContent = read.error;
    return;
  }
  const e = read.effect;
  const shape = e.cycles.map((c) => c.length).sort((a, b) => b - a);
  // A commutator's whole point is the shape of this line.
  const permutation = shape.length
    ? shape.map((n) => `${n}-cycle`).join(" + ")
    : "nothing moves";
  const spun = e.turnedInPlace.length
    ? `, ${e.turnedInPlace.length} turned in place`
    : "";
  out.textContent =
    `${read.tokens.length} moves: ${read.flat}\n` +
    `${permutation}${spun} — ${e.moved} pieces touched\n` +
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
  for (const b of document.querySelectorAll("[data-seq]"))
    b.addEventListener("click", () => {
      seq.value = b.dataset.seq;
      renderSequence();
      seq.focus();
    });

  $("play-start").addEventListener("click", () => startGame(true));
  $("play-reset").addEventListener("click", () => startGame(false));
  $("play-undo").addEventListener("click", undo);

  // A position is a string, so a game fits in a link. This is the whole of
  // what getPosition gives you that a facelet string could not: it comes
  // back exactly, down to which cubie is where.
  $("play-share").addEventListener("click", () => {
    const url = new URL(location.href);
    url.hash = new URLSearchParams({
      size: String(game.size),
      f: game.source,
      at: game.puzzle.getPosition(),
    }).toString();
    history.replaceState(null, "", url);
    navigator.clipboard?.writeText(url.href);
    $("play-status").textContent = "Link copied. It carries the function and the exact position.";
  });

  // and read one back
  const saved = new URLSearchParams(location.hash.slice(1));
  if (saved.get("f")) {
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
      renderGame();
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
