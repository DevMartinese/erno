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
  MasterPyraminx,
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
  DICE_CUBE,
  SUDOKU_CUBE,
  DOMINO_PRINT,
  Puzzle,
  Cube,
  Fused,
  Siamese,
} from "../src/erno.js";
import { version } from "../package.json";
import { initHero } from "./hero.js";
import { enhanceRange } from "./controls.js";
import { highlight } from "https://esm.sh/sugar-high";

document.querySelectorAll("pre code").forEach((el) => {
  // Keep the raw source: highlighting replaces it with markup, and the
  // renderer switch rewrites these samples afterwards.
  el.dataset.svgSrc = el.textContent;
  el.innerHTML = highlight(el.textContent);
});

/**
 * Show the sample for the renderer you are looking at.
 *
 * Only one line differs. Everything up to the render call is the mechanism,
 * which is the same either way; `toSVG` returns markup and `getPieces`
 * returns geometry and a matrix, and what you do with the second is the
 * comment underneath.
 */
/**
 * Replace `call(...)` with `replacement`, counting brackets rather than
 * matching them with a regular expression, because the arguments nest:
 * `toSVG({ turn: { move, progress } })` ends three characters after the
 * first `}` a lazy pattern would stop at.
 */
function swapCall(src, call, replacement) {
  let out = "";
  let i = 0;
  for (;;) {
    const at = src.indexOf(call, i);
    if (at === -1) return out + src.slice(i);
    out += src.slice(i, at) + replacement;
    let depth = 0;
    let j = at + call.length - 1;
    for (; j < src.length; j++) {
      if (src[j] === "(") depth++;
      else if (src[j] === ")" && --depth === 0) break;
    }
    i = j + 1;
  }
}

function retellSamples(useWebgl) {
  for (const el of document.querySelectorAll("pre code")) {
    const src = el.dataset.svgSrc;
    if (!src) continue;
    let text = src;
    if (useWebgl && /\bnew [A-Z]|\.move\(|\.toSVG\(/.test(src)) {
      // Where a sample renders, the render call is the only line that
      // differs. Where it only builds a puzzle, nothing differs, and the
      // useful thing to show is what you would do with it next.
      text = src.includes(".toSVG(")
        ? swapCall(src, ".toSVG(", ".getPieces()")
            .replace(/\bdocument\.body\.innerHTML = /g, "const pieces = ")
            .replace(/^(\s*)const svg = /gm, "$1const pieces = ")
        : src;
      text += `\n\n// drawn with three.js: geometry once, a matrix per frame\n${
        text.includes("getPieces") ? "" : "// const pieces = puzzle.getPieces()\n"
      }// mesh.matrix.fromArray(pieces[i].matrix)`;
    }
    el.innerHTML = highlight(text);
  }
}

document.querySelector("h1 .version").textContent = version;

// ─── The index ───────────────────────
// The titles are wrapped so the numeral and the words can be styled apart.
// The index groups the guide by subject, so its own order is not the page's
// and a CSS counter would number the entries by where they sit in the LIST,
// sending you to "X Cuboids" when the plate says XII. The numeral is read off
// the page instead, the same principle as everything else here: the map does
// not restate the territory, it reads it.
const roman = (n) =>
  [[10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]].reduce((out, [v, sym]) => {
    while (n >= v) {
      out += sym;
      n -= v;
    }
    return out;
  }, "");

const plateNumber = new Map();
let plate = 0;
for (const section of document.querySelectorAll("article > .section-row, article > .section-full")) {
  const heading = section.querySelector("h2");
  if (!heading) continue;
  plate += 1;
  // A two-column plate carries its id on the wrapper and a full-width one on
  // the heading itself, so both have to be asked.
  const id = heading.id || section.id;
  if (id) plateNumber.set(id, roman(plate));
}

for (const a of document.querySelectorAll("nav a")) {
  if (!a.querySelector("span")) a.innerHTML = `<span>${a.textContent.trim()}</span>`;
  a.dataset.num = plateNumber.get(a.getAttribute("href").slice(1)) || "";
}

// ─── Enhance all range inputs ────────

document.querySelectorAll('input[type="range"]').forEach(enhanceRange);

// ─── Settings panel ──────────────────
// The panel is fixed and never goes away once shown, so leaving it open
// parks a solid block over the top-right corner of every plate, which is
// exactly where a flipped plate puts its heading and first paragraph, and
// it was cutting words off the ends of lines. It opens on a click instead.
const panel = document.getElementById("settings-panel");
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
const optRenderer = document.getElementById("opt-renderer");

// Same puzzles, other renderer. The engine is not told: it hands out
// getPieces() either way and does not know what happens next.
if (optRenderer)
  optRenderer.addEventListener("input", () => {
    webgl.on = optRenderer.value === "1";
    retellSamples(webgl.on);
    for (const redraw of demos) redraw();
  });

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
    // The demo still runs whichever renderer is on: it is what applies the
    // move. Only where the result is drawn changes.
    const svg = fn(vals, ctx, trigger);
    // Some demos cannot be drawn in WebGL, and each says why on the page
    // rather than ignoring the switch and looking broken.
    if (webgl.on && root.dataset.svgOnly) {
      if (svg) canvas.innerHTML = svg;
      note(root, root.dataset.svgOnly);
      return;
    }
    note(root, null);
    if (webgl.on && ctx.p && typeof ctx.p.getPieces === "function") {
      // A move only reassigns matrices; anything else may have changed the
      // colours, which live in the geometry, so rebuild then.
      drawWebgl(ctx, canvas, !isMove(trigger), ctx.turn);
      markMoves();
      return;
    }
    if (ctx.view) {
      ctx.view.dispose();
      ctx.view = null;
    }
    if (svg) canvas.innerHTML = svg;
    markMoves();
  }

  // Grey out the turns this puzzle refuses from where it is now. The rule is
  // the puzzle's, not the page's: a Twist is moulded and only turns about the
  // axis it was wrung about, a Domino cannot make a quarter turn that would
  // leave it misshapen, a welded pair refuses whatever would tear it. The
  // button says so rather than doing nothing when pressed.
  function markMoves() {
    if (!ctx.p || typeof ctx.p.canMove !== "function") return;
    for (const el of root.querySelectorAll('button[data-bind^="move:"]')) {
      const token = el.dataset.bind.slice(5);
      el.disabled = !ctx.p.canMove(token);
    }
  }

  render();
  demos.push(() => render(null));
  return render;
}

