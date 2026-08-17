import {
  Erno,
  Skewb,
  Pyraminx,
  Mirror,
  Void,
  Tetris,
  Cuboid,
  Domino,
  Tower,
  Floppy,
  Fisher,
  Windmill,
  Axis,
  Ghost,
  Dino,
  Compy,
  MasterSkewb,
  Helicopter,
  Penrose,
  Twist,
  Pyramorphix,
  Mastermorphix,
  SkewbDiamond,
  Megaminx,
  Kilominx,
  SCHEMES,
  generateScheme,
  schemeFrom,
  generateRamp,
  tetrisPaint,
  Puzzle,
  Cube,
  Fused,
  Siamese,
} from "../src/erno.js";
import { version } from "../package.json";
import { initHero } from "./hero.js";
import { highlight } from "https://esm.sh/sugar-high";

document.querySelectorAll("pre code").forEach((el) => {
  el.innerHTML = highlight(el.textContent);
});

document.querySelector("h1 .version").textContent = version;

// ─── Enhance all range inputs ────────
function enhanceRange(input) {
  const wrap = document.createElement("div");
  wrap.className = "range-wrap";

  const thumb = document.createElement("span");
  thumb.className = "range-thumb";

  const capL = document.createElement("span");
  capL.className = "range-cap-left";
  const capR = document.createElement("span");
  capR.className = "range-cap-right";

  input.parentNode.insertBefore(wrap, input);
  wrap.appendChild(input);
  wrap.appendChild(thumb);
  wrap.appendChild(capL);
  wrap.appendChild(capR);

  const valueSpan = wrap
    .closest(".control-label")
    .querySelector(".control-value");

  function syncVal() {
    const min = parseFloat(input.min) || 0;
    const max = parseFloat(input.max) || 100;
    const val = parseFloat(input.value) || 0;
    wrap.style.setProperty("--val", (val - min) / (max - min));
    if (valueSpan) valueSpan.textContent = input.value;
  }

  input.addEventListener("input", syncVal);
  syncVal();
}

document.querySelectorAll('input[type="range"]').forEach(enhanceRange);

// ─── Settings panel ──────────────────
const panel = document.getElementById("settings-panel");
if (window.matchMedia("(max-width: 56rem)").matches) {
  panel.removeAttribute("open");
}
const movesSection = document.getElementById("moves");
let panelShown = false;
window.addEventListener(
  "scroll",
  () => {
    if (panelShown) return;
    if (movesSection.getBoundingClientRect().top < window.innerHeight) {
      panel.classList.add("visible");
      panelShown = true;
    }
  },
  { passive: true },
);

const camProj = document.getElementById("cam-proj");
const camAngle = document.getElementById("cam-angle");
const camPitch = document.getElementById("cam-pitch");
const camDist = document.getElementById("cam-dist");
const camPitchLabel = document.getElementById("cam-pitch-label");
const camDistLabel = document.getElementById("cam-dist-label");
const optInset = document.getElementById("opt-inset");
const optPlastic = document.getElementById("opt-plastic");
const optScheme = document.getElementById("opt-scheme");

function getCamera(span = 4) {
  const type = camProj.value;
  const angle = parseFloat(camAngle.value);
  if (type === "orthographic")
    return { type, angle, pitch: parseFloat(camPitch.value) };
  if (type === "perspective")
    return {
      type,
      position: [span / 2 + (angle / 30) * span, -span * 0.7],
      distance: parseFloat(camDist.value),
    };
  return { type, angle };
}

/** Apply the global settings to a persistent puzzle instance. */
function tune(p, { scheme = true } = {}) {
  if (!p._defaultColors) p._defaultColors = { ...p.colors };
  p.setCamera(getCamera(p.size || 5));
  p.stickerInset = parseFloat(optInset.value);
  p.plastic = optPlastic.value;
  if (scheme)
    p.colors = optScheme.value
      ? { ...SCHEMES[optScheme.value] }
      : { ...p._defaultColors };
  return p;
}

