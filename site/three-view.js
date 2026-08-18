/* ─────────────────────────────────────────────────────────────────────────
   The same puzzles, in WebGL.

   This is a page of the site, not a part of the library. erno has no idea
   three.js exists and never will: it hands out `getPieces()`, which is the
   geometry in each piece's own space plus a matrix saying where that space
   currently sits, and anything at all can draw that. This file is the proof
   that the SVG renderer is one consumer rather than the point.

   Two things make it cheap. The geometry is built ONCE per puzzle and never
   touched again; a turn only assigns 26 matrices. And three is loaded on
   demand, so a reader who never flips the switch never downloads it.
   ───────────────────────────────────────────────────────────────────── */

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
function buildGeometry(piece, lift) {
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

  for (const f of piece.faces) {
    // the body, always: it is what shows through the gaps
    emit(f.points, f.plastic, f.normal, 0);
    if (f.sticker) emit(f.sticker, f.color, f.normal, LIFT);
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
export async function createThreeView(container, { background = "#f4efe7" } = {}) {
  await load();

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setClearColor(hex(background), 1);
  renderer.domElement.style.cssText = "width:100%;height:100%;display:block";

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
  container.appendChild(renderer.domElement);

  let meshes = [];
  let decalMeshes = [];
  let atlas = null;
  let decalMaterial = null;
  let builtFor = null; // which puzzle the geometry belongs to
  let radius = 3;

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
    const pieces = puzzle.getPieces();
    meshes = pieces.map((piece) => {
      const mesh = new THREE.Mesh(buildGeometry(piece, radius * 0.008), material);
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
    const spec = puzzle.camera || { type: "isometric", angle: 30 };
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

  function resize() {
    const w = container.clientWidth || 1;
    const h = container.clientHeight || w;
    renderer.setSize(w, h, false);
    // fit the puzzle's own sphere, the same reservation fitSphere makes, so
    // the puzzle does not appear to breathe as it shape-shifts
    const half = radius * 1.08;
    const aspect = w / h;
    if (camera === persp) {
      persp.aspect = aspect;
    } else {
      ortho.left = -half * Math.max(1, aspect);
      ortho.right = half * Math.max(1, aspect);
      ortho.top = half * Math.max(1, 1 / aspect);
      ortho.bottom = -half * Math.max(1, 1 / aspect);
    }
    camera.updateProjectionMatrix();
  }

  const observer = new ResizeObserver(() => {
    resize();
    renderer.render(scene, camera);
  });
  observer.observe(container);

  return {
    /** Draw `puzzle`, optionally mid-turn. Rebuilds only on a new puzzle. */
    async show(puzzle, turn) {
      if (puzzle !== builtFor) await rebuild(puzzle);
      else {
        aim(puzzle); // the camera panel moves without touching the geometry
        resize();
      }
      const pieces = puzzle.getPieces({ turn });
      for (let i = 0; i < meshes.length; i++) {
        meshes[i].matrix.fromArray(pieces[i].matrix);
        if (decalMeshes[i]) decalMeshes[i].matrix.fromArray(pieces[i].matrix);
      }
      renderer.render(scene, camera);
    },
    /** Paint changed but the mechanism did not: colours live in the geometry. */
    invalidate() {
      builtFor = null;
    },
    dispose() {
      observer.disconnect();
      for (const m of [...meshes, ...decalMeshes]) if (m) m.geometry.dispose();
      if (atlas) atlas.texture.dispose();
      if (decalMaterial) decalMaterial.dispose();
      material.dispose();
      renderer.dispose();
      container.innerHTML = "";
    },
  };
}
