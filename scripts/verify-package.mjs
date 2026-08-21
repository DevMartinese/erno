/* ─────────────────────────────────────────────────────────────────────────
   The gate a release walks through.

   Packs the package, installs the tarball into a scratch consumer, and
   proves three things about what a stranger receives:

   - every js block in the README runs against the INSTALLED package. The
     README is the npm page, which makes it the first code anyone runs, and
     the first time this gate ran it failed 15 of 32: blocks using letters
     the page never imported, Math never unpacked, a variable fallen from
     the sky. Reading finds none of that. Running finds all of it.
   - both module systems load: import and require.
   - a strict TypeScript consumer of the new API compiles.

   Conventions of the document, honoured rather than tripped over: a line
   ending in "// throws" documents an error and is asserted to THROW; a
   block without imports continues an earlier one; a continuing block that
   says `cube` means the Quick start's 3×3.
   ───────────────────────────────────────────────────────────────────── */
import { execSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, cpSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const run = (cmd, cwd) => execSync(cmd, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });

const work = mkdtempSync(join(tmpdir(), "erno-release-"));
const tarball = run("npm pack --pack-destination " + JSON.stringify(work), root).trim().split("\n").pop();
run("npm init -y", work);
run(`npm i ${JSON.stringify(join(work, tarball))} --no-audit --no-fund`, work);

// ── the README, block by block ──────────────────────────────────────────────
const md = readFileSync(join(root, "README.md"), "utf8");
const blocks = [...md.matchAll(/```js\n([\s\S]*?)```/g)].map((m) => m[1]);

const SHIM = `
const __el = () => new Proxy(function(){}, { get: (t,k) => k === "style" ? {} : __el(), set: () => true, apply: () => __el() });
globalThis.document = { getElementById: __el, querySelector: __el, querySelectorAll: () => [], createElement: __el, addEventListener: () => {}, body: __el() };
globalThis.requestAnimationFrame = (f) => setTimeout(() => f(performance.now()), 0);
const __must = (f, w) => { try { f(); } catch { return; } throw new Error("the README says this throws, and it did not: " + w); };
`;
const armed = (code) =>
  code.split("\n").map((line) => {
    const m = line.match(/^(\s*)(.+?)\s*\/\/\s*(throws.*)$/);
    if (!m || /^\s*\/\//.test(line)) return line;
    return `${m[1]}__must(() => { ${m[2].replace(/;$/, "")} }, ${JSON.stringify(m[3])});`;
  }).join("\n");

const names = new Set(["Cube"]);
let chain = "";
let ok = 0;
const bad = [];
blocks.forEach((code, i) => {
  for (const m of code.matchAll(/import\s*\{([^}]*)\}\s*from\s*['"]erno(\.js)?['"]/g))
    m[1].split(",").map((x) => x.trim()).filter(Boolean).forEach((x) => names.add(x));
  const body = armed(code).split("\n").filter((l) => !/^\s*import\b/.test(l)).join("\n");
  const union = `import { ${[...names].join(", ")} } from "erno.js";`;
  const candidates = [
    `${union}\n${body}`,
    `${union}\nconst cube = new Cube({ size: 3 });\n${body}`,
    `${chain}\n${body}`,
  ];
  let firstErr = "";
  for (const src of candidates) {
    const file = join(work, `rb-${i}.mjs`);
    writeFileSync(file, SHIM + src);
    try {
      run(`node ${JSON.stringify(file)}`, work);
      ok++;
      chain = src;
      firstErr = "";
      break;
    } catch (e) {
      if (!firstErr) firstErr = (String(e.stderr || "").split("\n").find((l) => /Error/.test(l)) || "?").trim();
    }
  }
  if (firstErr) bad.push(`block ${i}: ${firstErr.slice(0, 120)}`);
});

// ── both module systems ─────────────────────────────────────────────────────
writeFileSync(join(work, "esm.mjs"), `
import { Cube, twist, expand } from "erno.js";
const p = new Cube({ size: 3, deform: twist(90) });
if (p.effectOf("R U").order !== 105) throw new Error("order broke");
if (expand("[R, U]") !== "R U R' U'") throw new Error("expand broke");
if (!p.toSVG({ fitSphere: true }).startsWith("<svg")) throw new Error("svg broke");
`);
run("node esm.mjs", work);
writeFileSync(join(work, "cjs.cjs"), `
const { Cube, expand } = require("erno.js");
if (expand("[R: U]") !== "R U R'") throw new Error("cjs expand broke");
if (new Cube({ size: 3 }).pieces.length !== 26) throw new Error("cjs cube broke");
`);
run("node cjs.cjs", work);

// ── a strict TypeScript consumer ────────────────────────────────────────────
const tsc = join(root, "node_modules", "typescript", "bin", "tsc");
writeFileSync(join(work, "check.ts"), `
import { Cube, Cuboid, Fused, expand, twist, SCHEMES } from "erno.js";
const cube = new Cube({ size: 3, deform: twist(90) });
const order: number | null = cube.effectOf("R U").order;
const frame: { halfWidth: number; halfHeight: number } = cube.getFrame();
const vocab: string[] = cube.vocabulary();
const warped: boolean = cube.getPieces()[0].warped;
const box = new Cuboid({ size: [3, 3, 5], paint: () => "#fff" });
const fused = new Fused({ bodies: [{ size: [3, 3, 3], at: [0, 0, 0] }, { size: [2, 2, 2], at: [1.5, 1.5, 0.5] }] });
console.log(expand("[R, U]"), SCHEMES.classic.U, order, frame, vocab.length, warped, box.pieces.length, fused.pieces.length);
`);
run(`node ${JSON.stringify(tsc)} --noEmit --strict --module esnext --target es2022 --moduleResolution bundler check.ts`, work);

console.log(`package gate: README ${ok}/${blocks.length}, esm ok, cjs ok, types ok  (${tarball})`);
if (bad.length) {
  bad.forEach((b) => console.error("  X", b));
  process.exit(1);
}
