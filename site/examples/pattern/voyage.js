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

const $ = (id) => document.getElementById(id);
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── The steps ───────────────────────────────────────────────────────────────
//
// Lines are arrays of SEGMENTS: the segment is the unit that animates.
// Joined, they are the exact sketch that runs.

const HALVES = 'const halves = (x, y, z) => y > 0 ? "B" : "F"';
const SEXY6 = "R U R' U' ".repeat(6).trim();

const STEPS = [
  {
    title: "i · a cube exists",
    caption: "One source word. The defaults are the healthy object: whole, at rest, classic colours.",
    lines: [["rubik()", ".out()"]],
    read: (t) => `${t.board.pieces.length} pieces, whole and at rest.`,
  },
  {
    title: "ii · it turns",
    caption: "A link joins the chain. The string is the notation cubers already write.",
    lines: [["rubik()", '.turn("R")', ".out()"]],
    fx: { rest: "rubik().out()", seq: "R" },
    read: (t) => `${t.moves()} move made.`,
  },
  {
    title: "iii · the string grows",
    caption: "The same link, a longer sentence: four turns cubers call the sexy move.",
    lines: [["rubik()", ".turn(\"R U R' U'\")", ".out()"]],
    fx: { rest: "rubik().out()", seq: "R U R' U'" },
    read: (t) => `${t.moves()} moves made.`,
  },
  {
    title: "iv · the algebra declares",
    caption: "alg() studies a sequence without turning anything. Its order is a theorem; watch it walk home.",
    lines: [['const sexy = alg("[R, U]")'], ["rubik()", ".turn(sexy.times(6))", ".out()"]],
    fx: { rest: "rubik().out()", seq: SEXY6 },
    read: () => `alg("[R, U]").order = ${alg("[R, U]").order}: six rounds close the loop.`,
  },
  {
    title: "v · paint rides upstream",
    caption: "A link inserted above repaints everything below: the chain is a pipeline, and now you can see it.",
    lines: [[HALVES], [], ["rubik()", ".paint(halves)", ".out()"]],
    read: () => "The paint runs once per sticker, on the sound cube: two colours, still a working puzzle.",
  },
  {
    title: "vi · carve",
    caption: "Holes are real: the absences are piece-shaped and they travel under turns.",
    lines: [[HALVES], [], ["rubik()", ".paint(halves)", '.carve("centers")', ".out()"]],
    read: (t) => `${t.board.pieces.length} pieces stand; the centres are gone.`,
  },
  {
    title: "vii · one character",
    caption: "The source string is the mini-notation of shapes. Edit one character, meet another beast.",
    lines: [[HALVES], [], ['rubik("5")', ".paint(halves)", '.carve("centers")', ".out()"]],
    read: (t) => `${t.board.pieces.length} pieces now.`,
  },
  {
    title: "viii · a box has laws",
    caption: "The mechanism refuses what would misshape it, and the refusal is the lesson.",
    lines: [
      [HALVES],
      [],
      ["const box = ", 'rubik("3x3x5")', ".paint(halves)"],
      ["box", ".turn(\"F R2 F' U2\")", ".out()"],
    ],
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
    title: "ix · a second cube joins",
    caption: "Weld another body on and it is one mechanism: the moves spell the body first, and most turns stopped existing.",
    lines: [
      [HALVES],
      [],
      ["const weld = ", 'rubik("3 + 3 @ 2,2,0")', ".paint(halves)"],
      ["weld", ".turn(\"AD BU AD' BU'\")", ".out()"],
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
      [HALVES],
      [],
      ["const weld = ", 'rubik("3 + 3 @ 2,2,0")', ".paint(halves)"],
      ["weld", ".scramble(7)", ".out()"],
    ],
    fx: { rest: HALVES + '\nrubik("3 + 3 @ 2,2,0").paint(halves).out()', seed: 7 },
    read: () => "Seed 7: everyone faces this exact position.",
  },
  {
    title: "xi · it comes apart",
    caption: "deal() opens the bin; place() sets from it. The centres ride the spider, and the last piece lands whole.",
    lines: [
      ["let v = ", "rubik()", ".deal()"],
      ["for (const q of v.bin()) v = v.place(q)"],
      ["v.out()"],
    ],
    fx: { reveal: true },
    read: (t) => `Whole again, and ${t.lawful().lawful ? "lawful" : "unlawful"}.`,
  },
  {
    title: "xii · the borrowed cube",
    caption: "One corner placed with a spin: the picture of a cube, and the judge knows it is a lie.",
    lines: [
      ["let v = ", "rubik()", ".deal()"],
      ["for (const q of v.bin())"],
      ['  v = v.place(q, q, q === "URF" ? 1 : 0)'],
      ["v.out()"],
    ],
    read: (t) => {
      const law = t.lawful();
      return `lawful() → ${law.lawful}. ${law.breaks[0] || ""}`;
    },
  },
  {
    title: "xiii · the goal",
    caption: "One base chain branches: the picture to reach, and the board that must reach it. That is the whole game.",
    lines: [
      [HALVES],
      ["const base = ", "rubik()", ".paint(halves)"],
      [],
      ["base", ".out(goal)"],
      ["base", ".scramble(7)", ".out()"],
    ],
    read: (t) => `off() → ${t.off()} stickers between you and the picture. The album is next.`,
  },
];

