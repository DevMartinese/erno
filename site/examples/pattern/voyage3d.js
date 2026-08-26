/* ─────────────────────────────────────────────────────────────────────────
   The voyage in glass: the same thirteen steps, on a WebGL stage.

   Everything the flat page decides, this page inherits - steps.js is the
   content, sketch.js the left panel, morph.js the stories, chain.js the
   language. What is new here is only HOW a story is played: pieces are
   meshes, an act is a field of per-voxel timelines, the scaffold is real
   edges, and the depth the flat stage composited its way around is simply
   there. Two doctrines carry over untouched - ONE CAMERA (scale is the
   object's, never the frame's) and the reader owning the angle - and one
   retires: "nothing is ever drawn naked" was the price of compositing
   independent SVGs, and a z-buffer does not charge it.
   ───────────────────────────────────────────────────────────────────── */

import { rubik, alg, resetOutputs, takeOutputs } from "./chain.js";
import { storyOf, waves } from "./morph.js";
import { STEPS, sourceOf } from "./steps.js";
import { createSketch, swapText } from "./sketch.js";
import { createTimeline, spring } from "animejs";

const $ = (id) => document.getElementById(id);
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── The stage ───────────────────────────────────────────────────────────────

// The one world frame, same numbers as the flat page: measured off the
// boards themselves, so a five is bigger than a three because it IS.
const FRAME = (() => {
  let radius = 0;
  for (const spec of ["3", "5", "3x3x5", "3 + 3 @ 2,2,0"]) {
    const b = rubik(spec).board;
    radius = Math.max(radius, b.getFrame({ fitSphere: true, padding: 0 }).halfWidth);
  }
  return { radius: Math.ceil(radius * 20) / 20, padding: 8 };
})();

const tokenColour = (name, fallback) =>
  getComputedStyle(document.body).getPropertyValue(name).trim() || fallback;
const mixHex = (a, b, t) => {
  const hx = (c) => {
    const v = c.replace("#", "");
    const n = v.length === 3 ? v.split("").map((x) => x + x).join("") : v;
    return [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16));
  };
  const [x, y] = [hx(a), hx(b)];
  return "#" + x.map((v, i) => Math.round(v * (1 - t) + y[i] * t).toString(16).padStart(2, "0")).join("");
};

const state = { step: -1, gen: 0, shown: null, board: null, cubie: "box" };
let view = null;
let HOLLOW = "#c8b7a0";
let INK = "#17110c";

async function boot() {
  INK = tokenColour("--ink", "#17110c");
  const paper = tokenColour("--paper", "#f4efe7");
  HOLLOW = mixHex(paper, INK, 0.2);
  const mod = await import("../../three-view.js");
  view = await mod.createStageView($("voyage-stage"), {
    frame: FRAME,
    background: paper,
    core: HOLLOW,
  });
}

const boardOptions = () => ({ cubie: state.cubie, core: HOLLOW });

// Every transient board is registered so an interrupted act can never
// leave one standing: the next step clears the stage before it begins.
const standing = new Set();
function addBoard(value) {
  const b = view.stage.add(value.board, boardOptions());
  if (value.veil) b.visible((i) => value.veil(i));
  standing.add(b);
  return b;
}
function dropBoard(b) {
  if (!b) return;
  b.remove();
  standing.delete(b);
}
function clearStage() {
  for (const b of [...standing]) dropBoard(b);
  state.board = null;
}

// ── Tweens: fields of per-voxel timelines ───────────────────────────────────
//
// waves() already orders pieces by distance from the heart; here a wave
// index stops being a discrete render and becomes a DELAY, so every voxel
// runs its own continuous timeline and a build reads as one fluid act
// instead of a staggered fade. That single change is most of what "in
// glass" means.

const easeOut = (t) => 1 - (1 - t) ** 3;

function tween(span, gen, frame) {
  return new Promise((done) => {
    if (reduced || span <= 0) {
      frame(1);
      view.render();
      return done();
    }
    const t0 = performance.now();
    const step = (now) => {
      if (gen !== state.gen) return done();
      const t = Math.min(1, (now - t0) / span);
      frame(t);
      view.render();
      if (t < 1) requestAnimationFrame(step);
      else done();
    };
    requestAnimationFrame(step);
  });
}

