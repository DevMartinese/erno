/* ─────────────────────────────────────────────────────────────────────────
   Does the code the page prints actually run, and does it draw that page?

   The Pattern example generates a snippet from the state it is drawing
   from and claims you can paste it beside the library and get the puzzle on
   screen, in the position on screen. This checks the claim, because when it
   was first made it was false in four different ways: the snippet used the
   face letters without importing them, unpacked no Math so `hypot` threw,
   left out stickerInset so it drew the right puzzle in the wrong picture,
   and could not reproduce the board at all because the opening scramble is
   deliberately kept out of history.

   Feed it the JSON that tests/browser/snippets.html collects:

     node tests/browser/verify-snippets.mjs snippets.json

   Each case is {etiqueta, code, huella}, the huella being every polygon's
   points and fill as the browser has them. Compared on content and not on
   text, because the browser rewrites <polygon /> as <polygon></polygon> and
   a diff of the markup only ever measures that.
   ───────────────────────────────────────────────────────────────────── */

import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execSync } from "node:child_process";

const casos = JSON.parse(readFileSync(process.argv[2], "utf8"));
const LIB = "/Users/gonzalomartinesse/Desktop/erno-heerich/erno/src/erno.js";
const dir = mkdtempSync(join(tmpdir(), "erno-snip-"));

// El navegador reescribe <polygon /> como <polygon></polygon>, asi que
// comparar el texto compara la serializacion. Lo que importa es el contenido:
// cada poligono, sus puntos y su color, en orden.
const TAIL = [
  'const svg = puzzle.toSVG({ fitSphere: true, padding: 8 });',
  'const tags = svg.match(/<polygon[^>]*>/g) || [];',
  'const attr = (t, k) => (t.match(new RegExp(k + \'="([^"]*)"\')) || [, ""])[1];',
  'process.stdout.write(tags.map((t) => attr(t, "points") + "|" + attr(t, "fill")).join("\\n"));',
].join("\n");

let ok = 0;
const bad = [];
for (const c of casos) {
  const src = c.code
    .replace('from "erno.js"', `from ${JSON.stringify(LIB)}`)
    .replace("puzzle.toSVG({ fitSphere: true });", TAIL);
  const file = join(dir, c.etiqueta.replace(/[^a-z0-9]/gi, "_") + ".mjs");
  writeFileSync(file, src);
  try {
    const mio = execSync(`node ${JSON.stringify(file)}`, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
    if (mio === c.huella.trim()) {
      ok++;
      console.log("IGUAL     " + c.etiqueta);
    } else {
      bad.push(c.etiqueta);
      const a = c.huella.trim().split("\n"), b = mio.split("\n");
      let i = 0; while (i < Math.min(a.length, b.length) && a[i] === b[i]) i++;
      console.log(`DISTINTO  ${c.etiqueta.padEnd(30)} ${a.length} vs ${b.length} poligonos, difieren en el ${i}`);
    }
  } catch (e) {
    bad.push(c.etiqueta);
    const err = String(e.stderr || "").split("\n").find((l) => /Error/.test(l)) || "?";
    console.log(`ROMPE     ${c.etiqueta.padEnd(30)} ${err.trim().slice(0, 80)}`);
  }
}
console.log(`\nel fragmento reproduce la pantalla: ${ok} de ${casos.length}`);
