import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";

import { build } from "esbuild";

const root = path.resolve(import.meta.dirname, "..");
const widgetPath = path.join(root, "public", "widget.html");
const widgetHtml = await readFile(widgetPath, "utf8");

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
  plugins: [
    {
      name: "embedded-widget-html",
      setup(buildApi) {
        buildApi.onResolve({ filter: /^image-skill-studio:widget-html$/ }, () => ({
          path: "image-skill-studio:widget-html",
          namespace: "image-skill-studio-widget",
        }));
        buildApi.onLoad({ filter: /.*/, namespace: "image-skill-studio-widget" }, () => ({
          contents: `export const EMBEDDED_WIDGET_HTML = ${JSON.stringify(widgetHtml)};\n`,
          loader: "js",
        }));
      },
    },
  ],
});
