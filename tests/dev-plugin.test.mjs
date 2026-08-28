import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

import { createDevMcpConfig, DEV_PLUGIN_ROOT, REPO_ROOT, syncDevPlugin } from "../scripts/sync-dev-plugin.mjs";

test("GitHub marketplace lists only the stable plugin at repo root", async () => {
  const marketplace = JSON.parse(
    await readFile(new URL("../.agents/plugins/marketplace.json", import.meta.url), "utf8"),
  );
  assert.equal(marketplace.name, "image-skill-studio");
  assert.deepEqual(
    marketplace.plugins.map((plugin) => plugin.name),
    ["image-skill-studio"],
  );
  assert.equal(marketplace.plugins[0].source.path, ".");
});

test("local marketplace lists only the live wrapper", async () => {
  const marketplace = JSON.parse(
    await readFile(new URL("../dev-marketplace/.agents/plugins/marketplace.json", import.meta.url), "utf8"),
  );
  assert.equal(marketplace.name, "image-skill-studio-local");
  assert.deepEqual(
    marketplace.plugins.map((plugin) => plugin.name),
    ["image-skill-studio-dev"],
  );
  assert.equal(marketplace.plugins[0].source.path, "./plugins/image-skill-studio-dev");
});

test("dev wrapper points Codex at this working tree, not a relative cache path", async () => {
  const mcpPath = await syncDevPlugin();
  const mcp = JSON.parse(await readFile(mcpPath, "utf8"));
  const server = mcp.mcpServers["image-skill-studio-dev"];
  assert.equal(server.command, "node");
  assert.equal(server.args[0], path.join(REPO_ROOT, "scripts", "dev-mcp.mjs"));
  assert.equal(server.cwd, REPO_ROOT);
  assert.ok(path.isAbsolute(server.args[0]));
  assert.ok(path.isAbsolute(server.cwd));
  assert.equal(path.basename(DEV_PLUGIN_ROOT), "image-skill-studio-dev");

  const generated = createDevMcpConfig("/tmp/image-skill-studio-checkout");
  assert.equal(
    generated.mcpServers["image-skill-studio-dev"].args[0],
    "/tmp/image-skill-studio-checkout/scripts/dev-mcp.mjs",
  );
  assert.equal(generated.mcpServers["image-skill-studio-dev"].cwd, "/tmp/image-skill-studio-checkout");
});

test("the live MCP process serves the workbench from this checkout", async (t) => {
  const dataRoot = await mkdtemp(path.join(os.tmpdir(), "image-skill-studio-dev-"));
  const transport = new StdioClientTransport({
    command: "node",
    args: [path.join(REPO_ROOT, "scripts", "dev-mcp.mjs")],
    cwd: REPO_ROOT,
    env: { ...process.env, PLUGIN_DATA: dataRoot, IMAGE_SKILL_STUDIO_DEV_WATCH: "0" },
    stderr: "pipe",
  });
  const client = new Client({ name: "image-skill-studio-dev-acceptance", version: "1.0.0" });
  await client.connect(transport);
  t.after(async () => {
    await client.close();
    await rm(dataRoot, { recursive: true, force: true });
  });

  const tools = await client.listTools();
  assert.ok(tools.tools.some((tool) => tool.name === "open_image_skill_studio_dev"));
  assert.ok(!tools.tools.some((tool) => tool.name === "open_image_skill_studio"));
  const resource = await client.readResource({ uri: "ui://image-skill-studio-dev/v1/workbench.html" });
  assert.equal(resource.contents[0].mimeType, "text/html;profile=mcp-app");
  assert.match(resource.contents[0].text, /ui\/message/);
  assert.match(resource.contents[0].text, /open_image_skill_studio_dev/);
});
