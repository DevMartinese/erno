import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

// Site build: builds the interactive guide as a static site
export default defineConfig({
  root: __dirname,
  base: "./",
  build: {
    outDir: "../dist-site",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL("./index.html", import.meta.url)),
        playground: fileURLToPath(new URL("./playground.html", import.meta.url)),
        gallery: fileURLToPath(new URL("./gallery.html", import.meta.url)),
        // Pattern and its sketchpad ship, but nothing links to them: the
        // game is still being shaped, and we reach it by URL until it is
        // ready to be introduced.
        pattern: fileURLToPath(
          new URL("./examples/pattern/index.html", import.meta.url),
        ),
        chain: fileURLToPath(
          new URL("./examples/pattern/chain.html", import.meta.url),
        ),
      },
    },
  },
});
