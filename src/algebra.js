/* ─────────────────────────────────────────────────────────────────────────
   The algebra cubers already write.

   Nobody needs a new notation for turning a cube. There has been one for
   fifty years, it is what every advanced method is written in, and it says
   the two things a move sequence is usually made of:

     (A)n        A, n times
     A'          A undone, and a whole group can be undone
     [A, B]      a COMMUTATOR:  A B A' B'
     [A: B]      a CONJUGATE:   A B A'

   Those two brackets are not shorthand. A commutator is how you move three
   pieces and leave everything else alone: do something, do something else,
   undo the first, undo the second, and what survives is only where the two
   overlapped. A conjugate is how you reach a piece that is in the wrong
   place: carry it somewhere convenient, act, carry it back.

   Written out they compress hard, which is what makes them worth having as
   a language rather than as a comment. `(R U)105` is eight characters and
   two hundred and ten moves, and it is only eight characters if you know
   that R U has order 105. Insight shortens the program; brute force does
   not. That is the whole game.

   Parsed by hand, by descent, because the grammar is nine lines and every
   parser generator worth using costs more than that and a dependency. What
   it does need is to say where it went wrong, which is the half a generator
   would not have given.
   ───────────────────────────────────────────────────────────────────── */

/** A move token: letters, an optional leading count, then primes/doubles. */
const TOKEN = /^\d*[A-Za-z]+[\d']*/;

/**
 * Parse a sequence into a tree.
 *
 * Nodes are `{ type: "seq" | "move" | "repeat" | "invert" | "commutator" |
 * "conjugate" }`. Kept separate from `expand` so an editor can colour it, an
 * error can point at it, and a program can ask what shape a sequence has
 * without running it.
 *
 * @param {string} source
 * @returns {Object} the root node
 */
export function parse(source) {
  const src = String(source);
  let i = 0;

  const fail = (msg) => {
    const at = Math.min(i, src.length);
    // The caret is built against the quoted line it points into, so it lands
    // on the character rather than near it.
    const head = "erno: ";
    const line = `${head}${msg} in "${src}"`;
    const caret = " ".repeat(head.length + msg.length + 5 + at) + "^";
    throw new Error(`${line}\n${caret}`);
  };
  const skip = () => {
    while (i < src.length && /[\s]/.test(src[i])) i++;
  };

  function sequence(closers, what) {
    const parts = [];
    for (;;) {
      skip();
      if (i >= src.length) break;
      if (closers && closers.includes(src[i])) break;
      if (")]".includes(src[i])) fail(`unexpected '${src[i]}'`);
      parts.push(term());
    }
    // A commutator with nothing on one side is almost always a typo, and it
    // expands to the other side doing and undoing itself: silently nothing.
    if (what && !parts.length) fail(`${what} is empty`);
    return { type: "seq", parts };
  }

  function term() {
    let node = atom();
    // Suffixes stack, and in either order: (R U)2' and (R U)'2 both mean the
    // same thing, which is how people write them.
    for (;;) {
      const n = /^\d+/.exec(src.slice(i));
      if (n) {
        i += n[0].length;
        node = { type: "repeat", times: Number(n[0]), of: node };
        continue;
      }
      if (src[i] === "'") {
        i++;
        node = { type: "invert", of: node };
        continue;
      }
      break;
    }
    return node;
  }

  function atom() {
    skip();
    if (i >= src.length) fail("expected a move");
    if (src[i] === "(") {
      i++;
      const inner = sequence(")");
      if (src[i] !== ")") fail("expected ')'");
      i++;
      return inner;
    }
    if (src[i] === "[") {
      i++;
      const left = sequence(",:", "the left of the bracket");
      const kind = src[i];
      if (kind !== "," && kind !== ":")
        fail("expected ',' for a commutator or ':' for a conjugate");
      i++;
      const right = sequence("]", "the right of the bracket");
      if (src[i] !== "]") fail("expected ']'");
      i++;
      return {
        type: kind === "," ? "commutator" : "conjugate",
        left,
        right,
      };
    }
    const m = TOKEN.exec(src.slice(i));
    if (!m) fail(`'${src[i]}' does not start a move`);
    i += m[0].length;
    return { type: "move", token: m[0] };
  }

  const root = sequence(null);
  skip();
  if (i < src.length) fail(`unexpected '${src[i]}'`);
  return root;
}

/** Invert a flat token string: "R U2 f'" becomes "f U2' R'". */
function invertTokens(tokens) {
  return tokens
    .slice()
    .reverse()
    .map((t) => {
      // Toggle the prime, whatever the count. This used to treat a trailing
      // 2 as its own inverse, which is a fact about CUBES quietly baked into
      // a layer that serves every puzzle: a face of order four undoes X2
      // with X2, a face of order three or five does not, and on a Pyraminx
      // [U2, R] followed by [R, U2] came back not solved — a commutator law
      // broken. X2' is the inverse of X2 everywhere; on a cube the two are
      // the same rotation, so nothing there changes but the spelling.
      return t.endsWith("'") ? t.slice(0, -1) : `${t}'`;
    });
}

function flatten(node) {
  switch (node.type) {
    case "move":
      return [node.token];
    case "seq":
      return node.parts.flatMap(flatten);
    case "repeat": {
      const inner = flatten(node.of);
      const out = [];
      for (let k = 0; k < node.times; k++) out.push(...inner);
      return out;
    }
    case "invert":
      return invertTokens(flatten(node.of));
    case "commutator": {
      const a = flatten(node.left);
      const b = flatten(node.right);
      return [...a, ...b, ...invertTokens(a), ...invertTokens(b)];
    }
    case "conjugate": {
      const a = flatten(node.left);
      const b = flatten(node.right);
      return [...a, ...b, ...invertTokens(a)];
    }
    default:
      throw new Error(`erno: unknown node '${node.type}'`);
    }
}

/**
 * Expand a sequence written in the algebra into plain move tokens.
 *
 * Plain notation passes through untouched, so anywhere a sequence is
 * accepted, the algebra is too.
 *
 * @param {string} source
 * @returns {string} space-separated tokens
 * @example
 *   expand("[R, U]")       // "R U R' U'"
 *   expand("[R: [U, D]]")  // "R U D U' D' R'"
 *   expand("(R U)105")     // 210 tokens
 */
export function expand(source) {
  return flatten(parse(source)).join(" ");
}

/** True if a string uses anything beyond plain move tokens. */
export function isAlgebra(source) {
  return /[()[\],:]/.test(String(source));
}
