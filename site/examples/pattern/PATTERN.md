# PATTERN — the language

A Replicube of twisty puzzles: challenges scored by code, where shorter
code demands understanding the puzzle. `(R U)105` is eight characters
only if you know R U has order 105. The boards are **cubes, cuboids and
welds**; the page derives everything from the engine and fakes nothing.

---

## 1. The fork — the roads, one making per run

**You are handed a whole board; or you take it apart and build it; or
you carve it; or, in the workshop, you make it from a spec.** The road
decides the judgement. The board is made once per run: dealt-and-built
or carved, never both.

| Road | Did | Verdict |
|---|---|---|
| Solver | only turned | "Reached the pattern": characters + moves |
| Builder | dealt and placed | "Built the pattern": characters + two crowns (picture, law) |
| Carver | carved, then turned | "Carved and reached": on the carved board's own laws |
| Practice | built, then turned | told what happened; no record |

Bests per challenge and per road, never mixed. A challenge owns its
board and its scramble; the workshop owns nothing and allows everything.

---

## 2. The grammar — five families

| Family | Words | Allowed |
|---|---|---|
| **Read** (pure) | `at` `face` `pieces` `cycles` `off` `distance` `solved` `moves` `bin` `legal` `can` | per word |
| **Act** (mutates state) | `turn` `scramble` | whole only |
| **Build** (shifts phase) | `deal` `place` | deal any; place in pieces |
| **Shape** (makes or edits the mechanism) | `board` `carve` | per word |
| **Declare** (pure) | `alg` | any phase, always |

Control flow is plain JavaScript. No `repeat()`, no combinators:
**structure in the algebra, strategy in the code.**

---

## 3. The mini-notation

- WCA tokens: `R U' F2 M x` — wides `Rw`/`r`, `3Rw`
- `(A)n` repeats; `'` inverts a move or a whole group
- `[A, B]` commutator; `[A: B]` conjugate; they nest
- Two dialects: **box** (cubes, cuboids) and **weld** (body-first:
  `AD`, `BR2` — and `C`, `D`… when a weld holds more bodies, a
  Triamese included; the habit never changes). Every alg carries its
  dialect for life.
- The dialect *is* the law: tokens that would misshape a box or fail to
  return a weld layer simply do not exist, and the parser refuses them
  with the lesson (`'R'` on a Domino → "use R2").

---

## 4. The alg value

`alg(seq)` declares without turning: it studies a twin, so it works in
any phase, the cube in pieces included. It returns a **frozen value**.

**Contract**
- Immutable; every method returns a new frozen value.
- Identity is the writing: `equals` = canonical string + dialect;
  `sameEffect` is the other question. `R R'` honestly does nothing and
  is honestly two moves.
- No hidden simplification, ever.
- Canonical emission preserves compression: `.times(6)` prints
  `(R U)6`; `alg(x.alg)` round-trips to the same value.
- The empty alg exists: order 1, identity for `then`.
- Cross-dialect composition refuses.

