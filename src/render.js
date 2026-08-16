/**
 * erno/render.js — the shared SVG render pipeline.
 *
 * Camera projectors, backface culling, viewBox helpers and SVG attribute
 * emission, used by both the N×N facelet cube (erno.js) and the generic
 * piece engine (twisty.js). Mirrors the role of heerich's svg-renderer.js.
 *
 * Cameras share heerich's semantics: oblique, orthographic, isometric,
 * perspective. Model coordinates arrive in render space (units, y down,
 * z away); `extent` is the model span used to center the projection and
 * scale perspective defaults.
 */

export const t4 = (v) => Math.round(v * 1e4) / 1e4;

/** Convert a camelCase style object to an SVG attribute string. */
const _kebabCache = {};
export function buildSvgAttributes(styleObj) {
  const merged = { strokeLinejoin: "round", ...styleObj };
  let attrStr = "";
  for (const key in merged) {
    const value = merged[key];
    if (value === undefined || value === null) continue;
    const kebabKey =
      _kebabCache[key] ||
      (_kebabCache[key] = key.replace(/([A-Z])/g, "-$1").toLowerCase());
    attrStr += ` ${kebabKey}="${value}"`;
  }
  return attrStr;
}

/**
 * Build a projector for a camera spec: { point(x,y,z) → [px,py],
 * depth(x,y,z) → sort key }. Larger depth = farther from the viewer.
 */
export function makeProjector(camera, tile, extent) {
  const { type } = camera;
  const N = extent;

  if (type === "oblique") {
    const angle = ((camera.angle ?? 45) * Math.PI) / 180;
    const depth = camera.depth ?? 0.5;
    const dox = Math.cos(angle) * tile * depth;
    const doy = -Math.sin(angle) * tile * depth;
    return {
      point: (x, y, z) => [x * tile + z * dox, y * tile + z * doy],
      depth: (x, y, z) => z - (x * dox) / tile - (y * doy) / tile,
      eye: { type: "dir", v: [-dox / tile, -doy / tile, 1] },
    };
  }

  if (type === "perspective") {
    const [cx, cy] = camera.position || [N * 1.7, -N * 0.7];
    const d = camera.distance ?? N * 3.5;
    return {
      point: (x, y, z) => {
        const t = d / (z + d);
        return [(cx + (x - cx) * t) * tile, (cy + (y - cy) * t) * tile];
      },
      depth: (x, y, z) => {
        const dx = x - cx,
          dy = y - cy,
          dz = z + d;
        return dx * dx + dy * dy + dz * dz;
      },
      eye: { type: "point", v: [cx, cy, -d] },
    };
  }

  // orthographic / isometric
  const angle = ((camera.angle ?? 30) * Math.PI) / 180;
  const pitch =
    type === "isometric"
      ? Math.atan(1 / Math.SQRT2)
      : ((camera.pitch ?? 30) * Math.PI) / 180;
  // negated pan sign vs heerich so positive angle orbits toward the R face
  const cosT = Math.cos(angle),
    sinT = -Math.sin(angle);
  const cosP = Math.cos(pitch),
    sinP = Math.sin(pitch);
  return {
    point: (x, y, z) => {
      const x1 = x * cosT - z * sinT;
      const y1 = y * cosP - (x * sinT + z * cosT) * sinP;
      return [(x1 + N) * tile, (y1 + N) * tile];
    },
    depth: (x, y, z) => y * sinP + (x * sinT + z * cosT) * cosP,
    // gradient of depth — the parallel view direction (into the screen)
    eye: { type: "dir", v: [sinT * cosP, sinP, cosT * cosP] },
  };
}

/**
 * Project a convex polygon (array of [x,y,z] in render space) and cull it if
 * it faces away. Outward-wound polygons project with negative shoelace area
 * when they face the camera (screen y points down). Pass keepBackfaces to
 * skip the cull (e.g. curved multi-facet stickers, where back-facing facets
 * still project inside their own piece's silhouette).
 * @returns {{points: number[], depth: number}|null}
 */
export function projectPolygon(pts3, proj, keepBackfaces = false) {
  const n = pts3.length;
  const pts = new Array(n * 2);
  let cx = 0,
    cy = 0,
    cz = 0;
  for (let k = 0; k < n; k++) {
    const [rx, ry, rz] = pts3[k];
    cx += rx;
    cy += ry;
    cz += rz;
    const [px, py] = proj.point(rx, ry, rz);
    pts[k * 2] = t4(px);
    pts[k * 2 + 1] = t4(py);
  }
  let area = 0;
  for (let k = 0; k < n; k++) {
    const j = (k + 1) % n;
    area += pts[k * 2] * pts[j * 2 + 1] - pts[j * 2] * pts[k * 2 + 1];
  }
  if (area >= 0 && !keepBackfaces) return null;
  return { points: pts, depth: proj.depth(cx / n, cy / n, cz / n) };
}

/** "x,y x,y …" attribute string from a flat projected point array. */
export function pointsAttr(pts) {
  let s = "";
  for (let k = 0; k < pts.length; k += 2) {
    if (k) s += " ";
    s += `${pts[k]},${pts[k + 1]}`;
  }
  return s;
}

/** ViewBox hugging the projected faces. */
export function boundsViewBox(faces, pad) {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const face of faces)
    for (let k = 0; k < face.points.length; k += 2) {
      const x = face.points[k],
        y = face.points[k + 1];
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  if (faces.length === 0) (minX = 0), (minY = 0), (maxX = 100), (maxY = 100);
  return [minX - pad, minY - pad, maxX - minX + pad * 2, maxY - minY + pad * 2];
}

/**
 * ViewBox covering a circumsphere (center + radius in render space) — every
 * mid-turn position stays inside it, so animations don't make the SVG jump.
 */
export function sphereViewBox(proj, cx, cy, cz, radius, pad) {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  const SAMPLES = 96;
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let k = 0; k < SAMPLES; k++) {
    const y = 1 - (2 * k) / (SAMPLES - 1);
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = golden * k;
    const [px, py] = proj.point(
      cx + radius * r * Math.cos(theta),
      cy + radius * y,
      cz + radius * r * Math.sin(theta),
    );
    if (px < minX) minX = px;
    if (py < minY) minY = py;
    if (px > maxX) maxX = px;
    if (py > maxY) maxY = py;
  }
  return [minX - pad, minY - pad, maxX - minX + pad * 2, maxY - minY + pad * 2];
}

/** Opening <svg> tag for a viewBox. */
export function openSvgTag(vb) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${t4(vb[0])} ${t4(vb[1])} ${t4(vb[2])} ${t4(vb[3])}" style="width:100%; height:100%;">`;
}
