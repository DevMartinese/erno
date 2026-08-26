/* ─────────────────────────────────────────────────────────────────────────
   The stage: boards in one scene, each piece answerable on its own.

   Everything a choreography needs to say - who is drawn, who is fading,
   who is travelling, who is mid-turn, who stands as bare outlines - said
   per piece, against the real three scene graph. Nothing here touches a
   renderer, a camera or the DOM, which is what makes the whole contract
   provable in node; three.js (the adapter) owns the drawing and consumes
   this for its scenes.

   Two facts of the engine's coordinate space carry the design:

     - `getPieces()[i].slot` IS the logical slot point, and the geometry is
       baked so that one slot unit is one world unit, identity-mapped -
       measured on the cube, the five and the weld, not assumed. So the
       offsets a story hands over (slot deltas) are world vectors as they
       are, with no projection and no exchange rate anywhere.

     - a piece's matrix is IDENTITY at rest and only speaks mid-turn, so
       an extra offset composes by adding to the translation column.
   ───────────────────────────────────────────────────────────────────── */

import { bodyOf, roundingOf, shrinkSticker } from "./three-geometry.js";

let THREE = null;
async function load() {
  if (!THREE) THREE = await import("three");
  return THREE;
}

const hex = (c) => new THREE.Color().setStyle(c, THREE.SRGBColorSpace);

/** One piece's mesh geometry: the body from three-geometry, the stickers
 *  lifted a hair above it, colours per vertex. */
