/* ─────────────────────────────────────────────────────────────────────────
   erno.js/three — the three.js adapter.

   Built on nothing but the public renderer contract: getPieces() hands each
   piece's geometry in its own space plus a column-major matrix, so the
   geometry is built ONCE and moved by matrix every frame, mid-turn
   included; getViewMatrix() says how the puzzle is held, getFrame() gives
   the exact frame toSVG draws in so the two renderers are the same picture,
   and a warped puzzle (a deform function) says `warped: true` and is
   rebuilt as it turns, since a twist has no matrix.

   `three` is an optional peer dependency, imported lazily on first use: a
   consumer who never calls createThreeView never loads it.

     import { createThreeView } from "erno.js/three";
     const view = await createThreeView(container);
     await view.show(puzzle, { move: "R", progress: 0.5 });

   One WebGL context is shared by every view on the page, because a browser
   caps live contexts (Chrome at sixteen) and force-loses the oldest when
   asked for more — a page of twenty-one demos showed broken canvases until
   this drew off-screen and blitted into per-view 2D canvases instead. A
   lost context is asked back and every live view rebuilds and redraws.
   ───────────────────────────────────────────────────────────────────── */

import { bodyOf, roundingOf, shrinkSticker } from "./three-geometry.js";

import { createStage } from "./three-stage.js";

export { createStage };
export { bodyOf } from "./three-geometry.js";

let THREE = null;

/** Load three the first time anyone asks, and only then. */
async function load() {
  if (!THREE) THREE = await import("three");
  return THREE;
}

// Colours arrive as the sRGB hex the SVG uses. Told that, three converts to
// linear on the way in and back on the way out, so #cc2823 leaves the
// renderer as #cc2823 rather than as something darker.
const hex = (c) => new THREE.Color().setStyle(c, THREE.SRGBColorSpace);

/**
 * Build one indexed BufferGeometry per piece, with a colour per vertex.
 *
 * A sticker is the same polygon as the body shrunk toward its own centre,
 * which is where the SVG's black grid comes from, so it is drawn as a second
 * face lifted a hair along the normal. Without the lift the two are coplanar
 * and the depth buffer picks a winner per pixel, which reads as noise.
 */
