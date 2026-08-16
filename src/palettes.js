/**
 * erno/palettes.js — generative color schemes for puzzle faces.
 *
 * Instead of curating static schemes, generate them: a system with internal
 * logic that produces outcomes — the philosophy behind meodai's color tools,
 * whose concepts this module borrows:
 *
 * - rampensau: hue cycling + easing produces harmonious ramps; sampling one
 *   per face gives every puzzle an endless supply of coherent schemes.
 * - dittoTones: derive a whole palette from a single input color, so a cube
 *   can match a brand or a mood from one hex value.
 * - color-names: every scheme deserves a name — here a tiny procedural one.
 *
 * Colors are composed in OKLCH (perceptually uniform lightness/chroma/hue)
 * and gamut-mapped to sRGB by reducing chroma — never lightness or hue — so
 * a scheme keeps its identity instead of clipping toward gray. Palettes are
 * organized character-first (pale / muted / deep / vivid): chroma and
 * lightness predict a palette's mood far better than hue does.
 *
 * Deterministic when given a `seed`, so a scheme can be reproduced, shared
 * or animated.
 */

// mulberry32 — tiny seedable PRNG
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── OKLCH ↔ sRGB (Björn Ottosson's OKLab) ─────────────────────────────────

function oklchToLinearRgb(L, C, H) {
  const hr = (H * Math.PI) / 180;
  const a = C * Math.cos(hr);
  const b = C * Math.sin(hr);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

const inGamut = (rgb) => rgb.every((c) => c >= -1e-4 && c <= 1 + 1e-4);

/**
 * OKLCH → "#rrggbb". Out-of-gamut requests are mapped by walking chroma
 * toward the gamut boundary while holding lightness and hue — clipping RGB
 * channels instead would shift the hue and dull the color unpredictably.
 */
export function oklchToHex(L, C, H) {
  let rgb = oklchToLinearRgb(L, C, H);
  if (!inGamut(rgb)) {
    let lo = 0;
    let hi = C;
    for (let i = 0; i < 14; i++) {
      const mid = (lo + hi) / 2;
      if (inGamut(oklchToLinearRgb(L, mid, H))) lo = mid;
      else hi = mid;
    }
    rgb = oklchToLinearRgb(L, lo, H);
  }
  const gamma = (c) => {
    c = Math.min(1, Math.max(0, c));
    return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  };
  return `#${rgb
    .map((c) =>
      Math.round(gamma(c) * 255)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

/** "#rrggbb" → [L, C, H] in OKLCH. */
export function hexToOklch(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex).trim());
  if (!m) throw new Error(`erno: bad color '${hex}' (expected #rrggbb)`);
  const v = parseInt(m[1], 16);
  const lin = [(v >> 16) & 255, (v >> 8) & 255, v & 255].map((c) => {
    c /= 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  const [r, g, b] = lin;
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const mm = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * mm - 0.0040720468 * s;
  const a = 1.9779984951 * l - 2.428592205 * mm + 0.4505937099 * s;
  const bb = 0.0259040371 * l + 0.7827717662 * mm - 0.808675766 * s;
  const C = Math.hypot(a, bb);
  const H = ((Math.atan2(bb, a) * 180) / Math.PI + 360) % 360;
  return [L, C, H];
}

// ── character bands (Ellen Divers: chroma+lightness carry the mood) ───────

const CHARACTERS = {
  pale: { L: [0.84, 0.94], C: [0.035, 0.09] },
  muted: { L: [0.6, 0.78], C: [0.055, 0.11] },
  deep: { L: [0.38, 0.56], C: [0.09, 0.15] },
  vivid: { L: [0.56, 0.76], C: [0.16, 0.26] },
};

// hue bucket + tone words for the procedural scheme name (OKLCH hue order)
const HUE_WORDS = [
  "Rose", "Crimson", "Ember", "Amber", "Gold", "Olive",
  "Fern", "Jade", "Teal", "Azure", "Indigo", "Violet", "Orchid",
];

/** Procedural two-word name for a scheme (a nod to color-names). */
export function nameScheme(scheme) {
  const colors = Object.values(scheme);
  const [L, C, H] = hexToOklch(colors[0]);
  const hue = HUE_WORDS[Math.floor((H / 360) * HUE_WORDS.length) % HUE_WORDS.length];
  const tone =
    L > 0.82 ? "Pale" : L < 0.42 ? "Deep" : C > 0.19 ? "Neon" : C > 0.13 ? "Vivid" : C > 0.08 ? "Dusty" : "Muted";
  return `${tone} ${hue}`;
}

/**
 * Generate a face-color scheme by cycling the hue wheel with eased
 * chroma/lightness (the rampensau idea, sampled once per face) in OKLCH.
 *
 * @param {string[]} letters - face letters, e.g. ["U","R","F","D","L","B"]
 * @param {Object} [opts]
 * @param {number} [opts.seed] - reproducible randomness (default: random)
 * @param {number} [opts.hueStart] - starting OKLCH hue (default: from seed)
 * @param {number} [opts.hueCycles] - wheel rotations across the faces
 * @param {string} [opts.character] - "pale" | "muted" | "deep" | "vivid":
 *   picks the lightness/chroma band that carries the palette's mood
 * @param {[number,number]} [opts.saturation] - legacy S range (0–1), mapped
 *   to a chroma band; ignored when `character` is given
 * @param {[number,number]} [opts.lightness] - legacy L range (0–1)
 * @returns {Object} letter → "#rrggbb" (with a `name` on the side)
 */
export function generateScheme(letters, opts = {}) {
  const seed = opts.seed ?? Math.floor(Math.random() * 2 ** 31);
  const rand = rng(seed);
  const n = letters.length;
  const hueStart = opts.hueStart ?? rand() * 360;
  // capped under a full rotation so the last face never collides with the
  // first
  const hueCycles = opts.hueCycles ?? 0.5 + rand() * 0.35;

  let Lr, Cr;
  if (opts.character && CHARACTERS[opts.character]) {
    ({ L: Lr, C: Cr } = CHARACTERS[opts.character]);
  } else {
    const [s0, s1] = opts.saturation ?? [0.55, 0.9];
    const [l0, l1] = opts.lightness ?? [0.38, 0.72];
    Cr = [0.03 + s0 * 0.2, 0.03 + s1 * 0.2];
    Lr = [0.22 + l0 * 0.68, 0.22 + l1 * 0.68];
  }
  const cBias = rand();
  const lBias = rand();

  const scheme = {};
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0 : i / (n - 1);
    const h = hueStart + t * 360 * hueCycles;
    // eased triangle waves keep neighbours distinct but harmonious; the
    // lightness sweep also gives the scheme grayscale separation
    const C = Cr[0] + (Cr[1] - Cr[0]) * Math.pow(Math.abs(((t + cBias) * 2) % 2 - 1), 1.4);
    const L = Lr[0] + (Lr[1] - Lr[0]) * Math.pow(Math.abs(((t + lBias) * 2) % 2 - 1), 1.2);
    scheme[letters[i]] = oklchToHex(L, C, h);
  }
  Object.defineProperty(scheme, "seed", { value: seed, enumerable: false });
  Object.defineProperty(scheme, "name", { value: nameScheme(scheme), enumerable: false });
  return scheme;
}

/**
 * Derive a whole scheme from a single color (the dittoTones idea): the
 * first face gets the input color exactly, the rest cycle away from its
 * hue while staying in its chroma/lightness neighbourhood.
 */
export function schemeFrom(color, letters, opts = {}) {
  const [L, C, H] = hexToOklch(color);
  const scheme = generateScheme(letters, {
    seed: opts.seed ?? Math.floor(H * 1000 + C * 100 + L * 10),
    hueStart: H,
    hueCycles: opts.hueCycles ?? 0.72,
    saturation: [
      Math.max(0.1, (C - 0.03) / 0.2 - 0.25),
      Math.min(1, (C - 0.03) / 0.2 + 0.15),
    ],
    lightness: [
      Math.max(0.05, (L - 0.22) / 0.68 - 0.22),
      Math.min(0.95, (L - 0.22) / 0.68 + 0.22),
    ],
    ...opts,
  });
  scheme[letters[0]] = oklchToHex(L, C, H); // anchor exactly on the input
  return scheme;
}

/**
 * Sample a full color ramp (one color per step) — feed it to a style
 * callback to paint pieces along a gradient that scrambling shuffles into
 * a mosaic.
 */
export function generateRamp(steps, opts = {}) {
  const letters = Array.from({ length: steps }, (_, i) => i);
  const scheme = generateScheme(letters, { hueCycles: 0.78, ...opts });
  return letters.map((i) => scheme[i]);
}
