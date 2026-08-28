import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("plugin manifest packages the bundled skill and MCP App server", async () => {
  const manifest = JSON.parse(await readFile(new URL("../.codex-plugin/plugin.json", import.meta.url), "utf8"));
  assert.equal(manifest.name, "image-skill-studio");
  assert.equal(manifest.version, "0.1.0");
  // The plugin keeps its own name so existing installs survive the repo rename.
  assert.equal(manifest.repository, "https://github.com/hrhrng/awesome-image-skill");
  assert.equal(manifest.skills, "./skills/");
  assert.equal(manifest.mcpServers, "./.mcp.json");
  assert.match(manifest.interface.capabilities.join(" "), /Image Generation/);

  const mcp = JSON.parse(await readFile(new URL("../.mcp.json", import.meta.url), "utf8"));
  assert.equal(mcp.mcpServers["image-skill-studio"].command, "node");
  assert.equal(mcp.mcpServers["image-skill-studio"].args[0], "./runtime/server.mjs");
  assert.equal(mcp.mcpServers["image-skill-studio"].cwd, ".");
  assert.equal(mcp.mcpServers["image-skill-studio"].env, undefined);
});

test("dev wrapper is a separate plugin with its own MCP server name", async () => {
  const manifest = JSON.parse(
    await readFile(new URL("../dev-marketplace/plugins/image-skill-studio-dev/.codex-plugin/plugin.json", import.meta.url), "utf8"),
  );
  assert.equal(manifest.name, "image-skill-studio-dev");
  assert.equal(manifest.mcpServers, "./.mcp.json");
  assert.match(manifest.interface.displayName, /dev/i);
});

test("plugin ships featured creative Skills beside the Studio Skill", async () => {
  const { stat } = await import("node:fs/promises");
  for (const id of ["image-skill-studio", "classic-epic-movie-poster", "gc-minimal-zine-poster-v0-1"]) {
    const info = await stat(new URL(`../skills/${id}/SKILL.md`, import.meta.url));
    assert.ok(info.isFile(), `${id} must be bundled in the plugin`);
  }
});

test("plugin ships the seed Skill feed that the runtime reads at startup", async () => {
  const { stat } = await import("node:fs/promises");
  const info = await stat(new URL("../catalog/registry.json", import.meta.url));
  assert.ok(info.isFile(), "catalog/registry.json must travel with the plugin");

  const server = await readFile(new URL("../runtime/server.mjs", import.meta.url), "utf8");
  assert.match(server, /catalog\/registry\.json/, "the runtime resolves the seed feed at startup");
});

test("widget can register a Skill into Studio and install one into Codex skills", async () => {
  const widget = await readFile(new URL("../web/widget.tsx", import.meta.url), "utf8");
  assert.match(widget, /studioTools\.registerSkill/);
  assert.match(widget, /studioTools\.installSkill/);
  assert.match(widget, /async registerSkill\(input\)/);
  assert.match(widget, /async installSkill\(input\)/);
});

test("widget uses MCP Apps bridge first and OpenAI compatibility aliases second", async () => {
  const html = await readFile(new URL("../public/widget.html", import.meta.url), "utf8");
  assert.match(html, /ui\/initialize/);
  assert.match(html, /tools\/call/);
  assert.match(html, /ui\/message/);
  assert.match(html, /window\.openai/);
});

test("the bundled runtime inlines the workbench HTML", async () => {
  const [server, html] = await Promise.all([
    readFile(new URL("../runtime/server.mjs", import.meta.url), "utf8"),
    readFile(new URL("../public/widget.html", import.meta.url), "utf8"),
  ]);
  assert.ok(html.includes("ui/message"));
  assert.ok(server.includes("ui/message"));
  assert.doesNotMatch(server, /readFile\(widgetPath/);
  assert.doesNotMatch(server, /process\.env\.PLUGIN_ROOT/);
});

test("widget waits for a successful record instead of publishing a prepared run", async () => {
  const widget = await readFile(new URL("../web/widget.tsx", import.meta.url), "utf8");
  assert.match(widget, /isPublishedRun/);
  assert.doesNotMatch(widget, /publish\(\{\s*runs:\s*\[prepared\.run/);
  assert.doesNotMatch(widget, /publish\(\{\s*run:\s*marked\.run/);
});

test("widget merges a recorded run from ontoolresult and can fall back to the Codex runner", async () => {
  const widget = await readFile(new URL("../web/widget.tsx", import.meta.url), "utf8");
  assert.match(widget, /applyStudioToolResult/);
  assert.match(widget, /app\.ontoolresult[\s\S]{0,240}?applyStudioToolResult/);
  assert.match(widget, /studioTools\.runPrepared/);
});

test("widget callTool names the failing MCP tool instead of a bare proxy error", async () => {
  const widget = await readFile(new URL("../web/widget.tsx", import.meta.url), "utf8");
  assert.match(widget, /window\.openai\?\.callTool/);
  assert.match(widget, /app\.callServerTool/);
  assert.match(widget, /\$\{name\} 失败：\$\{failures\.join/);
});

test("widget hands off with ui/message text and does not spawn a nested Codex runner after a host message failure", async () => {
  const widget = await readFile(new URL("../web/widget.tsx", import.meta.url), "utf8");
  assert.match(widget, /app\.sendMessage/);
  assert.match(widget, /sendFollowUpMessage/);
  assert.match(widget, /content: \[\{ type: "text", text: instruction \}\]/);
  assert.match(widget, /locale: document\.documentElement\.dataset\.locale/);
  assert.match(widget, /!app && !window\.openai\?\.sendFollowUpMessage && context\?\.runId/);
});

test("widget supports standard inline collapse but still requests fullscreen", async () => {
  const widget = await readFile(new URL("../web/widget.tsx", import.meta.url), "utf8");
  assert.match(widget, /availableDisplayModes:\s*WORKBENCH_DISPLAY_MODES/);
  assert.match(widget, /autoResize:\s*true/);
  assert.match(widget, /window\.openai\?\.requestDisplayMode/);
  assert.match(widget, /requestDisplayMode\(\{\s*mode:\s*"fullscreen"/);
});
