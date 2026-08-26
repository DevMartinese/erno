/* ─────────────────────────────────────────────────────────────────────────
   The voyage: the chain taught in one screen, fluid end to end.

   Two panels, nothing else. The left is the sketch: code made of
   SEGMENTS, and a step adds one - it floats in soft and slightly
   blurred, neighbours glide aside, a replaced fragment crosses over in
   place. No typewriter. The right is the consequence: one continuous
   body - a cube blooms into a five, is carved down to a box, and a
   second cube slides in and welds on. Every step's code truly runs.

   Emil's rules throughout: strong ease-out entrances, blur to bridge
   what would otherwise read as two objects, nothing born at scale(0),
   transitions over keyframes, reduced motion keeps the opacity story.
   ───────────────────────────────────────────────────────────────────── */

import { rubik, alg, resetOutputs, takeOutputs } from "./chain.js";
import { storyOf, waves, screenDelta } from "./morph.js";
import { STEPS, sourceOf } from "./steps.js";
import { createSketch, swapText } from "./sketch.js";

const $ = (id) => document.getElementById(id);
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── The board ───────────────────────────────────────────────────────────────
//
// ONE CAMERA, for the whole voyage. Every board is drawn in the same
// world frame, so nothing is ever rescaled to fit: a 3x3 is small
// because it IS small, a five is bigger, the weld is bigger still, and
// the only thing that ever changes size on screen is the object itself.
// That single decision retires every reframe, settle and camera hold
// this page used to need - the coherent thing and the simple thing at
// once.

const state = { step: -1, gen: 0, shown: null };
const table = $("voyage-table");

const ghostLayer = document.createElement("div");
ghostLayer.className = "board-layer board-layer--ghost";
table.appendChild(ghostLayer);

const base = document.createElement("div");
base.className = "board-layer";
table.appendChild(base);

// The frame that holds every board this voyage builds, measured from the
// boards themselves rather than guessed.
const FRAME = (() => {
  let radius = 0;
  for (const spec of ["3", "5", "3x3x5", "3 + 3 @ 2,2,0"]) {
    const b = rubik(spec).board;
    if (b._viewSpheres)
      for (const s of b._viewSpheres)
        radius = Math.max(radius, Math.hypot(s.c[0], s.c[1], s.c[2]) + s.r);
    else radius = Math.max(radius, b.getRadius());
  }
  return { center: [0, 0, 0], radius: Math.ceil(radius * 20) / 20 };
})();

const tokenColour = (name, fallback) =>
  getComputedStyle(document.body).getPropertyValue(name).trim() || fallback;

// ── The hollows ─────────────────────────────────────────────────────────────
//
// A cube's grid is black because the plastic between its stickers is
// black, and that is the puzzle's face. But the SAME colour also paints
// the walls a missing cubie leaves behind, and there it reads as a pit:
// a carved board, a cube mid-assembly or a shell mid-growth turns into a
// dark mass and the voxels lose their depth. The engine tells the two
// apart - a wall with no sticker is marked `core` - so the page dresses
// only those: a warm recess, edged in ink so every absent cubie still
// shows its own shape. The grid never changes.
const mixHex = (a, b, t) => {
  const hex = (c) => {
    const v = c.replace("#", "");
    const n = v.length === 3 ? v.split("").map((x) => x + x).join("") : v;
    return [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16));
  };
  const [x, y] = [hex(a), hex(b)];
  return (
    "#" +
    x
      .map((v, i) => Math.round(v * (1 - t) + y[i] * t).toString(16).padStart(2, "0"))
      .join("")
  );
};
const HOLLOW_FILL = mixHex(tokenColour("--paper", "#f4efe7"), tokenColour("--ink", "#17110c"), 0.2);
const HOLLOW_EDGE = mixHex(tokenColour("--paper", "#f4efe7"), tokenColour("--ink", "#17110c"), 0.5);

