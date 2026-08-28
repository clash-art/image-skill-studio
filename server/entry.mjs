import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { PACKAGE_ROOT } from "../lib/package-root.mjs";
import { createRemoteWidgetLoader } from "../lib/remote-widget.mjs";
import { createCodexGenerationRunner } from "./generation-runner.mjs";
import { createStudioServer } from "./studio-server.mjs";

const server = await createStudioServer({
  pluginRoot: PACKAGE_ROOT,
  widgetHtml: createRemoteWidgetLoader(),
  generationRunner: createCodexGenerationRunner({ projectRoot: PACKAGE_ROOT }),
});
await server.connect(new StdioServerTransport());