/** Per-voxel delays from wave rounds: wave k starts at k*gap, runs `dur`. */
function delaysOf(rounds, span) {
  const n = Math.max(1, rounds.length);
  const dur = Math.max(0.45, 1 / n);
  const gap = n > 1 ? (1 - dur) / (n - 1) : 0;
  const delay = new Map();
  rounds.forEach((wave, k) => {
    for (const idx of wave) delay.set(idx, k * gap);
  });
  return { delay, dur };
}

const heartOf = (points) => {
  if (!points.length) return [0, 0, 0];
  return [0, 1, 2].map((k) => points.reduce((s, p) => s + p[k], 0) / points.length);
};

// A voxel arrives full size on its own radial vector and settles - Emil's
// rules kept whole (nothing born at scale(0), one strong ease-out) - and
// leaves the same way, played backwards.
const AWAY = 1.15;
const radial = (at, heart) => {
  const d = [at[0] - heart[0], at[1] - heart[1], at[2] - heart[2]];
  const len = Math.hypot(...d) || 1;
  return d.map((v) => (v / len) * AWAY);
};

// ── The morph, per act ──────────────────────────────────────────────────────

const MORPH_MS = 2600; // ceiling for the one shared clock

// Emil's assignment, by rule rather than by taste-of-the-day:
//   what ENTERS or LEAVES gets the strong ease-out - the eye is watching
//   the first millisecond hardest, so the motion must be there already;
//   what TRAVELS across the screen gets the strong ease-in-out - a thing
//   already on stage accelerates and brakes like a thing with mass;
//   what SETTLES gets a spring - a landing has no fixed duration, it has
//   physics, and a spring keeps its velocity if the reader interrupts it.
const EASE_ENTER = [0.23, 1, 0.32, 1];
const EASE_TRAVEL = [0.77, 0, 0.175, 1];
const EASE_SETTLE = spring({ mass: 1, stiffness: 130, damping: 15 });

