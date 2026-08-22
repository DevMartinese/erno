# The language of Pattern

The Script console of the Pattern page speaks a small language of cubers'
words. This file is its logic, written down: what each word does, when it
is allowed, and how a run is judged. The language is page glue over the
public API of erno.js, not part of the library; every noun below is
injected into the player's script by `runScript`, and every call burns
fuel so a runaway loop dies with a message instead of hanging the page.
This file describes what stands today; PATTERN.md and ENGINE.md, beside
it, carry the designed road ahead and what the library must grow for it.

## The base is a fork

Before anything else, the game rests on one choice:

**You are handed a whole cube, or you take it apart and build your own.**

The default board arrives dealt and scrambled. `deal()` chooses the
second road, and `carve()` opens a third: holes on the bench before the
solve begins. Which road a script walks decides how it is judged, and
they are never confused: building the picture is not called reaching it,
and a carved board is judged over what exists.

## The grammar: four families

| Family | Words | Board phase |
|---|---|---|
| **Read** (pure, leave the board as found) | `at` `face` `pieces` `cycles` `off` `distance` `solved` `moves` `bin` `legal` `can` | see per-word rules below |
| **Act** (mutates) | `turn` `scramble` | whole only |
| **Build** (shifts phase) | `deal` `place` | `deal` any, `place` in pieces only |
| **Shape** (makes or edits the mechanism) | `board` `carve` | per word |
| **Declare** (pure, board never touched) | `alg` | any phase, always |

Control flow is JavaScript's own: `if`, `for`, `while`, `const`. The
language deliberately has no `repeat()`, no `until()`, no condition
combinators. Structure belongs in the algebra string; strategy belongs in
plain code.

## The mini-notation: the algebra

Everywhere a sequence is taken, the whole algebra is taken:

- plain WCA tokens: `R U' F2 M x`
- `(A)n` repeats, `'` inverts a move or a whole group
- `[A, B]` is a commutator, `[A: B]` a conjugate, and they nest
- macros: `let sexy = R U R' U'; (sexy)6`

No puzzle's own notation uses brackets or parentheses, so the two can
never be confused.

## The words

### Declare

- **`alg(seq)`**. The blindfold half of the sport: declares a sequence
  without turning it. Parsed on the spot; refused on the spot, in the
  parser's words, if it is not real notation. It studies a twin rather
  than the board, so an alg can be written and read in any phase, the
  cube in pieces included, and it carries its dialect (box or weld) for
  life. `turn()` and `cycles()` accept an alg wherever they accept a
  string. It returns a **frozen value**:

  - **Readings**: `alg`, `moves`, `cycles` (slot names), and two numbers
    with their names kept apart: `order` is the cubers' theorem, read on
    an unpainted twin ((R U) is 105 there whatever the board wears);
    `looksHome` is the same reading against the written picture,
    shortened by its symmetries.
  - **Constructors**, every one returning a new frozen alg, nothing ever
    simplified, emission preserving compression: `then(b)`, `times(n)`
    (prints `(A)n`; zero is the empty alg; negatives refused),
    `inverse()` (a bare sequence reverses in the open exactly as
    `Erno.inverse` writes it; a wrapped group keeps its wrapper:
    `(R U)6` comes back `(R U)6'`), `commutator(b)`, `conjugate(b)`.
  - **Transforms**: `reflect(plane)` stands on the box family, planes
    `RL`, `UD`, `FB`, total by theorem; the slice rides its pair's
    double flip, which is why M maps to M under RL and `Rw` comes back
    `Lw'`. `exchange()` and `swap()` wait for the engine to publish each
    weld's symmetries, and say so.
  - **Questions**: `equals(b)` is the writing plus the dialect, so
    `R R'` honestly differs from the empty alg; `sameEffect(b)` is the
    other question, answered on unpainted twins. Cross-dialect
    composition refuses: box and weld part ways.

### Act

- **`turn(seq | alg)`**. Applies the sequence to the board. Refuses while
  the cube is in pieces, saying how many pieces are still in the bin. On
  the build road, a turn after the last piece lands turns the run into
  practice (see judgement).