const dressHollows = (svg) =>
  svg.replace(
    /(<polygon points="[^"]*" )fill="[^"]*" stroke="[^"]*"( stroke-width="0\.5" data-part="core")/g,
    (m, head, tail) => `${head}fill="${HOLLOW_FILL}" stroke="${HOLLOW_EDGE}"${tail}`,
  );

const svgOf = (value, extra = {}) =>
  dressHollows(
    value.board.toSVG({
      frame: FRAME,
      padding: 8,
      ...(value.veil ? { pieces: value.veil } : {}),
      ...extra,
    }),
  );

// The scaffold: the same board drawn as bare outlines - no body, no
// fills - so the cubies that have not arrived yet read as cubes instead
// of as a black absence. The board lends itself for one render and is
// handed back exactly as it was.
const GHOST_INK = tokenColour("--ink", "#17110c");
const GHOST_PAPER = tokenColour("--paper", "#f4efe7");

/**
 * The scaffold, in two dialects. Outside the body - a cube that has not
 * arrived, a shell that is leaving - it is drawn in INK under the board,
 * where paper is the backdrop. Inside the body - the hollow a missing
 * cubie leaves, which the mechanism honestly paints black - it is drawn
 * in PAPER over the board, so the cavity is lit by its own edges and
 * reads as cubes waiting rather than as a hole.
 */
function ghostSvg(value, pieces, lit) {
  const b = value.board;
  const plastic = b.plastic;
  const styleObj = b._styleObj;
  const styleFn = b._styleFn;
  b.plastic = "none";
  b._styleObj = {
    fill: "none",
    stroke: lit ? GHOST_PAPER : GHOST_INK,
    strokeWidth: lit ? 1.8 : 1.6,
    strokeOpacity: lit ? 0.55 : 0.32,
  };
  b._styleFn = null;
  const svg = b.toSVG({ frame: FRAME, padding: 8, ...(pieces ? { pieces } : {}) });
  b.plastic = plastic;
  b._styleObj = styleObj;
  b._styleFn = styleFn;
  return svg;
}

// THE SCAFFOLD BELONGS TO THE STEP THAT RAISED IT. Every act that raises
// one - a bloom, a peel, an assembly - can be cut short between the
// raising and the hiding, because a reader is allowed to click on through
// it, and the abort paths used to return with the outlines still standing.
// A stale scaffold is not a small blemish: the lit dialect draws in paper,
// ABOVE the board, so what stays behind is white scribble across whatever
// step came next, until some later step happens to hide it.
//
// So the generation owns the layer. A superseded step may neither raise
// nor hide - its hide would blank the scaffold the NEW step had already
// raised, which is the same bug wearing the other shoe - and a step that
// begins finds the stage clear, because `dropGhost` runs at every gen++.
function showGhost(svg, lit, gen) {
  if (gen !== state.gen) return;
  ghostLayer.classList.toggle("board-layer--lit", !!lit);
  ghostLayer.innerHTML = svg;
  ghostLayer.classList.add("is-arriving");
  void ghostLayer.offsetHeight;
  ghostLayer.classList.remove("is-arriving");
}

async function hideGhost(gen) {
  if (gen !== state.gen) return;
  if (!ghostLayer.innerHTML) return;
  ghostLayer.classList.add("is-arriving");
  await sleep(reduced ? 0 : 420);
  if (gen !== state.gen) return;
  ghostLayer.innerHTML = "";
  ghostLayer.classList.remove("is-arriving");
}

// A new step starts on a clear stage: whatever the last one had standing
// went stale the moment its generation ended, and it goes at once rather
// than fading, because the fade belonged to the step that is already over.
function dropGhost() {
  ghostLayer.innerHTML = "";
  ghostLayer.classList.remove("is-arriving", "board-layer--lit");
}

function drawValue(value) {
  base.innerHTML = svgOf(value);
  state.shown = value;
}

// A transient layer above the base: the moving half of every story.
function overlayWith(svg, klass) {
  const over = document.createElement("div");
  over.className = `board-layer board-layer--over ${klass || ""}`;
  over.innerHTML = svg;
  table.appendChild(over);
  void over.offsetHeight;
  return over;
}

