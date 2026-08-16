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
variantDemo("demo-tetris", () => new Tetris(), { scheme: false });

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

// ─── Hero ────────────────────────────
initHero(document.getElementById("hero"));