const sourceOf = (s) => s.lines.map((segs) => segs.join("")).join("\n");

// ── The board ───────────────────────────────────────────────────────────────

const state = { step: -1, gen: 0, shown: null };
const table = $("voyage-table");

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

function drawValue(value) {
  base.innerHTML = svgOf(value);
  state.shown = value;
}

// A staging frame that covers both boards, centred on the next one.
function stagingFrame(prev, next) {
  const c = next.board._viewCenter;
  let radius = 0;
  for (const v of [prev, next]) {
    const d = v.board._viewCenter.map((x, i) => x - c[i]);
    radius = Math.max(radius, Math.hypot(d[0], d[1], d[2]) + v.board.getRadius());
  }
  return { radius, center: c };
}

// Reading a render like a surveyor: content box straight off the string.
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

function settleTransform(svgA, svgB) {
  const a = surveySvg(svgA);
  const b = surveySvg(svgB);
  const W = table.clientWidth || 480;
  const px = (m, x, y) => [((x - m.vb[0]) / m.vb[2]) * W, ((y - m.vb[1]) / m.vb[2]) * W];
  const [ax, ay] = px(a, (a.x0 + a.x1) / 2, (a.y0 + a.y1) / 2);
  const [bx, by] = px(b, (b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2);
  const scale = (a.x1 - a.x0) / (b.x1 - b.x0);
  return {
    still: Math.abs(scale - 1) < 0.004 && Math.abs(ax - bx) < 0.75 && Math.abs(ay - by) < 0.75,
    origin: `${bx.toFixed(1)}px ${by.toFixed(1)}px`,
    css: `translate(${(ax - bx).toFixed(1)}px, ${(ay - by).toFixed(1)}px) scale(${scale.toFixed(4)})`,
  };
}

// Swap the base to a new render, gliding from where the old one stood.
async function settleTo(svg, oldSvg, gen) {
  if (gen !== state.gen) return;
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
  base.style.transition = "transform 560ms cubic-bezier(0.77, 0, 0.175, 1)";
  base.style.transform = "";
  await sleep(580);
  base.style.transition = "";
  base.style.transformOrigin = "";
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

// ── The morph: one continuous body ──────────────────────────────────────────

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
  const leaving = new Set([...A].filter(([k]) => !B.has(k)).map(([, i]) => i));
  const arriving = new Set([...B].filter(([k]) => !A.has(k)).map(([, i]) => i));

  // step into the staging frame, gliding
  await settleTo(svgOf(prev, { frame: F }), base.innerHTML, gen);
  if (gen !== state.gen) return;

  if (leaving.size) {
    // what is being cut lifts away as one soft group; what remains is
    // already dressed as the next board underneath it
    const under = arriving.size
      ? svgOf(next, { frame: F, pieces: (i) => !arriving.has(i) })
      : svgOf(next, { frame: F });
    const cut = svgOf(prev, { frame: F, pieces: (i) => leaving.has(i) });
    base.innerHTML = under;
    const over = overlayWith(cut, "");
    void over.offsetHeight;
    over.classList.add("is-lifting");
    await sleep(reduced ? 0 : 780);
    over.remove();
    if (gen !== state.gen) return;
  }

  if (arriving.size) {
    // what joins arrives as one body: the weld's second cube slides in,
    // a bigger shell blooms on - same motion, different distance
    const joining = svgOf(next, { frame: F, pieces: (i) => arriving.has(i) });
    const spotOf = (set, map) => {
      const heart = [0, 0, 0];
      let n = 0;
      for (const [k] of map) {
        const idx = map.get(k);
        if (!set.has(idx)) continue;
        const c = k.split(",").map((v) => Number(v) / 2);
        heart[0] += c[0]; heart[1] += c[1]; heart[2] += c[2];
        n++;
      }
      return n ? heart.map((v) => v / n) : heart;
    };
    const from = spotOf(new Set([...B.values()].filter((i) => !arriving.has(i))), B);
    const to = spotOf(arriving, B);
    const dx = to[0] + to[1] - (from[0] + from[1]);
    const slide = arriving.size < B.size / 1.6 && Math.abs(dx) > 0.5;
    const over = overlayWith(joining, slide ? (dx > 0 ? "is-joining-r" : "is-joining-l") : "is-arriving");
    void over.offsetHeight;
    over.classList.remove("is-joining-r", "is-joining-l", "is-arriving");
    await sleep(reduced ? 0 : 840);
    over.remove();
    if (gen !== state.gen) return;
    base.innerHTML = svgOf(next, { frame: F });
  } else if (leaving.size) {
    // the survivors' new stickers surface behind a whisper
    await veilSwap(() => {
      base.innerHTML = svgOf(next, { frame: F });
    }, gen);
  } else {
    await crossfadeTo(svgOf(next, { frame: F }), gen);
  }
  if (gen !== state.gen) return;

  // settle out into the next board's own framing
  await settleTo(svgOf(next), base.innerHTML, gen);
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

// The assembly: pieces return to the frame one by one, quickening.
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
  await veilSwap(() => {
    base.innerHTML = svgOf(value, { pieces: (idx) => standing.has(idx) });
  }, gen);
  let i = 0;
  for (const idx of free) {
    if (gen !== state.gen) return;
    standing.add(idx);
    base.innerHTML = svgOf(value, { pieces: (id) => standing.has(id) });
    await sleep(Math.max(40, 95 * 0.95 ** i));
    i++;
  }
  state.shown = value;
}

// ── The code panel: segments, not keystrokes ────────────────────────────────

const linesHost = $("voyage-lines");

// The ink of the language, hand-rolled: strings wear blue (they are the
// mini-notation), keywords red, the chain's links bold. A segment is
// always whole - a string never splits across two - so each one can be
// inked on its own.
const escapeHtml = (t) =>
  t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function ink(seg) {
  let out = "";
  let i = 0;
  const src = seg;
  while (i < src.length) {
    const ch = src[i];
    if (ch === '"' || ch === "'") {
      let j = i + 1;
      while (j < src.length && src[j] !== ch) j++;
      out += `<span class="tk-str">${escapeHtml(src.slice(i, j + 1))}</span>`;
      i = j + 1;
      continue;
    }
    const rest = src.slice(i);
    const kw = rest.match(/^(const|let|for|of|new|return)\b/);
    if (kw) {
      out += `<span class="tk-kw">${kw[0]}</span>`;
      i += kw[0].length;
      continue;
    }
    const fn = rest.match(/^\.?(rubik|alg|paint|carve|turn|scramble|deal|place|bin|out|times|order)(?=\()/);
    if (fn) {
      const dot = fn[0].startsWith(".") ? "." : "";
      out += `${dot}<span class="tk-fn">${fn[0].slice(dot.length)}</span>`;
      i += fn[0].length;
      continue;
    }
    const num = rest.match(/^\d+(\.\d+)?/);
    if (num && !/\w/.test(src[i - 1] || "")) {
      out += `<span class="tk-num">${num[0]}</span>`;
      i += num[0].length;
      continue;
    }
    out += escapeHtml(ch);
    i++;
  }
  return out;
}

async function renderLines(lines, gen) {
  const oldLines = [...linesHost.querySelectorAll(".cline")];
  const oldTexts = oldLines.map((el) => el.dataset.text);
  const usedOld = new Set();

  // pair each new line with an old one: exact text, else a shared segment
  const plans = lines.map((segs) => {
    const text = segs.join("");
    let idx = oldTexts.findIndex((t, i) => !usedOld.has(i) && t === text);
    if (idx !== -1) {
      usedOld.add(idx);
      return { segs, text, el: oldLines[idx], same: true };
    }
    idx = oldTexts.findIndex(
      (t, i) => !usedOld.has(i) && t && segs.some((sg) => sg.length > 3 && t.includes(sg)),
    );
    if (idx !== -1) {
      usedOld.add(idx);
      return { segs, text, el: oldLines[idx] };
    }
    return { segs, text };
  });

  // FLIP first half: where every surviving line stands
  const before = new Map();
  if (!reduced) for (const el of oldLines) before.set(el, el.getBoundingClientRect().top);

  // retire unclaimed lines
  for (const [i, el] of oldLines.entries()) {
    if (usedOld.has(i)) continue;
    el.classList.add("is-gone");
    setTimeout(() => el.remove(), 700);
  }

  // structure: land everything in final order
  let anchor = null;
  for (const plan of plans) {
    let el = plan.el;
    if (!el) {
      el = document.createElement("div");
      el.className = "cline is-new";
      plan.entered = true;
    }
    linesHost.insertBefore(el, anchor ? anchor.nextSibling : linesHost.firstChild);
    plan.el = el;
    anchor = el;
  }

  // FLIP second half: survivors glide
  if (!reduced) {
    const moves = [];
    for (const [el, was] of before) {
      if (!el.isConnected || el.classList.contains("is-gone")) continue;
      const d = was - el.getBoundingClientRect().top;
      if (d) moves.push([el, d]);
    }
    for (const [el, d] of moves) {
      el.style.transition = "none";
      el.style.transform = `translateY(${d}px)`;
    }
    if (moves.length) {
      void linesHost.offsetHeight;
      for (const [el] of moves) {
        el.style.transition = "";
        el.style.transform = "";
      }
    }
  }

  // segments: reconcile each line's spans - new fragments float in,
  // replaced ones cross over in place, neighbours glide aside
  for (const plan of plans) {
    reconcileSegments(plan.el, plan.segs);
    plan.el.dataset.text = plan.text;
    if (plan.entered) {
      void plan.el.offsetHeight;
      plan.el.classList.remove("is-new");
    }
  }
  if (!reduced) await sleep(140);
}

function reconcileSegments(lineEl, segs) {
  const olds = [...lineEl.querySelectorAll(".seg")];
  const oldTexts = olds.map((el) => el.dataset.raw ?? el.textContent);
  const target = segs.filter((sg) => sg !== "");

  // common prefix and suffix of segment lists: the middle is the change
  let p = 0;
  while (p < olds.length && p < target.length && oldTexts[p] === target[p]) p++;
  let sFx = 0;
  while (
    sFx < olds.length - p &&
    sFx < target.length - p &&
    oldTexts[olds.length - 1 - sFx] === target[target.length - 1 - sFx]
  ) sFx++;

  // FLIP for the surviving spans of this line
  const keep = [...olds.slice(0, p), ...olds.slice(olds.length - sFx)];
  const lefts = new Map();
  if (!reduced) for (const el of keep) lefts.set(el, el.getBoundingClientRect().left);

  // out with the middle olds: ghosted in place, out of the flow, so the
  // neighbours glide exactly once
  for (const el of olds.slice(p, olds.length - sFx)) {
    const r = el.getBoundingClientRect();
    const lr = lineEl.getBoundingClientRect();
    el.style.position = "absolute";
    el.style.left = `${r.left - lr.left}px`;
    el.style.top = `${r.top - lr.top}px`;
    void el.offsetHeight;
    el.classList.add("seg-out");
    setTimeout(() => el.remove(), 620);
  }
  // in with the middle news, before the kept suffix
  const anchorEl = sFx ? olds[olds.length - sFx] : null;
  for (const sg of target.slice(p, target.length - sFx)) {
    const span = document.createElement("span");
    span.className = "seg seg-in";
    span.innerHTML = ink(sg);
    span.dataset.raw = sg;
    lineEl.insertBefore(span, anchorEl);
    void span.offsetHeight;
    span.classList.remove("seg-in");
  }
  // glide the survivors horizontally
  if (!reduced) {
    const moves = [];
    for (const [el, was] of lefts) {
      if (!el.isConnected) continue;
      const d = was - el.getBoundingClientRect().left;
      if (d) moves.push([el, d]);
    }
    for (const [el, d] of moves) {
      el.style.transition = "none";
      el.style.transform = `translateX(${d}px)`;
    }
    if (moves.length) {
      void lineEl.offsetHeight;
      for (const [el] of moves) {
        el.style.transition = "";
        el.style.transform = "";
      }
    }
  }
  // a brand-new line builds its spans directly
  if (!olds.length && !target.length) lineEl.textContent = " ";
}

// ── Captions and verdicts ───────────────────────────────────────────────────

async function swapText(el, text) {
  if (el.textContent === text) return;
  el.classList.add("is-leaving");
  await sleep(reduced ? 0 : 280);
  el.classList.remove("is-leaving");
  el.classList.add("is-entering");
  el.textContent = text;
  void el.offsetHeight;
  el.classList.remove("is-entering");
}

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

  const outs = runSketch(sourceOf(s));
  const tableValue = outs.get("table");
  const goalValue = outs.get("goal");

  const fx = s.fx || {};
  try {
    if (fx.reveal) {
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