async function morphTo(next, gen, budget) {
  const prev = state.shown;
  if (!prev || reduced) {
    clearStage();
    state.board = addBoard(next);
    state.shown = next;
    view.render();
    return;
  }

  const story = storyOf(prev.board, next.board);
  const atFrom = (i) => prev.board.pieces[i].slotPoint;
  const atTo = (i) => next.board.pieces[i].slotPoint;

  if (story.acts[0] === "repaint") {
    if (
      prev.board.getTints().join() === next.board.getTints().join() &&
      prev.board.getPosition() === next.board.getPosition() &&
      !prev.veil &&
      !next.veil
    ) {
      clearStage();
      state.board = addBoard(next);
      state.shown = next;
      view.render();
      return;
    }
    // THE PAINT SWEEPS. Nothing came, went or moved - only the colours -
    // so a whole-board dissolve reads as a new cube arriving, which is
    // exactly the story this is not. Instead each voxel flips in its own
    // quick crossfade, staggered outward from the heart: the repaint runs
    // over the cube the way the paint function ran over its cubies.
    const a = state.board;
    const b = addBoard(next);
    b.meshes.forEach((_, i) => b.opacity(i, 0));
    const all = next.board.pieces.map((_, i) => i);
    const rounds = waves(
      all.map((i) => ({ at: atTo(i), idx: i })),
      { outward: true, heart: [0, 0, 0] },
    );
    const { delay, dur } = delaysOf(rounds, 900);
    await tween(900, gen, (t) => {
      for (const i of all) {
        const local = Math.max(0, Math.min(1, (t - delay.get(i)) / dur));
        const e = easeOut(local);
        b.opacity(i, e);
        if (a && a.meshes[i]) a.opacity(i, 1 - e);
      }
    });
    dropBoard(a);
    if (gen !== state.gen) return;
    state.board = b;
    state.shown = next;
    view.render();
    return;
  }

  const undocked = new Set(story.undock ? story.undock.pieces : []);
  const docked = new Set(story.dock ? story.dock.pieces : []);
  const stayFrom = new Set(story.staying.map((p) => p.from));
  const stayTo = new Set(story.staying.map((p) => p.to));
  const shed = new Set(story.leaving.filter((i) => !undocked.has(i)));
  const grow = new Set(story.arriving.filter((i) => !docked.has(i)));

  // ── ONE TIMELINE, PHASES OVERLAPPED ─────────────────────────────────────
  //
  // The acts used to run in series with hard borders - leave, THEN travel,
  // THEN cross, THEN dock, THEN sprout - and every border was a dead beat
  // the eye read as a stutter. A mutation is one event: so it plays as one
  // tween, each phase owning a window that starts while the previous one
  // is still landing. The stories and their order are morph.js' word,
  // unchanged; only the clock is shared now.
  const a = state.board;

  const phases = [];
  if (story.undock && a) phases.push("undock");
  if (shed.size && a) phases.push("subtract");
  phases.push("stretch"); // even with no movers: the cross-over lives here
  if (story.dock) phases.push("dock");
  if (grow.size) phases.push("subdivide");
  // ── the clock is anime's now ────────────────────────────────────────────
  //
  // One timeline per morph. Every phase is added at an absolute time and
  // OVERLAPS the one before it, so a mutation reads as one continuous
  // event; every voxel is its own tween inside the phase, delayed by the
  // wave it rides. The curves are Emil's, by rule: EASE_ENTER for what
  // appears or leaves, EASE_TRAVEL for what crosses the stage, EASE_SETTLE
  // (a spring) for what lands.
  const DUR = { leave: 300, travel: 460, cross: 240 };
  const SPREAD = { leave: 480, grow: 640 }; // how long a wave takes to ripple

  // the next board arrives fully prepared and fully hidden
  const b = addBoard(next);
  const bVis = new Set();
  b.visible((i) => bVis.has(i));
  const offDock = story.dock ? story.dock.offset.map((v) => v * 1.5) : null;
  if (story.dock) for (const i of docked) b.offset(i, offDock);
  const offU = story.undock ? story.undock.offset.map((v) => v * 1.5) : null;
  state.board = b;

  // ── per-phase preparation, all before the clock starts ─────────────────
  let shedField = null;
  if (shed.size && a) {
    const heart = heartOf([...stayFrom].map(atFrom));
    const lo = [Infinity, Infinity, Infinity];
    const hi = [-Infinity, -Infinity, -Infinity];
    for (const i of stayFrom) {
      const q = atFrom(i);
      for (const k of [0, 1, 2]) {
        lo[k] = Math.min(lo[k], q[k]);
        hi[k] = Math.max(hi[k], q[k]);
      }
    }
    // a piece OUTSIDE the survivors' box is a slab coming off the end: it
    // slides off along that axis, all of one mind; a piece inside (a carved
    // centre) lifts on its own radial vector
    const wayOut = (q) => {
      let axis = -1;
      let most = 0.5;
      for (const k of [0, 1, 2]) {
        const over = q[k] > hi[k] ? q[k] - hi[k] : q[k] < lo[k] ? q[k] - lo[k] : 0;
        if (Math.abs(over) > most) {
          most = Math.abs(over);
          axis = k * 2 + (over > 0 ? 0 : 1);
        }
      }
      if (axis < 0) return null;
      const v = [0, 0, 0];
      v[axis >> 1] = (axis % 2 === 0 ? 1 : -1) * AWAY * 1.6;
      return v;
    };
    const rounds = waves(
      [...shed].map((i) => ({ at: atFrom(i), idx: i })),
      { outward: false, heart },
    );
    shedField = {
      ...delaysOf(rounds, 1),
      dir: new Map([...shed].map((i) => [i, wayOut(atFrom(i)) || radial(atFrom(i), heart)])),
    };
  }

  const movers = story.staying.filter((p) => p.delta.some((v) => v !== 0));

  let growField = null;
  if (grow.size) {
    const standingSet = new Set([...stayTo, ...docked]);
    const heart = heartOf([...standingSet].map(atTo));
    const rounds = waves(
      [...grow].map((i) => ({ at: atTo(i), idx: i })),
      { outward: true, heart },
    );
    growField = {
      ...delaysOf(rounds, 1),
      dir: new Map([...grow].map((i) => [i, radial(atTo(i), heart)])),
    };
    for (const i of grow) b.opacity(i, 0);
  }

  // ── the timeline ────────────────────────────────────────────────────────
  const scale = budget !== undefined ? Math.max(0.5, budget / MORPH_MS) : 1;
  const ms = (v) => v * scale;
  let finish = null;
  const tl = createTimeline({
    autoplay: false,
    onUpdate: () => {
      // a superseded generation cancels its own clock and still resolves,
      // so the cleanup below always runs and no board outlives its story
      if (gen !== state.gen) {
        tl.cancel();
        if (finish) finish();
        return;
      }
      view.render();
    },
    onComplete: () => {
      if (finish) finish();
    },
  });
  let cursor = 0;
  const OVERLAP = 0.45;
  const phaseLen = { undock: ms(DUR.travel), subtract: ms(SPREAD.leave + DUR.leave), stretch: ms(DUR.travel + DUR.cross), dock: ms(DUR.travel), subdivide: ms(SPREAD.grow + DUR.leave) };
  const startOf = new Map();
  for (const ph of phases) {
    startOf.set(ph, cursor);
    cursor += phaseLen[ph] * (1 - OVERLAP);
  }

  if (story.undock && a) {
    const o = { e: 0 };
    tl.add(o, {
      e: 1,
      duration: ms(DUR.travel),
      ease: EASE_TRAVEL,
      onUpdate: () => {
        for (const i of undocked) {
          a.offset(i, [offU[0] * o.e, offU[1] * o.e, offU[2] * o.e]);
          a.opacity(i, 1 - o.e);
        }
      },
    }, startOf.get("undock"));
  }

  if (shedField && a) {
    for (const i of shed) {
      const o = { e: 0 };
      const d = shedField.dir.get(i);
      tl.add(o, {
        e: 1,
        duration: ms(DUR.leave),
        ease: EASE_ENTER,
        onUpdate: () => {
          a.offset(i, [d[0] * o.e, d[1] * o.e, d[2] * o.e]);
          a.opacity(i, 1 - o.e);
        },
      }, startOf.get("subtract") + shedField.delay.get(i) * ms(SPREAD.leave));
    }
  }

  {
    const t0 = startOf.get("stretch");
    if (a && movers.length) {
      const o = { e: 0 };
      tl.add(o, {
        e: 1,
        duration: ms(DUR.travel),
        ease: EASE_TRAVEL,
        onUpdate: () => {
          for (const p of movers)
            a.offset(p.from, [p.delta[0] * o.e, p.delta[1] * o.e, p.delta[2] * o.e]);
        },
      }, t0);
    }
    // the cross-over rides the tail of the travel: the new board fades up
    // through the settling travellers, piece for piece in place
    const c = { e: 0 };
    tl.add(c, {
      e: 1,
      duration: ms(DUR.cross),
      ease: EASE_ENTER,
      onBegin: () => {
        for (const i of stayTo) {
          bVis.add(i);
          b.opacity(i, 0);
        }
        b.visible((i) => bVis.has(i));
      },
      onUpdate: () => {
        for (const i of stayTo) b.opacity(i, c.e);
        if (a) for (const p of story.staying) a.opacity(p.from, 1 - c.e);
      },
    }, t0 + (a && movers.length ? ms(DUR.travel) * 0.6 : 0));
  }

  if (story.dock) {
    const o = { e: 0 };
    tl.add(o, {
      e: 1,
      duration: ms(DUR.travel),
      ease: EASE_TRAVEL,
      onBegin: () => {
        for (const i of docked) bVis.add(i);
        b.visible((i) => bVis.has(i));
      },
      onUpdate: () => {
        for (const i of docked) {
          b.offset(i, [offDock[0] * (1 - o.e), offDock[1] * (1 - o.e), offDock[2] * (1 - o.e)]);
          b.opacity(i, Math.min(1, o.e * 1.6));
        }
      },
    }, startOf.get("dock"));
  }

  let wire = null;
  const landedSet = new Set();
  if (growField) {
    const t0 = startOf.get("subdivide");
    const raise = { e: 0 };
    tl.add(raise, {
      e: 1,
      duration: 1,
      onBegin: () => {
        wire = b.wireframe({ color: INK, opacity: 0.3 });
        wire.visible((i) => grow.has(i));
        for (const i of grow) {
          bVis.add(i);
          b.opacity(i, 0);
        }
        b.visible((i) => bVis.has(i));
      },
    }, t0);
    for (const i of grow) {
      const o = { e: 0 };
      const d = growField.dir.get(i);
      tl.add(o, {
        e: 1,
        ease: EASE_SETTLE,
        onUpdate: () => {
          b.offset(i, [d[0] * (1 - o.e), d[1] * (1 - o.e), d[2] * (1 - o.e)]);
          b.opacity(i, Math.min(1, o.e * 1.8));
        },
        // the scaffold gives up each voxel the moment it lands
        onComplete: () => {
          landedSet.add(i);
          if (wire) wire.visible((k) => grow.has(k) && !landedSet.has(k));
        },
      }, t0 + growField.delay.get(i) * ms(SPREAD.grow));
    }
  }

  if (reduced) {
    tl.seek(tl.duration);
    view.render();
  } else {
    await new Promise((done) => {
      finish = done;
      tl.play();
    });
  }

  // The board is normalized BEFORE the generation check: a cancelled morph
  // must not leave b half-hidden and half-transparent, because the very
  // next morph inherits b as its starting board and trusts it to be whole.
  // Every line here is idempotent and local, so running it for a
  // superseded story costs nothing.
  if (wire) wire.dispose();
  if (a) dropBoard(a);
  for (const i of docked) b.offset(i, null);
  for (const i of grow) b.offset(i, null);
  for (const p of movers) if (stayTo.has(p.to)) b.offset(p.to, null);
  b.meshes.forEach((_, i) => b.opacity(i, 1));
  b.visible(next.veil ? (i) => next.veil(i) : null);
  if (gen !== state.gen) return;
  state.shown = next;
  view.render();
}