- **`scramble(seed?)`**. Walks the board's own legal moves, never a fixed
  string, and is deterministic under a seed: same seed, same board, same
  walk, for everyone. The scramble is the board, not the player's doing,
  so `moves()` restarts at zero after it. A challenge owns its scramble
  and refuses the word.

### Shape

- **`board(spec)`**. Makes the board from the mini-notation of
  mechanisms: a number is a cube, a triple is a box, `+ size @ x,y,z`
  welds bodies on one lattice, `- name` bakes a carve in. The engine
  parses it, refuses misaligned lattices in the constructor's words,
  and the instance's canonical printing round-trips exactly, so the
  same string is the board's name everywhere. The new board arrives
  whole and at rest and the run begins again. Speaks in free play; a
  challenge owns its board and refuses the word.
- **`carve(...names | "centers")`**. Removes pieces: real holes, the
  mechanism's own remove, so what is left turns, scrambles and is judged
  exactly, and every twin the run studies wears the same holes. Bench
  rule: whole board, unturned this run, one making per run; you carve on
  the bench, not mid-solve. There is no `fill()`: nothing unsaws wood,
  and Reset heals, target included. `carve("centers")` is the Void as a
  sentence. Cubes and cuboids only; a weld waits for its laws. A carve is
  refused inside a challenge, which hands you its board whole.

### Build

- **`deal()`**. Takes the board apart: a fresh board at rest, what the
  mechanism holds riding the frame, everything free in a shuffled bin,
  returned as piece names. On a cube or cuboid the centres ride the
  spider. On a weld, thought of as one big solid, the shared pieces ride
  the weld like centres ride the spider, and the free pieces of both
  bodies go to the bin, addressed body-first: `ADLB` and `BDLB`, the
  same dialect the moves already speak. A carved board is missing the
  pieces a bin would promise, so it refuses.
- **`bin()`**. The names still waiting to be placed.
- **`place(piece, slot?, spin?)`**. Sets a piece from the bin into any
  free slot of its kind, spun on the spot: the whole of Assemble's power
  in one call, so a script can build the perfect cube or an impossible
  one. Defaults: the piece's home slot, no spin. Refusals speak:
  wrong-kind slots, taken slots, pieces not in the bin. On a welded
  board a piece goes to its home, unspun, for now: the weld's reduced
  symmetry is the mechanism's to enforce, and the language will not
  fake a carry it cannot name. When the last piece lands the board is
  whole, the move count starts at zero (the build IS the board, the way
  the scramble is), and the judge speaks where its laws are written:
  the weld's laws are not yet, and the verdict says so instead of
  pretending.

### Read

- **`at(slot)`**. Who stands where that slot rests, in home letters.
  Mid-build it answers for placed pieces and refuses empty slots by name.
- **`face(L)`**. The letters showing on a face. Whole board only.
- **`pieces()`**. Walks every slot: `{ at, is }` per entry, centres
  excluded since they never travel. Mid-build it walks only what stands.
- **`cycles(seq | alg)`**. Sugar for `alg(x).cycles`: the permutation a
  sequence drives, in cycle notation over slot names, read on the twin,
  so it speaks in any phase.
- **`off()`**. The slots still wrong against the target, counted exactly
  the way the judge counts: the pattern string against the target string,
  facelet by facelet, in the frame the board is held in. A reading noun
  must never be cleverer than the judge. Box family only, whole only.
- **`distance()`**. Stickers away from the picture. Whole only.
- **`solved()`**. Whether the board wears the picture, any orientation.
  Whole only.
- **`legal()`**. The mechanism's move list, derived from the one law and
  read off a twin at rest: pure, any phase, constant for the run.
- **`can(seq | alg)`**. Would the board take it from here, judged as
  `turn()` judges, turning nothing. Three words, three jobs: `alg()`
  parses, `can()` asks, `turn()` acts.
- **`moves()`**. Turns spent since the board last became yours (after the
  scramble, the last piece landing, or the carve).

## Phases

The board is either **whole** or **in pieces**, and the language enforces
the difference instead of guessing:

- In pieces: turning and judging refuse with the count still in the bin;
  the canvases veil the unplaced; the keypad, scramble, undo, share and
  the sequence console wait; Reset stays alive as the healer.
- Whole: everything speaks.
- `alg()` alone ignores phase, because it never touches the board.

## Judgement: the road decides

| Road | What the script did | Verdict and score |
|---|---|---|
| **Solver** | only turned | "Reached the pattern": characters + moves |
| **Builder** | dealt and placed | "Built the pattern": characters + the two crowns, the picture and the law |
| **Carver** | carved, then turned | "Carved and reached": on the carved board's own facelets |
| **Practice** | built, then turned | told what happened; no record kept |

Two crowns, because they are different virtues: a build can wear the
perfect picture and still be an impossible cube, one corner twist away
from lawful, and the status line names the broken law in the fundamental
theorem's own terms. A board built straight into the picture says "built
rather than reached"; "reached" waits for a walk that earned it. Bests
are kept per challenge and per road, never mixed.

## The recon

Every run leaves a recon: the reconstruction a cuber would write of what
actually happened, recorded from the engine's own history as it runs,
never re-derived. Afterwards the board watches it back on a shadow: the
truth already stands, so skipping, interrupting and dying scripts all end
the same way, by drawing what is. Turns replay eased with a ramp, placed
pieces land one by one under the veil, and a one-line ticker speaks it
all in plain notation. A script that dies mid-way replays up to the very
move where it died. Reduced motion gets the recon written out whole and a
board already arrived.

## Cycle: the instrument

Every sequence has a finite order, so every alg is a seamless loop: a bar
of music that comes back to one by theorem. The Cycle plate turns the
written bar around and around; editing it swaps bars mid-flight on the
same board; a broken bar is refused in the parser's words while the old
one keeps playing. The readout tells the bar's own truth against the
written picture: order here means until it LOOKS home, so a symmetric
picture shortens the loop. Rest rebuilds the cube at rest, wearing
whatever Write says.

## Worked examples

Every snippet below has been run against the page as printed; the quoted
verdicts are what it actually said.

### A cube you are handed (the default road)

The board arrives dealt and scrambled. A solver only turns:

```js
const sexy = alg("[R, U]")
while (!solved() && moves() < 60) turn(sexy)
```

Both hands from one declaration, never memorised twice:

```js
const right = alg("R U R'")
turn(right.then(right.reflect("RL")))   // R U R' L' U' L
```

Or reads before it acts, the shape of every smarter script:

```js
for (const m of ["R", "U", "F", "D", "L", "B"]) {
  const d = distance()
  turn(m)
  if (distance() >= d) turn(m + "'")
}
```

### A cube built piece by piece

The other road. Take it apart, put every cubie in its home:

```js
deal()                            // centres stay on the spider, 20 to the bin
for (const p of bin()) place(p)   // "Built the pattern: 39 characters, both crowns."
```

`place` takes a slot and a spin, so the same road builds the impossible.
One corner twisted:

```js
deal()
for (const p of bin()) place(p, p, p == "URF" ? 1 : 0)
// "Built the picture: 62 characters, but not a lawful cube."
// The board: "Unlawful: the corner twists add up to 1 mod 3 ..."
```

Two edges trading homes:

```js
deal()
place("UF", "UB")
place("UB", "UF")
for (const p of bin()) place(p)
// "Unlawful: the corner and edge permutations disagree in parity:
//  two pieces alone can never swap."
```

### A cuboid, on both roads (Puzzle: Cuboid, 3×3×2)

Pick Cuboid in the Write plate's Puzzle control; the slider drives the
long axis. A cuboid inherits the cube's spider, so it walks both roads.
Handed, it enforces its own shape law:

```js
alg("R")   // refused at declaration: 'R' would leave this cuboid
           // misshapen. Only half turns about that axis (use R2) ...

turn("F R2 U2")   // quarter turns only where the cross-section is square
while (!solved() && moves() < 40) turn(alg("[F, R2]"))
```

And it comes apart like its parent, two centres riding the spider and
sixteen free pieces to the bin:

```js
deal()                            // bin(): 8 corners and 8 edges
for (const p of bin()) place(p)   // "Built the pattern: 39 characters, both crowns."
```

