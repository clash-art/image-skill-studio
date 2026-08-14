import { readFile } from "node:fs/promises";
import path from "node:path";

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { createStudioServer } from "./studio-server.mjs";

const pluginRoot = path.resolve(process.env.PLUGIN_ROOT || process.cwd());
const widgetHtml = await readFile(path.join(pluginRoot, "public", "widget.html"), "utf8");
const server = await createStudioServer({ pluginRoot, widgetHtml });
await server.connect(new StdioServerTransport());
