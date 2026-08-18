/* ─────────────────────────────────────────────────────────────────────────
   The README is the npm page, which makes it the first code anyone runs.
   It is also the easiest thing in the repo to let rot, because nothing
   executes it.
   These tests execute it.
   ───────────────────────────────────────────────────────────────────── */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import * as E from "../src/erno.js";

const README = readFileSync(
  fileURLToPath(new URL("../README.md", import.meta.url)),
  "utf8",
);
const BLOCKS = [...README.matchAll(/```js\n([\s\S]*?)```/g)].map((m) => m[1]);
const EXPORTS = Object.keys(E);

let passed = 0;
let failed = 0;
const test = (name, fn) => {
  try {
    fn();
    passed++;
    console.log(`  ok — ${name}`);
  } catch (err) {
    failed++;
    console.error(`FAIL — ${name}\n      ${err.message}`);
  }
};
const assert = (cond, msg) => {
  if (!cond) throw new Error(msg || "assertion failed");
};

test("the README has examples to check", () => {
  assert(BLOCKS.length > 20, `only ${BLOCKS.length} js blocks found`);
});

test("an example that imports, imports everything it uses", () => {
  // The bug this catches is silent and total: the block reads fine, and the
  // reader who copies it gets "X is not defined". Five blocks had it.
  const broken = [];
  BLOCKS.forEach((block, i) => {
    const line = block.match(/import\s*\{([^}]*)\}\s*from\s*['"]erno(\.js)?['"]/);
    if (!line) return; // no import: it continues an earlier block, which is fine
    const imported = line[1].split(",").map((s) => s.trim()).filter(Boolean);
    const body = block.replace(line[0], "");
    const missing = EXPORTS.filter(
      (name) => new RegExp(`\\b${name}\\b`).test(body) && !imported.includes(name),
    );
    if (missing.length) broken.push(`block ${i + 1} uses ${missing.join(", ")} without importing`);
  });
  assert(!broken.length, broken.join("\n      "));
});

test("every method the examples call exists", () => {
  const BUILTIN = new Set([
    "map", "filter", "join", "split", "forEach", "push", "slice", "toFixed",
    "log", "querySelector", "getElementById", "addEventListener", "repeat",
    "replace", "match", "includes", "floor", "round", "random", "max", "min",
    "now", "requestAnimationFrame", "from", "sort", "flat", "flatMap", "reduce",
    "test", "padStart", "trim", "toString", "concat", "indexOf", "find", "some",
    "every", "abs", "hypot", "sqrt", "pow", "stringify", "parse", "has", "add",
    "set", "get", "elementFromPoint", "closest", "matches", "setAttribute",
    "getAttribute", "toUpperCase", "toLowerCase", "startsWith", "endsWith",
  ]);
  const api = new Set();
  for (const obj of [new E.Cube(), new E.Erno(), E.Twisty, E.Erno]) {
    let o = obj;
    while (o && o !== Object.prototype) {
      for (const k of Object.getOwnPropertyNames(o)) api.add(k);
      o = Object.getPrototypeOf(o);
    }
  }
  const called = [
    ...new Set([...BLOCKS.join("\n").matchAll(/\.([a-zA-Z][a-zA-Z0-9]*)\s*\(/g)].map((m) => m[1])),
  ];
  const invented = called.filter((m) => !api.has(m) && !BUILTIN.has(m));
  assert(!invented.length, `the README calls methods that do not exist: ${invented.join(", ")}`);
});

test("every erno name the examples import is really exported", () => {
  const wrong = [];
  for (const [, names] of README.matchAll(/import\s*\{([^}]*)\}\s*from\s*['"]erno(\.js)?['"]/g))
    for (const n of names.split(",").map((s) => s.trim()).filter(Boolean))
      if (!EXPORTS.includes(n)) wrong.push(n);
  assert(!wrong.length, `not exported: ${[...new Set(wrong)].join(", ")}`);
});

test("the install line names the package that is published", () => {
  const pkg = JSON.parse(
    readFileSync(fileURLToPath(new URL("../package.json", import.meta.url)), "utf8"),
  );
  assert(
    README.includes(`npm install ${pkg.name}`),
    `README does not say "npm install ${pkg.name}"`,
  );
  const wrongImport = [...README.matchAll(/from ['"]([^'"]+)['"]/g)]
    .map((m) => m[1])
    .filter((s) => /^erno/.test(s) && s !== pkg.name);
  assert(!wrongImport.length, `imports from ${[...new Set(wrongImport)].join(", ")}, not ${pkg.name}`);
});

test("the guide's code samples name the package that is published", () => {
  // The same bug as the README's, in the other public place: the site showed
  // `from 'erno'` in thirteen samples while the package is erno.js, so every
  // one of them installed nothing.
  const pkg = JSON.parse(
    readFileSync(fileURLToPath(new URL("../package.json", import.meta.url)), "utf8"),
  );
  const wrong = [];
  for (const file of ["../site/index.html", "../site/playground.html", "../site/gallery.html"]) {
    let text;
    try {
      text = readFileSync(fileURLToPath(new URL(file, import.meta.url)), "utf8");
    } catch {
      continue; // the site is not shipped, so its absence is not a failure
    }
    for (const [, spec] of text.matchAll(/from ['"]([^'"]+)['"]/g))
      if (/^erno/.test(spec) && spec !== pkg.name) wrong.push(`${file}: ${spec}`);
  }
  assert(!wrong.length, `imports the wrong package: ${[...new Set(wrong)].join(", ")}`);
});

test("the counts the README states are the counts the library has", () => {
  const claims = [
    ["3×3 facelets", new E.Erno().getState().length, 54],
    ["5×5 facelets", new E.Erno({ size: 5 }).getState().length, 150],
    ["Skewb pieces", new E.Skewb().pieces.length, 14],
    ["Skewb facelets", new E.Skewb().getState().length, 30],
    ["Pyraminx facelets", new E.Pyraminx().getState().length, 36],
    ["Void pieces", new E.Void().pieces.length, 20],
    ["Void facelets", new E.Void().getState().length, 48],
    ["Megaminx pieces", new E.Megaminx().pieces.length, 62],
    ["Helicopter pieces", new E.Helicopter().pieces.length, 32],
    ["Master Skewb pieces", new E.MasterSkewb().pieces.length, 50],
  ];
  for (const [what, got, want] of claims) assert(got === want, `${what}: ${got}, not ${want}`);

  // and the headline number, which was wrong twice before
  const base = new Set(["Twisty", "Puzzle"]);
  const puzzles = EXPORTS.filter((k) => {
    const v = E[k];
    return (
      typeof v === "function" && /^[A-Z]/.test(k) && !base.has(k) &&
      (v === E.Erno || (v.prototype && v.prototype instanceof E.Twisty))
    );
  });
  assert(
    README.includes(`twenty-nine of them`) && puzzles.length === 29,
    `README says twenty-nine, the library exports ${puzzles.length}`,
  );
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