async function veilSwap(fn, gen) {
  if (reduced || gen !== state.gen) {
    if (gen === state.gen) fn();
    return;
  }
  base.classList.add("is-veiled");
  await sleep(240);
  if (gen === state.gen) fn();
  base.classList.remove("is-veiled");
  await sleep(240);
}

// Two aligned renders crossfading in place: the repaint story.
async function crossfadeTo(svg, gen) {
  if (reduced || gen !== state.gen) {
    if (gen === state.gen) base.innerHTML = svg;
    return;
  }
  const over = overlayWith(svg, "is-arriving");
  over.classList.remove("is-arriving");
  base.classList.add("is-yielding");
  await sleep(660);
  over.remove();
  if (gen !== state.gen) {
    base.classList.remove("is-yielding");
    return;
  }
  base.style.transition = "none";
  base.innerHTML = svg;
  base.classList.remove("is-yielding");
  void base.offsetHeight;
  base.style.transition = "";
}

// ── The morph: one continuous body in one steady frame ──────────────────────
//
// WHAT changed between two boards is one question, and a set difference
// answers it. What STORY that change is, is another, and morph.js answers
// that one: a carve is not a growth, a body arriving is not a bloom, and a
// box squashing is not a death and a birth. Here we only play what it
// says, in the order it says - what leaves, then what travels, then what
// arrives - so the stage never carries two stories at once.

// One morph, one budget, however many stories it turns out to tell. A
// carve is a single act and takes its time; a box becoming a carved weld
// is four, and each one moves briskly - but the two take the SAME while,
// so clicking through the voyage has a pulse instead of a stall wherever
// the shape happens to change the most. Capped, so a lone act does not
// dawdle to fill a budget it has all to itself.
const MORPH_MS = 2600;
const actSlot = (n, budget = MORPH_MS) =>
  Math.max(420, Math.min(1150, budget / n));

// viewBox units are what the renderer speaks; CSS transforms want pixels.
// One layer on screen settles the exchange rate, and it is the same for
// every layer, because every layer is drawn in FRAME.
function unitPx() {
  const svg = base.querySelector("svg");
  if (!svg) return 1;
  const vb = (svg.getAttribute("viewBox") || "0 0 1 1").split(/\s+/).map(Number);
  const w = svg.getBoundingClientRect().width;
  return w && vb[2] ? w / vb[2] : 1;
}

const slidePx = (board, offset, reach = 1) => {
  const k = unitPx() * reach;
  const [dx, dy] = screenDelta(board, offset);
  return [dx * k, dy * k];
};

// A veiled value draws only the pieces that stand; every filter this file
// builds has to live inside that, not replace it.
const only = (value, pred) => ({
  pieces: value.veil ? (i) => value.veil(i) && pred(i) : pred,
});

/**
 * A layer travelling on a real vector, over a real duration.
 *
 * Emil's rules: one strong ease-out, a blur that resolves rather than a
 * pop, transitions over keyframes - and nothing born at scale(0). A body
 * that docks is full size the whole way in, because it is a body arriving
 * from somewhere, not an effect being played at us.
 */
async function glide(el, [dx, dy], arriving, span) {
  if (reduced) return;
  const away = `translate(${dx}px, ${dy}px)`;
  const home = "translate(0px, 0px)";
  el.style.transition = "none";
  el.style.transform = arriving ? away : home;
  el.style.opacity = arriving ? "0" : "1";
  el.style.filter = arriving ? "blur(3px)" : "blur(0px)";
  void el.offsetHeight;
  const fade = Math.round(span * 0.68);
  el.style.transition =
    `transform ${span}ms var(--ease-strong), opacity ${fade}ms ease-out, filter ${fade}ms ease-out`;
  el.style.transform = arriving ? home : away;
  el.style.opacity = arriving ? "1" : "0";
  el.style.filter = arriving ? "blur(0px)" : "blur(3px)";
  await sleep(span + 20);
}