function pieceGeometry(piece, lift, shape) {
  const positions = [];
  const colors = [];
  const index = [];
  const body = bodyOf(piece, shape);
  for (let i = 0; i < body.positions.length; i += 3) {
    positions.push(body.positions[i], body.positions[i + 1], body.positions[i + 2]);
    const col = hex(body.colors[i / 3]);
    colors.push(col.r, col.g, col.b);
  }
  for (const i of body.index) index.push(i);

  const retreat = roundingOf(piece, shape);
  for (const f of piece.faces) {
    if (!f.sticker) continue;
    const base = positions.length / 3;
    const col = hex(f.color);
    for (const q of shrinkSticker(f.sticker, retreat)) {
      positions.push(q[0] + f.normal[0] * lift, q[1] + f.normal[1] * lift, q[2] + f.normal[2] * lift);
      colors.push(col.r, col.g, col.b);
    }
    for (let i = 1; i + 1 < f.sticker.length; i++) index.push(base, base + i, base + i + 1);
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  g.setIndex(index);
  return g;
}

/**
 * A scene and the boards standing on it.
 *
 * @param {Object} [options]
 * @param {"box"|"rounded"} [options.cubie]
 * @param {string} [options.core] - dress for walls with no sticker
 */
export async function createStage(options = {}) {
  await load();
  const scene = new THREE.Scene();
  const shape = { cubie: options.cubie, core: options.core };

  const stage = {
    scene,

    /** Put a board on the stage. Returns its handle. */
    add(puzzle, boardOptions = {}) {
      const group = new THREE.Group();
      group.matrixAutoUpdate = false;
      group.matrix.fromArray(puzzle.getViewMatrix());
      scene.add(group);

      const radius = puzzle.getRadius();
      const pieces = puzzle.getPieces();
      const baseMaterial = new THREE.MeshBasicMaterial({
        vertexColors: true,
        side: THREE.DoubleSide,
      });

      const meshes = pieces.map((piece) => {
        const mesh = new THREE.Mesh(
          pieceGeometry(piece, radius * 0.008, { ...shape, ...boardOptions }),
          baseMaterial,
        );
        mesh.matrixAutoUpdate = false;
        group.add(mesh);
        return mesh;
      });

      // Per-piece state, composed into the mesh matrix on every change:
      // matrix = T(offset) * pieceMatrix. The piece matrix is the engine's
      // word on where a turn put the piece; the offset is the story's word
      // on where it is travelling from. Neither overwrites the other.
      const pieceMatrices = pieces.map((p) => p.matrix.slice());
      const offsets = new Map();
      const compose = (i) => {
        const m = meshes[i].matrix;
        m.fromArray(pieceMatrices[i]);
        const o = offsets.get(i);
        if (o) {
          m.elements[12] += o[0];
          m.elements[13] += o[1];
          m.elements[14] += o[2];
        }
      };
      meshes.forEach((_, i) => compose(i));

      let wire = null;

      const board = {
        puzzle,
        meshes,
        get lines() {
          return wire ? wire.lines : [];
        },

        /** Who is drawn: a predicate over piece index, or null for all. */
        visible(pred) {
          meshes.forEach((m, i) => {
            m.visible = pred ? !!pred(i) : true;
          });
          return board;
        },

        /**
         * One piece's opacity. The material is cloned on first use so a
         * fading piece never drags its neighbours with it; at 1 the piece
         * is solid again and stops paying for transparency.
         */
        opacity(i, a) {
          if (meshes[i].material === baseMaterial)
            meshes[i].material = baseMaterial.clone();
          meshes[i].material.opacity = a;
          meshes[i].material.transparent = a < 1;
          // A fader may not occlude: mid-fade it still wrote the depth
          // buffer, and on a real GPU whole runs of colour behind it lost
          // the depth test and vanished for the length of the fade.
          meshes[i].material.depthWrite = !(a < 1);
          if (wire && wire.lines[i] && wire.owned) {
            // nothing: the wireframe fades on its own terms
          }
          return board;
        },

        /** One piece's travel, in world units, on top of its own matrix.
         *  null clears it. */
        offset(i, v) {
          if (v) offsets.set(i, v);
          else offsets.delete(i);
          compose(i);
          if (wire && wire.lines[i]) wire.compose(i);
          return board;
        },

        /** Re-read the board mid-turn; offsets survive. */
        turn(turn) {
          const now = puzzle.getPieces(turn ? { turn } : {});
          for (let i = 0; i < meshes.length; i++) {
            pieceMatrices[i] = now[i].matrix.slice();
            compose(i);
            if (wire && wire.lines[i]) wire.compose(i);
          }
          return board;
        },

        /**
         * The same board as bare outlines: the scaffold. One line body per
         * piece, moved by the same matrices, filtered by the same kind of
         * predicate - so what the scaffold shows is exactly what the board
         * would show, drawn in edges.
         */
        wireframe(opts = {}) {
          if (wire) wire.dispose();
          const material = new THREE.LineBasicMaterial({
            color: new THREE.Color().setStyle(opts.color || "#17110c", THREE.SRGBColorSpace),
            transparent: true,
            opacity: opts.opacity ?? 0.32,
            depthTest: opts.depthTest ?? true,
          });
          const lines = meshes.map((mesh, i) => {
            const seg = new THREE.LineSegments(
              new THREE.EdgesGeometry(mesh.geometry, opts.angle ?? 20),
              material,
            );
            seg.matrixAutoUpdate = false;
            seg.matrix.copy(mesh.matrix);
            group.add(seg);
            return seg;
          });
          wire = {
            lines,
            material,
            compose(i) {
              lines[i].matrix.copy(meshes[i].matrix);
            },
            visible(pred) {
              lines.forEach((l, i) => {
                l.visible = pred ? !!pred(i) : true;
              });
            },
            opacity(a) {
              material.opacity = a;
            },
            dispose() {
              for (const l of lines) {
                group.remove(l);
                l.geometry.dispose();
              }
              material.dispose();
              wire = null;
            },
          };
          return wire;
        },

        /** Take the board, its wireframe and its buffers off the stage. */
        remove() {
          if (wire) wire.dispose();
          for (const m of meshes) {
            group.remove(m);
            m.geometry.dispose();
            if (m.material !== baseMaterial) m.material.dispose();
          }
          baseMaterial.dispose();
          scene.remove(group);
        },
      };
      return board;
    },
  };
  return stage;
}
