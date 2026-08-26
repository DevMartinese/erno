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

const MORPH_MS = 2600;
const actSlot = (n, budget = MORPH_MS) => Math.max(420, Math.min(1150, budget / n));

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
    // two boards, opacity crossed: the same object in both hands
    const a = state.board;
    const b = addBoard(next);
    b.meshes.forEach((_, i) => b.opacity(i, 0));
    await tween(660, gen, (t) => {
      const e = easeOut(t);
      b.meshes.forEach((_, i) => b.opacity(i, e));
      if (a) a.meshes.forEach((_, i) => a.opacity(i, 1 - e));
    });
    dropBoard(a);
    if (gen !== state.gen) return;
    state.board = b;
    state.shown = next;
    view.render();
    return;
  }

  const slot = actSlot(story.acts.length, budget);
  const undocked = new Set(story.undock ? story.undock.pieces : []);
  const docked = new Set(story.dock ? story.dock.pieces : []);
  const stayFrom = new Set(story.staying.map((p) => p.from));
  const stayTo = new Set(story.staying.map((p) => p.to));
  const shed = new Set(story.leaving.filter((i) => !undocked.has(i)));
  const grow = new Set(story.arriving.filter((i) => !docked.has(i)));

  const a = state.board;

  // ── undock: a whole body pulls away on the vector its place names ──────
  if (story.undock && a) {
    const off = story.undock.offset.map((v) => v * 1.5);
    await tween(slot, gen, (t) => {
      const e = easeOut(t);
      for (const i of undocked) {
        a.offset(i, [off[0] * e, off[1] * e, off[2] * e]);
        a.opacity(i, 1 - e);
      }
    });
    if (gen !== state.gen) return;
    a.visible((i) => !undocked.has(i) && (!prev.veil || prev.veil(i)));
  }

  // ── subtract: voxels leave the way they would really come off ──────────
  //
  // A piece that stands OUTSIDE the survivors' box is a slab being taken
  // off the end, and it slides off along that axis - all of one mind, the
  // way a lid comes off - because a radial scatter there reads as an
  // explosion, not a cut. A piece INSIDE the survivors (a carved centre)
  // keeps the radial lift: there is no lid axis to speak of.
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
    const wayOut = (q) => {
      let axis = -1;
      let most = 0.5; // half a slot of overflow before it counts as a lid
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
    const { delay, dur } = delaysOf(rounds, slot);
    const dir = new Map(
      [...shed].map((i) => [i, wayOut(atFrom(i)) || radial(atFrom(i), heart)]),
    );
    await tween(slot, gen, (t) => {
      for (const i of shed) {
        const local = Math.max(0, Math.min(1, (t - delay.get(i)) / dur));
        const e = easeOut(local);
        const d = dir.get(i);
        a.offset(i, [d[0] * e, d[1] * e, d[2] * e]);
        a.opacity(i, 1 - e);
      }
    });
    if (gen !== state.gen) return;
  }

  // ── stretch: the survivors travel their real vectors ───────────────────
  //
  // ONE BODY, MUTATING. The travellers are the OLD board's meshes, wearing
  // the colours they stood in, walking their own vectors to where the new
  // board wants them - and only once they stand still does the new board
  // cross over them, in place. The other order (new board first, then the
  // travel) put next step's colours on pieces still mid-flight, and the
  // voyage read as a parade of different cubes instead of one cube living
  // through its own story.
  const moving = story.staying.filter((p) => p.delta.some((v) => v !== 0));
  const b = addBoard(next);
  // The new board arrives INVISIBLE: the dock body parked at its full
  // arrival offset, everything else waiting for the cross-over.
  if (story.dock) {
    const off = story.dock.offset.map((v) => v * 1.5);
    for (const i of docked) {
      b.offset(i, off);
      b.opacity(i, 0);
    }
  }
  b.visible(() => false);
  state.board = b;
  if (moving.length && a) {
    await tween(slot, gen, (t) => {
      const e = easeOut(t);
      for (const p of moving)
        a.offset(p.from, [p.delta[0] * e, p.delta[1] * e, p.delta[2] * e]);
    });
    if (gen !== state.gen) return;
  }
  // the cross-over: the settled travellers and the new board share every
  // point, so the exchange is invisible when nothing repainted and a quick
  // fade where something did
  b.visible((i) => stayTo.has(i) || docked.has(i));
  if (a) {
    for (const i of stayTo) b.opacity(i, 0);
    await tween(reduced ? 0 : 240, gen, (t) => {
      for (const i of stayTo) b.opacity(i, t);
    });
    if (gen !== state.gen) return;
    for (const i of stayTo) b.opacity(i, 1);
    dropBoard(a);
  }

  // ── dock: a whole body arrives, full size, on its own vector ───────────
  if (story.dock) {
    const off = story.dock.offset.map((v) => v * 1.5);
    await tween(slot, gen, (t) => {
      const e = easeOut(t);
      for (const i of docked) {
        b.offset(i, [off[0] * (1 - e), off[1] * (1 - e), off[2] * (1 - e)]);
        b.opacity(i, Math.min(1, e * 1.6));
      }
    });
    if (gen !== state.gen) return;
    for (const i of docked) b.offset(i, null);
  }

  // ── subdivide: the scaffold shows what is coming, then voxels settle ───
  if (grow.size) {
    const standingSet = new Set([...stayTo, ...docked]);
    const heart = heartOf([...standingSet].map(atTo));
    const rounds = waves(
      [...grow].map((i) => ({ at: atTo(i), idx: i })),
      { outward: true, heart },
    );
    const wire = b.wireframe({ color: INK, opacity: 0.3 });
    wire.visible((i) => grow.has(i));
    const { delay, dur } = delaysOf(rounds, slot);
    const dir = new Map([...grow].map((i) => [i, radial(atTo(i), heart)]));
    const landed = new Set();
    b.visible((i) => standingSet.has(i) || grow.has(i));
    for (const i of grow) b.opacity(i, 0);
    await tween(slot * 1.25, gen, (t) => {
      for (const i of grow) {
        const local = Math.max(0, Math.min(1, (t - delay.get(i)) / dur));
        const e = easeOut(local);
        const d = dir.get(i);
        b.offset(i, [d[0] * (1 - e), d[1] * (1 - e), d[2] * (1 - e)]);
        b.opacity(i, Math.min(1, local * 1.8));
        if (local >= 1) landed.add(i);
        wire.visible((k) => grow.has(k) && !landed.has(k));
      }
    });
    wire.dispose();
    if (gen !== state.gen) return;
    for (const i of grow) b.offset(i, null);
  }

  if (gen !== state.gen) return;
  b.visible(next.veil ? (i) => next.veil(i) : null);
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
    if (fx.reveal) {
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