// NOTHING IS EVER DRAWN NAKED. A piece rendered without its neighbours
// shows the dark plastic of its inner walls, and a body drawn alone is a
// black mass with no depth at all. So each half of a morph is composed
// rather than isolated:
//
//   what LEAVES is the outer shell, drawn over the body that stays,
//   already in its own colours - the shell's inner walls face inward,
//   away from the camera, so peeling it reveals a dressed cube;
//
//   what ARRIVES is drawn WITH everything already standing, in one
//   render, so the engine's own painter decides who hides whom - a second
//   body layered over its neighbour would cover it with the very wall the
//   neighbour is meant to hide, and layered under it would be covered by
//   that wall instead. Only one render can be right, and the mechanism is
//   the one that knows.
async function stackFade(renders, dir, span, gen) {
  if (reduced) return;
  // the tail is the last wave finishing its own fade; the stagger is what
  // is left, shared out among the waves
  const tail = Math.min(560, Math.round(span * 0.45));
  const stagger = Math.max(40, Math.round((span - tail) / Math.max(1, renders.length)));
  if (dir === "in") {
    const overs = [];
    for (const svg of renders) {
      if (gen !== state.gen) break;
      const over = overlayWith(svg, "is-arriving");
      overs.push(over);
      void over.offsetHeight;
      over.classList.remove("is-arriving");
      await sleep(stagger);
    }
    await sleep(tail);
    for (const over of overs) over.remove();
  } else {
    const overs = renders.map((svg) => overlayWith(svg, ""));
    for (let k = overs.length - 1; k >= 0; k--) {
      if (gen !== state.gen) break;
      overs[k].classList.add("is-yielding");
      await sleep(stagger);
    }
    await sleep(tail);
    for (const over of overs) over.remove();
  }
}

const heartOf = (points) => {
  if (!points.length) return [0, 0, 0];
  return [0, 1, 2].map((k) => points.reduce((s, p) => s + p[k], 0) / points.length);
};

/**
 * @param {number} [budget] - the whole morph's ms, shared out among its
 *   acts. A morph that is the POINT of a step gets the full one; a morph
 *   that is only setting the shape up for something else - the assembly in
 *   `reveal`, say - is handed a shorter one, so the step does not spend
 *   its welcome before its own content starts.
 */
