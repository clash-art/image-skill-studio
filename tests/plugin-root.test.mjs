import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { resolvePluginRoot } from "../lib/plugin-root.mjs";

test("resolvePluginRoot uses the running plugin copy, not a stripped Codex cache version", async () => {
  const realRoot = await mkdtemp(path.join(os.tmpdir(), "studio-plugin-real-"));
  await mkdir(path.join(realRoot, "public"));
  await writeFile(path.join(realRoot, "public", "widget.html"), "<!doctype html>");
  const ghostRoot = path.join(os.tmpdir(), "image-skill-studio-0.1.0");

  const resolved = resolvePluginRoot({
    envRoot: ghostRoot,
    cwd: ghostRoot,
    moduleRoot: realRoot,
  });
  assert.equal(resolved, path.resolve(realRoot));
});

test("resolvePluginRoot prefers the running module over PLUGIN_ROOT even when both exist", async () => {
  const running = await mkdtemp(path.join(os.tmpdir(), "studio-plugin-running-"));
  const envRoot = await mkdtemp(path.join(os.tmpdir(), "studio-plugin-env-"));
  await mkdir(path.join(running, "public"));
  await mkdir(path.join(envRoot, "public"));
  await writeFile(path.join(running, "public", "widget.html"), "running");
  await writeFile(path.join(envRoot, "public", "widget.html"), "env");

  const resolved = resolvePluginRoot({
    envRoot,
    cwd: envRoot,
    moduleRoot: running,
  });
  assert.equal(resolved, path.resolve(running));
});