function syncCameraControls() {
  camPitchLabel.hidden = camProj.value !== "orthographic";
  camDistLabel.hidden = camProj.value !== "perspective";
}

const demos = [];
let rerenderQueued = false;
function rerenderAll() {
  if (rerenderQueued) return;
  rerenderQueued = true;
  requestAnimationFrame(() => {
    rerenderQueued = false;
    for (const render of demos) render();
  });
}

for (const el of [camProj, camAngle, camPitch, camDist, optInset, optPlastic, optScheme]) {
  el.addEventListener(el.tagName === "SELECT" ? "change" : "input", () => {
    syncCameraControls();
    rerenderAll();
  });
}
syncCameraControls();

// ─── Demo wiring ─────────────────────
function setupDemo(id, fn) {
  const root = document.getElementById(id);
  const canvas = root.querySelector(".demo-canvas");
  const readout = root.querySelector("[data-readout]");
  const controls = {};
  const ctx = { root, readout };

  root.querySelectorAll("[data-bind]").forEach((el) => {
    const key = el.dataset.bind;
    if (el.tagName !== "BUTTON") controls[key] = el;

    const update = (ev) => {
      const label = el.closest(".control-label");
      const span = label && label.querySelector(".control-value");
      if (span) span.textContent = el.value;
      render({ key, shift: !!(ev && ev.shiftKey) });
    };

    if (el.tagName === "BUTTON") el.addEventListener("click", update);
    else if (el.tagName === "SELECT") el.addEventListener("change", update);
    else if (el.type === "text")
      el.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter") update(ev);
      });
    else el.addEventListener("input", update);
  });

  function render(trigger = null) {
    const vals = {};
    for (const [k, el] of Object.entries(controls))
      vals[k] = el.type === "range" ? parseFloat(el.value) : el.value;
    const svg = fn(vals, ctx, trigger);
    if (svg) canvas.innerHTML = svg;
  }

  render();
  demos.push(() => render(null));
  return render;
}

const isMove = (t) => t && t.key.startsWith("move:");
const moveToken = (t) => t.key.slice(5) + (t.shift ? "'" : "");

// ─── 2. Moves ────────────────────────
setupDemo("demo-moves", (v, ctx, t) => {
  if (!ctx.p) ctx.p = new Erno();
  if (t && (t.key === "apply" || t.key === "seq")) {
    try {
      ctx.p.move(v.seq);
    } catch (err) {
      ctx.p.history.push(`⚠ ${err.message}`);
    }
  }
  if (t && t.key === "reset") ctx.p.reset();
  return tune(ctx.p).toSVG();
});

// ─── 3. Scramble ─────────────────────
setupDemo("demo-scramble", (v, ctx, t) => {
  if (!ctx.p) ctx.p = new Erno();
  if (t && t.key === "scramble") {
    ctx.p.reset();
    ctx.readout.textContent = ctx.p.scramble(v.len);
  }
  if (t && t.key === "reset") {
    ctx.p.reset();
    ctx.readout.textContent = "";
  }
  return tune(ctx.p).toSVG();
});

// ─── 4. State ────────────────────────
setupDemo("demo-state", (v, ctx, t) => {
  if (!ctx.p) ctx.p = new Erno();
  if (t && t.key === "scramble") {
    ctx.p.reset();
    ctx.p.scramble(12);
  }
  if (t && t.key === "reset") ctx.p.reset();
  ctx.readout.textContent = (ctx.p.getState().match(/.{9}/g) || []).join(" ");
  return tune(ctx.p).toSVG();
});

// ─── 5. Sizes ────────────────────────
setupDemo("demo-sizes", (v, ctx, t) => {
  if (!ctx.p || ctx.size !== v.size) {
    ctx.p = new Erno({ size: v.size });
    ctx.size = v.size;
  }
  if (t && t.key === "scramble") ctx.p.scramble();
  if (t && t.key === "reset") ctx.p.reset();
  return tune(ctx.p).toSVG();
});

