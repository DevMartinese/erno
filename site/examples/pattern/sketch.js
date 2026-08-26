/* ─────────────────────────────────────────────────────────────────────────
   The sketch panel: segments, not keystrokes - and stage-blind.

   Everything the voyage's left half does (lines reconciled by segment,
   fragments floating in, neighbours gliding aside, captions crossing over)
   knows nothing about how a board is drawn, so it is shared by both
   stages verbatim. A host element and the reduced-motion answer come in;
   nothing else is asked of the page.
   ───────────────────────────────────────────────────────────────────── */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function createSketch(linesHost, reduced) {



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
    const src2 = rest.match(/^(rubik|alg)(?=\()/);
    if (src2) {
      out += `<span class="tk-src">${src2[0]}</span>`;
      i += src2[0].length;
      continue;
    }
    const fn = rest.match(/^\.(paint|carve|turn|scramble|deal|place|bin|out|times|order|reflect|exchange)(?=\()/);
    if (fn) {
      out += `.<span class="tk-fn">${fn[0].slice(1)}</span>`;
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
  // A RETIRED NODE IS NOT A CANDIDATE. A line that lost its claim is
  // pinned out of the flow and removed on a timer, and for those few
  // hundred ms it is still a child of the host - so a reader who clicks
  // on before the timer fires used to have the next step's line handed to
  // a corpse: reconciled onto an element that was already invisible and
  // already scheduled to go. The line simply vanished, and the panel
  // stopped being the sketch that ran, on the one page whose whole claim
  // is that it is. The dying are filtered out of every query that decides
  // what to keep; they own nothing but their own fade.
  const oldLines = [...linesHost.querySelectorAll(".cline:not(.is-gone)")];
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

  // retire unclaimed lines: pinned where they stand, out of the flow, so
  // the survivors' glide is the only motion the eye has to follow
  const hostBox = linesHost.getBoundingClientRect();
  for (const [i, el] of oldLines.entries()) {
    if (usedOld.has(i)) continue;
    const r = el.getBoundingClientRect();
    el.style.top = `${r.top - hostBox.top}px`;
    el.style.left = `${r.left - hostBox.left}px`;
    el.style.width = `${r.width}px`;
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
    // every span re-inked from its raw text: one pass, one dress code,
    // whatever road brought the span here
    for (const span of plan.el.querySelectorAll(".seg:not(.seg-out)")) {
      const raw = span.dataset.raw ?? span.textContent;
      span.dataset.raw = raw;
      span.innerHTML = ink(raw);
    }
    if (plan.entered) {
      void plan.el.offsetHeight;
      plan.el.classList.remove("is-new");
    }
  }
  if (!reduced) await sleep(140);
}

function reconcileSegments(lineEl, segs) {
  // Same rule one storey down, and the same bug: a ghosted segment kept
  // its text, so a prefix that matched it was taken for a survivor and
  // left in place - `rubik()` held its spot in the sketch while fading to
  // nothing and then being removed under the reader.
  const olds = [...lineEl.querySelectorAll(".seg:not(.seg-out)")];
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


  return { renderLines };
}


export async function swapText(el, text, reduced) {
  if (el.textContent === text) return;
  el.classList.add("is-leaving");
  await sleep(reduced ? 0 : 280);
  el.classList.remove("is-leaving");
  el.classList.add("is-entering");
  el.textContent = text;
  void el.offsetHeight;
  el.classList.remove("is-entering");
}

