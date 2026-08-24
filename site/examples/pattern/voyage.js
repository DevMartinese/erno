/* ─────────────────────────────────────────────────────────────────────────
   The voyage: the chain taught in one screen.

   Two panels. The left is the sketch, growing and refined step by step -
   lines type themselves in, edits happen at the common prefix, retired
   lines collapse away. The right is the consequence: the real board,
   settling between framings, crossfading aligned shells, playing turns,
   assembling piece by piece. Nothing is a recording: every step's code
   runs against the engine when it lands.

   Hand-rolled on Emil Kowalski's rules: strong ease-out for entrances,
   blur to mask the crossfade, nothing born at scale(0), transitions over
   keyframes, and reduced motion keeps the opacity story only.
   ───────────────────────────────────────────────────────────────────── */

import { rubik, alg, resetOutputs, takeOutputs } from "./chain.js";

const $ = (id) => document.getElementById(id);
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── The steps ───────────────────────────────────────────────────────────────

const HALVES = 'const halves = (x, y, z) => y > 0 ? "B" : "F"';
const SEXY6 = "R U R' U' ".repeat(6).trim();

const STEPS = [
  {
    title: "i · a cube exists",
    caption: "One source word. The defaults are the healthy object: whole, at rest, classic colours.",
    lines: ["rubik().out()"],
    fx: {},
    read: (t) => `${t.board.pieces.length} pieces, whole and at rest.`,
  },
  {
    title: "ii · it turns",
    caption: "A link joins the chain. The string is the notation cubers already write.",
    lines: ['rubik().turn("R").out()'],
    fx: { rest: "rubik().out()", seq: "R" },
    read: (t) => `${t.moves()} move made.`,
  },
  {
    title: "iii · the string grows",
    caption: "The link is edited, not replaced: four turns cubers call the sexy move.",
    lines: [`rubik().turn("R U R' U'").out()`],
    fx: { rest: "rubik().out()", seq: "R U R' U'" },
    read: (t) => `${t.moves()} moves made.`,
  },
  {
    title: "iv · the algebra declares",
    caption: "alg() studies a sequence without turning anything. Its order is a theorem; watch it walk home.",
    lines: ['const sexy = alg("[R, U]")', "rubik().turn(sexy.times(6)).out()"],
    fx: { rest: "rubik().out()", seq: SEXY6 },
    read: () => `alg("[R, U]").order = ${alg("[R, U]").order}: six rounds close the loop.`,
  },
  {
    title: "v · paint rides upstream",
    caption: "A link inserted above repaints everything below: the chain is a pipeline, and now you can see it.",
    lines: [HALVES, "", "rubik().paint(halves).out()"],
    fx: {},
    read: (t) => "The paint runs once per sticker, on the sound cube: two colours, still a working puzzle.",
  },
  {
    title: "vi · carve",
    caption: "Holes are real: the absences are piece-shaped and they travel under turns.",
    lines: [HALVES, "", 'rubik().paint(halves).carve("centers").out()'],
    fx: {},
    read: (t) => `${t.board.pieces.length} pieces stand; the centres are gone.`,
  },
  {
    title: "vii · one character",
    caption: "The source string is the mini-notation of shapes. Edit one character, meet another beast.",
    lines: [HALVES, "", 'rubik("5").paint(halves).carve("centers").out()'],
    fx: {},
    read: (t) => `${t.board.pieces.length} pieces now.`,
  },
  {
    title: "viii · a box has laws",
    caption: "The mechanism refuses what would misshape it, and the refusal is the lesson.",
    lines: [HALVES, "", 'const box = rubik("3x3x5").paint(halves)', 'box.turn("F R2 F\' U2").out()'],
    fx: { rest: HALVES + '\nrubik("3x3x5").paint(halves).out()', seq: "F R2 F' U2" },
    read: () => {
      try {
        rubik("3x3x5").turn("R");
      } catch (err) {
        return `box.can("R") → false. ${err.message.replace(/^erno: /, "")}`;
      }
    },
  },
  {
    title: "ix · the weld",
    caption: "Two bodies, one lattice. The moves spell the body first, and most turns stopped existing.",
    lines: [
      HALVES,
      "",
      'const weld = rubik("3 + 3 @ 2,2,0").paint(halves)',
      "weld.turn(\"AD BU AD' BU'\").out()",
    ],
    fx: {
      rest: HALVES + '\nrubik("3 + 3 @ 2,2,0").paint(halves).out()',
      seq: "AD BU AD' BU'",
    },
    read: (t) => `${t.legend()} · ${t.legal().length} of 54 turns exist here.`,
  },
  {
    title: "x · the seed",
    caption: "scramble() walks the board's own legal moves. A seed makes it the same walk on every machine.",
    lines: [
      HALVES,
      "",
      'const weld = rubik("3 + 3 @ 2,2,0").paint(halves)',
      "weld.scramble(7).out()",
    ],
    fx: { rest: HALVES + '\nrubik("3 + 3 @ 2,2,0").paint(halves).out()', seed: 7 },
    read: () => "Seed 7: everyone faces this exact position.",
  },
  {
    title: "xi · it comes apart",
    caption: "deal() opens the bin; place() sets from it. The centres ride the spider, and the last piece lands whole.",
    lines: ["let v = rubik().deal()", "for (const q of v.bin()) v = v.place(q)", "v.out()"],
    fx: { reveal: true },
    read: (t) => `Whole again, and ${t.lawful().lawful ? "lawful" : "unlawful"}.`,
  },
  {
    title: "xii · the borrowed cube",
    caption: "One corner placed with a spin: the picture of a cube, and the judge knows it is a lie.",
    lines: [
      "let v = rubik().deal()",
      "for (const q of v.bin())",
      '  v = v.place(q, q, q === "URF" ? 1 : 0)',
      "v.out()",
    ],
    fx: {},
    read: (t) => {
      const law = t.lawful();
      return `lawful() → ${law.lawful}. ${law.breaks[0] || ""}`;
    },
  },
  {
    title: "xiii · the goal",
    caption: "One base chain branches: the picture to reach, and the board that must reach it. That is the whole game.",
    lines: [
      HALVES,
      "const base = rubik().paint(halves)",
      "",
      "base.out(goal)",
      "base.scramble(7).out()",
    ],
    fx: {},
    read: (t) => `off() → ${t.off()} stickers between you and the picture. The album is next.`,
  },
];

