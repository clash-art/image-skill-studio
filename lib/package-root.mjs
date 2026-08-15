import path from "node:path";

// Source: this file lives in lib/, so the parent is the repo.
// Bundled: esbuild rewrites import.meta to runtime/server.mjs, so the parent is the installed plugin.
export const PACKAGE_ROOT = path.resolve(import.meta.dirname, "..");
