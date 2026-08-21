# Changelog

## 0.2.0 (2026-08-21)

The release where the engine learned to say what it does, in the language
cubers already write, and stopped being married to its own renderer.

### The algebra

- `move()` takes the notation cubers write: `[R, U]` commutators, `[R: U]`
  conjugates, `(R U)3` repeats, `'` on a group. `expand`, `parse` and
  `isAlgebra` are exported; parse errors point at the character.
- `effectOf(sequence)` reads a sequence as a permutation: its cycles, the
  pieces turned in place, and its order, computed exactly from the cycle
  structure rather than counted. The order is what SHOWS: `(R U)` is 105 on
  a 3×3 and on a 4×4, because a turned centre and four identical centre
  stickers are invisible; a painted puzzle is a picture cube and its order
  says so. A look never moves the puzzle, even when the sequence is refused
  halfway on a puzzle that blocks.

### Renderers that are not this one

- `getPieces()`: per-piece geometry plus a column-major matrix, ready for
  `THREE.Matrix4().fromArray(...)`, mid-turn included. `getViewMatrix()`,
  `getRadius()`, and `getFrame()` — the exact frame `toSVG` uses, so two
  renderers draw the same picture instead of two guesses at a margin.
- `deform` now takes a function as well as a matrix, for bends no matrix
  can express: `new Cube({ deform: twist(90) })`. Warped puzzles hand back
  geometry already placed and bent, flagged `warped: true`.
- `site/three-view.js` is a complete three.js adapter on nothing but these
  calls, with one shared WebGL context for a whole page of views.

### Positions, patterns, and games

- `getPosition()` / `setPosition()`: a position as a string, exact down to
  the cubie; fits in a URL.
- `getPattern()`, `distanceTo()`, `matches()`: score a board against a
  picture. `vocabulary()`: every move a puzzle can name, as against
  `legalMoves()`, which is what is open from here.
- `site/examples/pattern` is a Replicube-style game built on the public API:
  paint a puzzle with a function of each cubie's place, then bring the
  pattern back, by keypad or by typing the algebra, with the code for what
  you are looking at generated live and verified runnable.

### Fixed

- The painter orders a turning layer by its own cut plane, so mid-turn
  frames of Fisher, Siamese and friends never interpenetrate.
- The Windmill's yaw is the condition it satisfies, not a rounded number.
- `legalMoves()` answered `[]` on seven puzzles that had moves.
- Error messages name the puzzle a person asked for, not a cache key.

The README executes: every code block runs against the packed package as
part of preparing a release.