// ── Drawing ─────────────────────────────────────────────────────────────────

const table = $("voyage-table");

// The table holds one BASE layer (what stands) and, during a shell
// change, a transient overlay - two aligned renders crossfading, so the
// body never leaves the screen.
const base = document.createElement("div");
base.className = "board-layer";
table.appendChild(base);

const svgOf = (value, extra = {}) =>
  value.board.toSVG({
    fitSphere: true,
    padding: 8,
    ...(value.veil ? { pieces: value.veil } : {}),
    ...extra,
  });

// A staging frame that COVERS both boards: anything smaller crops the
// larger one into a mangled thing mid-transition. Centred on the next
// board, wide enough for both from that centre.
function stagingFrame(prev, next) {
  const c = next.board._viewCenter;
  let radius = 0;
  for (const v of [prev, next]) {
    const d = v.board._viewCenter.map((x, i) => x - c[i]);
    radius = Math.max(
      radius,
      Math.hypot(d[0], d[1], d[2]) + v.board.getRadius(),
    );
  }
  return { radius, center: c };
}

function drawValue(value) {
  base.innerHTML = svgOf(value);
  state.shown = value;
}

// ── Reading a render like a surveyor ────────────────────────────────────────
//
// The settle between two framings needs the same body's screen position in
// both. No DOM, no projector math: every polygon's points already live in
// viewBox units inside the string, so the content box is a string away.
function surveySvg(svg) {
  const vb = svg.match(/viewBox="([^"]+)"/)[1].split(" ").map(Number);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const m of svg.matchAll(/points="([^"]+)"/g))
    for (const pair of m[1].split(" ")) {
      const [x, y] = pair.split(",").map(Number);
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  return { vb, x0, y0, x1, y1 };
}