// ─── 6–9. The classic variants ───────
function variantDemo(id, make, options) {
  setupDemo(id, (v, ctx, t) => {
    if (!ctx.p) ctx.p = make();
    if (t && isMove(t)) ctx.p.move(moveToken(t));
    if (t && t.key === "scramble") ctx.p.scramble();
    if (t && t.key === "reset") ctx.p.reset();
    return tune(ctx.p, options).toSVG();
  });
}

variantDemo("demo-skewb", () => new Skewb());
variantDemo("demo-pyraminx", () => new Pyraminx(), { scheme: false });
variantDemo("demo-void", () => new Void());
/* Painting is a system, not one puzzle: the same option carries the Tetris
   layout, a single face, a gradient by layer, or one flat colour — and the
   flat one is the point, since a puzzle whose pieces are all the same colour
   can never be unsolved. */
const PAINTS = {
  tetris: () => new Tetris(),
  mirror: () => new Mirror({ paint: tetrisPaint }),
  // paint belongs to the piece engine, so a painted 3×3 is a Cuboid — the
  // facelet Erno is a different representation and carries no pieces
  face: () =>
    new Cuboid({
      size: [3, 3, 3],
      paint: ({ letter }) => (letter === "U" ? "#cc2823" : undefined),
    }),
  layers: () =>
    new Cuboid({
      size: [3, 3, 3],
      paint: ({ slot }) => ["#f6ba00", "#cc2823", "#00489f"][Math.round(slot[1]) + 1],
    }),
  flat: () => new Cuboid({ size: [3, 3, 3], paint: () => "#17110c" }),
};

familyDemo("demo-painting", PAINTS, { scheme: false });

// ─── 9c. Cuboids ─────────────────────
const CUBOIDS = {
  domino: () => new Domino(),
  tower: () => new Tower(),
  floppy: () => new Floppy(),
  343: () => new Cuboid({ size: [3, 4, 3] }),
};

setupDemo("demo-cuboids", (v, ctx, t) => {
  if (!ctx.p || ctx.kind !== v.kind) {
    ctx.p = CUBOIDS[v.kind]();
    ctx.kind = v.kind;
  }
  if (t && isMove(t)) {
    try {
      ctx.p.move(moveToken(t));
    } catch {
      // quarter turn about a non-square axis — ignore, the text explains why
    }
  }
  if (t && t.key === "scramble") ctx.p.scramble();
  if (t && t.key === "reset") ctx.p.reset();
  return tune(ctx.p).toSVG({ fitSphere: true });
});

// ─── 9d/9e. Shape mods & turners ─────
function familyDemo(id, kinds, options) {
  setupDemo(id, (v, ctx, t) => {
    if (!ctx.p || ctx.kind !== v.kind) {
      ctx.p = kinds[v.kind]();
      ctx.kind = v.kind;
    }
    if (t && isMove(t)) {
      try {
        ctx.p.move(moveToken(t));
      } catch {
        // token belongs to the other puzzle in the select — ignore
      }
    }
    if (t && t.key === "scramble") ctx.p.scramble();
    if (t && t.key === "reset") ctx.p.reset();
    tune(ctx.p, v.kind === "penrose" ? { scheme: false } : options);
    return ctx.p.toSVG({ fitSphere: true });
  });
}

familyDemo("demo-shapemods", {
  fisher: () => new Fisher(),
  windmill: () => new Windmill(),
  axis: () => new Axis(),
  ghost: () => new Ghost(),
  twist: () => new Twist(),
  penrose: () => new Penrose(),
  pyramorphix: () => new Pyramorphix(),
  mastermorphix: () => new Mastermorphix(),
});

familyDemo("demo-turners", {
  dino: () => new Dino(),
  compy: () => new Compy(),
  masterskewb: () => new MasterSkewb(),
  helicopter: () => new Helicopter(),
});

