import { mkdir } from "node:fs/promises";
import path from "node:path";

import { build } from "esbuild";

const root = path.resolve(import.meta.dirname, "..");
await mkdir(path.join(root, "runtime"), { recursive: true });
await build({
  entryPoints: [path.join(root, "server", "entry.mjs")],
  outfile: path.join(root, "runtime", "server.mjs"),
  bundle: true,
  format: "esm",
  platform: "node",
  target: ["node22"],
  packages: "bundle",
  sourcemap: true,
  legalComments: "none",
});
