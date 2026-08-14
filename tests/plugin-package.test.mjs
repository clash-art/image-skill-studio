import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("plugin manifest packages the bundled skill and MCP App server", async () => {
  const manifest = JSON.parse(await readFile(new URL("../.codex-plugin/plugin.json", import.meta.url), "utf8"));
  assert.equal(manifest.name, "image-skill-studio");
  assert.equal(manifest.skills, "./skills/");
  assert.equal(manifest.mcpServers, "./.mcp.json");
  assert.match(manifest.interface.capabilities.join(" "), /Image Generation/);

  const mcp = JSON.parse(await readFile(new URL("../.mcp.json", import.meta.url), "utf8"));
  assert.equal(mcp.mcpServers["image-skill-studio"].command, "node");
  assert.equal(mcp.mcpServers["image-skill-studio"].args[0], "./runtime/server.mjs");
});

test("widget uses MCP Apps bridge first and OpenAI compatibility aliases second", async () => {
  const html = await readFile(new URL("../public/widget.html", import.meta.url), "utf8");
  assert.match(html, /ui\/initialize/);
  assert.match(html, /tools\/call/);
  assert.match(html, /ui\/message/);
  assert.match(html, /window\.openai/);
});
