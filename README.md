# erno.js

A tiny engine for twisty puzzles rendered to SVG — twenty-three of them.
N×N cubes, Skewb & Master Skewb, Pyraminx & Master Pyraminx, Mirror, Void,
Rubik's Tetris, cuboids (Domino, Tower, Floppy, any nx×ny×nz), shape mods
(Fisher, Windmill, Axis, Ghost, Twist, Penrose, Pyramorphix, Mastermorphix)
and corner/edge turners (Compy, Dino, Helicopter) — apply moves in standard
notation, scramble, animate layer turns, and style every sticker. No WebGL,
no canvas, just `<svg>`.

Sibling of [heerich.js](https://github.com/meodai/heerich) (voxels → SVG),
sharing its philosophy: a small dependency-free core, declarative API, and
crisp vector output with per-sticker data attributes.

Named after [Ernő Rubik](https://en.wikipedia.org/wiki/Ern%C5%91_Rubik).

## Install

```bash
npm install erno
```

```js
import { Erno } from 'erno'
```

Or use the UMD build via a `<script>` tag — the global `Erno` will be available.

## Quick Start

```js
import { Erno } from 'erno'

const cube = new Erno({
  size: 3,
  tile: 40,
  camera: { type: 'isometric', angle: 30 },
})

cube.move("R U R' U'")
document.body.innerHTML = cube.toSVG()
```

## Moves

`move()` accepts standard WCA notation, whitespace-separated:

- **Face turns**: `R L U D F B`, with `'` (counterclockwise) and `2` (half turn) — `R`, `R'`, `R2`, `R2'`
- **Wide turns**: `Rw` or lowercase `r` (outer two layers); on big cubes,
  prefix the layer count: `3Rw` / `3r` turns the outer three layers
- **Slices**: `M E S` (odd cubes only — M follows L, E follows D, S follows F)
- **Rotations**: `x y z` (whole cube — x follows R, y follows U, z follows F)

```js
cube.move("R U R' U'")   // chainable: cube.move("R").move("U")
cube.scramble()           // random scramble, returns the sequence
cube.scramble(30)         // explicit length
cube.reset()              // back to solved
cube.isSolved()           // boolean
cube.history              // tokens applied since the last reset
Erno.inverse("R U2 f'")   // → "f U2 R'"
```

Internally every move is a permutation of facelet indices, derived once from
exact integer 3D rotations and cached — applying a move is a single array
shuffle.

## State

State is a facelet string in URFDLB face order, row-major per face, one letter
per sticker naming its home face (54 chars for a 3×3, 6N² in general):

```js
cube.getState()
// "UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB"
cube.setState('UUU…')     // throws on malformed input
```

This is the same layout used by common solvers (e.g. Kociemba's), so wiring a
solver up is a string away.

### Stateless rendering

Render a facelet string without keeping an instance (size is inferred):

```js
Erno.renderState(stateString, { camera: { type: 'isometric', angle: 30 } })
// → '<svg …>'
```

Useful for static site generators — render hundreds of algorithm diagrams at
build time.

## Cubes of any size

```js
new Erno({ size: 2 })   // pocket cube
new Erno({ size: 5 })   // professor's cube — wide turns like 3Rw supported
```

## Classic variants

Beyond the N×N cube, erno ships the classic variants, all with the same API
(`move` / `scramble` / `toSVG` / `style` / `setCamera` / `turn` animation):

```js
import { Skewb, Pyraminx, Mirror, Void, Tetris, Megaminx } from 'erno'

new Skewb().move("R U' L B")
new Pyraminx().move("U L' R b")
new Mirror().move("R U2 F' D")   // shape-shifts like the real thing
new Void().move("M E' S2")
new Tetris().scramble()          // solid-colored Tetrimino cubies
new Megaminx().move("A C' F")    // a dodecahedron: faces are lettered A–L
```

The bigger siblings come along too — `MasterSkewb`, `MasterPyraminx`,
`Mastermorphix` and `Kilominx`.

Twenty-six puzzles in all. Cubes and cuboids of any size, the shape mods
(Fisher, Windmill, Axis, Ghost, Mirror, Twist, Penrose), the turners (Skewb,
Dino, Compy, Master Skewb, Helicopter), the tetrahedra (Pyraminx, Master
Pyraminx, Pyramorphix, Mastermorphix), and three solids that are neither
cube nor tetrahedron: `Megaminx` and `Kilominx` on a dodecahedron, and
`SkewbDiamond` on an octahedron — the Skewb's dual, which is the same four
cuts and moves applied to a different solid.

They run on a generic piece engine (`Twisty`, also exported): each puzzle is
defined as a base solid plus cut planes, the engine slices it into pieces,
and every piece carries an exact integer rotation — scramble + inverse
restores the solved state bit for bit, with zero float drift.

- **Skewb** — WCA [Fixed Corner Notation](https://www.speedsolving.com/wiki/index.php?title=Skewb_notation):
  `R U L B` turn 120° clockwise around a corner (`'` for counterclockwise).
  State is 30 facelets in URFDLB order, 5 per face (corners in reading
  order, center third).
- **Pyraminx** — `U L R B` turn a vertex's two layers, lowercase `u l r b`
  turn just the tips. State is 36 facelets in FLRD face order, reading order
  per face. Scrambles include random tip moves, WCA style.
- **Mirror** — a 3×3 mechanism sitting off-center inside the cube: the cut
  planes sit at the mechanism pivot ± ½ and turns rotate about that pivot,
  so blocks stay flush at the cuts while the outer surfaces protrude and
  recess — it shape-shifts exactly like the real puzzle. Full cube notation;
  `getState()` returns virtual URFDLB facelets identical to the `Erno` 3×3
  (it is isomorphic), so solvers work unchanged.
- **Void** — a 3×3 without centers; the engine renders interior plastic
  walls, so the holes go all the way through. 48 facelets (8 per face).
- **Tetris** — the official Rubik's × Tetris cube: 26 solid-colored cubies;
  solved, each face reveals one classic Tetrimino in its Tetris color around
  that face's center (all but the I, which the real product ships as a
  display stand), with exactly two white filler cubies. `isSolved()`
  compares the visible pattern, so same-colored cubies are interchangeable —
  like the physical puzzle.
- **Cuboids** — any nx×ny×nz box via `new Cuboid({ size: [3, 4, 3] })`,
  with presets `Domino` (3×2×3, Ernő Rubik's 1978 pre-cube puzzle), `Tower`
  (2×3×2) and `Floppy` (3×1×3). The engine enforces the physics: quarter
  turns only about axes with a square cross section (`R` throws on a
  Domino, `R2` works), so the box never shape-shifts. Standard cube
  notation, including slices on odd axes and legal whole-puzzle rotations.
- **Fisher, Windmill, Axis & Ghost** — a 3×3 mechanism rotated inside the
  cube shell: Fisher yawed 45°, Windmill 30°, Axis 60° about a corner
  diagonal, Ghost by a compound odd angle with uniform pale stickers.
  `U D R L F B` name the mechanism faces. Turns push pieces out at odd
  angles and the puzzle shape-shifts; stickers facing off-grid directions
  report `?` in `getState()` until they realign.
- **Pyramorphix & Mastermorphix** — a 2×2 / 3×3 mechanism inside a
  tetrahedron: quarter turns are legal but the shell isn't symmetric under
  them, so both shape-shift wildly. Full cube notation (Mastermorphix
  includes slices).
- **Master Pyraminx** — the 4-layer Pyraminx: `u` tips, `U` two layers,
  `Uw` three. Master Skewb and Compy Cube join the corner-turning family:
  the cut depth decides the puzzle (shallow Compy caps-and-wings, Dino's
  edges-only diagonals, Master Skewb's 50 pieces).
- **Twist** — a 3×3 molded with a continuous 90° twist: top and bottom
  squares sit axis-aligned with all the twisting in the body, side stickers
  are kite-shaped tiles. Full cube notation; `U D E` turns keep the
  silhouette coherent, side turns go wild.
- **Penrose** — the classic three-color shape mod: pairs of adjacent faces
  share a color and their shared edge (UB, FL, DR — mutually skew, 3-fold
  symmetric) is rounded off with a big fillet. Every face keeps its sticker
  grid; curved tiles wrap the rounded edges. Scrambling makes the surface
  jagged. Full cube notation.
- **Dino** — corner-turning: twelve edge pieces, cuts along the face
  diagonals; moves are corner names (`URF`, `DBL'`…, any letter order).
- **Helicopter** — edge-turning: 180° flips about twelve edge axes (`UF`,
  `FR`…); eight corners plus twenty-four single-sticker petals.

Color schemes ship as presets for any cube-faced puzzle:

```js
import { SCHEMES } from 'erno'

new Void({ colors: SCHEMES.japanese })   // blue down, yellow back
new Mirror({ colors: SCHEMES.gold })
// SCHEMES.classic, SCHEMES.japanese, SCHEMES.silver, SCHEMES.gold
```

Or generate them — a seeded hue walk with eased saturation and lightness
gives an endless supply of harmonious schemes (concepts borrowed from
[rampensau](https://github.com/meodai/rampensau),
[poline](https://github.com/meodai/poline) and
[dittoTones](https://github.com/meodai/dittoTones)):

```js
import { generateScheme, schemeFrom, generateRamp } from 'erno'

const scheme = generateScheme([..."URFDLB"], { seed: 42 })
scheme.name                       // "Vivid Cyan" — every scheme gets a name
new Erno({ colors: scheme })

schemeFrom('#e63946', [..."URFDLB"]) // whole scheme from one brand color

const ramp = generateRamp(20)        // paint pieces along a gradient…
new Void().style(({ piece }) => ({ fill: ramp[piece] }))
// …and scrambling turns it into a mosaic

nameScheme(scheme)                   // name any scheme after the fact
```

Schemes are composed in **OKLCH** and gamut-mapped by reducing chroma rather
than clipping channels, so a colour that sRGB cannot show is pulled toward
the boundary with its lightness and hue intact instead of drifting. Pass
`character: 'pale' | 'muted' | 'deep' | 'vivid'` to pick the mood — chroma
and lightness predict how a palette feels far better than hue does.

The conversions are exported for use on their own:

```js
import { oklchToHex, hexToOklch, TETRIS_PALETTE } from 'erno'

oklchToHex(0.55, 0.20, 28)           // '#cc2823', gamut-mapped
hexToOklch('#cc2823')                // [L, C, H]
```

Piece-based puzzles emit `data-part`, `data-face`, `data-index`,
`data-color` and `data-piece` on every polygon, and style callbacks receive
`{ face, index, letter, piece }`. Open `gallery.html` on the dev server for
a visual test sheet of every puzzle, scrambled and mid-turn.

### Cuboids that change shape

A quarter turn about an axis whose cross-section is not square leaves a box
misshapen. Both answers to that are real puzzles — a Domino's mechanism
cannot make the move, while a 3×3×5 is sold precisely because it can — so it
is a policy rather than a law:

```js
new Cuboid({ size: [3, 2, 3] }).move("R")                     // throws
new Cuboid({ size: [3, 3, 5], shapeShift: true }).move("R")   // deforms
```

Off (the default) the puzzle refuses the move and tells you to use `R2`. On,
it shifts shape, reports `?` for the stickers that have left the facelet
grid, and still inverts exactly.

## Painting

`colors` sets a fill per FACE. `paint` sets one per STICKER, at build time,
and unlike a style callback it becomes part of the puzzle's state:

```js
import { Cube, Skewb, Cuboid, Mirror, tetrisPaint } from 'erno'

// the Tetris cube is a plain 3×3 wearing a paint — this renders
// identically to `new Tetris()`
new Cube({ paint: tetrisPaint })

// tint one face of any mechanism
new Skewb({ paint: ({ letter }) => letter === 'U' ? '#cc2823' : undefined })

// return nothing and the sticker keeps its face colour, so a paint can
// decorate a few stickers without restating the rest
new Cuboid({ size: [4, 4, 4], paint: ({ index }) => index % 2 && '#00489f' })

// and any other mechanism can wear it too
new Mirror({ paint: tetrisPaint })
```

`Cube` is the plain cube on the piece engine — use it when a 3×3 has to
carry a paint, since `Erno` is the facelet representation and has no pieces
to paint. It takes a single number for `size`; `Cuboid` takes the triple.

The callback receives `{ face, index, row, col, letter, piece, pieceIndex,
slot, normal }`. A sticker is addressed the way `getState()` addresses it —
by its face and its place within that face, in the same reading order — so
you can paint one and leave the rest:

```js
// the centre of U, and nothing else
new Cube({ paint: ({ face, row, col }) =>
  face === 'U' && row === 1 && col === 1 && '#cc2823' })

// the top row of F
new Cube({ paint: ({ face, row }) => face === 'F' && row === 0 && '#f6ba00' })
```

`row` and `col` are given only where a face is square. A Skewb face holds
five stickers and a Megaminx eleven, so a grid there would be a lie — use
`index` instead.

To paint by hand, pass a map instead of a callback: face letter to colours in
that same reading order, with a hole wherever a sticker should keep its face
colour. A bare colour paints the whole face.

```js
new Cube({ paint: {
  U: ['#c00', null, '#00f', null, '#fc0', null, null, null, '#0a0'],
  D: '#111',
} })
```

A painted puzzle is **solved by its pattern, not by its facelets**: with
solid-coloured cubies two pieces of the same colour are interchangeable and
orientation stops mattering, exactly like the real Tetris cube. `isSolved()`
switches to comparing `getTints()` on its own — so a puzzle painted a single
colour can never be unsolved, however hard you scramble it.

Note `tetrisPaint`'s layout is a hand-found exact-cover solution for the 3×3
(one tetromino per face around its centre, no I piece, two white fillers).
It is not a formula, so it does not generalise to other sizes; anything off
that grid is left untinted.

## Subtraction

The sibling of heerich's `removeGeometry`: drop whole pieces and the engine
draws the interior walls they leave behind, so the holes go all the way
through.

```js
import { Cube, Megaminx } from 'erno'

new Cube({ remove: 'centers' })            // this IS the Void cube
new Cube({ size: 5, remove: 'centers' })   // and there is no 5×5 Void on sale
new Megaminx({ remove: 'centers' })

new Cube({ remove: ({ slot }) => slot.every(v => v > 0) })   // one corner gone
new Cube({ remove: { box: [[0, 0, 0], [2, 2, 2]] } })        // a whole octant
```

`remove` takes a predicate `({ slot, stickers, piece, centroid }) => boolean`,
the name `'centers'` or `'core'`, or a `{ box }` region in slot space. What
is left is a real puzzle: it turns, scrambles and inverts exactly, and
`Cube({ remove: 'centers' })` renders byte for byte the same as `new Void()`.

## Decals

A paint sets a sticker's colour; a decal puts a **mark** on it. A dice cube, a
Sudokube and the spots on Ernő's own Domino are the same mechanisms
underneath, printed differently — so they ship as decoration, not as classes.

```js
import { Cube, Domino, dicePips, sudokuDigits, dominoPips } from 'erno'

new Cube({ decal: dicePips })       // each face is one die; opposites sum to 7
new Cube({ decal: sudokuDigits })   // 1–9 on every face
new Domino({ decal: dominoPips })   // the 1978 puzzle, spots and all
```

The callback is addressed exactly like `paint` —
`({ face, index, row, col, size, letter, piece, slot, normal, fill })` — and
returns **SVG drawn in a unit square**, which the engine lays onto the
sticker:

```js
new Cube({
  decal: ({ row, col, fill }) =>
    row === col ? `<circle cx="0.5" cy="0.5" r="0.25" fill="${fill}"/>` : null,
})
```

Two things follow from how it works. Marks are printed at build time, so a
mark belongs to its **cubie** and travels with it — scramble the puzzle and
the pips go along, which is what a printed cube does. And the mark is laid on
the face's own reading directions, so it sits upright when solved and turns
with its piece afterwards. A sticker that is not a quadrilateral — a Skewb's
triangle, a Megaminx's kite — has no unit square to map and is left bare.

## Fusion

The union, and the other half of subtraction: weld two or more boxes into one
puzzle. Where they overlap, the wall between them stops being a wall — the
buried stickers go, the shared cubies become single pieces, and what is left
is the shape you would get by gluing two cubes together.

```js
import { Siamese, Fused } from 'erno'

new Siamese()                          // the classic: two 3×3s sharing a 1×1×3 bar
new Siamese({ offset: [1, 2, 0] })     // sharing a 2×1×3 block instead
new Siamese({ size: 4, offset: [3, 3, 0] })

new Fused({ bodies: [                  // a 2×2 grown on the corner of a 3×3
  { size: [3, 3, 3], at: [0, 0, 0] },
  { size: [2, 2, 2], at: [1.5, 1.5, 0.5] },
]})
```

Notation prefixes each face with its body's letter — `AU`, `BR'`, `AF2`.
Bodies must line up cubie to cubie on one lattice; anything else would slice
its neighbour in half, and the constructor says so instead.

## Blocking

Fusion supplies the shape. What makes a Siamese cube a *puzzle* is which turns
it refuses, and that comes from one rule:

> **A turn is possible only if the layer it grabs comes back to itself.**

This is the shell symmetry law narrowed from the whole puzzle to a single
layer. Whatever the layer leaves behind is still in the way, so a layer that
would land somewhere else cannot go. Ask a puzzle what it can do:

```js
const s = new Siamese()
s.legalMoves()      // AD AD' AD2 AL AL' AL2 BU BU' BU2 BR BR' BR2
s.canMove('AF')     // false
s.move('AF')        // throws: the layer does not come back to itself
s.scramble(20)      // walks the legal moves rather than replaying a fixed string
```

Nothing lists those twelve moves anywhere. The shared bar runs up one corner
of each cube, so each cube keeps exactly the two faces furthest from the weld
— which is what the real puzzle does in your hands.

The same law reproduces rules the library used to state by hand. A Domino
refuses its quarter turns because a 3×1×3 layer spun about x comes back
3×3×1; switch blocking on over a cuboid that is allowed to deform and you get
the identical move list, size for size:

```js
new Cuboid({ size: [3, 2, 3], shapeShift: true, blocking: true }).legalMoves()
// same as new Cuboid({ size: [3, 2, 3] }).legalMoves()
```

`legalMoves()` and `canMove()` answer on every puzzle, not just blocking ones:
a move the notation refuses outright counts as unavailable too.

One consequence worth knowing: because the law is about the shape of the
material, subtraction takes part in it. A Void cube keeps all eighteen turns
(its holes are symmetric), but hollowing out one corner and switching blocking
on will close the turns that no longer come back to themselves.

## Bandaging

Fusion welds bodies; bandaging welds cubies inside one. It is the other way a
twisty puzzle gets its blocked turns, and it runs through the same law.

```js
import { Cube } from 'erno'

// the Fused Cube: a 2×2×2 block set into a 3×3
new Cube({ bandage: ({ slot }) => slot.every(v => v >= 0) ? 'block' : null })
// → 20 pieces, and only D, L and B still turn

// or name the slots outright — here the U centre glued to the UF edge
new Cube({ bandage: [[[0, 1, 1], [0, 1, 0]]] })
// → F is the only turn it costs
```

`bandage` takes a grouping function `({ slot, piece, centroid }) => key` —
pieces answering with the same key are welded — or a plain list of slot
groups. It switches blocking on by default, since a glued pair with nothing
forbidden would simply tear.

Add `stickerGroup: true` to make the glue visible: the welded cubies then wear
one tile per face instead of a grid pretending they come apart.

```js
new Cube({
  bandage: ({ slot }) => slot.every(v => v >= 0) ? 'block' : null,
  stickerGroup: true,
})
```

## Camera

Four projection types, sharing semantics with heerich:

- **isometric** (default): `{ angle }` — pitch locked to 35.264°. The classic
  cube-diagram look.
- **orthographic**: `{ angle, pitch }` — true parallel projection, free tilt.
- **oblique**: `{ angle, depth }` — front face undistorted, depth recedes at
  `angle`; `depth` is the fraction of a tile per cubie of depth (default 0.5).
- **perspective**: `{ position: [x, y], distance }` in cubie units — single
  vanishing point.

```js
cube.setCamera({ type: 'perspective', position: [5, -2], distance: 12 })
```

## Styling

Sticker fills come from the color scheme (`colors` option, keyed by home face
letter). Override per sticker with a static object or a callback:

```js
// static: merged into every sticker
cube.style({ stroke: '#111', strokeWidth: 2 })

// per sticker: ({face, row, col, letter}) → style | null
// face/row/col = where the sticker sits now; letter = its home face (color)
cube.style(({ letter }) => letter === 'U' ? null : { fill: '#d4d4d4' })
```

Style objects use camelCase SVG attributes (`fill`, `stroke`, `strokeWidth`,
`opacity`, …). Returning `null` keeps the default.

Cube body options:

```js
new Erno({
  plastic: '#0d0d0d',   // gap/core color
  stickerInset: 0.12,   // sticker inset per cell; 0 = stickerless look
  colors: { U: '#fff', R: '#b71234', F: '#009b48',
            D: '#ffd500', L: '#ff5800', B: '#0046ad' },
})
```

## SVG output & interactivity

Every sticker is a `<polygon>` with data attributes:

```html
<polygon points="…" fill="#009b48"
  data-part="sticker" data-face="F" data-row="0" data-col="2" data-color="F" />
```

- `data-part`: `sticker`, `plastic` (cell backing) or `core` (internals
  exposed mid-turn)
- `data-face` / `data-row` / `data-col`: the *position* on the cube
- `data-color`: the sticker's home face (its color identity)

So highlighting, hovering and click-handling are plain CSS/JS:

```css
svg [data-face="U"]:hover { opacity: 0.7; }
```

`toSVG(options)`:

- `padding` — viewBox padding in px (default 20)
- `viewBox` — explicit `[x, y, w, h]` override
- `fitSphere` — size the viewBox to the cube's circumsphere so it stays
  stable across moves and animation frames
- `turn` — mid-turn snapshot, see below
- `prepend` / `append` — raw SVG inserted before/after the faces

## Animating turns

`toSVG` can render a layer mid-turn — the internal core is drawn where the
cube opens up:

```js
cube.toSVG({ turn: { move: 'R', progress: 0.5 }, fitSphere: true })
```

The state is *not* changed by rendering; animate with `requestAnimationFrame`
and apply the move when the turn completes:

```js
function play(token, duration = 180) {
  const start = performance.now()
  function frame(now) {
    const p = Math.min(1, (now - start) / duration)
    el.innerHTML = cube.toSVG({ turn: { move: token, progress: p }, fitSphere: true })
    if (p < 1) requestAnimationFrame(frame)
    else { cube.move(token); el.innerHTML = cube.toSVG({ fitSphere: true }) }
  }
  requestAnimationFrame(frame)
}
```

Use `fitSphere: true` (or a fixed `viewBox`) while animating so the image
doesn't jump between frames.

## Advanced: getFaces()

`getFaces(turn?)` returns the projected, depth-sorted face list (`points`,
`face`, `row`, `col`, `letter`, `part`, `depth`) if you want to build your own
renderer on top.

## Development

- `npm run dev` — Vite dev server with the demo page (`/`) and the visual
  test gallery (`/gallery.html`)
- `npm test` — run both test suites (plain Node, no framework)
- `npm run build` — build the library to `dist/` (UMD + ESM)
- `npm run build:site` — build the demo page to `dist-site/`

Source layout mirrors heerich: `src/erno.js` (N×N facelet cube, package
entry), `src/twisty.js` (generic piece engine + notation), `src/puzzles.js`
(Skewb, Pyraminx, Mirror, Void, color schemes), `src/render.js` (shared
cameras, culling, depth sort, SVG emission).

## License

MIT
