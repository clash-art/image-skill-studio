import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { build } from "esbuild";

const root = path.resolve(import.meta.dirname, "..");
const workDir = path.join(root, "work", "widget");
await mkdir(workDir, { recursive: true });
await mkdir(path.join(root, "public"), { recursive: true });

await build({
  entryPoints: [path.join(root, "web", "widget.tsx")],
  outfile: path.join(workDir, "widget.js"),
  bundle: true,
  format: "iife",
  platform: "browser",
  target: ["es2022"],
  jsx: "automatic",
  minify: true,
  legalComments: "none",
  tsconfig: path.join(root, "tsconfig.json"),
});

const [shell, javascript, css] = await Promise.all([
  readFile(path.join(root, "web", "widget-shell.html"), "utf8"),
  readFile(path.join(workDir, "widget.js"), "utf8"),
  readFile(path.join(workDir, "widget.css"), "utf8"),
]);
const html = shell
  .replace("__WIDGET_CSS__", () => css)
  .replace("__WIDGET_JS__", () => javascript)
  .replace(
    "<body>",
    "<body>\n    <!-- MCP Apps bridge: ui/initialize · tools/call · ui/message · window.openai compatibility -->",
  );
if (html.includes("__WIDGET_")) throw new Error("Widget shell still contains an unreplaced placeholder");
await writeFile(path.join(root, "public", "widget.html"), html);