function buildGeometry(piece, lift, shape = {}) {
  const positions = [];
  const colors = [];
  const index = [];
  // A fraction of the puzzle's own size, not a fixed number: what the lift
  // has to beat is depth-buffer precision, and that is measured against the
  // range the camera covers. At a flat 0.004 a strongly curved sticker fought
  // with the body under it and the Twist came out hatched.
  const LIFT = lift;

  // A vertex is lifted along a normal it SHARES, averaged over the stickers
  // that meet there, never along one facet's own.
  //
  // This is what the stripes were. On a curved strip two facets meet at an
  // edge with different normals; lifting that shared vertex once per facet
  // sent the two copies apart, opening a hairline V through which the black
  // body showed, along every interior edge. It also explains why a bigger
  // lift looked worse rather than better: it was widening the gap it was
  // supposed to be closing.
  const lifted = new Map();
  const at = (q) => `${Math.round(q[0] * 1e6)},${Math.round(q[1] * 1e6)},${Math.round(q[2] * 1e6)}`;
  for (const f of piece.faces) {
    if (!f.sticker) continue;
    for (const q of f.sticker) {
      const k = at(q);
      const acc = lifted.get(k) || [0, 0, 0];
      lifted.set(k, [acc[0] + f.normal[0], acc[1] + f.normal[1], acc[2] + f.normal[2]]);
    }
  }
  for (const [k, n] of lifted) {
    const len = Math.hypot(n[0], n[1], n[2]) || 1;
    lifted.set(k, [n[0] / len, n[1] / len, n[2] / len]);
  }

  const emit = (points, colour, normal, lift) => {
    const base = positions.length / 3;
    const col = hex(colour);
    for (const q of points) {
      const n = lift ? lifted.get(at(q)) || normal : normal;
      positions.push(q[0] + n[0] * lift, q[1] + n[1] * lift, q[2] + n[2] * lift);
      colors.push(col.r, col.g, col.b);
    }
    for (let i = 1; i + 1 < points.length; i++) index.push(base, base + i, base + i + 1);
  };

  // The body, always: it is what shows through the gaps. Its SHAPE is
  // three-geometry.js' answer rather than this file's, so the cubie forms
  // can be proven in node, where there is no context to draw into.
  const body = bodyOf(piece, shape);
  const base0 = positions.length / 3;
  for (let i = 0; i < body.positions.length; i += 3) {
    positions.push(body.positions[i], body.positions[i + 1], body.positions[i + 2]);
    const col = hex(body.colors[i / 3]);
    colors.push(col.r, col.g, col.b);
  }
  for (const i of body.index) index.push(base0 + i);

  // The stickers stay where the mechanism put them - they are the puzzle's
  // state made visible - except that on a rounded body each retreats from
  // the shoulder by the same radius the body did, or it pokes past the
  // silhouette as a sliver of its own colour.
  const retreat = roundingOf(piece, shape);
  for (const f of piece.faces) {
    if (f.sticker) emit(shrinkSticker(f.sticker, retreat), f.color, f.normal, LIFT);
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  g.setIndex(index);
  return g; // unlit, so no normals are needed
}


/**
 * Decals, as one texture.
 *
 * A decal is SVG drawn in a unit square, which is exactly what a texture
 * tile is, so every distinct mark on the puzzle is rasterised once into a
 * grid and each sticker gets the UVs of its own tile. A dice cube has six
 * marks and a Sudokube nine, so the atlas stays small and there is one
 * extra draw call for the whole puzzle rather than one per pip.
 *
 * Returns null when the puzzle wears no marks, which is most of them.
 */
async function buildDecalAtlas(pieces, size = 128) {
  const marks = [...new Set(
    pieces.flatMap((p) => p.faces.map((f) => f.decal)).filter(Boolean),
  )];
  if (!marks.length) return null;

  const cols = Math.ceil(Math.sqrt(marks.length));
  const rows = Math.ceil(marks.length / cols);
  const canvas = document.createElement("canvas");
  canvas.width = cols * size;
  canvas.height = rows * size;
  const ctx = canvas.getContext("2d");

  await Promise.all(
    marks.map(
      (mark, i) =>
        new Promise((done) => {
          const svg =
            `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1" ` +
            `width="${size}" height="${size}">${mark}</svg>`;
          const img = new Image();
          img.onload = () => {
            ctx.drawImage(img, (i % cols) * size, Math.floor(i / cols) * size, size, size);
            done();
          };
          img.onerror = done; // a mark that will not rasterise is left blank
          img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
        }),
    ),
  );

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.flipY = false; // UVs are built in reading order, which runs down
  const index = new Map(marks.map((m, i) => [m, i]));
  return { texture, index, cols, rows };
}

/** Where a point sits inside its own sticker, as a fraction along u and v. */
function uvOf(point, centre, u, v, halfU, halfV) {
  const d = [point[0] - centre[0], point[1] - centre[1], point[2] - centre[2]];
  const du = d[0] * u[0] + d[1] * u[1] + d[2] * u[2];
  const dv = d[0] * v[0] + d[1] * v[1] + d[2] * v[2];
  return [0.5 + du / (2 * halfU), 0.5 + dv / (2 * halfV)];
}

/** The decal quads of one piece, with UVs into the atlas. */
function buildDecalGeometry(piece, atlas, lift) {
  const positions = [];
  const uvs = [];
  const index = [];
  const LIFT = lift; // above the sticker, which is already above the body

  for (const f of piece.faces) {
    if (!f.decal || !f.sticker || !f.decalU || !f.decalV) continue;
    const tile = atlas.index.get(f.decal);
    if (tile === undefined) continue;
    const pts = f.sticker;
    const c = [0, 1, 2].map((k) => pts.reduce((a, q) => a + q[k], 0) / pts.length);
    // half extents along the reading directions, so a rectangular sticker
    // maps its own shape rather than a square guess
    let halfU = 0;
    let halfV = 0;
    for (const q of pts) {
      const d = [q[0] - c[0], q[1] - c[1], q[2] - c[2]];
      halfU = Math.max(halfU, Math.abs(d[0] * f.decalU[0] + d[1] * f.decalU[1] + d[2] * f.decalU[2]));
      halfV = Math.max(halfV, Math.abs(d[0] * f.decalV[0] + d[1] * f.decalV[1] + d[2] * f.decalV[2]));
    }
    if (halfU < 1e-9 || halfV < 1e-9) continue;

    const col = tile % atlas.cols;
    const row = Math.floor(tile / atlas.cols);
    const base = positions.length / 3;
    for (const q of pts) {
      positions.push(
        q[0] + f.normal[0] * LIFT,
        q[1] + f.normal[1] * LIFT,
        q[2] + f.normal[2] * LIFT,
      );
      const [s, t] = uvOf(q, c, f.decalU, f.decalV, halfU, halfV);
      uvs.push((col + s) / atlas.cols, (row + t) / atlas.rows);
    }
    for (let i = 1; i + 1 < pts.length; i++) index.push(base, base + i, base + i + 1);
  }

  if (!index.length) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(index);
  return g;
}

/**
 * A view bound to one container. Call `show(puzzle, turn)` as often as you
 * like; it rebuilds only when it is handed a different puzzle.
 */
/* ─────────────────────────────────────────────────────────────────────────
   One context for the whole page.

   A browser will not give you unlimited WebGL contexts. Chrome's ceiling is
   sixteen, and when the seventeenth is asked for it does not refuse: it
   force-loses the oldest, which is why a page of twenty-one demos showed the
   broken-canvas face on the first few and drew the rest correctly. Measured
   here rather than guessed: asking for twenty-one gave five losses.

   So there is ONE renderer, shared, drawing off-screen, and each view owns a
   plain 2D canvas that it copies the result into. A copy is not free, but it
   is a blit of an image the GPU already has, and it buys a page that cannot
   run out of the thing it was running out of, at any number of demos.

   The renderer's canvas is grown to the largest view that has asked for it
   and every view draws into its bottom-left corner, so switching between
   demos of different sizes never reallocates the drawing buffer.
   ───────────────────────────────────────────────────────────────────── */

let shared = null;
const views = new Set();

function sharedRenderer() {
  if (shared) return shared;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(1); // sizes are handed over in device pixels already
  const canvas = renderer.domElement;

  // A shared context can still be lost: a GPU reset, a driver update, a tab
  // in the background for long enough. Losing it silently is what the broken
  // face was; preventDefault asks for it back, and when it comes back every
  // live view redraws what it was last showing. The geometry has to be built
  // again because it lived in the context that went away.
  canvas.addEventListener("webglcontextlost", (e) => e.preventDefault());
  canvas.addEventListener("webglcontextrestored", () => {
    for (const v of views) v.revive();
  });

  shared = { renderer, canvas, w: 0, h: 0 };
  return shared;
}

export async function createThreeView(
  container,
  { background = "#f4efe7", frame = {}, cubie = "box", core = null } = {},
) {
  await load();

  const gl = sharedRenderer();
  const clear = hex(background);

  // What the page actually sees: an ordinary 2D canvas, holding a copy.
  const surface = document.createElement("canvas");
  surface.style.cssText = "width:100%;height:100%;display:block";
  const paint2d = surface.getContext("2d");

  const scene = new THREE.Scene();
  const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 400);
  const persp = new THREE.PerspectiveCamera(35, 1, 0.01, 400);
  let camera = ortho;

  // No lights. The SVG has no shading either: it reads as solid because of
  // the black plastic between the stickers, not because of a light. Lambert
  // shading turned white into grey and red into maroon, which is a different
  // puzzle. Unlit material gives back the exact colours.

  const group = new THREE.Group();
  scene.add(group);
  container.innerHTML = "";
  container.appendChild(surface);

  let meshes = [];
  let decalMeshes = [];
  let atlas = null;
  let decalMaterial = null;
  let builtFor = null; // which puzzle the geometry belongs to
  let radius = 3;
  let frameW = 3;
  let frameH = 3;

  // How a cubie is shaped and how its inner walls are dressed. Read on every
  // rebuild, so a page may change either and ask for the board again.
  const shape = { cubie, core };

  const material = new THREE.MeshBasicMaterial({
    vertexColors: true,
    side: THREE.DoubleSide,
  });

  async function rebuild(puzzle) {
    for (const m of [...meshes, ...decalMeshes]) m.geometry.dispose();
    if (atlas) atlas.texture.dispose();
    if (decalMaterial) decalMaterial.dispose();
    atlas = null;
    decalMaterial = null;
    decalMeshes = [];
    group.clear();
    radius = puzzle.getRadius();
    if (typeof puzzle.getFrame === "function") {
      // THE SAME FRAME THE CALLER'S SVG ASKS FOR, or this view is not the
      // same picture after all. `getFrame` defaults to a padding of 20 and
      // `toSVG` to the same, so a caller who leaves both alone gets two
      // renderers that agree; a caller who tightens the SVG's padding and
      // cannot say so here gets a puzzle drawn correctly and sized wrong,
      // which is invisible until the two are laid over each other.
      const f = puzzle.getFrame(frame);
      frameW = f.halfWidth;
      frameH = f.halfHeight;
    } else {
      frameW = radius * 1.08;
      frameH = frameW;
    }
    const pieces = puzzle.getPieces();
    meshes = pieces.map((piece) => {
      const mesh = new THREE.Mesh(buildGeometry(piece, radius * 0.008, shape), material);
      mesh.matrixAutoUpdate = false; // the whole point: we assign it ourselves
      group.add(mesh);
      return mesh;
    });

    // The marks, if it wears any: one texture for the whole puzzle, and one
    // extra mesh per piece that has something printed on it.
    atlas = await buildDecalAtlas(pieces);
    if (atlas) {
      decalMaterial = new THREE.MeshBasicMaterial({
        map: atlas.texture,
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      decalMeshes = pieces.map((piece) => {
        const g = buildDecalGeometry(piece, atlas, radius * 0.016);
        if (!g) return null;
        const mesh = new THREE.Mesh(g, decalMaterial);
        mesh.matrixAutoUpdate = false;
        mesh.renderOrder = 1;
        group.add(mesh);
        return mesh;
      });
    }
    builtFor = puzzle;

    // How the whole puzzle is turned to be looked at: a Pyraminx is a
    // tetrahedron described in a cube's coordinates and would otherwise rest
    // on the wrong face, and a caller's deform composes on top. The engine
    // works it out; this used to rebuild it from def.view and _deform by
    // hand, which is exactly the kind of derivation a consumer should never
    // have to repeat.
    group.matrixAutoUpdate = false;
    group.matrix.fromArray(puzzle.getViewMatrix());
    aim(puzzle);
    resize();
  }

  /**
   * Point the camera the way erno's projector does.
   *
   * Its parallel view direction is [sinT·cosP, sinP, cosT·cosP] in render
   * space, with sinT negated so a positive angle orbits toward the R face,
   * and render space flips y and z. Undo the flip and the camera sits at
   * [sin(angle)·cosP, sinP, cos(angle)·cosP].
   *
   * Isometric locks the pitch to atan(1/√2), which is what makes the three
   * axes foreshorten equally, so it is that same formula with the pitch
   * taken out of the caller's hands.
   *
   * Oblique is not a camera at all: it is a shear, and no position or
   * orientation produces it. It falls back to orthographic at the same angle,
   * and the page says so rather than quietly showing something else.
   */
  function aim(puzzle) {
    // `view.camera` is the view's OWN spec, and it wins when it is set.
    //
    // Without it the only way to look at a board from somewhere else is to
    // move the board's camera, and a puzzle is commonly drawn in more than
    // one place at once: a page that let the reader swing this view around
    // would have tilted every other picture of the same object with it.
    // Left null - which is the default - the view is what it always was,
    // the same picture the SVG draws.
    const spec = view.camera || puzzle.camera || { type: "isometric", angle: 30 };
    const type = spec.type || "isometric";
    const angle = ((spec.angle ?? 30) * Math.PI) / 180;
    const pitch =
      type === "isometric"
        ? Math.atan(1 / Math.SQRT2)
        : ((spec.pitch ?? 30) * Math.PI) / 180;
    const dist = Math.max(20, radius * 6);

    if (type === "perspective") {
      camera = persp;
      const d = spec.distance ?? radius * 3.5;
      camera.position.set(radius * 1.2, radius * 0.9, d);
      camera.lookAt(0, 0, 0);
    } else {
      camera = ortho;
      camera.position.set(
        Math.sin(angle) * Math.cos(pitch) * dist,
        Math.sin(pitch) * dist,
        Math.cos(angle) * Math.cos(pitch) * dist,
      );
      camera.lookAt(0, 0, 0);
    }
  }

  // The view's own size, in device pixels, which is what both the renderer's
  // viewport and the 2D canvas are measured in.
  let pw = 0;
  let ph = 0;

  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = container.clientWidth || 1;
    const h = container.clientHeight || w;
    pw = Math.max(1, Math.round(w * dpr));
    ph = Math.max(1, Math.round(h * dpr));
    // Assigning width or height clears a 2D canvas, so only on a real change.
    if (surface.width !== pw || surface.height !== ph) {
      surface.width = pw;
      surface.height = ph;
    }
    // Frame it exactly as the SVG does. The engine is asked rather than
    // guessed at: an eight percent margin here against the SVG's absolute
    // twenty units drew the same puzzle nine percent too large, and the two
    // renderers are supposed to be the same picture.
    const aspect = w / h;
    if (camera === persp) {
      persp.aspect = aspect;
    } else {
      // preserveAspectRatio="xMidYMid meet", which is what an <svg> does:
      // scale until the frame fits, and letterbox the rest.
      const HW = Math.max(frameW, frameH * aspect);
      ortho.left = -HW;
      ortho.right = HW;
      ortho.top = HW / aspect;
      ortho.bottom = -HW / aspect;
    }
    camera.updateProjectionMatrix();
  }

  /**
   * Draw into the shared context, then copy the result here.
   *
   * The renderer's canvas is only ever grown, never shrunk, so a page of
   * mixed sizes allocates one drawing buffer rather than reallocating on
   * every switch. Everyone draws into its bottom-left corner, which is
   * where WebGL's origin is; the copy reads that corner back out.
   *
   * The copy is synchronous with the render, in the same task, so the
   * drawing buffer is still there to be read: it is cleared at composite
   * time, and nothing has composited yet.
   */
  function paint() {
    if (gl.w < pw || gl.h < ph) {
      gl.w = Math.max(gl.w, pw);
      gl.h = Math.max(gl.h, ph);
      gl.renderer.setSize(gl.w, gl.h, false);
    }
    gl.renderer.setViewport(0, 0, pw, ph);
    gl.renderer.setScissor(0, 0, pw, ph);
    gl.renderer.setScissorTest(true);
    gl.renderer.setClearColor(clear, 1);
    gl.renderer.render(scene, camera);
    paint2d.clearRect(0, 0, pw, ph);
    paint2d.drawImage(gl.canvas, 0, gl.h - ph, pw, ph, 0, 0, pw, ph);
  }

  const observer = new ResizeObserver(() => {
    resize();
    if (builtFor) paint();
  });
  observer.observe(container);

  // What this view is showing, so it can be drawn again without being asked:
  // after a resize, and after the shared context comes back from a loss.
  let showing = null;

  // Which `show` is the live one.
  //
  // A rebuild AWAITS the decal atlas, and the meshes it installs are the
  // new puzzle's while the caller that is suspended over that await still
  // holds the old one. Two shows crossing there - a page switching puzzle
  // draws twice in quick succession, and anything animating draws every
  // frame - left one of them reading its own puzzle's pieces out of the
  // other's meshes, which is an undefined at the first index past the
  // shorter of the two. A superseded show simply stops: a newer one is
  // already on its way and will paint.
  let asked = 0;

  const view = {
    /**
     * This view's own camera spec, or null to follow the puzzle's. Same
     * types and fields as `setCamera`; assign and call `show` to look at
     * the same board from somewhere else without moving the board.
     * @type {Object|null}
     */
    camera: null,
    /** Draw `puzzle`, optionally mid-turn. Rebuilds only on a new puzzle. */
    async show(puzzle, turn) {
      const mine = ++asked;
      showing = { puzzle, turn };
      if (puzzle !== builtFor) {
        await rebuild(puzzle);
        if (mine !== asked) return; // another show took the scene meanwhile
      } else {
        aim(puzzle); // the camera panel moves without touching the geometry
        resize();
      }
      const pieces = puzzle.getPieces({ turn });
      // A warped puzzle hands its geometry back already placed and bent, so
      // there is no matrix to assign and the geometry itself has to be
      // rebuilt as it turns. Only these puzzles pay for it, and they pay
      // because the bend follows the piece rather than travelling with it:
      // a twist is not a rigid motion and cannot be made into one.
      if (pieces[0] && pieces[0].warped) {
        for (let i = 0; i < meshes.length; i++) {
          meshes[i].geometry.dispose();
          meshes[i].geometry = buildGeometry(pieces[i], radius * 0.008, shape);
          if (decalMeshes[i]) {
            decalMeshes[i].geometry.dispose();
            decalMeshes[i].geometry = buildDecalGeometry(pieces[i], atlas, radius * 0.016);
          }
        }
      } else {
        for (let i = 0; i < meshes.length; i++) {
          meshes[i].matrix.fromArray(pieces[i].matrix);
          if (decalMeshes[i]) decalMeshes[i].matrix.fromArray(pieces[i].matrix);
        }
      }
      paint();
    },
    /** Paint changed but the mechanism did not: colours live in the geometry. */
    invalidate() {
      builtFor = null;
    },
    dispose() {
      observer.disconnect();
      views.delete(view);
      for (const m of [...meshes, ...decalMeshes]) if (m) m.geometry.dispose();
      if (atlas) atlas.texture.dispose();
      if (decalMaterial) decalMaterial.dispose();
      material.dispose();
      // The renderer is not this view's to dispose: it belongs to the page.
      container.innerHTML = "";
    },
  };

  // Called when the shared context comes back. Everything built in the old
  // one is gone, so the geometry is rebuilt from the puzzle rather than
  // reused, which is what invalidate() already means.
  view.revive = () => {
    if (!showing) return;
    builtFor = null;
    view.show(showing.puzzle, showing.turn);
  };
  views.add(view);
  return view;
}


/* ─────────────────────────────────────────────────────────────────────────
   A stage with a window: renderer, orthographic camera and ONE WORLD FRAME.

   createThreeView frames each puzzle by its own getFrame, which is right
   for a single board and exactly wrong for a voyage: two boards framed
   each to fit are two boards silently rescaled, and the page's doctrine
   is that nothing is ever rescaled - a five is bigger than a three
   because it IS. So this view takes the frame ONCE, in world units, and
   every board ever added is seen through it.

   One renderer of its own, no sharing: a stage page has one continuously
   animating view, not twenty-one stills.
   ───────────────────────────────────────────────────────────────────── */

/**
 * @param {HTMLElement} container
 * @param {Object} options
 * @param {{radius: number, padding?: number}} options.frame - the fixed
 *   world frame: half extent `radius`, plus `padding` in projector units
 *   (tile-relative, default 8) so the same numbers frame the SVG twin.
 * @param {string} [options.background]
 * @param {"box"|"rounded"} [options.cubie]
 * @param {string} [options.core]
 */
export async function createStageView(container, options) {
  await load();
  const stage = await createStage(options);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(2, globalThis.devicePixelRatio || 1));
  renderer.setClearColor(hex(options.background || "#f4efe7"), 1);
  container.innerHTML = "";
  container.appendChild(renderer.domElement);
  renderer.domElement.style.cssText = "width:100%;height:100%;display:block";

  // world half extent: the shared radius plus the same padding the SVG
  // carries, converted at the default tile of 20 projector units per world
  const halfW = options.frame.radius + (options.frame.padding ?? 8) / 20;

  // The frustum hugs the scene. A lazy far plane is not free under an
  // orthographic camera: depth precision is spread over the whole range,
  // and the stickers float 0.008 radii above the body - with far at 4000
  // the two landed in the same depth bucket and the faces came out
  // speckled. Near and far bracket the distance the camera actually
  // stands at, plus the frame it can see.
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 10);
  const spec = { angle: 30, pitch: (Math.atan(1 / Math.SQRT2) * 180) / Math.PI };

  function aim() {
    const a = (spec.angle * Math.PI) / 180;
    const p = (spec.pitch * Math.PI) / 180;
    const dist = Math.max(40, options.frame.radius * 8);
    camera.near = dist - options.frame.radius * 3;
    camera.far = dist + options.frame.radius * 3;
    camera.position.set(
      Math.sin(a) * Math.cos(p) * dist,
      Math.sin(p) * dist,
      Math.cos(a) * Math.cos(p) * dist,
    );
    camera.lookAt(0, 0, 0);
  }

  function resize() {
    const w = container.clientWidth || 1;
    const h = container.clientHeight || w;
    renderer.setSize(w, h, false);
    const aspect = w / h;
    // xMidYMid meet, as the <svg> does: fit the frame, letterbox the rest
    const HW = Math.max(halfW, halfW * aspect);
    camera.left = -HW;
    camera.right = HW;
    camera.top = HW / aspect;
    camera.bottom = -HW / aspect;
    camera.updateProjectionMatrix();
  }

  const observer = new ResizeObserver(() => {
    resize();
    view.render();
  });
  observer.observe(container);

  const view = {
    stage,
    render() {
      renderer.render(stage.scene, camera);
    },
    /** Where the reader left the camera; assign and render to orbit. */
    get angle() {
      return { ...spec };
    },
    aim(angle, pitch) {
      spec.angle = angle;
      if (pitch !== undefined) spec.pitch = pitch;
      aim();
    },
    dispose() {
      observer.disconnect();
      renderer.dispose();
      container.innerHTML = "";
    },
  };
  aim();
  resize();
  return view;
}