async function morphTo(next, gen, budget) {
  const prev = state.shown;
  if (!prev || reduced) {
    await hideGhost(gen);
    drawValue(next);
    return;
  }

  const story = storyOf(prev.board, next.board);
  const atFrom = (i) => prev.board.pieces[i].slotPoint;
  const atTo = (i) => next.board.pieces[i].slotPoint;

  // Nothing came, went or moved. Either the colours changed - and one
  // aligned crossfade in place is the whole story - or nothing did.
  if (story.acts[0] === "repaint") {
    if (
      prev.board.getTints().join() === next.board.getTints().join() &&
      prev.board.getPosition() === next.board.getPosition() &&
      !prev.veil &&
      !next.veil
    ) {
      drawValue(next);
      return;
    }
    await crossfadeTo(svgOf(next), gen);
    if (gen === state.gen) state.shown = next;
    return;
  }

  const slot = actSlot(story.acts.length, budget);
  const undocked = new Set(story.undock ? story.undock.pieces : []);
  const docked = new Set(story.dock ? story.dock.pieces : []);
  const stayFrom = new Set(story.staying.map((p) => p.from));
  const stayTo = new Set(story.staying.map((p) => p.to));
  const shed = new Set(story.leaving.filter((i) => !undocked.has(i)));
  const grow = new Set(story.arriving.filter((i) => !docked.has(i)));

  // ── undock ────────────────────────────────────────────────────────────
  // A body the next board does not have at all does not dissolve in
  // place: it pulls away along the vector its own place names, and what
  // it was welded to is already standing behind it before it moves.
  if (story.undock) {
    base.innerHTML = svgOf(prev, only(prev, (i) => !undocked.has(i)));
    const over = overlayWith(svgOf(prev, only(prev, (i) => undocked.has(i))), "");
    await glide(over, slidePx(prev.board, story.undock.offset, 1.5), false, slot);
    over.remove();
    if (gen !== state.gen) return;
  }

  // ── subtract ──────────────────────────────────────────────────────────
  // The hollow is not revealed at the end behind a blink. It is already
  // there, under the piece, dressed as the warm recess it is - so the
  // piece lifts off it wave by wave and the cavity is simply uncovered.
  if (shed.size) {
    base.innerHTML = svgOf(prev, only(prev, (i) => stayFrom.has(i)));
    // The scaffold stays in its outdoor dialect - ink, under the board -
    // because the pieces it outlines are still ON SCREEN, fading on the
    // layers above. The lit dialect belongs to a cavity nothing is drawn
    // in yet (that is reveal's job); painted over a solid cubie it would
    // be paper scribbled across the piece.
    //
    // The hollow itself needs no help here. It is already in the base:
    // the survivors' inner walls come back from the mechanism marked
    // `core`, dressed as a warm recess, so the cavity is under the piece
    // the whole time and the peel simply uncovers it.
    showGhost(ghostSvg(prev, (i) => shed.has(i)), false, gen);
    const rounds = waves(
      [...shed].map((i) => ({ at: atFrom(i), idx: i })),
      { outward: false, heart: heartOf([...stayFrom].map(atFrom)) },
    );
    const gone = new Set();
    const renders = [];
    for (const w of rounds) {
      const still = new Set(gone);
      renders.push(svgOf(prev, only(prev, (i) => shed.has(i) && !still.has(i))));
      for (const idx of w) gone.add(idx);
    }
    renders.reverse(); // fullest shell on top, peeled away first
    await stackFade(renders, "out", slot, gen);
    await hideGhost(gen);
    if (gen !== state.gen) return;
  }

  // ── stretch ───────────────────────────────────────────────────────────
  // The survivors travel. Pieces that travel the same way travel together
  // - one layer, one vector, exactly the displacement the renderer would
  // have drawn - and they slide out of their old render into the new one
  // that is already waiting underneath.
  //
  // Waiting underneath, and VISIBLE: for the length of the slide each
  // traveller overlaps a copy of itself standing at the destination. The
  // alternative is to keep the movers out of the base until they land,
  // and that was measured: on a five becoming a box, 36 of the 42
  // survivors travel and the six that stay draw nothing at all, so the
  // base is an empty stage; on a box becoming a weld it is three quarters
  // bare plastic. An overlap the eye reads as motion beats a hole in the
  // middle of the board, and it is what the blur in `glide` is for -
  // Emil's bridge across what would otherwise read as two objects.
  const moving = story.staying.filter((p) => p.delta.some((v) => v !== 0));
  if (moving.length) {
    const groups = new Map();
    for (const p of moving) {
      const k = p.delta.join();
      if (!groups.has(k)) groups.set(k, { delta: p.delta, from: [] });
      groups.get(k).from.push(p.from);
    }
    base.innerHTML = svgOf(next, only(next, (i) => stayTo.has(i)));
    // A handful of groups is a squash you can follow. Twenty groups of one
    // piece each is a swarm, and it is what a cube becoming a BIGGER cube
    // looks like - every piece of the shell steps its own way. There the
    // motion worth showing is the bloom that follows, not the step.
    if (groups.size <= 8) {
      const overs = [];
      for (const g of groups.values()) {
        const set = new Set(g.from);
        overs.push(overlayWith(svgOf(prev, only(prev, (i) => set.has(i))), ""));
      }
      await Promise.all(
        [...groups.values()].map((g, k) =>
          glide(overs[k], slidePx(next.board, g.delta), false, slot),
        ),
      );
      for (const over of overs) over.remove();
    } else {
      const over = overlayWith(svgOf(prev, only(prev, (i) => stayFrom.has(i))), "");
      over.classList.add("is-yielding");
      await sleep(slot);
      over.remove();
    }
    if (gen !== state.gen) return;
  } else if (shed.size || story.undock) {
    base.innerHTML = svgOf(next, only(next, (i) => stayTo.has(i)));
  }

  // ── dock ──────────────────────────────────────────────────────────────
  // A whole body arrives, full size, on the vector its place names, over
  // the body it is about to be welded to. It is not a fade: you can see
  // where it came from.
  if (story.dock) {
    base.innerHTML = svgOf(next, only(next, (i) => !docked.has(i) && !grow.has(i)));
    const over = overlayWith(svgOf(next, only(next, (i) => docked.has(i))), "");
    await glide(over, slidePx(next.board, story.dock.offset, 1.5), true, slot);
    if (gen !== state.gen) {
      over.remove();
      return;
    }
    // land it in the base before letting the traveller go, so the weld
    // never blinks between the two renders
    base.innerHTML = svgOf(next, only(next, (i) => !grow.has(i)));
    void base.offsetHeight;
    over.remove();
  }

  // ── subdivide ─────────────────────────────────────────────────────────
  // New cuts inside a shell that is already standing: growth radiates
  // outward from what stands, and nothing arrives out of nowhere - the
  // scaffold shows the shape that is coming before it is filled.
  if (grow.size) {
    showGhost(ghostSvg(next, (i) => grow.has(i)), false, gen);
    const standing = new Set([...stayTo, ...docked]);
    const rounds = waves(
      [...grow].map((i) => ({ at: atTo(i), idx: i })),
      { outward: true, heart: heartOf([...standing].map(atTo)) },
    );
    const renders = [];
    for (const w of rounds) {
      for (const idx of w) standing.add(idx);
      const snap = new Set(standing);
      renders.push(svgOf(next, only(next, (i) => snap.has(i))));
    }
    await stackFade(renders, "in", slot, gen);
    if (gen !== state.gen) return;
    base.innerHTML = svgOf(next);
    await hideGhost(gen);
  }

  if (gen !== state.gen) return;
  base.innerHTML = svgOf(next);
  state.shown = next;
}

