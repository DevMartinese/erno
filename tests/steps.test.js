// The thirteen steps, pinned: two stages read this file, and an extraction
// or an edit that quietly rewrote a sketch would put a lie on whichever
// page nobody was looking at.
import { STEPS, sourceOf } from "../site/examples/pattern/steps.js";
import { rubik, alg, resetOutputs, takeOutputs } from "../site/examples/pattern/chain.js";

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  ok — ${name}`); }
  catch (err) { failed++; console.error(`  FAIL — ${name}\n      ${err.message}`); }
}
const assert = (c, m) => { if (!c) throw new Error(m || "assertion failed"); };

test("every step sketch still runs, and the count is pinned", () => {
  assert(STEPS.length === 17, `${STEPS.length} steps`);
  for (const s of STEPS) {
    resetOutputs();
    const fn = new Function("rubik", "alg", "goal", "table", `"use strict";\n${sourceOf(s)}`);
    fn(rubik, alg, "goal", "table");
    const outs = takeOutputs();
    assert(outs.get("table"), `${s.title}: the sketch reaches the table`);
    if (s.read) assert(typeof s.read(outs.get("table")) === "string", `${s.title}: the verdict reads`);
  }
});

test("a verdict that catches must catch the MECHANISM's refusal, not its own", () => {
  // Step viii's read() provokes a refusal on purpose and quotes it. A
  // missing import there does not throw - the catch eats it and the page
  // prints a plausible-looking lie. Found live: the extraction forgot
  // `rubik`, and "box.can(\"R\") → false. rubik is not defined" shipped to
  // the screen while every "does it run" test stayed green.
  // found by title, not by index: the voyage grows, and an index that
  // silently started pointing at some other step is how this guard was
  // once green while testing nothing
  const s = STEPS.find((st) => st.title.includes("a box has laws"));
  const said = s.read();
  assert(said.includes("misshapen"), `the cuboid's own words, got: ${said}`);
  for (const step of STEPS) {
    if (!step.read) continue;
    resetOutputs();
    const fn = new Function("rubik", "alg", "goal", "table", `"use strict";\n${sourceOf(step)}`);
    fn(rubik, alg, "goal", "table");
    const v = step.read(takeOutputs().get("table"));
    assert(!/is not defined|undefined is not|cannot read/i.test(v || ""),
      `${step.title}: the verdict leaked an internal error: ${v}`);
  }
});

test("the sketches are byte for byte what both stages agreed to teach", () => {
  // fingerprint of all the sources: an edit that changes what a sketch
  // SAYS must come here and say so, or it ships silently to both stages
  const joined = STEPS.map(sourceOf).join("\n<<>>\n");
  let h = 0;
  for (let i = 0; i < joined.length; i++) h = (h * 31 + joined.charCodeAt(i)) >>> 0;
  assert(joined.length === 1544, `total source length changed: ${joined.length}`);
  assert(h === 743487012, `fingerprint changed: ${h}`);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
