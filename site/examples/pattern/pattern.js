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

import { Cube, Twisty } from "../../../src/erno.js";
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

function build(source, size) {
  const n = (size - 1) / 2;
  const f = compile(source, n);
  return new Cube({
    size,
    paint: ({ slot: [x, y, z] }) => {
      const v = f(x, y, z, n);
      if (typeof v === "string") return v;
      const i = Math.floor(Number(v)) || 0;
      return PALETTE[((i % PALETTE.length) + PALETTE.length) % PALETTE.length];
    },
    stickerInset: 0.1,
  });
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
function animate(host, puzzle, move, done) {
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
    puzzle = build(code.value, game.size);
    code.removeAttribute("data-bad");
  } catch (err) {
    code.setAttribute("data-bad", "");
    $("write-status").textContent = `${err.message}`;
    return;
  }
  game.source = code.value;
  draw($("write-canvas"), puzzle);

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

// ── Solve ───────────────────────────────────────────────────────────────────

function startGame(scramble) {
  game.puzzle = build(game.source, game.size);
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
}

function renderMoves() {
  const host = $("play-moves");
  const vocabulary = game.puzzle.def.tokens;
  if (host.childElementCount !== vocabulary.length) {
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
    if (game.puzzle.def.tokens.includes(token)) {
      play(e.shiftKey ? `${token}'` : token);
      e.preventDefault();
    }
  });
}

init();
