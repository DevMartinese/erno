# ENGINE — what erno.js must grow for Pattern

Pattern derives everything from the engine (honesty rule #1), so every
promise in PATTERN.md is a demand on the library. Nine items, each tied
to the promise it backs. **The golden rule: cut an item here, cut the
sentence it backs there — the two files stay one truth.**

---

## 1. The alg value module

*Backs: PATTERN §4–5, the whole Declare entry.*

A frozen value beside the notation (natural home: next to the parser in
`twisty.js`), carrying its **dialect** (box or weld, captured at
declaration) and exposing:

- readings: `alg`, `moves`, `order`, `cycles`, `inverse` — one
  implementation shared with `effectOf`, which must accept the value
  wherever it accepts a string;
- constructors: `then`, `times`, `inverse`, `commutator`, `conjugate`;
- transforms: `reflect(plane)`, `exchange()`, `swap()`;
- questions: `equals` (canonical string + dialect), `sameEffect`.

Laws enforced in code, not prose: every method returns a new frozen
value; canonical emission preserves compression (`times(6)` prints
`(R U)6`); `alg(x.alg)` round-trips to an equal value; `inverse` of a
bare sequence reverses in the open (matching `Erno.inverse` today)
while a wrapped group keeps its wrapper (`(R U)6` → `(R U)6'`); no
method simplifies; cross-dialect `then` refuses.

**Cost rule**: `order` and `cycles` of `(A)n` are computed from the
base permutation (cycle powers, order over gcd), never by expanding n
times. `alg("R U").times(100000).order` must be O(base), or Pattern's
fuel pricing becomes a lie.

## 2. Published symmetries, computed per geometry

*Backs: `reflect`, `exchange`, `swap` and their refusals (§5).*

Each mechanism publishes a named table of its solid's symmetries —
name → token map — **derived from the geometry, never hand-listed**,
exactly as `legalMoves()` derives the move list from the one law. The
list is per-instance, not per-class:

- a box always publishes `RL`, `UD`, `FB` (coordinate mirrors preserve
  each axis's dimensions → legality preserved: the closure theorem);
- the classic Siamese publishes `exchange` and `swap` (180° rotations,
  prime-free) plus the mirrors `diag`, `anti`, `flat`;
- a Siamese at another offset keeps `exchange` (equal bodies always
  have the 180° turn about the shared block) but may lose the mirrors;
- a weld of unequal bodies never publishes exchange or swap; the
  mirrors its compound truly has still appear;
- a carve re-publishes: the Void keeps all three planes; a one-corner
  carve keeps what survives.

The transforms consult this table and nothing else. Refusal errors
carry the published list as data so the page can quote it, never
compose it.

## 3. Runtime carve

*Backs: the Shape family, `carve()` (§6).*

`remove` exists at construction; Pattern needs it on a live board: an
operation that rebuilds the mechanism with the removal while carrying
the surviving pieces' current placement. The absence is a *piece*
removed (the one standing at the pointed slot), and the hole then
travels under turns as the piece would have. Must hold:

- `carve("centers")` on a fresh Cube renders **byte for byte** what
  `new Void()` renders, and `legal()` answers the same eighteen;
- carving never changes the move list on Pattern's boards (blocking
  stays off over carves — the state-dependent door stays shut);
- `getState` / `getPattern` / `distanceTo` speak over the facelets
  that exist, so `off()` and the judge agree to the facelet.

## 4. The judge, scoped per mechanism

*Backs: the crowns column and every "laws unwritten" verdict (§1, §9).*

`lawful()` today speaks the cube's three laws. It must know its scope:

- **center carves inherit the three laws verbatim** (none mentions a
  centre) — test: a corner twisted on a Void is named unlawful in the
  same words as on a cube;
- other carves and all welds route to the honest verdict channel:
  picture crown judged, law crown "unwritten", stated, not pretended;
- future, in this order: a universal membership test (a small
  Schreier–Sims over any mechanism's generators) gives the judge a
  silent yes/no everywhere; the hand-named laws remain its voice where
  written. Only after a mechanism's laws are written does `place()`
  gain exotic slots and spins there, and `deal()` open on carved
  boards — a builder deserves a judge who can name what they broke.

## 5. History as first-class events

*Backs: the recon, honesty rule #4 (§7, §11).*

The engine's history is the recon's only source. It carries turns; it
must carry **placements and carves as first-class events** (which
piece, which slot, which spin; which piece left which slot), so the
page records and replays without re-deriving anything.

## 6. Body-first slot names, everywhere

*Backs: the weld dialect (§3, §8).*

`cycles` / `effectOf` on welds must answer in body-first slot names
(`ADLB`, `BUFR`) — the same dialect the moves, the reads and the bin
already speak — and the scheme extends to `C`, `D`… on welds of more
bodies.

## 7. The board spec parser

*Backs: `board(spec)` and the challenge serialization (§6, §12).*

One factory mapping the spec string to the constructors the engine
already has — a number to `size`, a triple to `Cuboid`, `+ … @ x,y,z`
to `Siamese`/`Fused` bodies, `- …` to `remove` — and printing it back.
The string is the serialization challenges and shares carry, so
**parse ∘ print must round-trip** exactly like the alg's, and its
refusals (misaligned lattices, impossible offsets) carry the named
thing as data. Note the shape of the ask: **no new mechanism** — the
constructors all exist; this is a notation over what the engine
already knows how to build.

## 8. Seeded scrambles

*Backs: `scramble(seed?)` and both leagues (§6, §12).*

`scramble()` already walks the legal moves rather than replaying a
fixed string. It must additionally take a **seed** and be deterministic
under it — same seed, same board, same walk, on every machine — because
a challenge's identity includes its scramble, and the any-position
league evaluates one script against N named seeds. The seed and the
resulting sequence both belong in the history (item 5), so the recon
and the share can speak them.

## 9. The test sheet

Every item lands with its assertions:

1. **involution** — `reflect(p)` twice is identity; likewise
   `exchange`, `swap`;
2. **homomorphism** — transforms distribute through `then`, `(A)n`,
   `[A, B]`, `[A: B]`, and commute with `'`;
3. **coherence** — reflect of `Rw` equals reflect of `R M'`, tables
   and engine identities agreeing move for move (this pins `M → M`
   under `RL`);
4. **closure** — every token a transform emits parses in the source
   dialect: by theorem on boxes, by construction on welds;
5. **effect invariance** — `order`, `moves`, cycle shape survive every
   transform; a do-nothing reflects to a do-nothing;
6. **Declare purity** — the board's facelets before and after any
   Declare-family call are byte for byte the same;
7. **Void equivalence** — `carve("centers")` ≡ `new Void()` byte for
   byte; the three laws verbatim on it;
8. **spec round-trip** — parse ∘ print is identity on every spec the
   page offers, and print ∘ parse on every board it deals;
9. **seeded determinism** — `scramble(seed)` reproduces its walk
   across runs and machines;
10. **refusal voices** — every refusal carries the named thing (list,
    piece, plane, body, spec, seed) as data, not prose, so the page
    can speak it in its own two voices.

---

## Build order

What Pattern needs to exist at all: **1, 2, 3, 7, 8**.
What unlocks crowns and future powers: **4**.
Coherence of the record: **5, 6**.
The guarantee over everything: **9**.