// Real turns, eased frame by frame, each a touch quicker than the last.
async function playTurns(value, seq, gen) {
  const board = value.board;
  const tokens = seq.split(/\s+/).filter(Boolean);
  let i = 0;
  for (const token of tokens) {
    if (gen !== state.gen) return;
    const ms = reduced ? 0 : Math.max(95, 260 * 0.94 ** i);
    if (ms) {
      const t0 = performance.now();
      await new Promise((done) => {
        const frame = (now) => {
          try {
            if (gen !== state.gen) return done();
            const t = Math.min(1, (now - t0) / ms);
            const progress = 1 - (1 - t) ** 3;
            base.innerHTML = svgOf(value, { turn: { move: token, progress } });
            if (t < 1) requestAnimationFrame(frame);
            else done();
          } catch (err) {
            console.error(err);
            done();
          }
        };
        requestAnimationFrame(frame);
      });
    }
    board.move(token);
    if (gen !== state.gen) return;
    base.innerHTML = svgOf(value);
    i++;
  }
  state.shown = value;
}

// The assembly: the whole cube stands outlined, and the pieces return to
// it one by one - you can see exactly what is being built.
async function reveal(value, gen) {
  const board = value.board;
  const held = new Set();
  board.pieces.forEach((piece, idx) => {
    if (piece.faces.filter((f) => f.letter).length < 2) held.add(idx);
  });
  const free = board.pieces.map((_, idx) => idx).filter((idx) => !held.has(idx));
  if (reduced) {
    drawValue(value);
    return;
  }
  const standing = new Set(held);
  showGhost(ghostSvg(value, (idx) => !standing.has(idx)), true, gen);
  await veilSwap(() => {
    base.innerHTML = svgOf(value, { pieces: (idx) => standing.has(idx) });
  }, gen);
  let i = 0;
  for (const idx of free) {
    if (gen !== state.gen) return;
    standing.add(idx);
    base.innerHTML = svgOf(value, { pieces: (id) => standing.has(id) });
    // the scaffold keeps only what is still missing
    const left = new Set(standing);
    ghostLayer.innerHTML = ghostSvg(value, (id) => !left.has(id), true);
    await sleep(Math.max(40, 95 * 0.95 ** i));
    i++;
  }
  await hideGhost(gen);
  state.shown = value;
}