// ─── WebGL, on demand ────────────────
//
// erno knows nothing about three.js. It hands out getPieces(), which is the
// geometry in each piece's own space plus a matrix, and this draws that. The
// module is imported the first time somebody flips the switch, so a reader
// who never does never downloads it.
const webgl = { on: false, module: null };

/** Say, on the demo itself, why it did not switch. */
function note(root, why) {
  let el = root.querySelector(".demo-note");
  if (!why) {
    if (el) el.remove();
    return;
  }
  if (!el) {
    el = document.createElement("p");
    el.className = "demo-note";
    root.querySelector(".demo-canvas").after(el);
  }
  el.textContent = `SVG only: ${why}.`;
}

async function drawWebgl(ctx, canvas, rebuild, turn) {
  if (!webgl.module) webgl.module = await import("./three-view.js");
  if (!ctx.view) ctx.view = await webgl.module.createThreeView(canvas);
  if (rebuild) ctx.view.invalidate();
  ctx.view.show(ctx.p, turn);
}

/**
 * One frame, drawn by whichever renderer is on. The demos that animate run
 * their own loop and used to assign innerHTML straight; they call this
 * instead, so a turn in flight reaches WebGL too rather than snapping.
 * `svg` is a thunk so the string is never built when nothing will read it.
 */
function paintFrame(ctx, canvas, svg, turn) {
  if (webgl.on && ctx.p && typeof ctx.p.getPieces === "function")
    drawWebgl(ctx, canvas, false, turn);
  else canvas.innerHTML = typeof svg === "function" ? svg() : svg;
}

/**
 * A facelet string as a puzzle you can draw from any renderer.
 *
 * `paint` runs at build time, when every sticker is still on its home face,
 * so addressing it by face and index is addressing the string directly. The
 * cube is never turned, so the picture is the string.
 */
