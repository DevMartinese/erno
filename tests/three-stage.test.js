// The stage: boards in a scene, each piece answerable on its own.
//
// three's scene graph runs fine in node - only the WebGLRenderer needs a
// browser - so the whole per-piece contract (visibility, opacity, offset,
// turns, wireframes, several boards at once) is proven here, against the
// real three, with no canvas anywhere.
import { Cube, boardOf } from "../src/erno.js";
import { createStage } from "../src/three-stage.js";

let passed = 0;
let failed = 0;
async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ok — ${name}`);
  } catch (err) {
    failed++;
    console.error(`  FAIL — ${name}\n      ${err.message}`);
  }
}
const assert = (c, m) => {
  if (!c) throw new Error(m || "assertion failed");
};

const T = (m) => [m.elements[12], m.elements[13], m.elements[14]];

await test("a board adds one mesh per piece, and remove() leaves nothing", async () => {
  const stage = await createStage();
  const cube = new Cube({ size: 3 });
  const before = stage.scene.children.length;
  const b = stage.add(cube);
  assert(b.meshes.length === cube.getPieces().length, "one mesh per piece");
  assert(stage.scene.children.length > before, "the board is really in the scene");
  b.remove();
  assert(stage.scene.children.length === before, "remove() takes everything back out");
});

await test("visible(pred) hides exactly the others", async () => {
  const stage = await createStage();
  const b = stage.add(new Cube({ size: 3 }));
  b.visible((i) => i < 5);
  const shown = b.meshes.filter((m) => m.visible).length;
  assert(shown === 5, `5 visible, got ${shown}`);
  b.visible(null);
  assert(b.meshes.every((m) => m.visible), "null shows everyone again");
});

await test("opacity is per piece, and no piece leaks it to a neighbour", async () => {
  const stage = await createStage();
  const b = stage.add(new Cube({ size: 3 }));
  b.opacity(3, 0.4);
  assert(Math.abs(b.meshes[3].material.opacity - 0.4) < 1e-9, "piece 3 wears it");
  assert(b.meshes[3].material.transparent, "and is transparent");
  assert(b.meshes[4].material.opacity === 1, "piece 4 does not");
  b.opacity(3, 1);
  assert(!b.meshes[3].material.transparent, "back to solid at 1");
});

await test("a fading piece stops writing depth, and takes it back when solid", async () => {
  // Seen live, on a real GPU, during the morphs: a half-faded voxel still
  // wrote the depth buffer, so pieces behind it lost the depth test and
  // whole runs of colour vanished for the length of the fade. A fader is
  // see-through; it has no business deciding what is hidden.
  const stage = await createStage();
  const b = stage.add(new Cube({ size: 3 }));
  b.opacity(3, 0.4);
  assert(b.meshes[3].material.depthWrite === false, "mid-fade it writes none");
  b.opacity(3, 1);
  assert(b.meshes[3].material.depthWrite === true, "solid, it occludes again");
});

await test("offset is in world units, on top of the piece's own matrix", async () => {
  const stage = await createStage();
  const b = stage.add(new Cube({ size: 3 }));
  const at = T(b.meshes[0].matrix);
  b.offset(0, [2, 2, 0]);
  const moved = T(b.meshes[0].matrix);
  assert(
    Math.abs(moved[0] - at[0] - 2) < 1e-9 &&
      Math.abs(moved[1] - at[1] - 2) < 1e-9 &&
      Math.abs(moved[2] - at[2]) < 1e-9,
    `moved by [2,2,0], got ${moved.map((v, k) => (v - at[k]).toFixed(3))}`,
  );
  b.offset(0, null);
  assert(T(b.meshes[0].matrix).join() === at.join(), "null puts it back");
});

await test("a turn moves the turning pieces and an offset survives it", async () => {
  const stage = await createStage();
  const cube = new Cube({ size: 3 });
  const b = stage.add(cube);
  const before = b.meshes.map((m) => m.matrix.elements.join());
  b.offset(0, [5, 0, 0]);
  b.turn({ move: "R", progress: 0.5 });
  const changed = b.meshes.filter((m, i) => m.matrix.elements.join() !== before[i]).length;
  assert(changed >= 9, `a mid-R touches at least the R layer, got ${changed}`);
  // piece 0 sits at [-1,-1,-1], baked in place: at rest its matrix is the
  // IDENTITY, so with the offset standing its translation is the offset and
  // nothing else - and a turn that re-reads the board may not eat it
  const at = T(b.meshes[0].matrix);
  assert(Math.abs(at[0] - 5) < 1e-9, `the offset survived the turn, x = ${at[0]}`);
});

await test("a wireframe is the same board in lines, and leaves with the board", async () => {
  const stage = await createStage();
  const b = stage.add(new Cube({ size: 3 }));
  const count = () => {
    let n = 0;
    stage.scene.traverse(() => n++);
    return n;
  };
  const before = count();
  const w = b.wireframe({ opacity: 0.32 });
  assert(count() > before, "the lines are in the scene graph");
  assert(w.lines.length === b.meshes.length, "one line body per piece");
  w.visible((i) => i === 0);
  assert(w.lines.filter((l) => l.visible).length === 1, "and it takes the same filter");
  b.remove();
  assert(count() === 1, "remove() takes the board AND its wireframe out");
});

await test("two boards stand in one scene without stepping on each other", async () => {
  const stage = await createStage();
  const a = stage.add(new Cube({ size: 3 }));
  const b = stage.add(boardOf("3 + 3 @ 2,2,0"));
  assert(a.meshes.length === 26 && b.meshes.length === 48, "both are whole");
  a.opacity(0, 0.5);
  assert(b.meshes[0].material.opacity === 1, "a's fade is not b's");
  a.remove();
  assert(b.meshes.every((m) => m.parent), "b survives a leaving");
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
