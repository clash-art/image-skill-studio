import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const root = path.resolve(import.meta.dirname, "..");

test("the built plugin serves its real MCP App over stdio", async (t) => {
  const dataRoot = await mkdtemp(path.join(os.tmpdir(), "image-skill-studio-stdio-"));
  const transport = new StdioClientTransport({
    command: "node",
    args: [path.join(root, "runtime", "server.mjs")],
    cwd: root,
    env: { ...process.env, PLUGIN_ROOT: root, PLUGIN_DATA: dataRoot },
    stderr: "pipe",
  });
  const client = new Client({ name: "image-skill-studio-acceptance", version: "1.0.0" });
  await client.connect(transport);
  t.after(async () => {
    await client.close();
    await rm(dataRoot, { recursive: true, force: true });
  });

  const tools = await client.listTools();
  assert.ok(tools.tools.some((tool) => tool.name === "open_image_skill_studio"));
  const opened = await client.callTool({ name: "open_image_skill_studio", arguments: {} });
  assert.ok(Array.isArray(opened.structuredContent.skills));
  assert.equal(opened.structuredContent.runs.length, 8);
  assert.ok(opened.structuredContent.runs.every((run) => run.artifacts[0].resourceUri.includes("/runs/")));
  assert.ok(opened.structuredContent.runs.every((run) => !run.artifacts[0].resourceUri.includes("/examples/")));
  const runResource = await client.readResource({ uri: opened.structuredContent.runs[0].artifacts[0].resourceUri });
  assert.equal(runResource.contents[0].mimeType, "image/png");
  assert.ok(runResource.contents[0].blob.length > 20_000);

  const resource = await client.readResource({ uri: "ui://image-skill-studio/v1/workbench.html" });
  assert.equal(resource.contents[0].mimeType, "text/html;profile=mcp-app");
  assert.match(resource.contents[0].text, /ui\/message/);
  assert.match(resource.contents[0].text, /Hand off to Codex|交给 Codex|Codex Agent/);
});