// The transform that makes render B look like render A at the moment of
// the swap - measured off the two strings at the table's real width.
function settleTransform(svgA, svgB) {
  const a = surveySvg(svgA);
  const b = surveySvg(svgB);
  const W = table.clientWidth || 480;
  const px = (m, x, y) => [
    ((x - m.vb[0]) / m.vb[2]) * W,
    ((y - m.vb[1]) / m.vb[2]) * W, // same scale both axes: viewBox is uncropped
  ];
  const [ax, ay] = px(a, (a.x0 + a.x1) / 2, (a.y0 + a.y1) / 2);
  const [bx, by] = px(b, (b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2);
  const scale = (a.x1 - a.x0) / (b.x1 - b.x0);
  return {
    still: Math.abs(scale - 1) < 0.004 && Math.abs(ax - bx) < 0.75 && Math.abs(ay - by) < 0.75,
    origin: `${bx.toFixed(1)}px ${by.toFixed(1)}px`,
    css: `translate(${(ax - bx).toFixed(1)}px, ${(ay - by).toFixed(1)}px) scale(${scale.toFixed(4)})`,
  };
}

// Swap the base to a new render, gliding from exactly where the old one
// stood: the same body, re-framed, never replaced.
async function settleTo(svg, oldSvg) {
  if (reduced || !oldSvg) {
    base.innerHTML = svg;
    return;
  }
  const t = settleTransform(oldSvg, svg);
  if (t.still) {
    base.innerHTML = svg;
    return;
  }
  base.style.transition = "none";
  base.style.transformOrigin = t.origin;
  base.style.transform = t.css;
  base.innerHTML = svg;
  void base.offsetHeight;
  base.style.transition = "transform 340ms cubic-bezier(0.77, 0, 0.175, 1)";
  base.style.transform = "";
  await sleep(360);
  base.style.transition = "";
  base.style.transformOrigin = "";
}

// A whisper of a veil for a seam where only the paint changes: the body
// stays at nearly full presence, the recolouring hides in the blur.
async function veilSwap(fn) {
  if (reduced) {
    fn();
    return;
  }
  base.classList.add("is-veiled");
  await sleep(160);
  fn();
  base.classList.remove("is-veiled");
  await sleep(160);
}

// Two aligned renders crossfading in place - the shell change. Both are
// on screen through the middle, which is the whole point.
async function crossfadeTo(svg) {
  if (reduced) {
    base.innerHTML = svg;
    return;
  }
  const over = document.createElement("div");
  over.className = "board-layer is-arriving";
  over.innerHTML = svg;
  table.appendChild(over);
  void over.offsetHeight;
  over.classList.remove("is-arriving");
  base.classList.add("is-yielding");
  await sleep(440);
  // land without a blink: the base takes the new render at full presence
  // in the same beat the overlay leaves - no re-fade, no ghost
  base.style.transition = "none";
  base.innerHTML = svg;
  base.classList.remove("is-yielding");
  void base.offsetHeight;
  base.style.transition = "";
  over.remove();
}

// ── The morph ───────────────────────────────────────────────────────────────
//
// Everything happens in the NEXT board's own frame. The old board settles
// into that frame first (measured, gliding, the same body re-framed);
// then: pure removals dissolve cell by cell and seam behind a whisper of
// blur; shell changes crossfade in two aligned layers. Nothing ever
// leaves the screen to be replaced.
const cellKey = (p) => p.slotPoint.map((v) => Math.round(v * 2)).join(",");

async function morphTo(next, gen) {
  const prev = state.shown;
  if (!prev || reduced) {
    drawValue(next);
    return;
  }
  if (
    prev.board.getTints().join() === next.board.getTints().join() &&
    prev.board.getPosition() === next.board.getPosition() &&
    !prev.veil && !next.veil
  ) {
    drawValue(next);
    return;
  }

  const F = stagingFrame(prev, next);
  const A = new Map(prev.board.pieces.map((pc, i) => [cellKey(pc), i]));
  const B = new Map(next.board.pieces.map((pc, i) => [cellKey(pc), i]));
  const leaving = [...A].filter(([k]) => !B.has(k));
  const arriving = [...B].filter(([k]) => !A.has(k));

  // step into the staging frame - wide enough for both bodies, so
  // neither is ever cropped - gliding from the old framing
  const prevInF = svgOf(prev, { frame: F });
  await settleTo(prevInF, base.innerHTML);
  if (gen !== state.gen) return;

  if (leaving.length && !arriving.length) {
    // pure removal: the rim dissolves, farthest from the survivors first
    const heart = [0, 0, 0];
    const spot = (k) => k.split(",").map((v) => Number(v) / 2);
    for (const k of B.keys()) {
      const c = spot(k);
      heart[0] += c[0]; heart[1] += c[1]; heart[2] += c[2];
    }
    heart.forEach((v, i) => (heart[i] = v / B.size));
    const far = (k) => {
      const c = spot(k);
      return (c[0] - heart[0]) ** 2 + (c[1] - heart[1]) ** 2 + (c[2] - heart[2]) ** 2;
    };
    leaving.sort((a, b) => far(b[0]) - far(a[0]));
    const gone = new Set();
    const chunk = Math.max(1, Math.ceil(leaving.length / 22));
    let i = 0;
    while (i < leaving.length) {
      if (gen !== state.gen) return;
      for (let c = 0; c < chunk && i < leaving.length; c++) gone.add(leaving[i++][1]);
      base.innerHTML = svgOf(prev, { frame: F, pieces: (idx) => !gone.has(idx) });
      await sleep(Math.max(24, 55 * 0.93 ** (i / chunk)));
    }
    // the survivors change clothes (new stickers surface) behind a whisper
    await veilSwap(() => {
      base.innerHTML = svgOf(next, { frame: F });
    });
  } else {
    // shell change, or new paint on the same cells: two aligned renders
    // crossfade in the staging frame; the body stays
    await crossfadeTo(svgOf(next, { frame: F }));
  }
  if (gen !== state.gen) return;

  // and settle out into the next board's own framing
  await settleTo(svgOf(next), base.innerHTML);
  state.shown = next;
}

// ── The code panel ──────────────────────────────────────────────────────────

const linesHost = $("voyage-lines");

function commonPrefix(a, b) {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i;
}

async function typeInto(el, text, from, gen) {
  if (reduced) {
    el.textContent = text;
    return;
  }
  const caret = document.createElement("span");
  caret.className = "caret";
  el.textContent = text.slice(0, from);
  el.appendChild(caret);
  for (let i = from; i <= text.length; i++) {
    if (gen !== state.gen) break;
    el.firstChild ? (el.childNodes[0].textContent = text.slice(0, i)) : null;
    if (el.firstChild === caret) el.insertBefore(document.createTextNode(text.slice(0, i)), caret);
    await sleep(text[i - 1] === " " ? 10 : 22);
  }
  el.textContent = text;
}

async function renderLines(next, gen) {
  const current = [...linesHost.querySelectorAll(".cline")];
  const currentTexts = current.map((el) => el.dataset.text);
  const used = new Set();

  // pair every next line with a surviving, an editable, or nothing
  const plans = next.map((text) => {
    let idx = currentTexts.findIndex((t, i) => t === text && !used.has(i));
    if (idx !== -1) {
      used.add(idx);
      return { text, keep: current[idx] };
    }
    idx = currentTexts.findIndex(
      (t, i) => !used.has(i) && t && text && commonPrefix(t, text) >= 6,
    );
    if (idx !== -1) {
      used.add(idx);
      return { text, edit: current[idx], from: commonPrefix(currentTexts[idx], text) };
    }
    return { text, type: true };
  });

  // FLIP, first half: where does every surviving line stand today?
  const before = new Map();
  if (!reduced)
    for (const el of current) before.set(el, el.getBoundingClientRect().top);

  // retire what nothing claimed
  for (const [i, el] of current.entries()) {
    if (used.has(i)) continue;
    el.classList.add("is-gone");
    setTimeout(() => el.remove(), 400);
  }

  // structure pass: everything lands in its final order at once - kept
  // lines move, new lines arrive empty and low, edits stay put for now
  let anchor = null;
  for (const plan of plans) {
    let el = plan.keep || plan.edit;
    if (!el) {
      el = document.createElement("div");
      el.className = "cline is-new";
      linesHost.insertBefore(el, anchor ? anchor.nextSibling : linesHost.firstChild);
      plan.made = el;
    } else if (anchor ? anchor.nextSibling !== el : linesHost.firstChild !== el) {
      linesHost.insertBefore(el, anchor ? anchor.nextSibling : linesHost.firstChild);
    }
    el.dataset.text = plan.text;
    anchor = el;
  }

  // FLIP, second half: surviving lines glide from where they were - one
  // batched read, inverted transforms, then release together
  if (!reduced) {
    const moves = [];
    for (const [el, was] of before) {
      if (!el.isConnected || el.classList.contains("is-gone")) continue;
      const delta = was - el.getBoundingClientRect().top;
      if (delta) moves.push([el, delta]);
    }
    for (const [el, delta] of moves) {
      el.style.transition = "none";
      el.style.transform = `translateY(${delta}px)`;
    }
    if (moves.length) {
      void linesHost.offsetHeight;
      for (const [el] of moves) {
        el.style.transition = "";
        el.style.transform = "";
      }
    }
  }

  // voice pass: the new and the edited type themselves in, in order
  for (const plan of plans) {
    const el = plan.made || plan.edit || plan.keep;
    if (plan.made) {
      void el.offsetHeight;
      el.classList.remove("is-new");
      await typeInto(el, plan.text || " ", 0, gen);
    } else if (plan.edit) {
      await typeInto(el, plan.text, plan.from, gen);
    } else {
      el.textContent = plan.text || " ";
    }
    if (gen !== state.gen) return;
  }
}

// ── Captions and verdicts ───────────────────────────────────────────────────

async function swapText(el, text) {
  if (el.textContent === text) return;
  el.classList.add("is-leaving");
  await sleep(reduced ? 0 : 200);
  el.classList.remove("is-leaving");
  el.classList.add("is-entering");
  el.textContent = text;
  void el.offsetHeight;
  el.classList.remove("is-entering");
}

// ── The step engine ─────────────────────────────────────────────────────────

const state = { step: -1, gen: 0, shown: null };

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

  $("voyage-title").textContent = s.title;
  [...$("voyage-dots").children].forEach((d, i) =>
    d.setAttribute("aria-current", String(i === step)),
  );
  $("voyage-prev").disabled = step === 0;
  $("voyage-next").disabled = step === STEPS.length - 1;
  swapText($("voyage-caption"), s.caption);
  $("voyage-verdict").style.opacity = "0";

  await renderLines(s.lines, gen);
  if (gen !== state.gen) return;

  // the consequence: run the real code, then let the board tell it
  const outs = runSketch(s.lines.join("\n"));
  const tableValue = outs.get("table");
  const goalValue = outs.get("goal");

  const fx = s.fx || {};
  try {
    if (fx.reveal) {
      await reveal(tableValue, gen);
    } else {
      // the stage: where the step's motion starts - a rest sketch if the
      // step plays turns, the step's own end otherwise
      const stage = fx.rest ? runSketch(fx.rest).get("table") : tableValue;
      await morphTo(stage, gen);
      if (gen !== state.gen) return;
      let seq = fx.seq;
      if (fx.seed !== undefined)
        seq = runSketch(fx.rest).get("table").board.scramble(18, fx.seed);
      if (seq) await playTurns(stage, seq, gen);
    }
  } catch (err) {
    // an fx that stumbles must never strand the board: land the truth
    console.error(err);
  }
  if (gen !== state.gen) return;

  drawValue(tableValue);
  const goalBox = $("voyage-goal");
  if (goalValue) {
    $("voyage-goal-art").innerHTML = goalValue.board.toSVG({ fitSphere: true, padding: 8 });
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