**Readings**: `alg`, `moves`, `cycles`, `inverse`, and `order` — the
pure group order, the theorem. (How long until it *looks* home against
the picture is the Cycle plate's readout, `looksHome`.) Readings are
computed, never expanded.

**Constructors** (mirror the notation):

| method | emits |
|---|---|
| `a.then(b)` | `A B` |
| `a.times(n)` | `(A)n` — times(0) = empty; negative refused |
| `a.inverse()` | reverses order + primes; groups keep wrapper: `(R U)6'` |
| `a.commutator(b)` | `[A, B]` |
| `a.conjugate(b)` | `[A: B]` |

---

## 5. The transforms — what the string cannot say

There is no mirror token, and never will be: no thumb performs a
reflection. Rotational relabels are already sayable (`[x: A]`); mirror
relabels are not — that is why these are methods.

**`a.reflect(plane)`** — the sequence on the other side of the glass.
Planes named by the pair they swap: `RL`, `UD`, `FB`. One rule makes
all tables: *axis ⊥ plane → letter swaps and prime toggles; axis in the
plane → prime toggles in place; half turns only map the letter.*

reflect("RL") on the cube:

| token | image | token | image |
|---|---|---|---|
| `R R' R2` | `L' L L2` | `M M' M2` | `M M' M2` |
| `L L' L2` | `R' R R2` | `E` / `S` | `E'` / `S'` |
| `U D F B` | `U' D' F' B'` | `x y z` | `x y' z'` |
| `Rw`, `3Rw` | `Lw'`, `3Lw'` | | |

`M → M` looks wrong and is forced: the slice lies on the glass, and
`Rw = R M'` must reflect to `Lw' = L' M'`. `UD` and `FB` follow the
same rule with their pair. **On boxes reflect is total**: coordinate
mirrors preserve every axis's dimensions, so a legal token always
reflects to a legal token — a 2×2×3 has no M to turn, and reflecting
through its RL plane is still perfectly defined.

**`a.exchange()`** — on a weld of twin bodies, the same technique on
the other body. The classic Siamese's exchange is a **180° rotation
about the bar** — not a mirror — so the port is prime-free:
`[AD, AL]` → `[BU, BR]`.

**`a.swap()`** — the intra-body twin (D↔L within a body), also a
rotation, also prime-free. The Siamese additionally publishes three
true mirrors for `reflect`: `diag` (`AD↔AL'`), `anti` (`AD↔BR'`),
`flat` (every prime toggles in place).

**Publication is per geometry** — derived by the engine like the move
list, never hand-listed. Unequal bodies publish nothing; unknown names
are refused with the board's list. Transforms port **algorithms**
(same order, same cycle shape, mirrored slots), never solutions: the
other body wears its own scramble.

---

## 6. The words

### Act

- **`turn(seq | alg)`** — applies the sequence to the board. Refuses in
  pieces, naming the bin count.
- **`scramble(seed?)`** — walks the board's own legal moves, never a
  fixed string, deterministic under a seed: the same scramble for
  everyone on a challenge, N seeds for the any-position league. The
  board becomes yours after it — `moves()` restarts at zero. Speaks in
  the workshop; a challenge owns its scramble and refuses the word,
  naming the challenge.

### Build

- **`deal()`** — takes the board apart; centres ride the spider; on a
  weld the shared pieces ride the weld and free pieces go to the bin,
  body-first (`ADLB`, `BDLB`). Refuses on carved boards, naming the
  carve.
- **`place(piece, slot?, spin?)`** — sets from the bin, spun on the
  spot: the perfect cube or an impossible one. Welds: home placements,
  unspun, until their laws are written. Last piece lands → whole,
  moves at zero.

### Shape

- **`board(spec)`** — makes the board from a spec string, the
  mini-notation of mechanisms:

  ```js
  board("3")                     // a 3×3 cube
  board("2x2x3")                 // a cuboid; quarters on the square axis only
  board("3 + 3 @ 2,2,0")         // the classic Siamese
  board("3 + 2 @ 1.5,1.5,0.5")   // a 2×2 grown on a 3×3's corner
  board("3 + 3x2x3 @ 2,1,0")     // a cube welded to a cuboid
  board("3 - centers")           // a Void, born carved
  ```

  One number is a cube; a triple is a box; `+ … @ x,y,z` welds bodies
  on one lattice — misaligned bodies are refused in the constructor's
  words, because anything else would slice its neighbour in half;
  `- …` bakes a carve in. The new board arrives whole and at rest and
  the run begins again. The same string is the board's name everywhere:
  what `board()` speaks, the challenge spec carries, and the share
  records — one notation, three uses, round-tripping like the alg's.
  Speaks in the workshop; a challenge owns its board and refuses the
  word, naming the challenge.

- **`carve(...slots | "centers")`** — removes pieces; the absences are
  piece-shaped and travel under turns. Speaks slots (a hole is where
  you point the drill); refusals name the piece. **Bench rule**: whole
  board, unturned this run — you carve on the bench, not mid-solve. No
  `fill()`: nothing unsaws wood; Reset heals. `carve("centers")` **is**
  the Void — and keeps **both crowns**: the cube's three laws never
  mention a centre, so they hold verbatim. Other carves change the laws
  → "laws unwritten", said, not pretended. Carving removes pieces,
  never moves: `legal()` stays constant. A carve re-publishes
  symmetries (the Void keeps all planes; a one-corner carve loses `RL`
  and reflect refuses with the surviving list). Cubes and cuboids only;
  welds wait on their laws.

### Read

- **`at(slot)`** — who stands there, home letters; mid-build answers
  the placed, refuses empty slots by name.
- **`face(L)`** — the letters showing. Whole only.
- **`pieces()`** — every slot, `{at, is}`; mid-build walks what stands.
- **`cycles(seq | alg)`** — sugar for `alg(x).cycles`: the twin's
  permutation in slot names, **any phase**.
- **`legal()`** — the mechanism's move list, derived from the one law
  (the Siamese's twelve that nobody lists by hand). Pure, any phase,
  constant for the run on every board Pattern deals.
- **`can(seq | alg)`** — would the board accept it, judged as `turn()`
  judges, turning nothing. **Three words, three jobs: `alg()` parses,
  `can()` asks, `turn()` acts.**
- **`off()`** — slots wrong against the target, counted exactly as the
  judge counts; on carved boards, over what exists. Box family, whole.
- **`distance()`**, **`solved()`** — whole only.
- **`moves()`** — since the board became yours (the scramble, the last
  placement, or the carve).

---

## 7. Phases, recon, Cycle

**Phases**: whole or in pieces, enforced. In pieces: turn, scramble,
carve and judging refuse with the bin count; canvases veil the
unplaced; Reset heals. Twin-and-mechanism words (`alg`, `cycles`,
`legal`, `can`) ignore phase.

**Recon**: recorded from the engine's history as it runs, never
re-derived. Turns replay eased; placements land under the veil; carved
pieces leave the same way, walls closing behind them. Dying scripts
replay to the very move.

**Cycle plate**: every alg loops by theorem. Two numbers, names kept
apart: `order` (the value's theorem) and `looksHome` (the instrument's
readout against the written picture, shortened by symmetry).

---

## 8. Worked cases

**Cube — both hands from one declaration:**
```js
const right = alg("R U R'")
turn(right.then(right.reflect("RL")))   // R U R' L' U' L — never memorised
```

**Builder — the borrowed-cube tragedy, as a theorem:**
```js
deal()
for (const p of bin()) place(p, p, p == "URF" ? 1 : 0)
// "…but not a lawful cube."  "Unlawful: the corner twists add up to 1 mod 3 …"
```

**Carver — the Void as a sentence:**
```js
carve("centers")
while (!solved() && moves() < 60) turn(alg("[R, U]"))
// "Carved and reached." The three laws hold verbatim on it.
```

**Workshop — make, shake, work:**
```js
board("3 + 3 @ 2,2,0")
scramble(42)
turn("[AD, AL]")
```

**Cuboid met for the first time — ask, don't assume:**
```js
alg("R")        // refused: 'R' would leave this cuboid misshapen. Use R2 …
for (const m of legal()) {
  const d = distance()
  turn(m)
  if (distance() >= d) turn(alg(m).inverse())
}
```

**Siamese — address, never travel** (no cursor, no goto; the body is in
the token):
```js
turn("AD")                       // body A; the bar never moves
const cyc = alg("[AD, AL]")
turn(cyc)                        // worked A
turn(cyc.exchange())             // [BU, BR] — same technique in B
alg("[AD, BU]").cycles           // [] — disjoint layers commute; it dies
```

**Weld that is not twins (3×3 + 2×2, cube + cuboid) — ask, split, work:**
```js
alg("[AD, AL]").exchange()
// refused: this weld publishes no symmetries: its bodies are not each other's image.
const inB = legal().filter(m => m.startsWith("B"))
alg("BR")                        // refused: no quarter turn about that axis …
if (can("BR2")) turn("BR2")      // the polite habit
```

**The four habits**: ask, don't assume · address, don't travel · port
understanding, not solutions · structure in the algebra, strategy in
the code.

---

## 9. What each family can do

|  | Cube | Cuboid | Weld twins | Weld unequal | Carved |
|---|---|---|---|---|---|
| Handed, turned, judged | yes | yes | yes | yes | over what stands |
| Algebra and algs | yes | yes | weld tokens | weld tokens | unchanged |
| `legal()` / `can()` | yes | yes | yes | yes | yes |
| `reflect` | yes | yes | published mirrors | refused, empty list | what survives |
| `exchange` / `swap` | — | — | prime-free | refused by name | — |
| Built piece by piece | yes | yes | home, unspun | home, unspun | not yet |
| Law's crown | three laws | corner twist law | unwritten, said | unwritten | centers: verbatim; others: unwritten |
| `deal()` | yes | yes | yes | yes | no, names its carve |
| Can be carved | yes | yes | waits | waits | is one |
| `board()` spells it | `"3"` | `"2x2x3"` | `"3 + 3 @ …"` | `"3 + 2 @ …"` | `"3 - centers"` |

---

## 10. Deliberately absent

- Control-flow combinators (JS suffices; TF itself retreated).
- A randomness word beyond the seeded scramble (chance has one name and
  one place).
- An implicit simplifier (a verb someday, never a courtesy).
- **Shape-shifting** (the judge cannot read a deformed board; not faked).
- **Bandaging** (state-dependent legality; if it enters, it enters by
  name).
- **Blocking over a carve** (same door, other side: walking holes).
- `fill()` (nothing unsaws wood; Reset heals).

## 11. The honesty rules

1. Everything countable is derived from the engine, never restated.
2. A reading noun counts exactly as the judge counts, or refuses.
3. Refusals name the thing: slot, piece, bin count, plane, body, spec,
   road already taken, the challenge that owns the board.
4. The recon records what ran — turns, placements, carves alike.
5. The code you watch is the code that runs.

---

## 12. Open, on purpose

1. **The weld's laws** — invariants of each body's two-face subgroup
   (they factor: disjoint supports), derived and *named* so the judge
   gains its voice there; unlocks exotic placements and carves on
   welds.
2. **The challenge format** — target + road + board spec (the same
   string `board()` speaks, carve included) + seeds. Two leagues:
   *this position* (fixed seed, hardcoding is the floor) and *any
   position* (N seeds; what golfs is a solver). Four level kinds, one
   unique to this game: **reach** the pattern; **build** it; **build
   the impossible** — the target is unlawful on purpose, won when the
   judge names the broken law; and **which road exists?** — shown a
   picture, answer with the script that proves it reachable or only
   buildable. Three honest metrics, never one number: characters,
   moves, fuel — separate boards, each its own virtue.
3. **The verb question** — `reflect`/`exchange`/`swap` split vs one
   general `under(name)`. Tables identical either way.
