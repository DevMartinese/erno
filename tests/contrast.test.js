/* ─────────────────────────────────────────────────────────────────────────
   The site's colour, measured.

   Contrast was chosen by eye and recorded as WCAG ratios in a comment, which
   is a claim nothing checked. APCA models reading better and is stricter, and
   under it five of the seven muted colours were below the floor for text at
   reading size: the masthead subtitle sat at Lc 62 and the version number
   beside the wordmark at Lc 51.

   This runs the numbers on every pair the stylesheet actually declares, so
   the next hand-picked grey fails here instead of on the page.
   ───────────────────────────────────────────────────────────────────── */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const CSS = readFileSync(
  fileURLToPath(new URL("../site/site.css", import.meta.url)),
  "utf8",
);

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

// ── APCA-W3 0.1.9 ───────────────────────────────────────────────────────────
// Lc is signed: positive for dark text on light, negative for the reverse.
// Its magnitude is the readability. Validated below against the three values
// the specification publishes, so a mistake here cannot pass silently.
const channel = (v) => Math.pow(v / 255, 2.4);
const luminance = (hex) => {
  const n = parseInt(hex.replace("#", ""), 16);
  return (
    0.2126729 * channel((n >> 16) & 255) +
    0.7151522 * channel((n >> 8) & 255) +
    0.072175 * channel(n & 255)
  );
};
function apca(text, bg) {
  const soften = (y) => (y < 0.022 ? y + Math.pow(0.022 - y, 1.414) : y);
  const t = soften(luminance(text));
  const b = soften(luminance(bg));
  if (Math.abs(b - t) < 0.0005) return 0;
  if (b > t) {
    const s = (Math.pow(b, 0.56) - Math.pow(t, 0.57)) * 1.14;
    return s < 0.1 ? 0 : (s - 0.027) * 100;
  }
  const s = (Math.pow(b, 0.65) - Math.pow(t, 0.62)) * 1.14;
  return s > -0.1 ? 0 : (s + 0.027) * 100;
}

// ── color-mix(in oklab, …), resolved the way the browser resolves it ────────
const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const toSrgb = (c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);
const oklab = (hex) => {
  const n = parseInt(hex.replace("#", ""), 16);
  const [r, g, b] = [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255].map(toLinear);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
};
const fromOklab = ([L, A, B]) => {
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  return (
    "#" +
    [
      4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
      -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
      -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
    ]
      .map((c) => Math.max(0, Math.min(255, Math.round(toSrgb(c) * 255))).toString(16).padStart(2, "0"))
      .join("")
  );
};
const mixOklab = (a, b, share) => {
  const A = oklab(a);
  const B = oklab(b);
  return fromOklab(A.map((v, i) => v * share + B[i] * (1 - share)));
};

// ── The tokens, read off the stylesheet rather than restated here ───────────
const tokenOf = (name) => {
  const m = new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, "i").exec(CSS);
  assert(m, `--${name} is not declared in site.css`);
  return m[1];
};
const quietShare = (name) => {
  const m = new RegExp(
    `--${name}:\\s*color-mix\\(in oklab, var\\(--text\\) (\\d+)%`,
    "i",
  ).exec(CSS);
  assert(m, `--${name} is not a color-mix on --text`);
  return Number(m[1]) / 100;
};

test("the APCA implementation matches the published values", () => {
  for (const [text, bg, want] of [
    ["#000000", "#ffffff", 106.04],
    ["#ffffff", "#000000", -107.88],
    ["#888888", "#ffffff", 63.06],
  ])
    assert(
      Math.abs(apca(text, bg) - want) < 0.05,
      `${text} on ${bg}: ${apca(text, bg).toFixed(2)}, published ${want}`,
    );
});

test("no text at reading size falls below the APCA floor", () => {
  const paper = tokenOf("paper");
  const ink = tokenOf("ink");
  const FLOOR = 75; // Lc 75 is fluent reading; below it, body text strains
  const pairs = [
    ["body", ink, paper],
    ["paper on ink", paper, ink],
    ["paper on blue", paper, tokenOf("blue")],
    ["--text-quiet", mixOklab(ink, paper, quietShare("text-quiet")), paper],
    ["--text-quiet-xs", mixOklab(ink, paper, quietShare("text-quiet-xs")), paper],
  ];
  for (const [what, text, bg] of pairs) {
    const lc = Math.abs(apca(text, bg));
    assert(lc >= FLOOR, `${what}: Lc ${lc.toFixed(1)}, below the floor of ${FLOOR}`);
  }
});

test("the smaller quiet voice carries more ink, not less", () => {
  // The mistake this catches is the intuitive one: making small text fainter
  // because it is small. Resolving the same ink costs more at a smaller size.
  const paper = tokenOf("paper");
  const ink = tokenOf("ink");
  const quiet = Math.abs(apca(mixOklab(ink, paper, quietShare("text-quiet")), paper));
  const xs = Math.abs(apca(mixOklab(ink, paper, quietShare("text-quiet-xs")), paper));
  assert(xs > quiet, `--text-quiet-xs is Lc ${xs.toFixed(1)}, no more than --text-quiet at ${quiet.toFixed(1)}`);
});

test("red and yellow planes carry only what they can", () => {
  // Neither reaches the floor for paragraphs, and neither is asked to: they
  // carry headings and labels. What matters is that they clear the bar for
  // that, and that ink never goes on red.
  const paper = tokenOf("paper");
  const ink = tokenOf("ink");
  const onRed = Math.abs(apca(paper, tokenOf("red")));
  const onYellow = Math.abs(apca(ink, tokenOf("yellow")));
  assert(onRed >= 60, `paper on red is Lc ${onRed.toFixed(1)}, under 60`);
  assert(onYellow >= 60, `ink on yellow is Lc ${onYellow.toFixed(1)}, under 60`);
  assert(
    Math.abs(apca(ink, tokenOf("red"))) < onRed,
    "ink on red must stay the worse choice, which is why red carries paper",
  );
});

test("no colour is mixed by hand where a token should be", () => {
  // Seven places used to pick their own grey, between 40% and 60% ink, and
  // five were under the floor. The tokens are the two measured answers.
  const stray = [...CSS.matchAll(/color:\s*color-mix\(in oklab, var\(--text\)[^;]*;/g)];
  assert(
    !stray.length,
    `${stray.length} hand-mixed text colours remain: ${stray.map((m) => m[0]).join(" ")}`,
  );
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
