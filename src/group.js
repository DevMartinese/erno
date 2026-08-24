// ── The group, held the way Schreier and Sims hold one ───────────────────────
//
// A permutation group given by generators, answering the only two questions
// the judge ever asks: how many positions are reachable, and is this one of
// them. The answers are exact - a base and strong generating set, computed
// once - because "unlawful" is a verdict, and a verdict must not be a guess.
//
// Permutations are plain arrays over 0..n-1, p[i] the image of i, composed
// apply-right-first: (a∘b)[i] = a[b[i]]. Orders are BigInt, because the
// cube's own group already needs twenty digits.

const compose = (a, b) => {
  const out = new Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = a[b[i]];
  return out;
};

const inverse = (p) => {
  const out = new Array(p.length);
  for (let i = 0; i < p.length; i++) out[p[i]] = i;
  return out;
};

const identity = (n) => Array.from({ length: n }, (_, i) => i);

const isIdentity = (p) => p.every((v, i) => v === i);

/**
 * The stabilizer chain: levels[l] fixes every base point above it, and its
 * orbit of its own base point carries a transversal - for each reachable
 * point, one group element taking the base there. Sifting a permutation
 * down the chain strips it to the identity exactly when it is a member.
 */
export function groupOf(generators, n) {
  const levels = []; // { point, gens, orbit: Map(point -> transversal perm) }

  const rebuildOrbit = (L) => {
    L.orbit = new Map([[L.point, identity(n)]]);
    const queue = [L.point];
    while (queue.length) {
      const x = queue.shift();
      const u = L.orbit.get(x);
      for (const s of L.gens) {
        const y = s[x];
        if (!L.orbit.has(y)) {
          L.orbit.set(y, compose(s, u));
          queue.push(y);
        }
      }
    }
  };

  // Strip g through the chain from `from` down; returns the residue and how
  // far it got. A residue of identity at the chain's end is membership.
  const sift = (g, from = 0) => {
    for (let l = from; l < levels.length; l++) {
      const L = levels[l];
      const u = L.orbit.get(g[L.point]);
      if (!u) return { residue: g, level: l };
      g = compose(inverse(u), g);
    }
    return { residue: g, level: levels.length };
  };

  const newLevel = (moved) => {
    const L = { point: moved, gens: [], orbit: new Map() };
    levels.push(L);
    rebuildOrbit(L);
  };

  // Sims's method: every Schreier generator of every level must sift to
  // nothing. When one refuses, it joins the chain where it stopped and the
  // check resumes from there - the loop only ends with the chain closed.
  const closeAt = (l) => {
    const L = levels[l];
    rebuildOrbit(L);
    for (const x of [...L.orbit.keys()]) {
      const u = L.orbit.get(x);
      for (const s of L.gens) {
        const schreier = compose(inverse(L.orbit.get(s[x])), compose(s, u));
        if (isIdentity(schreier)) continue;
        const { residue, level } = sift(schreier, l + 1);
        if (isIdentity(residue)) continue;
        if (level === levels.length)
          newLevel(residue.findIndex((v, i) => v !== i));
        for (let m = l + 1; m <= Math.min(level, levels.length - 1); m++)
          levels[m].gens.push(residue);
        for (let m = Math.min(level, levels.length - 1); m > l; m--) closeAt(m);
        // the new element may have widened this very orbit
        return closeAt(l);
      }
    }
  };

  for (const raw of generators) {
    const g = Array.from(raw);
    if (isIdentity(g)) continue;
    const { residue, level } = sift(g);
    if (isIdentity(residue)) continue;
    if (level === levels.length) newLevel(residue.findIndex((v, i) => v !== i));
    for (let m = 0; m <= Math.min(level, levels.length - 1); m++)
      levels[m].gens.push(residue);
    for (let m = Math.min(level, levels.length - 1); m >= 0; m--) closeAt(m);
  }

  let order = 1n;
  for (const L of levels) order *= BigInt(L.orbit.size);

  return {
    order,
    contains: (p) => isIdentity(sift(Array.from(p)).residue),
  };
}
