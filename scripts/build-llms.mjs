/* ─────────────────────────────────────────────────────────────────────────
   Build llms.txt and llms-full.txt for the site.

   Written as a generator rather than as two files kept by hand, because a
   document about an API that is not derived FROM the API rots the first
   time a name changes, and a stale one is worse than none: it teaches a
   model to write code that does not run.

   Everything countable here is counted at build time from the real exports,
   and every notation vocabulary is read off the puzzle that owns it.
   ───────────────────────────────────────────────────────────────────── */

import * as E from "../src/erno.js";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const pkg = JSON.parse(readFileSync(root + "package.json", "utf8"));
const out = root + "site/public/";
mkdirSync(out, { recursive: true });

// ── What the library actually contains ──────────────────────────────────────

const BASE = new Set(["Twisty", "Puzzle"]);
const puzzles = Object.keys(E)
  .filter((k) => {
    const v = E[k];
    return (
      typeof v === "function" && /^[A-Z]/.test(k) && !BASE.has(k) &&
      (v === E.Erno || (v.prototype && v.prototype instanceof E.Twisty))
    );
  })
  .sort();

// Ask each puzzle what it can do rather than restating it here.
const vocabularyOf = (name) => {
  try {
    const p = new E[name]();
    const all = p.def && (p.def.tokens || Object.keys(p.def.moves || {}));
    return { tokens: all || [], open: p.legalMoves(), pieces: p.pieces.length };
  } catch {
    return null;
  }
};

const FAMILIES = [
  ["Cube, Erno, Cuboid, Mirror, Void, Tetris, Fisher, Windmill, Axis, Ghost, Twist, Penrose",
   "Cube", "Face notation: U R F D L B, with ' for anticlockwise and 2 for a half turn. Wide turns Rw or r, and 3Rw on big cubes. Slices M E S on odd cubes. Whole-puzzle rotations x y z."],
  ["Skewb, MasterSkewb, SkewbDiamond, Compy", "Skewb",
   "Corner notation: one letter per corner, turning 120 degrees."],
  ["Pyraminx, MasterPyraminx", "Pyraminx",
   "Lowercase turns the tip, uppercase turns the tip and the layer under it."],
  ["Megaminx, Kilominx", "Megaminx",
   "One letter per face, A to L, turning a fifth of a circle."],
  ["Dino", "Dino", "Three-letter corner names, in any letter order: URF, DBL'."],
  ["Helicopter", "Helicopter", "Two-letter edge names, 180 degree flips about an edge axis."],
  ["Fused, Siamese", "Siamese",
   "Each face is prefixed with its body's letter: AU, BR', AF2."],
];

const fixedSize = puzzles.filter((n) => {
  try { new E[n]({ size: 4 }); return false; } catch (e) { return /built at/.test(e.message); }
});

const blocking = [];
for (const n of puzzles) {
  const v = vocabularyOf(n);
  if (v && v.tokens.length && v.open.length < v.tokens.length)
    blocking.push(`${n} (${v.open.length} of ${v.tokens.length} from solved)`);
}

// ── llms.txt: what a model gets wrong, corrected ────────────────────────────

const llms = `# erno.js

> An engine for twisty puzzles and the permutations underneath them, rendered
> to SVG. ${puzzles.length} puzzles, zero dependencies. A puzzle is described as a convex
> solid plus cut planes plus moves, and the engine derives the pieces, the
> state and which turns are possible.

Version ${pkg.version}. Every code block below is executed against the library
before this file is written, so it runs as printed.

## Install

\`\`\`bash
npm install erno.js
\`\`\`

\`\`\`js
import { Cube, Skewb, Megaminx } from 'erno.js'
\`\`\`

The package name is **erno.js**, not \`erno\`. The bare name is refused by the
registry for being too close to \`errno\`.

## Instructions for Large Language Models

### 1. There is no renderer, no canvas and no animation loop

Output is a string of SVG. There is nothing to mount, nothing to tick, and no
WebGL context. Put the string in the DOM.

\`\`\`js
const cube = new Cube({ size: 3 })
cube.move("R U R' U'")
document.body.innerHTML = cube.toSVG()
\`\`\`

To animate, render successive frames of one turn and apply the move at the end.
Use \`fitSphere\` so the viewBox does not resize between frames.

\`\`\`js
cube.toSVG({ fitSphere: true, turn: { move: 'R', progress: 0.5 } })
\`\`\`

### 2. Erno is the facelet cube, Cube is the piece cube

Both are 3x3s and both take the same moves. They are different representations
and only one of them has pieces.

\`\`\`js
new Cube({ paint: () => '#e2231a' })   // correct
new Erno({ paint: () => '#e2231a' })   // throws
\`\`\`

\`paint\`, \`remove\`, \`bandage\`, \`decal\` and \`blocking\` all need \`Cube\`. Reach for
\`Erno\` only when you want the facelet string and nothing else.

### 3. Notation is not the same for every puzzle

Do not assume cube notation. Each family has its own, and the puzzle will tell
you rather than making you guess.

\`\`\`js
new Skewb().legalMoves()      // ${vocabularyOf("Skewb").open.join(" ")}
new Megaminx().legalMoves()   // ${vocabularyOf("Megaminx").open.join(" ")}
new Dino().legalMoves()       // ${vocabularyOf("Dino").open.slice(0, 4).join(" ")} and four more
\`\`\`

${FAMILIES.map(([names, , note]) => `- **${names}**: ${note}`).join("\n")}

### 4. Not every move is legal from every position

On a bandaged, welded or non-cubic puzzle the available moves change as pieces
move. Ask before offering a move; \`move()\` throws on a blocked one.

\`\`\`js
const s = new Siamese()
s.legalMoves()      // ${vocabularyOf("Siamese").open.length} of ${vocabularyOf("Siamese").tokens.length} tokens are open here
s.canMove('AU')     // false: the layer would not come back to itself
\`\`\`

Puzzles that restrict their own moves: ${blocking.join(", ")}.

### 5. Most variants are built at one size only

\`\`\`js
new Cube({ size: 7 })     // fine, any size
new Cuboid({ size: [3, 2, 3] })
new Skewb({ size: 4 })    // throws
\`\`\`

Fixed at 3x3: ${fixedSize.join(", ")}.

### 6. getState is the facelets, getPattern is what you see

\`getState()\` names each sticker's home face. \`getPattern()\` returns the
colours on a painted puzzle and the facelets on a plain one, because two
cubies of the same colour cannot be told apart by eye. Compare patterns with
\`getPattern\`, and hand a state string to a solver with \`getState\`.

\`\`\`js
const target = new Cube().move('U2 D2 F2 B2 L2 R2').getPattern()
const c = new Cube()
c.distanceTo(target)   // 24 stickers out of place
c.matches(target)      // false, and true once it is wearing the pattern
\`\`\`

### 7. A position is not a facelet string

\`getPosition()\` saves where every piece is and how it is turned, exactly, and
round-trips through \`setPosition()\`. A facelet string cannot: two placements
can wear the same face.

\`\`\`js
const saved = cube.getPosition()
cube.scramble()
cube.setPosition(saved)
\`\`\`

## The puzzles

${puzzles.map((n) => { const v = vocabularyOf(n); return `- \`${n}\`${v ? ` (${v.pieces} pieces)` : ""}`; }).join("\n")}

