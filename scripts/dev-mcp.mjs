import { spawn } from "node:child_process";
import { existsSync, watch } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { PACKAGE_ROOT } from "../lib/package-root.mjs";
import { createCodexGenerationRunner } from "../server/generation-runner.mjs";
import { createStudioServer } from "../server/studio-server.mjs";

const widgetPath = path.join(PACKAGE_ROOT, "public", "widget.html");
const log = (...args) => console.error("[image-skill-studio-dev]", ...args);

function runWidgetBuild() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(PACKAGE_ROOT, "scripts", "build-widget.mjs")], {
      cwd: PACKAGE_ROOT,
      stdio: ["ignore", "ignore", "pipe"],
    });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
      process.stderr.write(chunk);
    });
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr.trim() || `build-widget exited ${code}`));
    });
  });
}

let pendingUi = false;
let runningUi = false;

async function rebuildWidget() {
  if (runningUi) {
    pendingUi = true;
    return;
  }
  runningUi = true;
  try {
    log("rebuilding workbench…");
    await runWidgetBuild();
    log("workbench ready. Reopen Image Skill Studio to load public/widget.html.");
  } catch (error) {
    log(error instanceof Error ? error.message : error);
  } finally {
    runningUi = false;
    if (pendingUi) {
      pendingUi = false;
      void rebuildWidget();
    }
  }
}

function debounce(fn, ms) {
  let timer;
  return () => {
    clearTimeout(timer);
    timer = setTimeout(fn, ms);
  };
}

const scheduleUi = debounce(() => void rebuildWidget(), 120);
const scheduleServerHint = debounce(() => {
  log("server/lib changed. Start a new thread so Codex relaunches this process.");
}, 120);

if (!existsSync(widgetPath)) {
  await runWidgetBuild();
}

const watchEnabled = process.env.IMAGE_SKILL_STUDIO_DEV_WATCH !== "0";
if (watchEnabled) {
  for (const directory of ["web", "components"]) {
    watch(path.join(PACKAGE_ROOT, directory), { recursive: true }, (_event, filename) => {
      if (!filename || filename.endsWith(".map")) return;
      scheduleUi();
    });
  }
  for (const directory of ["server", "lib"]) {
    watch(path.join(PACKAGE_ROOT, directory), { recursive: true }, (_event, filename) => {
      if (!filename || filename.endsWith(".map")) return;
      scheduleServerHint();
    });
  }
}

const server = await createStudioServer({
  pluginRoot: PACKAGE_ROOT,
  widgetHtml: () => readFile(widgetPath, "utf8"),
  generationRunner: createCodexGenerationRunner({ projectRoot: PACKAGE_ROOT }),
});
await server.connect(new StdioServerTransport());
log("live MCP process connected");
