/* ─────────────────────────────────────────────────────────────────────────
   Controls shared by the guide and the examples.

   A quantity on this site is a row of cells, not a bar, and the handle is a
   cell out of line rather than a knob. That belongs to the site rather than
   to any one page of it, so it lives here and both import it.
   ───────────────────────────────────────────────────────────────────── */

/**
 * Replace a native range with the site's cell strip.
 *
 * Two kinds, and conflating them was the mistake. An ANGLE is a quantity:
 * filling the strip up to it reads correctly. A cube's SIZE is a choice
 * among whole values, and filling cells 2, 3 and 4 to mean "four" reads as
 * "two and three and four", which is why it was impossible to tell where 2
 * sat versus 3. A choice marks one cell and names them all: set
 * `data-scale="choice"` on the input.
 */
export function enhanceRange(input) {
  const wrap = document.createElement("div");
  wrap.className = "range-wrap";
  input.parentNode.insertBefore(wrap, input);
  wrap.appendChild(input);

  // One cell per real step, which is what makes the strip honest: a cube's
  // size has seven values and shows seven cells. Where the steps are finer
  // than the eye, an angle in whole degrees, the strip stops subdividing at
  // a count that still reads as cells rather than as a hairline fill.
  const min = parseFloat(input.min) || 0;
  const max = parseFloat(input.max) || 100;
  const step = parseFloat(input.step) || 1;
  const steps = Math.round((max - min) / step) + 1;

  const choice = input.dataset.scale === "choice";
  const count = choice ? steps : Math.max(2, Math.min(24, steps));
  wrap.dataset.scale = choice ? "choice" : "quantity";

  const cells = document.createElement("div");
  cells.className = "range-cells";
  cells.setAttribute("aria-hidden", "true");
  for (let i = 0; i < count; i++) {
    const cell = document.createElement("i");
    if (choice) cell.textContent = String(min + i * step);
    cells.appendChild(cell);
  }
  wrap.appendChild(cells);

  const label = wrap.closest(".control-label");
  const valueSpan = label && label.querySelector(".control-value");

  function syncVal() {
    const val = parseFloat(input.value) || 0;
    const t = (val - min) / (max - min || 1);
    // A choice lights the cell it is on. A quantity fills up to it.
    const on = choice
      ? Math.round((val - min) / step) + 1
      : Math.max(1, Math.round(t * count));
    [...cells.children].forEach((c, i) => {
      if (choice ? i === on - 1 : i < on) c.setAttribute("data-on", "");
      else c.removeAttribute("data-on");
      // The handle is marked here rather than in CSS: `:last-of-type` means
      // the last cell OF ITS TYPE, not the last one that happens to be
      // filled, so it matches the final cell only when the strip is full.
      if (i === on - 1) c.setAttribute("data-head", "");
      else c.removeAttribute("data-head");
    });
    if (valueSpan) valueSpan.textContent = input.value;
  }

  input.addEventListener("input", syncVal);
  syncVal();
}
