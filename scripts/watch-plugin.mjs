import { spawn } from "node:child_process";
import { watch } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
let pending = false;
let running = false;

function runPluginBuild() {
  return new Promise((resolve, reject) => {
    const child = spawn("npm", ["run", "build:plugin"], {
      cwd: root,
      stdio: "inherit",
    });
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`build:plugin exited with ${code}`));
    });
  });
}

async function rebuild() {
  if (running) {
    pending = true;
    return;
  }
  running = true;
  try {
    console.log("[watch] rebuilding plugin…");
    await runPluginBuild();
    console.log("[watch] ready. Reopen the GitHub plugin or start a new thread to load runtime/server.mjs.");
  } catch (error) {
    console.error("[watch]", error instanceof Error ? error.message : error);
  } finally {
    running = false;
    if (pending) {
      pending = false;
      void rebuild();
    }
  }
}

function schedule() {
  clearTimeout(schedule.timer);
  schedule.timer = setTimeout(() => void rebuild(), 120);
}

await rebuild();
for (const directory of ["web", "components", "lib", "server", "skills"]) {
  watch(path.join(root, directory), { recursive: true }, (_event, filename) => {
    if (!filename || filename.endsWith(".map")) return;
    schedule();
  });
}