familyDemo("demo-solids", {
  megaminx: () => new Megaminx(),
  kilominx: () => new Kilominx(),
  skewbdiamond: () => new SkewbDiamond(),
});

// ─── 9f. Welding ─────────────────────
// The palette is the point of this one: rather than fixed buttons it asks
// the puzzle what it can do right now, so the greying-out IS the rule being
// demonstrated. Rebuilt every render, because a turn changes the answer.
const WELDS = {
  siamese: () => new Siamese(),
  siamese2: () => new Siamese({ offset: [1, 2, 0] }),
  corner: () =>
    new Fused({
      bodies: [
        { size: [3, 3, 3], at: [0, 0, 0] },
        { size: [2, 2, 2], at: [1.5, 1.5, 0.5] },
      ],
    }),
  chain: () =>
    new Fused({
      bodies: [
        { size: [3, 3, 3], at: [0, 0, 0] },
        { size: [3, 3, 3], at: [2, 2, 0] },
        { size: [3, 3, 3], at: [4, 4, 0] },
      ],
    }),
  fusedcube: () =>
    new Cube({
      bandage: ({ slot }) => (slot.every((v) => v >= 0) ? "block" : null),
      stickerGroup: true,
    }),
  pair: () =>
    new Cube({ bandage: [[[0, 1, 1], [0, 1, 0]]], stickerGroup: true }),
  column: () =>
    new Cube({
      bandage: ({ slot }) => (slot[0] === 1 && slot[2] === 1 ? "col" : null),
      stickerGroup: true,
    }),
};

