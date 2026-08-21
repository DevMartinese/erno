/* The second build pass: the three.js adapter as its own entry.
   Separate from the main pass because the main ships a UMD for the
   script-tag reader, and multi-entry libraries cannot: one entry per
   format-set, two passes. `three` stays external — it is the consumer's,
   as a peer, and the adapter imports it lazily besides. */
import { defineConfig } from "vite";


export default defineConfig({
  build: {
    emptyOutDir: false, // the main pass already wrote dist/
    lib: {
      entry: new URL("./src/three.js", import.meta.url).pathname,
      fileName: "three",
      formats: ["es", "cjs"],
    },
    rollupOptions: { external: ["three"] },
  },
});
