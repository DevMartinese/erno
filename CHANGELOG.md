# Changelog

## 0.2.6 (2026-08-21)

- The renderer and permutation contracts are typed for real. `getPieces()`
  returns `PieceView[]` and `effectOf()` a `SequenceEffect`, both exported
  types; before this they compiled against `any`, so a strict TypeScript
  consumer could misuse every field and hear nothing. Verified both ways:
  correct usage compiles, and three deliberate misuses are each rejected.
- `effectOf` no longer takes an options bag. The `{ order: true }` flag
  was left over from when the order was counted on demand; it has been
  computed always, and exactly, since 0.2.0.

## 0.2.5 (2026-08-21)

- The three.js adapter ships in the package: `erno.js/three`. It was the
  README's best argument and lived only in the site's source, so an
  installer was sent to copy a file off GitHub. `three` is an optional
  peer, imported lazily on first use; reaching the module without three
  installed is free, and the subpath resolves in ESM, CJS and TypeScript.
  One shared WebGL context per page, decals, warped puzzles, context-loss
  recovery: the same adapter the site runs, because the site now imports
  the shipped file rather than keeping a copy that would drift.

## 0.2.4 (2026-08-21)

- Big cubes and cuboids can say what they could always do. Every box
  shared a 3×3's eighteen face tokens, so a 5×5's parseMove happily turned
  `Uw`, `3Uw` and `M` while vocabulary() never named them: legalMoves()
  withheld them, keypads never drew them, and a 7×7 scramble moved nothing
  but its outer skin. The vocabulary is sized now — faces, wide blocks up
  to half the axis (`Uw`, `3Uw`), and the middle slice letters where an
  odd axis has a middle — and scrambles draw faces and wides the way
  big-cube scrambles are written. The quarter-versus-half policy of
  cuboids rules the new tokens exactly as it rules faces, so a 3×3×5
  offers `S` and `Fw` in quarters and `M2`/`E2` in halves. A 3×3 gains
  only `M E S`; a 2×2 is untouched.
- Bandaging rules the slices it was never told about: glue a centre to an
  edge and the slice band holding one half without the other refuses,
  exactly as the face does.

## 0.2.3 (2026-08-21)

- Welded bodies turn their middle slices (issue #2). `Fused` and `Siamese`
  only registered face turns, so the middle layers of each body could never
  move: 12 legal moves at rest, and no amount of play grew them. Each body
  now names its slices where a middle exists (`AE`, `AM'`, `BS2`; even-sized
  axes get no token rather than one that always refuses), and the blocking
  law rules on them like on everything else: E and M clear the default weld
  and turn, S holds the neighbour's own slab and refuses. On the default
  Siamese that is 12 legal moves grown to 24, and on a staircase of three
  the law found `BS2`, a half-turn symmetry one plane deeper than the ones
  it already knew. Slices ride scrambles, inverses, the algebra and
  `effectOf` like any move.

## 0.2.2 (2026-08-21)

- Says who this library is for first, on the page where a reader decides:
  cubes, cuboids, and cubes fused into one are the priority. The algebra,
  the permutation tools and the pattern game are aimed at them; the other
  puzzles are real, tested and kept working, second in line.
- That priority is enforced, not remembered: the suite now runs the
  algebra's laws with each family member's own tokens (a sequence with
  brackets cancels against its inverse, a commutator against its reverse,
  the order effectOf declares brings the pattern back, inverting a
  conjugate is conjugating the inverse), and checks all 284 token/inverse
  pairs across cubes 2 through 7, cuboids, Domino, Tower, Floppy, Siamese
  and Fused parse and come home.

## 0.2.1 (2026-08-21)

- Inversion no longer assumes a cube. Both inverters treated a trailing
  `2` as its own inverse, which is true of a face of order four and quietly
  false everywhere else: on a Pyraminx, `[U2, R]` followed by `[R, U2]` did
  not come back solved, a commutator law broken. The inverse of `X2` is
  `X2'` on every puzzle; on a cube the two are the same rotation, so
  nothing there changes but the spelling. Pinned by a test that runs the
  cancellation law on faces of order three, four and five.

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
