# The language of Pattern

The Script console of the Pattern page speaks a small language of cubers'
words. This file is its logic, written down: what each word does, when it
is allowed, and how a run is judged. The language is page glue over the
public API of erno.js, not part of the library; every noun below is
injected into the player's script by `runScript`, and every call burns
fuel so a runaway loop dies with a message instead of hanging the page.

## The base is a fork

Before anything else, the game rests on one choice:

**You are handed a whole cube, or you take it apart and build your own.**

The default board arrives dealt and scrambled. `deal()` chooses the second
road. Which road a script walks decides how it is judged, and the two are
never confused: building the picture is not called reaching it.

## The grammar: four families

| Family | Words | Board phase |
|---|---|---|
| **Read** (pure, leave the board as found) | `at` `face` `pieces` `cycles` `off` `distance` `solved` `moves` `bin` | see per-word rules below |
| **Act** (mutates) | `turn` | whole only |
| **Build** (shifts phase) | `deal` `place` | `deal` any, `place` in pieces only |
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
  parser's words, if it is not real notation. Returns a frozen value:
  `{ alg, moves, order, cycles, inverse }`, with `cycles` already in slot
  names and `order` measured against the written picture. It studies a
  twin rather than the board, so an alg can be written and read in any
  phase, the cube in pieces included. `turn()` and `cycles()` accept an
  alg wherever they accept a string.

### Act

- **`turn(seq | alg)`**. Applies the sequence to the board. Refuses while
  the cube is in pieces, saying how many pieces are still in the bin. On
  the build road, a turn after the last piece lands turns the run into
  practice (see judgement).

### Build

- **`deal()`**. Takes the board apart the way Assemble does: a fresh cube
  at rest, six centres bolted to the core, everything else in a shuffled
  bin. Returns the bin as piece names. Only a plain cube comes apart;
  welded or carved boards are refused by name.
- **`bin()`**. The names still waiting to be placed.
- **`place(piece, slot?, spin?)`**. Sets a piece from the bin into any
  free slot of its kind, spun on the spot: the whole of Assemble's power
  in one call, so a script can build the perfect cube or an impossible
  one. Defaults: the piece's home slot, no spin. Refusals speak:
  wrong-kind slots, taken slots, pieces not in the bin. When the last
  piece lands the board is whole, the move count starts at zero (the
  build IS the board, the way the scramble is), and the judge may speak.

### Read

- **`at(slot)`**. Who stands where that slot rests, in home letters.
  Mid-build it answers for placed pieces and refuses empty slots by name.
- **`face(L)`**. The letters showing on a face. Whole board only.
- **`pieces()`**. Walks every slot: `{ at, is }` per entry, centres
  excluded since they never travel. Mid-build it walks only what stands.
- **`cycles(seq | alg)`**. A sequence read as the permutation it drives,
  in cycle notation over slot names. Whole board only.
- **`off()`**. The slots still wrong against the target, counted exactly
  the way the judge counts: the pattern string against the target string,
  facelet by facelet, in the frame the board is held in. A reading noun
  must never be cleverer than the judge. Plain cube only, whole only.
- **`distance()`**. Stickers away from the picture. Whole only.
- **`solved()`**. Whether the board wears the picture, any orientation.
  Whole only.
- **`moves()`**. Turns spent since the board last became yours (after the
  scramble, or after the last piece landed).

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

### A cuboid, handed (Puzzle: Cuboid, 3×3×2)

Pick Cuboid in the Write plate's Puzzle control; the slider drives the
long axis. A cuboid is a given board, never a dealt one, and it enforces
its own shape law:

```js
alg("R")   // refused at declaration: 'R' would leave this cuboid
           // misshapen. Only half turns about that axis (use R2) ...

turn("F R2 U2")   // quarter turns only where the cross-section is square
while (!solved() && moves() < 40) turn(alg("[F, R2]"))
```

### A Siamese, handed (Puzzle: Siamese)

Two cubes sharing a welded block. The vocabulary is per body, A-moves and
B-moves, and only the layers that come back to themselves exist at all;
the algebra takes the weld tokens like any others:

```js
turn("[AD, BU]2")
while (!solved() && moves() < 40) turn(alg("[AD, BU]"))
```

### Why only the plain cube comes apart

```js
deal()   // on a cuboid or a Siamese:
         // "only a plain cube comes apart; weld or carve it and the
         //  pieces stop being free"
```

A welded or carved board has pieces held by the weld, not by a core; a
bin of them would be a lie about the mechanism, so the language refuses
in the mechanism's own terms.

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