function stateAsCube(state) {
  const order = ["U", "R", "F", "D", "L", "B"];
  const per = state.length / 6;
  const size = Math.round(Math.sqrt(per));
  const scheme = SCHEMES.classic;
  return new Cube({
    size,
    paint: ({ face, index }) => scheme[state[order.indexOf(face) * per + index]],
  });
}

const isMove = (t) => t && t.key.startsWith("move:");
const moveToken = (t) => t.key.slice(5) + (t.shift ? "'" : "");

// ─── 2. Moves ────────────────────────
setupDemo("demo-moves", (v, ctx, t) => {
  if (!ctx.p) ctx.p = new Cube();
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
  if (!ctx.p) ctx.p = new Cube();
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
  if (!ctx.p) ctx.p = new Cube({ size: 3 });
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
    ctx.p = new Cube({ size: v.size });
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
    // The frame is the puzzle's own circumsphere, not its current outline.
    // A tight fit is measured on the drawing, so anything that shape-shifts,
    // or simply opens up mid-turn, redraws at a different scale and the
    // puzzle appears to shrink as you use it.
    return tune(ctx.p, options).toSVG({ fitSphere: true });
  });
}

variantDemo("demo-skewb", () => new Skewb());
// The four-layer Pyraminx belongs beside the three-layer one: same solid,
// same axes, one more cut. Its wide turns (Uw, Rw) have no meaning on the
// small one, which familyDemo simply ignores.
familyDemo(
  "demo-pyraminx",
  { pyraminx: () => new Pyraminx(), master: () => new MasterPyraminx() },
  { scheme: false },
);
variantDemo("demo-void", () => new Void());
/* Painting is a system, not one puzzle: the same option carries the Tetris
   layout, a single face, a gradient by layer, or one flat colour, and the
   flat one is the point, since a puzzle whose pieces are all the same colour
   can never be unsolved. */