### A Siamese, on both roads (Puzzle: Siamese)

Two cubes sharing a welded block. The vocabulary is per body, A-moves and
B-moves, and only the layers that come back to themselves exist at all;
the algebra takes the weld tokens like any others. And the weld teaches a
lesson no single cube can: layers on different bodies never share a
piece, so a commutator across the weld is nothing at all, and one inside
a body is the real thing:

```js
alg("[AD, BU]").cycles   // [] : disjoint layers commute, the commutator dies
alg("[AD, AL]").cycles   // real cycles: alive inside body A
                         // (.order is the theorem; .looksHome, your picture)
turn("[AD, AL]2")
while (!solved() && moves() < 40) turn(alg("[AD, AL]"))
```

And it comes apart, one big solid with a frame inside: fourteen pieces
ride the frame (the centres and the weld's own), thirty four go to the
bin, spelled body-first:

```js
deal()                            // bin(): ADLB, BUFR, ... 34 free pieces
for (const p of bin()) place(p)
// "Built the pattern: 39 characters; the picture crown, its laws
//  unwritten."  The weld has no written laws yet, and the verdict says
//  so rather than pretending a second crown.
```

Mid-build the reads speak the same dialect: `at("ADLB")` answers once it
stands, `pieces()` walks the placed, and `place("DLB")` is turned away
with the spelling lesson: a welded board spells pieces body-first.

### The workshop (make, shake, work)

```js
board("3 + 3 @ 2,2,0")   // the classic Siamese, spelled out
scramble(42)             // the same walk for everyone
turn("[AD, AL]")
```

```js
board("3 - centers")             // a Void, born carved
board("3 + 3x2x3 @ 2,0.5,0")     // a cube welded to a cuboid
board("3 + 3 @ 1.3,0,0")         // refused: off the shared lattice ...
```

### A carver's run (holes on the bench)

```js
carve("URF", "UF")   // two piece-shaped holes; the target wears them too
scramble(42)         // seeded: the same walk for everyone
while (!solved() && moves() < 60) turn(alg("[R, U]"))
// "Carved and reached: ..." or "Carved: ..., N stickers off the picture."
```

```js
carve("centers")     // the Void, written as a sentence
```

### What each family can do

|  | Cube | Cuboid | Weld (Siamese, Fused, composed) |
|---|---|---|---|
| Handed, turned, judged by picture | yes | yes | yes |
| The algebra and algs | yes | yes | yes, in weld tokens |
| Built piece by piece | yes | yes | yes, home placements, body-first names |
| Carved with holes | yes | yes | waits for its laws |
| `reflect` | yes | yes | waits for published symmetries |
| `exchange` / `swap` | refused by name | refused by name | wait for published symmetries |
| Exotic placements (any slot, spins) | yes | yes | not yet: home and unspun |
| `off()` | yes | yes | not yet |
| `board()` spells it | `"3"` | `"3x3x2"` | `"3 + 3 @ 2,2,0"` |
| The law's crown | yes | corner twist law | laws unwritten; the verdict says so |

The one board that never comes apart is the carved one (Void): it is
missing the pieces a bin would promise, and the language refuses in the
mechanism's own terms.

## The two voices

Wherever the page narrates, two voices keep strict jobs: a line of words
may explain, and a line of notation may only ever carry notation. The say
line never holds tokens; the ticker never holds prose.

## Deliberately absent

- Graph-style control flow (`cond`, `while_loop` combinators): strategy
  is written in plain JavaScript. TensorFlow itself retreated from the
  alternative.
- Node syntax for the paint function: `return y > 0 ? U : D` needs no
  shader cosplay; there is no GPU here to appease.
- A randomness combinator: chance already has a name and a place, the
  scramble.

## The honesty rules

1. Everything countable is derived from the engine, never restated.
2. A reading noun counts exactly as the judge counts, or refuses.
3. Refusals name the thing: the slot, the piece, the count in the bin.
4. The recon is recorded from what ran, not replayed from what was asked.
5. Nothing on screen is a recording; the code you watch is the code that
   runs.