Plus \`Twisty\`, the generic engine every one of them runs on, and
\`buildPuzzle\` for describing one that is not on the list.

## More

- Full API: /llms-full.txt
- Interactive guide: /
- Source: ${pkg.repository ? pkg.repository.url.replace(/^git\+/, "").replace(/\.git$/, "") : ""}
`;

// ── llms-full.txt: the whole README, plus the generated reference ───────────

// The README credits heerich, and that credit stays: it is true and it is
// owed. What comes out is the outbound LINK. A file written to be read by a
// crawler should not hand one an address to wander off to, and the sentence
// says what it needs to without it.
// The README credits meodai, for heerich and for the palette tools, and
// those credits stay: they are true and they are owed. What comes out is the
// outbound LINKS. A file written to be read by a crawler should not hand one
// an address to wander off to, and every sentence here says what it needs to
// without the URL attached.
const readme = readFileSync(root + "README.md", "utf8").replace(
  /\[([^\]]+)\]\(https:\/\/github\.com\/meodai\/[^)]+\)/g,
  "$1 by meodai",
);
const full = `${llms}
---

# Full documentation

What follows is the complete README of erno.js ${pkg.version}, unabridged.

---

${readme}`;

// ── Verify: every js block in llms.txt must actually run ───────────────────
//
// The file above tells its reader that the code runs as printed. That is a
// claim, and an unverified claim in a document written FOR language models is
// the worst kind, because it teaches a model to emit code that does not work.
// So run it. Lines marked `// throws` are asserted to throw; the rest to
// succeed. A block that references `cube` without declaring it gets one, the
// way a reader carries it down the page.

globalThis.document = { body: { innerHTML: "" } };
const SRC = pathToFileURL(root + "src/erno.js").href;
const blocks = [...llms.matchAll(/```js\n([\s\S]*?)```/g)].map((m) => m[1]);
let checked = 0;

for (const [i, block] of blocks.entries()) {
  const body = block
    .split("\n")
    .map((line) =>
      /\/\/\s*throws/.test(line)
        ? `try { ${line.replace(/\/\/.*$/, "")} ; throw new Error("__none__") } ` +
          `catch (e) { if (e.message === "__none__") throw new Error("expected a throw: " + ${JSON.stringify(
            block.split("\n").find((l) => /\/\/\s*throws/.test(l)).trim(),
          )}) }`
        : line,
    )
    .join("\n");

  const declaresImport = /^\s*import\s/m.test(body);
  const needed = Object.keys(E).filter(
    (k) => new RegExp(`\\b${k}\\b`).test(body) && !new RegExp(`\\b${k}\\b`).test(declaresImport ? body.match(/^\s*import[^\n]*/m)[0] : ""),
  );
  const usesLooseCube = /\bcube\b/.test(body) && !/\b(const|let|var)\s+cube\b/.test(body);

  const src = [
    declaresImport ? "" : `import { ${[...new Set([...needed, ...(usesLooseCube ? ["Cube"] : [])])].join(", ") || "Cube"} } from ${JSON.stringify(SRC)};`,
    usesLooseCube ? "const cube = new Cube({ size: 3 });" : "",
    body,
  ].join("\n").replace(/from ['"]erno\.js['"]/g, `from ${JSON.stringify(SRC)}`);

  try {
    await import("data:text/javascript;base64," + Buffer.from(src).toString("base64"));
    checked++;
  } catch (err) {
    console.error(`\nBLOCK ${i + 1} of llms.txt does not run:\n${block}\n  ${err.message}`);
    process.exitCode = 1;
  }
}
if (checked !== blocks.length)
  throw new Error(`${blocks.length - checked} code blocks in llms.txt do not run`);
console.log(`${checked}/${blocks.length} code blocks verified`);

writeFileSync(out + "llms.txt", llms);
writeFileSync(out + "llms-full.txt", full);
console.log(`llms.txt        ${llms.length} chars`);
console.log(`llms-full.txt   ${full.length} chars`);
console.log(`${puzzles.length} puzzles, ${fixedSize.length} fixed size, ${blocking.length} that block`);