let weldRender;
weldRender = setupDemo("demo-welding", (v, ctx, t) => {
  if (!ctx.p || ctx.kind !== v.kind) {
    ctx.p = WELDS[v.kind]();
    ctx.kind = v.kind;
  }
  const p = ctx.p;
  if (t && t.key === "scramble") p.scramble(14);
  if (t && t.key === "reset") p.reset();
  if (t && t.key.startsWith("weld:")) {
    try {
      p.move(t.key.slice(5) + (t.shift ? "'" : ""));
    } catch {
      // the button was live a moment ago and is not any more — nothing to do
    }
  }

  const vocab = (p.def.tokens || []).filter((tok) => !/['2]$/.test(tok));
  const open = vocab.filter((tok) => p.canMove(tok));
  const grid = ctx.root.querySelector("[data-moves]");
  grid.innerHTML = vocab
    .map(
      (tok) =>
        `<button class="weld-move" data-move="${tok}"${
          p.canMove(tok) ? "" : " disabled"
        }>${tok}</button>`,
    )
    .join("");
  grid.querySelectorAll("button").forEach((b) =>
    b.addEventListener("click", (ev) =>
      weldRender({ key: `weld:${b.dataset.move}`, shift: ev.shiftKey }),
    ),
  );
  if (ctx.readout)
    ctx.readout.textContent = `${p.pieces.length} pieces · ${open.length} of ${vocab.length} faces still turn${
      open.length ? "" : " — welded shut"
    }`;

  return tune(p, { scheme: false }).toSVG({ fitSphere: true });
});

setupDemo("demo-mirror", (v, ctx, t) => {
  if (!ctx.p) ctx.p = new Mirror();
  if (t && isMove(t)) ctx.p.move(moveToken(t));
  if (t && t.key === "scramble") ctx.p.scramble();
  if (t && t.key === "reset") ctx.p.reset();
  tune(ctx.p, { scheme: false });
  ctx.p.colors = { ...SCHEMES[v.finish] };
  return ctx.p.toSVG();
});

// ─── 10. Schemes ─────────────────────
setupDemo("demo-schemes", (v, ctx, t) => {
  // start rotated x2: western vs japanese only differ on the D and B faces
  if (!ctx.p) ctx.p = new Erno().move("x2");
  if (t && isMove(t)) ctx.p.move(moveToken(t));
  tune(ctx.p, { scheme: false });
  ctx.p.colors = { ...SCHEMES[v.scheme] };
  return ctx.p.toSVG();
});

// ─── 10b. Generative color ───────────
const CUBE_LETTERS = ["U", "R", "F", "D", "L", "B"];

setupDemo("demo-generative", (v, ctx, t) => {
  if (!ctx.p || ctx.kind !== v.kind) {
    ctx.kind = v.kind;
    if (v.kind === "mosaic") {
      ctx.p = new Void();
      ctx.ramp = generateRamp(ctx.p.pieces.length);
      ctx.p.style(({ piece }) => ({ fill: ctx.ramp[piece] }));
      ctx.readout.textContent = "a ramp across the pieces — scramble it";
    } else {
      ctx.p = new Erno();
      ctx.scheme = generateScheme(CUBE_LETTERS);
      ctx.p.colors = ctx.scheme;
      ctx.readout.textContent = `“${ctx.scheme.name}” — seed ${ctx.scheme.seed}`;
    }
  }
  if (t && t.key === "shuffle") {
    if (v.kind === "mosaic") {
      ctx.ramp = generateRamp(ctx.p.pieces.length);
      ctx.p.style(({ piece }) => ({ fill: ctx.ramp[piece] }));
      ctx.readout.textContent = "a fresh ramp";
    } else {
      ctx.scheme = generateScheme(CUBE_LETTERS);
      ctx.p.colors = ctx.scheme;
      ctx.readout.textContent = `“${ctx.scheme.name}” — seed ${ctx.scheme.seed}`;
    }
  }
  if (t && (t.key === "derive" || t.key === "base")) {
    if (v.kind === "mosaic") {
      ctx.ramp = generateRamp(ctx.p.pieces.length, {
        hueStart: parseInt(v.base.slice(1, 3), 16) * 1.4,
      });
      ctx.p.style(({ piece }) => ({ fill: ctx.ramp[piece] }));
    } else {
      ctx.scheme = schemeFrom(v.base, CUBE_LETTERS);
      ctx.p.colors = ctx.scheme;
      ctx.readout.textContent = `derived from ${v.base} — “${ctx.scheme.name}”`;
    }
  }
  if (t && t.key === "scramble") ctx.p.scramble();
  if (t && t.key === "reset") ctx.p.reset();
  // camera/inset from the panel, but keep our generated colors
  const keep = ctx.p.colors;
  tune(ctx.p, { scheme: false });
  ctx.p.colors = keep;
  return ctx.p.toSVG({ fitSphere: true });
});

// ─── 11. Functional styles ───────────
const STYLE_PRESETS = {
  none: () => null,
  cross: (c) => ({ face, row, col }) => {
    const mid = Math.floor(c.size / 2);
    const isCenter = row === mid && col === mid;
    const dCross = face === "D" && (row === mid || col === mid);
    const sideBottom =
      face !== "U" && face !== "D" && row === c.size - 1 && col === mid;
    return isCenter || dCross || sideBottom ? null : { fill: "#d4d4d4" };
  },
  f2l: (c) => ({ face, row, col }) => {
    const pair =
      (face === "F" && row >= 1 && col === c.size - 1) ||
      (face === "R" && row >= 1 && col === 0);
    return pair ? null : { fill: "#d4d4d4" };
  },
  letters: () => ({ letter }) => ({
    fill: { U: "#fff", D: "#fff", R: "#eee", L: "#eee", F: "#ddd", B: "#ddd" }[letter],
    stroke: "#999",
    strokeWidth: 0.6,
  }),
};

setupDemo("demo-styles", (v, ctx) => {
  if (!ctx.p) ctx.p = new Erno();
  tune(ctx.p);
  ctx.p.style(STYLE_PRESETS[v.preset](ctx.p));
  return ctx.p.toSVG();
});

// ─── 12. Animation ───────────────────
setupDemo("demo-animation", (v, ctx, t) => {
  if (!ctx.p) ctx.p = new Erno();
  const stop = () => {
    if (ctx.raf) cancelAnimationFrame(ctx.raf);
    ctx.raf = 0;
  };

  if (t && t.key === "reset") {
    stop();
    ctx.p.reset();
    return tune(ctx.p).toSVG();
  }

  if (t && (t.key === "play" || t.key === "seq")) {
    stop();
    let tokens;
    try {
      tokens = v.seq.trim().split(/[\s,]+/).filter(Boolean);
      tokens.forEach((tok) => ctx.p.parseMove(tok));
    } catch {
      return tune(ctx.p).toSVG();
    }
    const canvas = ctx.root.querySelector(".demo-canvas");
    const easeOut = (x) => 1 - Math.pow(1 - x, 3);

    const playNext = () => {
      const token = tokens.shift();
      if (!token) {
        ctx.raf = 0;
        return;
      }
      const spec = ctx.p.parseMove(token);
      const quarters =
        spec.quarters !== undefined
          ? Math.abs(spec.quarters)
          : Math.abs(spec.angle) / (Math.PI / 2);
      const total = parseFloat(controlsValue(ctx, "dur") || v.dur) * Math.max(1, quarters);
      const start = performance.now();
      const frame = (now) => {
        const p = Math.min(1, (now - start) / total);
        tune(ctx.p);
        canvas.innerHTML = ctx.p.toSVG({
          fitSphere: true,
          turn: { move: token, progress: easeOut(p) },
        });
        if (p < 1) ctx.raf = requestAnimationFrame(frame);
        else {
          ctx.p.move(token);
          canvas.innerHTML = tune(ctx.p).toSVG({ fitSphere: true });
          playNext();
        }
      };
      ctx.raf = requestAnimationFrame(frame);
    };
    playNext();
    return null; // frames drive the canvas
  }

  if (ctx.raf) return null; // don't fight a running animation
  return tune(ctx.p).toSVG({ fitSphere: true });
});

function controlsValue(ctx, key) {
  const el = ctx.root.querySelector(`[data-bind="${key}"]`);
  return el ? el.value : null;
}

// ─── 13. renderState ─────────────────
const POSITIONS = {
  superflip: () =>
    new Erno().move(
      "U R2 F B R B2 R U2 L B2 R U' D' R2 F R' L B2 U2 F2",
    ),
  checkerboard: () => new Erno().move("M2 E2 S2"),
  cubeincube: () =>
    new Erno().move("F L F U' R U F2 L2 U' L' B D' B' L2 U"),
};

setupDemo("demo-renderstate", (v, ctx) => {
  const state = POSITIONS[v.pos]().getState();
  return Erno.renderState(state, {
    camera: getCamera(3),
    stickerInset: parseFloat(optInset.value),
    plastic: optPlastic.value,
  });
});

/**
 * Compose each plate to its own contents.
 *
 * The four arrangements used to cycle by position, which meant the split
 * between text and demo was decided before anyone knew what was going in
 * it. Across these eighteen plates the prose runs from 159 to 773
 * characters — a 4.9× spread — and the demos carry between one and ten
 * controls, so pairing width to position put the shortest text in the
 * widest column and left a hole under it.
 *
 * Weight is measured instead, and the arrangement follows. Note that a
 * LIGHT plate gets the NARROWER text column, not a wider one: narrow
 * wraps the same words into more lines, so the text fills its plane
 * instead of sitting as a strip above a void. The side still alternates
 * by position, so the composition keeps its rhythm without letting
 * position decide the proportions.
 */
function composePlates() {
  const plates = document.querySelectorAll(".section-row");
  plates.forEach((plate, i) => {
    const text = plate.querySelector(".section-text");
    const demo = plate.querySelector(".section-demo");
    if (!text) return;
    // all prose, not just <p> — the longest plate on the page keeps half its
    // text in a list, and counting paragraphs alone filed it as the lightest
    const bare = text.cloneNode(true);
    bare.querySelectorAll("pre, h2").forEach((n) => n.remove());
    const prose = bare.textContent.replace(/\s+/g, " ").trim().length;
    const codeLines = Array.from(text.querySelectorAll("pre")).reduce(
      (n, pre) => n + pre.textContent.trim().split("\n").length,
      0,
    );
    const controls = demo ? demo.querySelectorAll("[data-bind]").length : 0;
    // code and controls cost vertical room too, so they count toward weight
    const weight = prose + codeLines * 42 + controls * 12;
    // Cuts sit on this page's own terciles (measured: weights run 285–944),
    // so the three arrangements are used in equal share rather than one
    // swallowing the page.
    plate.classList.add(
      weight > 650 ? "plate--heavy" : weight > 470 ? "plate--even" : "plate--light",
    );
    plate.classList.add(i % 2 ? "plate--flip" : "plate--straight");
  });
}

composePlates();

// ─── Hero ────────────────────────────
initHero(document.getElementById("hero"));

/**
 * Compose one — the code block IS the control.
 *
 * The spec is parsed, never evaluated: this reads `key: value` pairs and
 * nothing else, so an editable block on a public page cannot run anything.
 * It costs a few lines against `new Function` and is worth every one.
 */
function parseSpec(text) {
  const body = text.slice(text.indexOf("{") + 1, text.lastIndexOf("}"));
  const spec = {};
  for (const part of body.split(",")) {
    const at = part.indexOf(":");
    if (at < 0) continue;
    const key = part.slice(0, at).trim().replace(/^["']|["']$/g, "");
    const raw = part.slice(at + 1).trim();
    if (!key) continue;
    // fractions are allowed because the classic depths ARE fractions —
    // a Dino is exactly 1/3, and 0.3333 is a different puzzle
    const frac = raw.match(/^(-?[\d.]+)\s*\/\s*([\d.]+)$/);
    if (frac) spec[key] = Number(frac[1]) / Number(frac[2]);
    else if (/^["']/.test(raw)) spec[key] = raw.replace(/^["']|["']$/g, "");
    else if (/^\[/.test(raw)) spec[key] = raw.replace(/[[\]]/g, "").split(/\s+/).map(Number);
    else if (raw !== "" && !Number.isNaN(Number(raw))) spec[key] = Number(raw);
  }
  // `size` is written [3, 2, 3], and splitting the body on commas tore it
  // apart — stitch it back from the original text
  const size = text.match(/size\s*:\s*\[([^\]]*)\]/);
  if (size) spec.size = size[1].split(",").map((n) => parseInt(n, 10));
  return spec;
}

const SPEC_PRESETS = {
  skewb: 'new Puzzle({\n  shape: "cube",\n  turn: "corners",\n  depth: 0\n})',
  dino: 'new Puzzle({\n  shape: "cube",\n  turn: "corners",\n  depth: 1/3\n})',
  helicopter: 'new Puzzle({\n  shape: "cube",\n  turn: "edges",\n  depth: 0.5\n})',
  megaminx: 'new Puzzle({\n  shape: "dodecahedron",\n  depth: 0.32\n})',
  cuboid: 'new Puzzle({\n  shape: "box",\n  size: [3, 2, 3]\n})',
  nobody: 'new Puzzle({\n  shape: "cube",\n  turn: "edges",\n  depth: 0.68\n})',
};

/**
 * Compose one — the code writes itself and the puzzle forms as it goes.
 *
 * The hero builds a sculpture cubie by cubie; this builds a puzzle line by
 * line, which is the same argument in a different register: a puzzle is a
 * description, and you can watch one being written.
 *
 * It rebuilds at property boundaries rather than on every character —
 * parsing and slicing a solid per keystroke is wasted work, and landing the
 * change when a value completes is also what reads as cause and effect.
 *
 * Typing stops for good the moment anyone touches the block. It is a real
 * editor underneath, and an animation that fights the person using it is
 * worse than no animation.
 */
const SPEC_SCRIPT = [
  { label: "a Skewb", text: 'new Puzzle({\n  shape: "cube",\n  turn: "corners",\n  depth: 0\n})' },
  { label: "a Dino", text: 'new Puzzle({\n  shape: "cube",\n  turn: "corners",\n  depth: 1/3\n})' },
  { label: "a Helicopter", text: 'new Puzzle({\n  shape: "cube",\n  turn: "edges",\n  depth: 1/2\n})' },
  { label: "one nobody makes", text: 'new Puzzle({\n  shape: "cube",\n  turn: "edges",\n  depth: 0.68\n})' },
  { label: "a Megaminx", text: 'new Puzzle({\n  shape: "dodecahedron",\n  depth: 0.32\n})' },
  { label: "a Domino", text: 'new Puzzle({\n  shape: "box",\n  size: [3, 2, 3]\n})' },
];

(function composeDemo() {
  const root = document.getElementById("demo-compose");
  if (!root) return;
  const canvas = root.querySelector(".demo-canvas");
  const source = document.getElementById("spec-source");
  const readout = document.querySelector("#compose [data-readout]");
  const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let puzzle = null;
  let typing = null;
  let handedOver = false;

  function rebuild() {
    try {
      puzzle = new Puzzle(parseSpec(source.textContent));
      readout.textContent = `${puzzle.pieces.length} pieces · turns: ${Object.keys(
        puzzle.def.moves || { R: 1, U: 1, F: 1, D: 1, L: 1, B: 1 },
      ).join(" ")}`;
    } catch (err) {
      // a half-typed or unbuildable spec keeps the last good puzzle on
      // screen and says why, rather than blanking mid-keystroke
      readout.textContent = `⚠ ${err.message}`;
      return;
    }
    draw();
  }

  function draw() {
    if (puzzle) canvas.innerHTML = tune(puzzle, { scheme: false }).toSVG({ fitSphere: true });
  }

  /** Stop the reel and leave the block to whoever just touched it. */
  function handOver() {
    if (handedOver) return;
    handedOver = true;
    clearTimeout(typing);
    // the block sits in the text plane and the demo in the other, so the
    // signal has to be raised on the plate they share
    root.closest(".section-row").classList.add("is-live");
  }

  function play(step = 0) {
    if (handedOver) return;
    const target = SPEC_SCRIPT[step % SPEC_SCRIPT.length].text;
    let i = 0;
    source.textContent = "";
    (function type() {
      if (handedOver) return;
      const ch = target[i];
      source.textContent = target.slice(0, ++i);
      // a value has just landed, so show what it built
      if (ch === "," || ch === "}") rebuild();
      if (i < target.length) typing = setTimeout(type, ch === "\n" ? 90 : 26);
      else {
        rebuild();
        typing = setTimeout(() => play(step + 1), 2600);
      }
    })();
  }

  source.addEventListener("input", () => {
    handOver();
    rebuild();
  });
  source.addEventListener("focus", handOver);
  root.querySelectorAll("[data-preset]").forEach((b) =>
    b.addEventListener("click", () => {
      handOver();
      source.textContent = SPEC_PRESETS[b.dataset.preset];
      rebuild();
    }),
  );
  root.querySelector('[data-bind="scramble"]').addEventListener("click", () => {
    handOver();
    if (puzzle) puzzle.scramble();
    draw();
  });
  root.querySelector('[data-bind="reset"]').addEventListener("click", () => {
    handOver();
    if (puzzle) puzzle.reset();
    draw();
  });

  if (still) {
    // no unprompted typing; the block is simply there to be edited
    source.textContent = SPEC_PRESETS.dino;
    handedOver = true;
    root.closest(".section-row").classList.add("is-live");
    rebuild();
  } else {
    rebuild();
    play(0);
  }
  demos.push(draw);
})();