// ── Turns, real, eased frame by frame ───────────────────────────────────────

async function playTurns(value, seq, gen) {
  const board = state.board;
  const tokens = seq.split(/\s+/).filter(Boolean);
  let i = 0;
  for (const token of tokens) {
    if (gen !== state.gen) return;
    const ms = reduced ? 0 : Math.max(95, 260 * 0.94 ** i);
    if (ms)
      await tween(ms, gen, (t) => {
        board.turn({ move: token, progress: easeOut(t) });
      });
    value.board.move(token);
    if (gen !== state.gen) return;
    board.turn(null);
    view.render();
    i++;
  }
  state.shown = value;
}

// ── The assembly: voxels return to a lit scaffold, one by one ───────────────

async function reveal(value, gen) {
  // The board the morph just settled is REUSED, never blinked away: the
  // free pieces melt into their own wireframe and only then return, so
  // weld-to-cube reads as one continuous act instead of a cut hidden
  // between two functions.
  let b = state.board;
  if (!b || state.shown !== value) {
    clearStage();
    b = addBoard(value);
    state.board = b;
  }
  const board = value.board;
  const held = new Set();
  board.pieces.forEach((piece, idx) => {
    if (piece.faces.filter((f) => f.letter).length < 2) held.add(idx);
  });
  const free = board.pieces.map((_, idx) => idx).filter((idx) => !held.has(idx));
  if (reduced) {
    state.shown = value;
    view.render();
    return;
  }
  const heart = [0, 0, 0];
  const wire = b.wireframe({ color: INK, opacity: 0.3 });
  const landed = new Set(held);
  wire.visible((i) => !landed.has(i));
  // the melt: what is about to be rebuilt dissolves into its own outline
  await tween(360, gen, (t) => {
    const e = easeOut(t);
    for (const i of free) b.opacity(i, 1 - e);
  });
  if (gen !== state.gen) {
    wire.dispose();
    return;
  }
  b.visible((i) => held.has(i));
  const per = Math.max(60, 130 * 0.96 ** free.length);
  const span = free.length * per * 0.4 + 420;
  const dir = new Map(free.map((i) => [i, radial(board.pieces[i].slotPoint, heart)]));
  const delay = new Map(free.map((i, k) => [i, (k / free.length) * 0.82]));
  for (const i of free) b.opacity(i, 0);
  b.visible((i) => held.has(i) || free.includes(i));
  await tween(span, gen, (t) => {
    for (const i of free) {
      const local = Math.max(0, Math.min(1, (t - delay.get(i)) / 0.18));
      const e = easeOut(local);
      const d = dir.get(i);
      b.offset(i, [d[0] * (1 - e), d[1] * (1 - e), d[2] * (1 - e)]);
      b.opacity(i, Math.min(1, local * 2));
      if (local >= 1) landed.add(i);
    }
    wire.visible((k) => !landed.has(k));
  });
  wire.dispose();
  if (gen !== state.gen) return;
  for (const i of free) b.offset(i, null);
  b.visible(null);
  state.shown = value;
  view.render();
}

