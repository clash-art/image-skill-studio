import { watch } from "node:fs";
import path from "node:path";

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { PACKAGE_ROOT } from "../lib/package-root.mjs";
import { createRemoteWidgetLoader } from "../lib/remote-widget.mjs";
import { createStudioIdentity } from "../lib/studio-identity.mjs";
import { createCodexGenerationRunner } from "../server/generation-runner.mjs";
import { createStudioServer } from "../server/studio-server.mjs";

const log = (...args) => console.error("[image-skill-studio-dev]", ...args);

function debounce(fn, ms) {
  let timer;
  return () => {
    clearTimeout(timer);
    timer = setTimeout(fn, ms);
  };
}

const scheduleServerHint = debounce(() => {
  log("server/lib changed. Start a new thread so Codex relaunches this process.");
}, 120);

const watchEnabled = process.env.IMAGE_SKILL_STUDIO_DEV_WATCH !== "0";
if (watchEnabled) {
  for (const directory of ["server", "lib"]) {
    watch(path.join(PACKAGE_ROOT, directory), { recursive: true }, (_event, filename) => {
      if (!filename || filename.endsWith(".map")) return;
      scheduleServerHint();
    });
  }
}

const server = await createStudioServer({
  pluginRoot: PACKAGE_ROOT,
  identity: createStudioIdentity("dev"),
  widgetHtml: createRemoteWidgetLoader(),
  generationRunner: createCodexGenerationRunner({ projectRoot: PACKAGE_ROOT }),
});
await server.connect(new StdioServerTransport());
log("cloud UI MCP process connected");
