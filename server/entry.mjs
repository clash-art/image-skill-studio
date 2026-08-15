import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { PACKAGE_ROOT } from "../lib/package-root.mjs";
import workbenchHtml from "../public/widget.html";
import { createCodexGenerationRunner } from "./generation-runner.mjs";
import { createStudioServer } from "./studio-server.mjs";

const server = await createStudioServer({
  pluginRoot: PACKAGE_ROOT,
  widgetHtml: workbenchHtml,
  generationRunner: createCodexGenerationRunner({ projectRoot: PACKAGE_ROOT }),
});
await server.connect(new StdioServerTransport());