// ── The goal inset: a still picture, so it stays SVG ────────────────────────

const dressHollows = (svg) =>
  svg.replace(
    /(<polygon points="[^"]*" )fill="[^"]*" stroke="[^"]*"( stroke-width="0\.5" data-part="core")/g,
    (m, head, tail) =>
      `${head}fill="${HOLLOW}" stroke="${mixHex(tokenColour("--paper", "#f4efe7"), INK, 0.5)}"${tail}`,
  );


// What the fx stage last played, so the next step can CONTINUE the cube
// instead of resetting it: same rest and a sequence that extends what has
// already been played means the board on screen is this story a few turns
// behind, and only the remainder is owed. rubik().turn("R") into
// .turn("R U R' U'") mutates on from the R; nothing rewinds to solved.
const played = { rest: null, seq: "" };

const tokensOf = (s) => String(s || "").split(/\s+/).filter(Boolean);

function continuation(rest, seq) {
  if (!rest || played.rest !== rest) return null;
  const done = tokensOf(played.seq);
  const want = tokensOf(seq);
  if (!done.length || want.length <= done.length) return null;
  if (want.slice(0, done.length).join(" ") !== done.join(" ")) return null;
  return { prefix: done, suffix: want.slice(done.length).join(" ") };
}

// ── The step engine ─────────────────────────────────────────────────────────

