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
function buildGeometry(piece) {
  const positions = [];
  const colors = [];
  const index = [];
  const LIFT = 0.004;

  const emit = (points, colour, normal, lift) => {
    const base = positions.length / 3;
    const col = hex(colour);
    for (const [x, y, z] of points) {
      positions.push(x + normal[0] * lift, y + normal[1] * lift, z + normal[2] * lift);
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
  // An orthographic camera down the body diagonal is what erno's default
  // isometric projection IS, so flipping the switch changes the renderer and
  // not the picture.
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  camera.position.set(1, 1, 1).normalize().multiplyScalar(20);
  camera.lookAt(0, 0, 0);

  // No lights. The SVG has no shading either: it reads as solid because of
  // the black plastic between the stickers, not because of a light. Lambert
  // shading turned white into grey and red into maroon, which is a different
  // puzzle. Unlit material gives back the exact colours.

  const group = new THREE.Group();
  scene.add(group);
  container.innerHTML = "";
  container.appendChild(renderer.domElement);

  let meshes = [];
  let builtFor = null; // which puzzle the geometry belongs to
  let radius = 3;

  const material = new THREE.MeshBasicMaterial({
    vertexColors: true,
    side: THREE.DoubleSide,
  });

  function rebuild(puzzle) {
    for (const m of meshes) m.geometry.dispose();
    group.clear();
    meshes = puzzle.getPieces().map((piece) => {
      const mesh = new THREE.Mesh(buildGeometry(piece), material);
      mesh.matrixAutoUpdate = false; // the whole point: we assign it ourselves
      group.add(mesh);
      return mesh;
    });
    builtFor = puzzle;
    radius = puzzle._radius || 3;
    // centre the composition the way the SVG frames it
    group.position.set(...(puzzle._viewCenter || [0, 0, 0]).map((v) => -v));
    resize();
  }

  function resize() {
    const w = container.clientWidth || 1;
    const h = container.clientHeight || w;
    renderer.setSize(w, h, false);
    // fit the puzzle's own sphere, the same reservation fitSphere makes, so
    // the puzzle does not appear to breathe as it shape-shifts
    const half = radius * 1.08;
    const aspect = w / h;
    camera.left = -half * Math.max(1, aspect);
    camera.right = half * Math.max(1, aspect);
    camera.top = half * Math.max(1, 1 / aspect);
    camera.bottom = -half * Math.max(1, 1 / aspect);
    camera.updateProjectionMatrix();
  }

  const observer = new ResizeObserver(() => {
    resize();
    renderer.render(scene, camera);
  });
  observer.observe(container);

  return {
    /** Draw `puzzle`, optionally mid-turn. Rebuilds only on a new puzzle. */
    show(puzzle, turn) {
      if (puzzle !== builtFor) rebuild(puzzle);
      const pieces = puzzle.getPieces({ turn });
      for (let i = 0; i < meshes.length; i++)
        meshes[i].matrix.fromArray(pieces[i].matrix);
      renderer.render(scene, camera);
    },
    /** Paint changed but the mechanism did not: colours live in the geometry. */
    invalidate() {
      builtFor = null;
    },
    dispose() {
      observer.disconnect();
      for (const m of meshes) m.geometry.dispose();
      material.dispose();
      renderer.dispose();
      container.innerHTML = "";
    },
  };
}