const PAINTS = {
  tetris: () => new Tetris(),

  mirror: () => new Mirror({ paint: tetrisPaint }),
  // paint belongs to the piece engine, so a painted 3×3 is a Cuboid; the
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

/* Decals get their own plate. They are a different idea from a paint, a mark
   rather than a colour, and the three printings share a frame of their own,
   which a Mirror in the same family would have forced wide. */
familyDemo(
  "demo-decals",
  {
    dice: () => new Cube(DICE_CUBE),
    sudoku: () => new Cube(SUDOKU_CUBE),
    domino: () => new Domino(DOMINO_PRINT),
  },
  { scheme: false },
);

// ─── 9c. Cuboids ─────────────────────
const CUBOIDS = {
  domino: () => new Domino(),
  tower: () => new Tower(),
  floppy: () => new Floppy(),
  343: () => new Cuboid({ size: [3, 4, 3] }),
};

// One frame for the boxes too. They are genuinely different sizes, so here
// sharing is not about hiding a difference, it is what makes the difference
// legible: the cubie stays one size and a Floppy reads as flat rather than
// being blown up to fill the same square as a 3×4×3.
let cuboidFrame = null;
setupDemo("demo-cuboids", (v, ctx, t) => {
  if (cuboidFrame === null)
    cuboidFrame = Math.max(...Object.values(CUBOIDS).map((make) => make()._radius));
  if (!ctx.p || ctx.kind !== v.kind) {
    ctx.p = CUBOIDS[v.kind]();
    ctx.kind = v.kind;
  }
  if (t && isMove(t)) {
    try {
      ctx.p.move(moveToken(t));
    } catch {
      // quarter turn about a non-square axis, so ignore it; the text explains why
    }
  }
  if (t && t.key === "scramble") ctx.p.scramble();
  if (t && t.key === "reset") ctx.p.reset();
  return tune(ctx.p).toSVG({ fitSphere: cuboidFrame });
});

// ─── 9d/9e. Shape mods & turners ─────
function familyDemo(id, kinds, options) {
  // One frame for the whole family. Each puzzle reserves the room its own
  // turns need. A Mirror shape-shifts and asks for a quarter more than a
  // plain 3×3, so framing each to itself makes the cube appear to change
  // size when you change the option and only the frame moved. Built once,
  // from the largest.
  let shared = null;
  const frame = () => {
    if (shared === null)
      shared = Math.max(...Object.values(kinds).map((make) => make()._radius));
    return shared;
  };
  setupDemo(id, (v, ctx, t) => {
    if (!ctx.p || ctx.kind !== v.kind) {
      ctx.p = kinds[v.kind]();
      ctx.kind = v.kind;
    }
    if (t && isMove(t)) {
      try {
        ctx.p.move(moveToken(t));
      } catch {
        // token belongs to the other puzzle in the select, so ignore it
      }
    }
    if (t && t.key === "scramble") ctx.p.scramble();
    if (t && t.key === "reset") ctx.p.reset();
    tune(ctx.p, v.kind === "penrose" ? { scheme: false } : options);
    return ctx.p.toSVG({ fitSphere: frame() });
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

// The welds are framed to their own outline rather than a sphere they barely
// fill, which leaves each one filling its box, so a staircase of three cubes
// and a single bandaged one drew their cubies at 1.7× each other. One frame,
// big enough for the largest, centred on whichever is showing: the cubie is
// then the same size whatever you pick, and a bigger puzzle looks bigger.
let weldBox = null;
function weldFrame(svg) {
  const vb = svg.match(/viewBox="([^"]*)"/)[1].split(" ").map(Number);
  const cx = vb[0] + vb[2] / 2,
    cy = vb[1] + vb[3] / 2;
  return [cx - weldBox / 2, cy - weldBox / 2, weldBox, weldBox];
}

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
      // the button was live a moment ago and is not any more, so there is nothing to do
    }
  }

  const vocab = p.vocabulary().filter((tok) => !/['2]$/.test(tok));
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
      open.length ? "" : ", welded shut"
    }`;

  // Every other demo fits its viewBox to the circumsphere so the frame holds
  // still while a puzzle turns. A welded puzzle is a poor sphere: the
  // staircase filled a tenth of its own frame and read as a distant speck.
  // It does not need the sphere either. With blocking on, a legal turn maps
  // its layer onto itself, so the silhouette is invariant and the tight fit
  // cannot jump. Measured across every legal move and a forty-move scramble
  // on all seven welds: zero drift.
  const tight = tune(p, { scheme: false }).toSVG();
  if (weldBox === null)
    weldBox = Math.max(
      ...Object.values(WELDS).map((make) => {
        const vb = make().toSVG().match(/viewBox="([^"]*)"/)[1].split(" ").map(Number);
        return Math.max(vb[2], vb[3]);
      }),
    );
  return p.toSVG({ viewBox: weldFrame(tight) });
});

setupDemo("demo-mirror", (v, ctx, t) => {
  if (!ctx.p) ctx.p = new Mirror();
  if (t && isMove(t)) ctx.p.move(moveToken(t));
  if (t && t.key === "scramble") ctx.p.scramble();
  if (t && t.key === "reset") ctx.p.reset();
  tune(ctx.p, { scheme: false });
  ctx.p.colors = { ...SCHEMES[v.finish] };
  return ctx.p.toSVG({ fitSphere: true });
});

// ─── 10. Schemes ─────────────────────
setupDemo("demo-schemes", (v, ctx, t) => {
  // start rotated x2: western vs japanese only differ on the D and B faces
  if (!ctx.p) ctx.p = new Cube().move("x2");
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
      ctx.readout.textContent = "a ramp across the pieces, scramble it";
    } else {
      ctx.p = new Cube();
      ctx.scheme = generateScheme(CUBE_LETTERS);
      ctx.p.colors = ctx.scheme;
      ctx.readout.textContent = `“${ctx.scheme.name}”, seed ${ctx.scheme.seed}`;
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
      ctx.readout.textContent = `“${ctx.scheme.name}”, seed ${ctx.scheme.seed}`;
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
      ctx.readout.textContent = `derived from ${v.base}, “${ctx.scheme.name}”`;
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
  if (!ctx.p) ctx.p = new Cube();
  tune(ctx.p);
  ctx.p.style(STYLE_PRESETS[v.preset](ctx.p));
  return ctx.p.toSVG();
});

// ─── 12. Animation ───────────────────
setupDemo("demo-animation", (v, ctx, t) => {
  if (!ctx.p) ctx.p = new Cube();
  const stop = () => {
    if (ctx.raf) cancelAnimationFrame(ctx.raf);
    ctx.raf = 0;
  };

  if (t && t.key === "reset") {
    stop();
    ctx.p.reset();
    return tune(ctx.p).toSVG({ fitSphere: true });
  }

  // Scrubbing is the API in the prose, driven by hand: one move held at a
  // fraction of its turn. The control is a strip of cells, the same form the
  // puzzle is made of, so the thing you drag and the thing you turn are cut
  // from one material.
  if (t && t.key === "scrub") {
    stop();
    const token = (v.seq || "").trim().split(/[\s,]+/).filter(Boolean)[0];
    if (token) {
      try {
        ctx.p.parseMove(token);
        ctx.turn = { move: token, progress: v.scrub / 100 };
        return tune(ctx.p).toSVG({ fitSphere: true, turn: ctx.turn });
      } catch {
        /* a sequence that does not parse simply does not scrub */
      }
    }
    return tune(ctx.p).toSVG({ fitSphere: true });
  }

  if (t && (t.key === "play" || t.key === "seq")) {
    stop();
    let tokens;
    try {
      tokens = v.seq.trim().split(/[\s,]+/).filter(Boolean);
      tokens.forEach((tok) => ctx.p.parseMove(tok));
    } catch {
      return tune(ctx.p).toSVG({ fitSphere: true });
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
        const turn = { move: token, progress: easeOut(p) };
        paintFrame(ctx, canvas, () => ctx.p.toSVG({ fitSphere: true, turn }), turn);
        if (p < 1) ctx.raf = requestAnimationFrame(frame);
        else {
          ctx.p.move(token);
          ctx.turn = null;
          paintFrame(ctx, canvas, () => tune(ctx.p).toSVG({ fitSphere: true }), null);
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
    new Cube().move(
      "U R2 F B R B2 R U2 L B2 R U' D' R2 F R' L B2 U2 F2",
    ),
  checkerboard: () => new Cube().move("M2 E2 S2"),
  cubeincube: () =>
    new Cube().move("F L F U' R U F2 L2 U' L' B D' B' L2 U"),
};

setupDemo("demo-renderstate", (v, ctx) => {
  const state = POSITIONS[v.pos]().getState();
  // renderState keeps no instance because SVG needs none: it turns a string
  // straight into markup. WebGL needs something to place, so the string
  // becomes a paint on a cube that is built and thrown away. Same picture,
  // and it is still the string that decides every sticker.
  ctx.p = stateAsCube(state);
  tune(ctx.p);
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
 * characters, a 4.9× spread, and the demos carry between one and ten
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
    // all prose, not just <p>, since the longest plate on the page keeps half its
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
 * Compose one: the code block IS the control.
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
    // fractions are allowed because the classic depths ARE fractions:
    // a Dino is exactly 1/3, and 0.3333 is a different puzzle
    const frac = raw.match(/^(-?[\d.]+)\s*\/\s*([\d.]+)$/);
    if (frac) spec[key] = Number(frac[1]) / Number(frac[2]);
    else if (/^["']/.test(raw)) spec[key] = raw.replace(/^["']|["']$/g, "");
    else if (/^\[/.test(raw)) spec[key] = raw.replace(/[[\]]/g, "").split(/\s+/).map(Number);
    else if (raw !== "" && !Number.isNaN(Number(raw))) spec[key] = Number(raw);
  }
  // `size` is written [3, 2, 3], and splitting the body on commas tore it
  // apart, so stitch it back from the original text
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
 * Compose one: the code writes itself and the puzzle forms as it goes.
 *
 * The hero builds a sculpture cubie by cubie; this builds a puzzle line by
 * line, which is the same argument in a different register: a puzzle is a
 * description, and you can watch one being written.
 *
 * It rebuilds at property boundaries rather than on every character;
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