const sketch = createSketch($("voyage-lines"), reduced);

function runSketch(src) {
  resetOutputs();
  const fn = new Function("rubik", "alg", "goal", "table", `"use strict";\n${src}`);
  fn(rubik, alg, "goal", "table");
  return takeOutputs();
}

async function goTo(step) {
  if (step < 0 || step >= STEPS.length || step === state.step) return;
  const gen = ++state.gen;
  state.step = step;
  const s = STEPS[step];

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
    if (!fx.rest) {
      // a step with no fx stage tells some other story: the trail ends here
      played.rest = null;
      played.seq = "";
    }
    if (fx.reveal) {
      await morphTo(tableValue, gen, 1800);
      if (gen !== state.gen) return;
      await reveal(tableValue, gen);
    } else {
      const stage = fx.rest ? runSketch(fx.rest).get("table") : tableValue;
      let seq = fx.seq;
      if (fx.seed !== undefined)
        seq = runSketch(fx.rest).get("table").board.scramble(18, fx.seed);
      const cont = continuation(fx.rest, seq);
      if (cont) {
        // the standing board already shows the prefix played: plant the
        // stage at that same position - an invisible exchange, the two
        // draw the same picture - and keep mutating from there
        for (const t of cont.prefix) stage.board.move(t);
        clearStage();
        state.board = addBoard(stage);
        state.shown = stage;
        view.render();
        await playTurns(stage, cont.suffix, gen);
      } else {
        await morphTo(stage, gen);
        if (gen !== state.gen) return;
        if (seq) await playTurns(stage, seq, gen);
      }
      if (gen === state.gen) {
        played.rest = fx.rest || null;
        played.seq = seq || "";
      }
    }
  } catch (err) {
    console.error(err);
  }
  if (gen !== state.gen) return;

  // land the true value: one board, whole, no leftovers
  clearStage();
  state.board = addBoard(tableValue);
  state.shown = tableValue;
  view.render();

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

// ── Orbit: the reader owns the angle, the page never moves it ───────────────

function wireOrbit() {
  const el = $("voyage-stage");
  let drag = null;
  el.addEventListener("pointerdown", (e) => {
    const a = view.angle;
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, angle: a.angle, pitch: a.pitch };
    el.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  el.addEventListener("pointermove", (e) => {
    if (!drag || drag.id !== e.pointerId) return;
    view.aim(
      drag.angle + (e.clientX - drag.x) * 0.45,
      Math.max(-72, Math.min(72, drag.pitch + (e.clientY - drag.y) * 0.35)),
    );
    view.render();
  });
  const drop = (e) => {
    if (drag && drag.id === e.pointerId) drag = null;
  };
  el.addEventListener("pointerup", drop);
  el.addEventListener("pointercancel", drop);
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
$("voyage-cubie").addEventListener("input", () => {
  state.cubie = $("voyage-cubie").value;
  // redraw the standing value in the new dress; the story is not replayed
  if (state.shown) {
    clearStage();
    state.board = addBoard(state.shown);
    view.render();
  }
});

boot()
  .then(() => {
    wireOrbit();
    goTo(0);
  })
  .catch((err) => {
    // No WebGL: the page says so and points at its flat twin, which tells
    // the same voyage without asking the GPU for anything.
    console.error(err);
    $("voyage-stage").hidden = true;
    const note = $("voyage-refuse");
    note.hidden = false;
    note.innerHTML =
      "This route needs WebGL, and the browser said no. " +
      'The <a href="./chain.html">flat version</a> tells the same voyage.';
  });