const sketch = createSketch($("voyage-lines"), reduced);

// ── The step engine ─────────────────────────────────────────────────────────

function runSketch(src) {
  resetOutputs();
  const fn = new Function("rubik", "alg", "goal", "table", `"use strict";\n${src}`);
  fn(rubik, alg, "goal", "table");
  return takeOutputs();
}

async function goTo(step) {
  if (step < 0 || step >= STEPS.length || step === state.step) return;
  const gen = ++state.gen;
  dropGhost();
  state.step = step;
  const s = STEPS[step];

  // the numeral is the entry point; the name is its label
  const [numeral, ...rest] = s.title.split(" · ");
  $("voyage-num").textContent = numeral;
  $("voyage-title").textContent = rest.join(" · ");
  $("voyage-count").textContent = `${step + 1} / ${STEPS.length}`;
  [...$("voyage-dots").children].forEach((d, i) =>
    d.setAttribute("aria-current", String(i === step)),
  );
  $("voyage-prev").disabled = step === 0;
  $("voyage-next").disabled = step === STEPS.length - 1;
  swapText($("voyage-caption"), s.caption, reduced);
  $("voyage-verdict").style.opacity = "0";

  await sketch.renderLines(s.lines, gen);
  if (gen !== state.gen) return;

  const outs = runSketch(sourceOf(s));
  const tableValue = outs.get("table");
  const goalValue = outs.get("goal");

  const fx = s.fx || {};
  try {
    if (fx.reveal) {
      // The shape settles before the assembly starts. A step that reveals
      // is still arriving from whatever stood before it - and what stands
      // before this one is a WELD - so the body that is leaving pulls away
      // and the rest sheds down to a plain cube first. Without this the
      // only weld-to-cube crossing in the voyage is a hard cut hidden in a
      // 240ms veil, and the one story built for it never gets told.
      await morphTo(tableValue, gen, 1800);
      if (gen !== state.gen) return;
      await reveal(tableValue, gen);
    } else {
      const stage = fx.rest ? runSketch(fx.rest).get("table") : tableValue;
      await morphTo(stage, gen);
      if (gen !== state.gen) return;
      let seq = fx.seq;
      if (fx.seed !== undefined)
        seq = runSketch(fx.rest).get("table").board.scramble(18, fx.seed);
      if (seq) await playTurns(stage, seq, gen);
    }
  } catch (err) {
    console.error(err);
  }
  if (gen !== state.gen) return;

  drawValue(tableValue);
  const goalBox = $("voyage-goal");
  if (goalValue) {
    $("voyage-goal-art").innerHTML = dressHollows(
      goalValue.board.toSVG({ fitSphere: true, padding: 8 }),
    );
    if (goalBox.hidden) {
      goalBox.classList.add("is-entering");
      goalBox.hidden = false;
      void goalBox.offsetHeight;
      goalBox.classList.remove("is-entering");
    }
  } else goalBox.hidden = true;

  const verdict = s.read ? s.read(tableValue) : "";
  $("voyage-verdict").textContent = verdict || "";
  $("voyage-verdict").style.opacity = "1";
}

// ── Wiring ──────────────────────────────────────────────────────────────────

const dots = $("voyage-dots");
STEPS.forEach((s, i) => {
  const b = document.createElement("button");
  b.setAttribute("aria-label", s.title);
  b.addEventListener("click", () => goTo(i));
  dots.appendChild(b);
});

$("voyage-prev").addEventListener("click", () => goTo(state.step - 1));
$("voyage-next").addEventListener("click", () => goTo(state.step + 1));
window.addEventListener("keydown", (e) => {
  if (e.key === "ArrowRight" || e.key === " ") {
    e.preventDefault();
    goTo(state.step + 1);
  } else if (e.key === "ArrowLeft") {
    e.preventDefault();
    goTo(state.step - 1);
  }
});

goTo(0);
