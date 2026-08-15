import { readFile } from "node:fs/promises";
import path from "node:path";

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { EMBEDDED_WIDGET_HTML } from "image-skill-studio:widget-html";
import { resolvePluginRoot } from "../lib/plugin-root.mjs";
import { createCodexGenerationRunner } from "./generation-runner.mjs";
import { createStudioServer } from "./studio-server.mjs";

const pluginRoot = resolvePluginRoot({
  moduleRoot: path.resolve(import.meta.dirname, ".."),
});
const widgetPath = path.join(pluginRoot, "public", "widget.html");

async function loadWidgetHtml() {
  try {
    return await readFile(widgetPath, "utf8");
  } catch {
    return EMBEDDED_WIDGET_HTML;
  }
}

const server = await createStudioServer({
  pluginRoot,
  widgetHtml: loadWidgetHtml,
  generationRunner: createCodexGenerationRunner({ projectRoot: pluginRoot }),
});
await server.connect(new StdioServerTransport());
