import {
  Skewb,
  Penrose,
  Mirror,
  Ghost,
  Pyraminx,
  Twist,
  Cuboid,
} from "../src/erno.js";

/**
 * Constructive hero — heerichdots-style monoliths built from puzzles.
 *
 * Each scene is ONE monumental abstract voxel artwork (a grid with holes,
 * an organic growth, a stack of shifting slabs…) on a 3-unit lattice where
 * every voxel is a real puzzle: mostly 3×3 cubes, with skewbs, penroses,
 * ghosts and mirrors as texture accents — their cut patterns play the role
 * of heerichdots' triangulated faces. One tight color ramp per scene,
 * sampled by height, keeps the mass reading as a single work.
 *
 * The camera is fixed; the sculpture assembles itself cubie by cubie,
 * holds, dissolves, and the next work begins. Click to skip ahead.
 */
export function initHero(container) {
  /**
   * Someone who asks for less motion gets the finished sculpture rather than
   * the seven-second assembly, and it never dissolves into the next one —
   * the work is the point, the building of it is the flourish. Read live, so
   * changing the system setting takes effect without a reload.
   */
  const stillness = window.matchMedia("(prefers-reduced-motion: reduce)");
  const INSTANT = location.search.includes("instant") || stillness.matches;
  const FREEZE = parseFloat(new URLSearchParams(location.search).get("progress"));
  let animationId = 0;
  let scene = null;
  let grammarIdx = Math.floor(Math.random() * 3);

  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const key = (c) => `${c[0]}|${c[1]}|${c[2]}`;

  /**
   * Plan the lattice from the hero's proportions. Under this projection
   * world X runs almost straight across the picture while Z spends half its
   * length going down, and height is pure vertical — so a square plan can
   * never out-run its own height on screen, and a wide hero is only filled
   * by a plan stretched along X and kept low. (Stretching Z instead would
   * make the mass taller as fast as it makes it wider.)
   */
  function planFor(W, H) {
    const aspect = W / Math.max(1, H);
    const fit = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.round(v)));
    return {
      nx: fit(2 + aspect * 4, 5, 13),
      nz: fit(8 - aspect * 2, 3, 6),
      ny: fit(7.5 - aspect * 1.8, 3, 5),
    };
  }

  // ── shape grammars: cell lists on an integer lattice ──────────────────
  const GRAMMARS = [
    // grid with holes — denser toward the core, floating bits at the rim
    function grid(plan) {
      const nx = plan.nx;
      const ny = plan.ny;
      const nz = plan.nz;
      const cells = [];
      for (let x = 0; x < nx; x++)
        for (let y = 0; y < ny; y++)
          for (let z = 0; z < nz; z++) {
            const d =
              Math.abs(x - (nx - 1) / 2) / nx +
              Math.abs(y - (ny - 1) / 2) / ny +
              Math.abs(z - (nz - 1) / 2) / nz;
            // a gentle falloff, or the plan's far ends never fill and the
            // mass rounds itself back into a blob in the middle
            if (Math.random() < 0.92 - d * 0.72) cells.push([x, y, z]);
          }
      return cells;
    },
    // organic accretion from a couple of seeds
    function growth(plan) {
      const cells = [[0, 0, 0], [1, 0, 1]];
      const seen = new Set(cells.map(key));
      const DIRS = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
      // accretion is isotropic and would settle into a blob in the middle;
      // weighting the horizontal run makes it sprawl out to the plan's ends
      const GROW = [...DIRS, [1,0,0], [-1,0,0], [1,0,0], [-1,0,0]];
      const hx = plan.nx / 2;
      const hz = plan.nz / 2;
      const target = Math.round(plan.nx * plan.nz * plan.ny * rand(0.5, 0.62));
      while (cells.length < target) {
        const c = pick(cells);
        const d = pick(GROW);
        const n = [c[0] + d[0], Math.max(0, c[1] + d[1]), c[2] + d[2]];
        if (Math.abs(n[0]) > hx || n[1] > plan.ny || Math.abs(n[2]) > hz) continue;
        if (seen.has(key(n))) continue;
        seen.add(key(n));
        cells.push(n);
      }
      // densify: fill pockets with 4+ filled neighbours so the mass reads
      // as one sculpture instead of a loose polyomino
      const DIRS6 = DIRS;
      for (const c of [...cells]) {
        for (const d of DIRS6) {
          const n = [c[0] + d[0], c[1] + d[1], c[2] + d[2]];
          if (n[1] < 0 || seen.has(key(n))) continue;
          let count = 0;
          for (const e of DIRS6)
            if (seen.has(key([n[0] + e[0], n[1] + e[1], n[2] + e[2]]))) count++;
          if (count >= 4) {
            seen.add(key(n));
            cells.push(n);
          }
        }
      }
      return cells;
    },
    // shifting slabs — shrinking plates, each nudged off-axis
    function slabs(plan) {
      const cells = [];
      let w = plan.nx + 1;
      let d = plan.nz;
      let ox = 0;
      let oz = 0;
      const levels = plan.ny;
      for (let y = 0; y < levels; y++) {
        for (let x = 0; x < w; x++)
          for (let z = 0; z < d; z++)
            if (Math.random() < 0.94) cells.push([ox + x, y, oz + z]);
        ox += Math.round(rand(0, 1.8));
        oz += Math.round(rand(0, 1.4));
        w = Math.max(3, w - Math.round(rand(0, 2)));
        d = Math.max(2, d - Math.round(rand(0, 1.4)));
      }
      // a floating satellite or two hovering just over the work, like
      // dots' stray cubes
      cells.push([
        ox + Math.round(rand(0, Math.max(0, w - 1))),
        levels + 1,
        oz + Math.round(rand(0, Math.max(0, d - 1))),
      ]);
      if (Math.random() < 0.5)
        cells.push([ox + w + 1, Math.max(1, levels - 2), oz + Math.round(rand(0, 1))]);
      return cells;
    },
  ];

  /**
   * Keep the work reading as one body: take the largest connected group of
   * cells and re-admit only the strays hovering close to it. A cell marooned
   * out at the rim reads as a mistake, and it also stretches the bounding
   * box the whole composition is scaled to fit — one stray in a corner
   * shrinks everything else and hands the hero back its empty margins.
   */
  function tidy(cells) {
    const occ = new Set(cells.map(key));
    const DIRS = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
    const seen = new Set();
    let body = [];
    for (const c of cells) {
      if (seen.has(key(c))) continue;
      seen.add(key(c));
      const group = [];
      const stack = [c];
      while (stack.length) {
        const p = stack.pop();
        group.push(p);
        for (const d of DIRS) {
          const n = [p[0] + d[0], p[1] + d[1], p[2] + d[2]];
          if (occ.has(key(n)) && !seen.has(key(n))) {
            seen.add(key(n));
            stack.push(n);
          }
        }
      }
      if (group.length > body.length) body = group;
    }
    const kept = new Set(body.map(key));
    const hugs = (c) =>
      body.some(
        (b) =>
          Math.abs(b[0] - c[0]) <= 2 &&
          Math.abs(b[1] - c[1]) <= 2 &&
          Math.abs(b[2] - c[2]) <= 2,
      );
    let satellites = 0;
    for (const c of cells)
      if (!kept.has(key(c)) && satellites < 2 && hugs(c)) {
        kept.add(key(c));
        satellites++;
      }
    return cells.filter((c) => kept.has(key(c)));
  }

  // ── fusion: weld adjacent cells into ONE continuous puzzle ────────────
  // A fused pair becomes a single 6×3×3 (or 3×6×3 / 3×3×6) cuboid whose
  // sticker grid runs unbroken across both cells — the engine's arbitrary
  // cuboid support turned into sculpture.
  function fuseCells(cells, rate) {
    const seen = new Set(cells.map(key));
    const used = new Set();
    const AXES = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
    const out = [];
    for (const c of cells) {
      if (used.has(key(c))) continue;
      used.add(key(c));
      let mate = null;
      let axis = 0;
      if (Math.random() < rate) {
        const order = [...AXES].sort(() => Math.random() - 0.5);
        for (const a of order) {
          const n = [c[0] + a[0], c[1] + a[1], c[2] + a[2]];
          if (seen.has(key(n)) && !used.has(key(n))) {
            mate = n;
            axis = AXES.indexOf(a);
            break;
          }
        }
      }
      if (mate) {
        used.add(key(mate));
        out.push({ cells: [c, mate], axis });
      } else {
        out.push({ cells: [c] });
      }
    }
    return out;
  }

  // ── block vocabulary: everything is 3 units, so cells tile exactly ────
  const mk = {
    cube: (o) => new Cuboid({ ...o, size: [3, 3, 3] }),
    skewb: (o) => new Skewb(o),
    penrose: (o) => new Penrose(o),
    ghost: (o) => new Ghost(o),
    mirror: (o) => new Mirror(o),
    twist: (o) => new Twist(o),
    pyra: (o) => new Pyraminx(o),
  };
  const LETTERS = {
    cube: ["U", "R", "F", "D", "L", "B"],
    skewb: ["U", "R", "F", "D", "L", "B"],
    twist: ["U", "R", "F", "D", "L", "B"],
    penrose: ["X", "Y", "Z"],
    pyra: ["F", "L", "R", "D"],
  };
  // The Twist's body is wrung about the vertical axis, so only turns about
  // that axis leave its shape intact — a side turn sends the twisted slabs
  // across orientations and it bursts out of its cell.
  const TWIST_MOVES = ["U", "U'", "U2", "D", "D'", "E", "E'"];

  // The Pyraminx never joins the mass — a tetrahedron inside a cubic
  // lattice reads as a hole. It only ever caps an exposed top cell, where
  // its apex turns that column into a roof. In its view frame the base
  // sits at y = -0.866 and the apex at +2.598, and the footprint leans
  // -0.612 in z, so both offsets are undone when seating it on a cube.
  const PYRA_BASE = 0.866;
  const PYRA_ZOFF = 0.612;

  /** Cells with nothing above them, highest first — candidate roofs. */
  function crownCells(cells) {
    const occ = new Set(cells.map(key));
    // a roof only works where the apex clears its surroundings: nothing
    // taller in the 3×3 column neighbourhood, or the spire reads as buried
    const clear = (c) => {
      for (let dx = -1; dx <= 1; dx++)
        for (let dz = -1; dz <= 1; dz++)
          for (let dy = 1; dy <= 2; dy++)
            if (occ.has(key([c[0] + dx, c[1] + dy, c[2] + dz]))) return false;
      return true;
    };
    const open = cells
      .filter((c) => !occ.has(key([c[0], c[1] + 1, c[2]])) && clear(c))
      .sort((a, b) => b[1] - a[1]);
    if (!open.length) return [];
    // only the upper band can carry a roof, so spires read as the summit
    const cutoff = open[0][1] - 1;
    const band = open.filter((c) => c[1] >= cutoff).sort(() => Math.random() - 0.5);
    const want = 1 + Math.floor(Math.random() * 3);
    const chosen = [];
    for (const c of band) {
      if (chosen.length >= want) break;
      // keep spires apart so they punctuate instead of bristling
      if (chosen.some((o) => Math.abs(o[0] - c[0]) < 2 && Math.abs(o[2] - c[2]) < 2))
        continue;
      chosen.push(c);
    }
    return chosen;
  }

  /**
   * Which puzzles a scene is cast from. Most works are mostly plain cubes
   * with the odd curiosity, but every fourth one or so hands the lead to
   * the curved puzzles and the whole mass turns round-edged and wrung.
   *
   * A curved scene pays for it twice over, so it runs smaller: the twist
   * costs about five times a plain cube to draw and the hero redraws a
   * block once per cubie it reveals, and welding neighbours into long
   * cuboids would put plain cubes back in the majority — hence the much
   * lower fusion rate as well.
   */
  const CASTS = [
    {
      pick: 3,
      budget: 130,
      fuse: 0.42,
      mix: [["cube", 70], ["skewb", 11], ["twist", 6], ["penrose", 6], ["ghost", 4], ["mirror", 3]],
    },
    {
      pick: 1,
      budget: 100,
      fuse: 0.12,
      mix: [["penrose", 45], ["twist", 25], ["cube", 18], ["skewb", 6], ["ghost", 3], ["mirror", 3]],
    },
  ];
  for (const c of CASTS) c.total = c.mix.reduce((s, [, w]) => s + w, 0);
  const CAST_TOTAL = CASTS.reduce((s, c) => s + c.pick, 0);

  function pickCast() {
    if (location.search.includes("curved")) return CASTS[1];
    let r = Math.random() * CAST_TOTAL;
    for (const c of CASTS) if ((r -= c.pick) < 0) return c;
    return CASTS[0];
  }

  function pickType(cast) {
    let r = Math.random() * cast.total;
    for (const [type, w] of cast.mix) if ((r -= w) < 0) return type;
    return "cube";
  }

  /**
   * The scene's whole colour vocabulary, read off the page's own custom
   * properties so the stylesheet stays the single source of truth: if the
   * palette is retuned in CSS, the sculptures follow without a code change.
   * Paper and ink are in the set — in a linocut the paper is a colour too.
   */
  function readUnitPalette() {
    const cs = getComputedStyle(document.documentElement);
    const of = (name, fallback) =>
      (cs.getPropertyValue(name) || "").trim() || fallback;
    return [
      of("--red", "#cc2823"),
      of("--blue", "#00489f"),
      of("--yellow", "#f6ba00"),
      of("--paper", "#f4efe7"),
      of("--ink", "#17110c"),
      of("--red", "#cc2823"),
    ];
  }

  /**
   * Deal the unit colours onto one block's faces. The rotation is driven by
   * height and index rather than randomness, so a column shifts hue-by-hue
   * as it rises and neighbours never land on the same deal — variation
   * without ever leaving the five colours.
   */
  function permuteUnit(unit, letters, level, index) {
    const shift = level * 2 + index;
    const scheme = {};
    letters.forEach((L, i) => {
      scheme[L] = unit[(i + shift) % unit.length];
    });
    return scheme;
  }

  // ── scene lifecycle ───────────────────────────────────────────────────
  function buildScene() {
    const W = container.clientWidth;
    const H = container.clientHeight;
    if (!W || !H) return;
    container.innerHTML = "";

    grammarIdx = (grammarIdx + 1) % GRAMMARS.length;
    const cast = pickCast();
    let cells = tidy(GRAMMARS[grammarIdx](planFor(W, H)));

    // budget: keep the piece count tractable — the hero redraws a block once
    // per cubie it reveals, so this bounds the work of a whole build
    while (cells.length > cast.budget)
      cells.splice(Math.floor(Math.random() * cells.length), 1);

    // fixed camera
    const angle = rand(24, 38);
    const A = (angle * Math.PI) / 180;
    const P = Math.atan(1 / Math.SQRT2);
    const ex = [Math.cos(A), Math.sin(A) * Math.sin(P)];
    const ez = [-Math.sin(A), Math.cos(A) * Math.sin(P)];
    const eyUp = [0, -Math.cos(P)];
    const camera = { type: "isometric", angle };

    // center the lattice, weld neighbours, then measure the screen bbox
    const mean = [0, 1, 2].map((i) => cells.reduce((s, c) => s + c[i], 0) / cells.length);
    const blocks = fuseCells(cells, cast.fuse).map((g) => {
      const c = [0, 1, 2].map((i) => g.cells.reduce((s, cc) => s + cc[i], 0) / g.cells.length);
      const size = [3, 3, 3];
      const fused = g.cells.length === 2;
      if (fused) size[g.axis] = 6;
      return {
        x: (c[0] - mean[0]) * 3,
        y: c[1] * 3 + 1.5,
        z: (c[2] - mean[2]) * 3,
        level: Math.round(c[1]),
        size,
        fused,
        axis: g.axis,
        R: fused ? 2.9 : 1.95, // half projected footprint, world units
      };
    });

    // roofs: pyraminx spires seated on exposed top cells
    for (const c of crownCells(cells))
      blocks.push({
        x: (c[0] - mean[0]) * 3,
        y: c[1] * 3 + 3 + PYRA_BASE,
        z: (c[2] - mean[2]) * 3 + PYRA_ZOFF,
        level: c[1] + 1,
        crown: true,
        R: 2.6,
      });
    const uOf = (b) => b.x * ex[0] + b.z * ez[0];
    const vOf = (b) => b.x * ex[1] + b.z * ez[1] + b.y * eyUp[1];

    /** Screen bounds of a set of blocks, and the fit that frames them. */
    const frame = (set) => {
      let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
      for (const b of set) {
        const su = uOf(b), sv = vOf(b);
        u0 = Math.min(u0, su - b.R); u1 = Math.max(u1, su + b.R);
        v0 = Math.min(v0, sv - b.R); v1 = Math.max(v1, sv + b.R);
      }
      // monumental, near full-bleed
      const k = Math.max(14, Math.min((W * 0.97) / (u1 - u0), (H * 0.94) / (v1 - v0), 72));
      return {
        u0, u1, v0, v1, k,
        cx: W / 2 - ((u0 + u1) / 2) * k,
        cy: H * 0.485 - ((v0 + v1) / 2) * k,
      };
    };

    // every so often the work is built from original Rubik's-colored,
    // scrambled cubes — the icon itself as raw material
    const classic = location.search.includes("classic") || Math.random() < 0.28;

    // The colour story is Vasarely's Plastic Unit: constant forms and a
    // fixed set of homogeneous colours, varied only by PERMUTATION. Hue
    // never wanders, so however many blocks a scene holds it still reads
    // as one composition — and the palette is read straight off the page's
    // own tokens, so the work and the page are painted from one pot.
    const maxLevel = Math.max(...blocks.map((b) => b.level));
    const unit = readUnitPalette();

    // keep the title legible: carve cells over the h1, heerich-style
    let reserved = null;
    const h1 = document.querySelector("article h1");
    if (h1) {
      const hr = container.getBoundingClientRect();
      const r = h1.getBoundingClientRect();
      if (r.top < hr.bottom)
        reserved = {
          x0: r.left - hr.left - 20,
          y0: r.top - hr.top - 20,
          x1: r.left - hr.left + r.width + 20,
          y1: r.top - hr.top + r.height + 20,
        };
    }

    // Carve the title zone FIRST, then reframe. The fit has to be measured
    // on the blocks that actually survive: sizing the frame around the whole
    // composition and only then dropping the ones over the masthead leaves
    // the survivors sitting off-centre, with the carved side reading as dead
    // space. A provisional fit is needed to test the zone in screen space,
    // so the frame is simply taken twice.
    const draft = frame(blocks);
    const kept = reserved
      ? blocks.filter((b) => {
          const sx = draft.cx + uOf(b) * draft.k;
          const sy = draft.cy + vOf(b) * draft.k;
          const rp = b.R * draft.k;
          return !(
            sx + rp > reserved.x0 &&
            sx - rp < reserved.x1 &&
            sy + rp > reserved.y0 &&
            sy - rp < reserved.y1
          );
        })
      : blocks;
    if (!kept.length) return;
    const { u0, u1, v0, v1, k, cx, cy } = frame(kept);

    // Build order: outward from the middle of the composition, so the work
    // grows from its centre toward the edges. Measured on screen rather than
    // in the world, so the ripple spreads evenly in the picture whatever the
    // camera angle. Height breaks ties, which keeps each column stacking
    // bottom-up and lands a pyraminx roof right after the cell it caps.
    const midU = (u0 + u1) / 2;
    const midV = (v0 + v1) / 2;
    for (const b of kept)
      b.spread = Math.hypot(uOf(b) - midU, vOf(b) - midV);
    kept.sort((a, b) => a.spread - b.spread || a.y - b.y);

    const AXIS_MOVES = [["R", "L"], ["U", "D"], ["F", "B"]];
    const items = [];
    for (const blk of kept) {
      const type = blk.crown ? "pyra" : blk.fused ? "cube" : pickType(cast);
      const letters = LETTERS[type];
      const colors =
        classic || !letters
          ? undefined // engine defaults ARE the original scheme
          : permuteUnit(unit, letters, blk.level, items.length);
      const inst = blk.fused
        ? new Cuboid({ camera, stickerInset: 0.12, colors, size: blk.size })
        : mk[type]({ camera, stickerInset: 0.12, colors });
      // classic works read best mid-solve: scramble most of the stable
      // blocks (shape-shifters stay solved so the lattice keeps its form)
      if (classic && type !== "mirror" && type !== "ghost" && Math.random() < 0.65) {
        if (type === "twist")
          inst.move(
            Array.from({ length: 4 }, () => pick(TWIST_MOVES)).join(" "),
          );
        else inst.scramble(3 + Math.floor(Math.random() * 4));
      }
      // some blocks hold a frozen mid-turn — sculpture with puzzle tension
      let turn;
      if (blk.fused && Math.random() < 0.14) {
        // fused cuboids only allow quarter turns about their long axis
        turn = { move: pick(AXIS_MOVES[blk.axis]), progress: rand(0.25, 0.5) };
      } else if (!blk.fused && Math.random() < 0.12) {
        if (type === "cube") turn = { move: pick(["R", "U", "F"]), progress: rand(0.25, 0.5) };
        else if (type === "skewb") turn = { move: pick(["U", "R", "L", "B"]), progress: rand(0.25, 0.45) };
        else if (type === "twist") turn = { move: pick(["U", "D"]), progress: rand(0.25, 0.5) };
      }
      // cubie assembly order: bottom-up, back-to-front, then across
      const order = inst.pieces
        .map((p, i) => ({ i, c: p.centroid }))
        .sort(
          (a, b) =>
            a.c[1] - b.c[1] ||
            a.c[0] + a.c[2] - (b.c[0] + b.c[2]) ||
            a.c[0] - b.c[0],
        );
      const rank = new Array(inst.pieces.length);
      order.forEach((o, ord) => (rank[o.i] = ord));
      const div = document.createElement("div");
      div.className = "hero-puzzle";
      container.appendChild(div);
      items.push({
        ...blk,
        inst,
        rank,
        turn,
        step: type === "twist" ? 2 : 1,
        count: inst.pieces.length,
        radius: inst._radius,
        el: div,
        revealed: -1,
      });
    }

    // schedule: blocks overlap heavily; compress so the work rises in ~7s
    let t = 400;
    let buildSpan = 0;
    for (const it of items) {
      it.buildStart = t;
      it.buildMs = Math.min(1700, Math.max(600, it.count * 45));
      buildSpan = Math.max(buildSpan, t + it.buildMs);
      t += it.buildMs * 0.32;
    }
    const MAXSPAN = 7200;
    if (buildSpan > MAXSPAN) {
      const f = (MAXSPAN - 400 - 900) / (buildSpan - 400);
      buildSpan = 0;
      for (const it of items) {
        it.buildStart = 400 + (it.buildStart - 400) * f;
        buildSpan = Math.max(buildSpan, it.buildStart + it.buildMs);
      }
    }

    // static placement + z-order (the camera never moves)
    items
      .map((it) => ({ it, depth: it.x * Math.sin(A) + it.z * Math.cos(A) + it.y * 0.001 }))
      .sort((a, b) => a.depth - b.depth)
      .forEach(({ it }, zi) => {
        const sx = it.x * ex[0] + it.z * ez[0];
        const sy = it.x * ex[1] + it.z * ez[1] + it.y * eyUp[1];
        const size = it.radius * 2 * k;
        it.el.style.left = `${(cx + sx * k - size / 2).toFixed(1)}px`;
        it.el.style.top = `${(cy + sy * k - size / 2).toFixed(1)}px`;
        it.el.style.width = `${size.toFixed(1)}px`;
        it.el.style.height = `${size.toFixed(1)}px`;
        it.el.style.zIndex = zi + 1;
      });

    // No ground shadow. A soft radial gradient is the one thing on this
    // page pretending to depth, and picture-architecture "absorbs all into
    // a flat plane" — the work sits ON the paper, it does not hover above it.

    scene = {
      items,
      buildSpan,
      holdMs: rand(4500, 7500),
      dissolveMs: 1600,
      phase: "build",
      startTime: undefined,
      phaseStart: 0,
    };
  }

  const easeOut = (x) => 1 - Math.pow(1 - x, 2.2);

  function setRevealed(it, n) {
    n = Math.max(0, Math.min(it.count, n));
    // A block is redrawn from scratch every time its count changes, so the
    // dearer puzzles reveal several cubies at a time. Empty and full states
    // are exact, or a block would never finish assembling.
    if (it.step > 1 && n > 0 && n < it.count)
      n = Math.min(it.count, Math.ceil(n / it.step) * it.step);
    if (n === it.revealed) return;
    it.revealed = n;
    it.el.innerHTML =
      n === 0
        ? ""
        : it.inst.toSVG({ fitSphere: true, turn: it.turn, pieces: (i) => it.rank[i] < n });
  }

  function frame(now) {
    if (!scene) return;
    const s = scene;
    if (s.startTime === undefined) {
      s.startTime = now;
      s.phaseStart = now;
    }
    const rel = now - s.phaseStart;

    if (s.phase === "build") {
      let done = true;
      const effRel = Number.isFinite(FREEZE) ? FREEZE * s.buildSpan : rel;
      for (const it of s.items) {
        const p = INSTANT
          ? 1
          : Math.min(1, Math.max(0, (effRel - it.buildStart) / it.buildMs));
        setRevealed(it, Math.ceil(easeOut(p) * it.count));
        if (p < 1) done = false;
      }
      if (done && !Number.isFinite(FREEZE)) {
        s.phase = "hold";
        s.phaseStart = now;
      }
    } else if (s.phase === "hold") {
      if (rel > s.holdMs && !INSTANT) {
        s.phase = "dissolve";
        s.phaseStart = now;
      }
    } else if (s.phase === "dissolve") {
      // dissolve in reverse: later-built blocks leave first
      let gone = true;
      const n = s.items.length;
      for (let i = 0; i < n; i++) {
        const it = s.items[i];
        const delay = ((n - 1 - i) / n) * s.dissolveMs * 0.5;
        const p = Math.min(1, Math.max(0, (rel - delay) / (s.dissolveMs * 0.6)));
        setRevealed(it, Math.floor((1 - p) * it.count));
        if (p < 1) gone = false;
      }
      if (gone) buildScene();
    }

    animationId = requestAnimationFrame(frame);
  }

  function start() {
    cancelAnimationFrame(animationId);
    buildScene();
    animationId = requestAnimationFrame(frame);
  }

  // Clicking still swaps the work when motion is reduced — the person asked
  // for no unprompted animation, not for no interaction — it just cuts
  // straight to the next one instead of dissolving into it.
  container.addEventListener("click", () => {
    if (!scene) return;
    if (INSTANT) start();
    else if (scene.phase !== "dissolve") {
      scene.phase = "dissolve";
      scene.phaseStart = performance.now();
    }
  });
  let resizeTimer = 0;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(start, 200);
  });
  start();
}
