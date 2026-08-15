import { spawn } from "node:child_process";
import { watch } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
let pending = null;
let running = false;

function run(script) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(root, "scripts", script)], {
      cwd: root,
      stdio: "inherit",
    });
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${script} exited with ${code}`));
    });
  });
}

async function rebuild(kind) {
  if (running) {
    pending = kind === "all" || pending === "all" || pending === "server" && kind === "widget" ? "all" : kind;
    return;
  }
  running = true;
  try {
    if (kind === "widget" || kind === "all") {
      console.log("[watch] rebuilding widget…");
      await run("build-widget.mjs");
    }
    if (kind === "server" || kind === "all") {
      console.log("[watch] rebuilding plugin server…");
      await run("build-plugin.mjs");
    }
    console.log("[watch] ready. Reopen Image Skill Studio in Codex to load the new HTML.");
  } catch (error) {
    console.error("[watch]", error instanceof Error ? error.message : error);
  } finally {
    running = false;
    if (pending) {
      const next = pending;
      pending = null;
      void rebuild(next);
    }
  }
}

function schedule(kind) {
  clearTimeout(schedule.timer);
  schedule.timer = setTimeout(() => void rebuild(kind), 120);
}

await rebuild("all");
for (const directory of ["web", "components", "lib", "server", "skills"]) {
  watch(path.join(root, directory), { recursive: true }, (_event, filename) => {
    if (!filename || filename.endsWith(".map")) return;
    schedule(directory === "server" ? "server" : "widget");
  });
}
console.log("[watch] plugin sources. Codex still needs a reopen or new task after a server rebuild.");
