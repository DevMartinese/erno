/* ─────────────────────────────────────────────────────────────────────────
   The voyage: the chain taught in one screen.

   Two panels. The left is the sketch, growing and refined step by step -
   lines type themselves in, edits happen at the common prefix, retired
   lines collapse away. The right is the consequence: the real board,
   molting through rebuilds behind a two-pixel blur, playing real turns,
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
    fx: { kind: "molt" },
    read: (t) => `${t.board.pieces.length} pieces, whole and at rest.`,
  },
  {
    title: "ii · it turns",
    caption: "A link joins the chain. The string is the notation cubers already write.",
    lines: ['rubik().turn("R").out()'],
    fx: { kind: "turns", seq: "R" },
    read: (t) => `${t.moves()} move made.`,
  },
  {
    title: "iii · the string grows",
    caption: "The link is edited, not replaced: four turns cubers call the sexy move.",
    lines: [`rubik().turn("R U R' U'").out()`],
    fx: { kind: "restTurns", rest: "rubik().out()", seq: "R U R' U'" },
    read: (t) => `${t.moves()} moves made.`,
  },
  {
    title: "iv · the algebra declares",
    caption: "alg() studies a sequence without turning anything. Its order is a theorem; watch it walk home.",
    lines: ['const sexy = alg("[R, U]")', "rubik().turn(sexy.times(6)).out()"],
    fx: { kind: "restTurns", rest: "rubik().out()", seq: SEXY6 },
    read: () => `alg("[R, U]").order = ${alg("[R, U]").order}: six rounds close the loop.`,
  },
  {
    title: "v · paint rides upstream",
    caption: "A link inserted above repaints everything below: the chain is a pipeline, and now you can see it.",
    lines: [HALVES, "", "rubik().paint(halves).out()"],
    fx: { kind: "molt" },
    read: (t) => "The paint runs once per sticker, on the sound cube: two colours, still a working puzzle.",
  },
  {
    title: "vi · carve",
    caption: "Holes are real: the absences are piece-shaped and they travel under turns.",
    lines: [HALVES, "", 'rubik().paint(halves).carve("centers").out()'],
    fx: { kind: "molt" },
    read: (t) => `${t.board.pieces.length} pieces stand; the centres are gone.`,
  },
  {
    title: "vii · one character",
    caption: "The source string is the mini-notation of shapes. Edit one character, meet another beast.",
    lines: [HALVES, "", 'rubik("5").paint(halves).carve("centers").out()'],
    fx: { kind: "molt" },
    read: (t) => `${t.board.pieces.length} pieces now.`,
  },
  {
    title: "viii · a box has laws",
    caption: "The mechanism refuses what would misshape it, and the refusal is the lesson.",
    lines: [HALVES, "", 'const box = rubik("3x3x5").paint(halves)', 'box.turn("R2 U R2 U\'").out()'],
    fx: { kind: "restTurns", rest: HALVES + '\nrubik("3x3x5").paint(halves).out()', seq: "R2 U R2 U'" },
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
      kind: "restTurns",
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
    fx: { kind: "scramble", rest: HALVES + '\nrubik("3 + 3 @ 2,2,0").paint(halves).out()', seed: 7 },
    read: () => "Seed 7: everyone faces this exact position.",
  },
  {
    title: "xi · it comes apart",
    caption: "deal() opens the bin; place() sets from it. The centres ride the spider, and the last piece lands whole.",
    lines: ["let v = rubik().deal()", "for (const q of v.bin()) v = v.place(q)", "v.out()"],
    fx: { kind: "reveal" },
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
    fx: { kind: "molt" },
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
    fx: { kind: "molt" },
    read: (t) => `off() → ${t.off()} stickers between you and the picture. The album is next.`,
  },
];

// ── Drawing ─────────────────────────────────────────────────────────────────

const table = $("voyage-table");

const svgOf = (value, extra = {}) =>
  value.board.toSVG({
    fitSphere: true,
    padding: 8,
    ...(value.veil ? { pieces: value.veil } : {}),
    ...extra,
  });

function drawValue(value) {
  table.innerHTML = svgOf(value);
}

// The molt: the old board leaves behind two pixels of blur, the new one
// arrives from 97.5% - one object transforming, never two objects swapping.
async function molt(value) {
  if (reduced) {
    drawValue(value);
    return;
  }
  table.classList.add("is-molting");
  await sleep(270);
  drawValue(value);
  table.classList.remove("is-molting");
  await sleep(270);
}

// Real turns, eased frame by frame, each one a touch quicker than the last.
async function playTurns(value, seq, gen) {
  const board = value.board; // materialized fresh for this value: ours to move
  const tokens = seq.split(/\s+/).filter(Boolean);
  let i = 0;
  for (const token of tokens) {
    if (gen !== state.gen) return;
    const ms = reduced ? 0 : Math.max(70, 200 * 0.93 ** i);
    if (ms) {
      const t0 = performance.now();
      await new Promise((done) => {
        const frame = (now) => {
          if (gen !== state.gen) return done();
          const t = Math.min(1, (now - t0) / ms);
          const progress = 1 - (1 - t) ** 3;
          table.innerHTML = svgOf(value, { turn: { move: token, progress } });
          if (t < 1) requestAnimationFrame(frame);
          else done();
        };
        requestAnimationFrame(frame);
      });
    }
    board.move(token);
    table.innerHTML = svgOf(value);
    i++;
  }
}

// The assembly: pieces return to the frame one by one, quick and quickening.
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
  table.innerHTML = svgOf(value, { pieces: (idx) => standing.has(idx) });
  await sleep(200);
  let i = 0;
  for (const idx of free) {
    if (gen !== state.gen) return;
    standing.add(idx);
    table.innerHTML = svgOf(value, { pieces: (id) => standing.has(id) });
    await sleep(Math.max(30, 70 * 0.94 ** i));
    i++;
  }
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

  // retire what nothing claimed
  for (const [i, el] of current.entries()) {
    if (used.has(i)) continue;
    el.classList.add("is-gone");
    setTimeout(() => el.remove(), 400);
  }

  // rebuild in order: keeps move instantly (the collapse above makes room),
  // edits retype from the shared prefix, new lines enter low and type in
  let anchor = null;
  for (const plan of plans) {
    let el = plan.keep || plan.edit;
    if (!el) {
      el = document.createElement("div");
      el.className = "cline is-new";
      linesHost.insertBefore(el, anchor ? anchor.nextSibling : linesHost.firstChild);
      void el.offsetHeight;
      el.classList.remove("is-new");
    } else if (anchor ? anchor.nextSibling !== el : linesHost.firstChild !== el) {
      linesHost.insertBefore(el, anchor ? anchor.nextSibling : linesHost.firstChild);
    }
    el.dataset.text = plan.text;
    if (plan.type) await typeInto(el, plan.text || " ", 0, gen);
    else if (plan.edit) await typeInto(el, plan.text, plan.from, gen);
    else el.textContent = plan.text || " ";
    anchor = el;
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

const state = { step: -1, gen: 0 };

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

  const fx = s.fx || { kind: "molt" };
  try {
  if (fx.kind === "turns" || fx.kind === "restTurns" || fx.kind === "scramble") {
    const restOuts = runSketch(fx.rest || "rubik().out()");
    const restValue = restOuts.get("table");
    let seq = fx.seq;
    if (fx.kind === "scramble") seq = restValue.board.scramble(18, fx.seed);
    if (fx.kind === "scramble") {
      // the scramble already ran while we asked for its tokens; rewind
      const fresh = runSketch(fx.rest).get("table");
      await molt(fresh);
      if (gen !== state.gen) return;
      await playTurns(fresh, seq, gen);
    } else if (fx.kind === "turns") {
      await playTurns(tableValueAtRest(fx, tableValue), seq, gen);
    } else {
      await molt(restValue);
      if (gen !== state.gen) return;
      await playTurns(restValue, seq, gen);
    }
  } else if (fx.kind === "reveal") {
    await reveal(tableValue, gen);
  } else {
    await molt(tableValue);
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
    goalBox.hidden = false;
  } else goalBox.hidden = true;

  const verdict = s.read ? s.read(tableValue) : "";
  $("voyage-verdict").textContent = verdict || "";
  $("voyage-verdict").style.opacity = "1";
}

// step ii turns on the PREVIOUS board (a fresh rest cube), not a rebuilt one
function tableValueAtRest(fx, fallback) {
  const rest = runSketch(fx.rest || "rubik().out()").get("table");
  return rest || fallback;
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
