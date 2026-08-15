# erno.js

A tiny engine for Rubik's cubes rendered to SVG. Apply moves in standard
notation, scramble, animate layer turns, and style every sticker — no WebGL,
no canvas, just `<svg>`.

Sibling of [heerich.js](https://github.com/meodai/heerich) (voxels → SVG),
sharing its philosophy: a single-file core, zero dependencies, declarative
API, and crisp vector output with per-sticker data attributes.

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

- `npm run dev` — Vite dev server with the demo page
- `npm test` — run the test suite (plain Node, no framework)
- `npm run build` — build the library to `dist/` (UMD + ESM)
- `npm run build:site` — build the demo page to `dist-site/`

## License

MIT
