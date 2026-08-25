# PATTERN — the chain

A redesign of the game's surface: one fluent value, transformed link by
link, in the style this family of instruments taught us. Strudel and TSL
lend the shape (a chained value, terse mini-notation strings); hydra
lends the routing (`.out()`), the live edit and the URL-as-sketch; p5
lends the attitude (one line makes something, refusals that teach); and
Replicube lends the game frame — levels, golf, records — but never its
flat statement syntax. The engine underneath does not change: every link
speaks to the same mechanisms PATTERN.md derives, and every law named
there still holds. This document only changes how the language is worn.

---

## 1. The source

**`rubik(spec?)`** — the one source word. The library carries the man's
first name; the chains open with his surname.

```js
rubik()                      // = rubik("3"): a 3×3, whole, at rest, classic colours
rubik("5")                   // a number is a cube
rubik("3x3x5")               // a triple is a box
rubik("3 + 3 @ 2,2,0")       // + welds bodies on one lattice
rubik("3 - centers")         // - bakes a carve in: the Void
```

The spec string is the same board spec PATTERN.md defines, unchanged —
it is this language's mini-notation, the way `"c3 [e3 g3]"` is
Strudel's. Misalignment, bad sizes, shared-piece carves: refused in the
constructor's words, exactly as before.

**The defaults are the healthy object.** Shape `"3"`; paint, the classic
scheme; state, whole and at rest; seed, none. Nothing arrives scrambled,
broken or strangely painted unless a link asked for it: the chain is the
story of what you did to a sound cube.

## 2. The value

A chain value is **immutable and frozen**, like the alg value already
is: every link returns a NEW value and the one you held is untouched.
That is what makes chains branch:

```js
const base = rubik("3").paint((x, y, z) => y > 0 ? "B" : "F")
base.out(goal)               // the picture to reach
base.scramble(7).out()       // the same board, shaken, on the table
```

One base, two branches, zero copies made by hand. Running a sketch is
re-running its chains whole — deterministic under their seeds — so the
code you watch is the code that runs, literally and every time.

## 3. The links

Same families as the words had; the family is never said, it is felt.

**Shape** — makes or edits the mechanism.

| link | does |
|---|---|
| `.carve(...names \| "centers")` | removes pieces; absences travel; refusals name the piece |
| `.paint(fn \| scheme)` | paints every sticker: `fn(x, y, z, n, face, row, col, kind)` returns a face letter or 0–7, the same eight arguments Write always passed; or a scheme by name (`"classic"`, `"japanese"`, `"silver"`, `"gold"`) |

`paint` joins the language: it was always an ordinary option on an
ordinary cube, and now it is an ordinary link on the chain.

**Act** — moves the state.

| link | does |
|---|---|
| `.turn(seq \| alg)` | plays a sequence; refuses what the mechanism refuses, with the lesson |
| `.scramble(seed?)` | walks the board's own legal moves; a seed makes it the same walk for everyone |

**Build** — the other road.

| link | does |
|---|---|
| `.deal()` | takes the board apart; centres ride the spider, welds ride the weld |
| `.place(piece, slot?, spin?)` | sets from the bin, spun on the spot; body-first on welds |

**Route** — hydra's gift.

| link | does |
|---|---|
| `.out(slot?)` | routes the value to a screen slot: `out()` is the table, `out(goal)` the picture to reach; the workshop may open numbered slots (`o0`…) for boards side by side |

**Reads** — the leaves. They end a chain in data, never in another board:
`.off()` `.distance()` `.solved()` `.moves()` `.legal()` `.can(seq)`
`.at(slot)` `.face(L)` `.pieces()` `.cycles(seq)` `.lawful()`
`.legend()` `.bin()` — each counting exactly as the judge counts, or
refusing in its own words, per PATTERN.md.

**The alg stays the sub-value**, unchanged and already chain-shaped:

```js
turnable: rubik("3").turn( alg("[R, U]").times(3).reflect("RL") )
```

## 4. The order is the law

The chain reads top to bottom as the run's own history, so the bench
rules become visible in the shape of the code: `.carve()` after a
`.turn()` is refused with the same words as ever — you carve on the
bench, not mid-solve — but now the refusal points at a link you can see
standing in the wrong place. `.turn()` after `.deal()` refuses with the
bin count. Phase, ownership and honesty rules all carry over verbatim
from PATTERN.md §7 and §11; nothing is relitigated here.

## 5. The sketch

- **Live**: the editor is always real. The page may type, but the reader
  may interrupt, edit any link and re-evaluate on the spot (Ctrl+Enter,
  hydra's gesture). A step can be restored if broken.
- **Shareable**: the URL carries the chain. A sketch is its code.
- **Refusals are material**: every error is a lesson in the mechanism's
  words ("'R' would leave this cuboid misshapen. Use R2"), p5's friendly
  errors taken as doctrine. In the journey, refusals are steps, not
  accidents.

## 6. The journey

The two-panel page is one chain growing. Nothing is ever wiped; links
are added, edited in place, or inserted upstream, and the board answers
because the chain truly re-runs.

1. `rubik()` — a cube exists. The first lesson is free.
2. `.turn("R")` — it turns. The string edits to `"R U R' U'"`.
3. `.turn(alg("R U").times(6))` — the algebra: `alg("R U").order` is 105.
4. `.paint((x,y,z) => y > 0 ? "B" : "F")` inserted UPSTREAM — everything
   below repaints: the pipeline shows itself.
5. `.carve("centers")` — the Void; holes that travel.
6. The source edits: `"3"` → `"5"` — one character, another beast.
7. `"3x3x5"` — and the first refusal: `turn("R")` answers "use R2".
   `legal()` and `can()` enter: ask, don't assume.
8. `.carve` on the box — composition of everything learned.
9. `"3 + 3 @ 2,2,0"` — the weld: `turn("AD")`, body-first, and `legal()`
   showing how many turns stopped existing.
10. `.scramble(7)` — the seed: the same shake for everyone.
11. `.deal()` and `.place(q, q, 1)` — the borrowed-cube sin, and the
    judge naming the broken law.
12. `alg("[AD, AL]").exchange()` — port understanding, not solutions.
13. A goal appears — `base.out(goal)` — and the question *can you come
    back?* lands the reader in the album: the game.

## 7. Open, on purpose

1. **`cube()` as a friendly alias of `rubik()`** — costs nothing,
   greets strangers; undecided.
2. **The fate of the flat words** — the chain is THE taught syntax; do
   the 18 free words stay as internal sugar, or retire? PATTERN.md
   would be rewritten either way once the chain settles.
3. **Where the chain lives** — the page's sandbox only, or an exported
   fluent session in erno.js proper, so every user of the library can
   write chains.
4. **Advance mechanics of the journey** — stepper with keyboard, scroll,
   or hybrid; and whether the page types alone or alongside the reader.
5. **A `watch()` link** — a chain that plays itself, so even the
   landing page's attract mode is written in the language.
6. **Paint mini-notation** — a terse string form for common paints,
   Strudel-style, beside the function form.

Branding note: `rubik()` is a word of the language, an homage — the
game remains Pattern and the library remains erno.js.
