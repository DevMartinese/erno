/* The three.js adapter is part of the package now, as `erno.js/three`, so
   the site consumes the same file it ships instead of keeping a private
   copy that would drift. This module exists so nothing on the site had to
   change its import path. */
export * from "../src/three.js";
