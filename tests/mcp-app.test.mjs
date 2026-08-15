import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

import { STUDIO_RESOURCE_URI, createStudioServer } from "../server/studio-server.mjs";

async function createHarness() {
  const root = await mkdtemp(path.join(os.tmpdir(), "image-studio-mcp-"));
  const skillDir = path.join(root, "skill");
  await mkdir(skillDir);
  await writeFile(
    path.join(skillDir, "SKILL.md"),
    `---\nname: test-image-skill\ndescription: Makes a test image.\n---\nUse imagegen.`,
  );
  const examplePath = path.join(root, "paper-moon.png");
  await writeFile(examplePath, Buffer.from("89504e470d0a1a0a0000000d49484452", "hex"));

  const server = await createStudioServer({
    pluginRoot: root,
    dataRoot: path.join(root, "data"),
    widgetHtml: "<!doctype html><script>window.__MCP_APP__ = true</script>",
    catalogEntries: [
      {
        id: "test-image-skill",
        path: skillDir,
        examples: [{ id: "paper-moon", prompt: "A paper moon above a quiet sea", aspectRatio: "3:4", previewPath: examplePath }],
        capabilities: { references: true, maxReferences: 2, aspectRatios: ["3:4"] },
      },
    ],
  });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client(
    { name: "image-studio-test", version: "1.0.0" },
    {
      capabilities: {
        extensions: {
          "io.modelcontextprotocol/ui": { mimeTypes: ["text/html;profile=mcp-app"] },
        },
      },
    },
  );
  await client.connect(clientTransport);
  return { client, server };
}

test("MCP server exposes a standards-first app resource and useful tools", async (t) => {
  const { client, server } = await createHarness();
  t.after(async () => {
    await client.close();
    await server.close();
  });

  const listed = await client.listTools();
  const names = listed.tools.map((tool) => tool.name);
  assert.ok(names.includes("open_image_skill_studio"));
  assert.ok(names.includes("prepare_image_generation"));
  assert.ok(names.includes("run_prepared_image_generation"));
  assert.ok(names.includes("get_image_generation_run"));
  assert.ok(names.includes("record_image_generation"));
  assert.ok(names.includes("register_image_skill"));
  assert.ok(names.includes("install_image_skill"));
  const openTool = listed.tools.find((tool) => tool.name === "open_image_skill_studio");
  const prepareTool = listed.tools.find((tool) => tool.name === "prepare_image_generation");
  const listTool = listed.tools.find((tool) => tool.name === "list_image_skills");
  assert.equal(openTool._meta.ui.resourceUri, STUDIO_RESOURCE_URI);
  assert.equal(openTool._meta["openai/outputTemplate"], STUDIO_RESOURCE_URI);
  assert.equal(openTool._meta["openai/widgetAccessible"], true);
  assert.equal(prepareTool._meta["openai/widgetAccessible"], true);
  assert.equal(prepareTool._meta["openai/outputTemplate"], undefined);
  assert.equal(prepareTool._meta.ui.resourceUri, undefined);
  assert.deepEqual(prepareTool._meta.ui.visibility, ["model", "app"]);
  assert.equal(listTool._meta["openai/widgetAccessible"], true);
  assert.equal(listTool._meta["openai/outputTemplate"], undefined);

  const resource = await client.readResource({ uri: STUDIO_RESOURCE_URI });
  assert.equal(resource.contents[0].mimeType, "text/html;profile=mcp-app");
  assert.match(resource.contents[0].text, /__MCP_APP__/);

  const opened = await client.callTool({ name: "open_image_skill_studio", arguments: {} });
  const example = opened.structuredContent.skills[0].examples[0];
  assert.equal(example.prompt, "A paper moon above a quiet sea");
  assert.equal(example.aspectRatio, "3:4");
  assert.match(example.previewResourceUri, /^image-skill-studio:\/\/examples\//);
  const exampleResource = await client.readResource({ uri: example.previewResourceUri });
  assert.equal(exampleResource.contents[0].mimeType, "image/png");
  assert.deepEqual(resource.contents[0]._meta.ui.availableDisplayModes, ["fullscreen"]);
});

test("createStudioServer can supply workbench HTML as a string or loader", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "image-studio-widget-"));
  const skillDir = path.join(root, "skill");
  await mkdir(skillDir);
  await writeFile(path.join(skillDir, "SKILL.md"), `---\nname: test-image-skill\ndescription: Makes a test image.\n---\nUse imagegen.`);
  let version = 1;
  const server = await createStudioServer({
    dataRoot: path.join(root, "data"),
    widgetHtml: async () => `<!doctype html><script>window.__WIDGET_VERSION__ = ${version}</script>`,
    catalogEntries: [{
      id: "test-image-skill",
      path: skillDir,
      capabilities: { references: false, maxReferences: 0, aspectRatios: ["3:4"] },
    }],
  });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: "widget-reload-test", version: "1.0.0" });
  await client.connect(clientTransport);
  t.after(async () => { await client.close(); await server.close(); });

  const first = await client.readResource({ uri: STUDIO_RESOURCE_URI });
  version = 2;
  const second = await client.readResource({ uri: STUDIO_RESOURCE_URI });
  assert.match(first.contents[0].text, /__WIDGET_VERSION__ = 1/);
  assert.match(second.contents[0].text, /__WIDGET_VERSION__ = 2/);
});

test("an empty MCP App store is seeded once from distinct generated-work assets", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "image-studio-seed-"));
  const skillDir = path.join(root, "skill");
  await mkdir(skillDir);
  await writeFile(
    path.join(skillDir, "SKILL.md"),
    `---\nname: seeded-image-skill\ndescription: Makes seeded images.\n---\nUse imagegen.`,
  );
  const examplePath = path.join(root, "example.png");
  const generatedPath = path.join(root, "generated.png");
  await writeFile(examplePath, Buffer.from("89504e470d0a1a0a0000000d4948445201", "hex"));
  await writeFile(generatedPath, Buffer.from("89504e470d0a1a0a0000000d4948445202", "hex"));
  const dataRoot = path.join(root, "data");
  const options = {
    dataRoot,
    widgetHtml: "<!doctype html>",
    runSeeds: [{
      id: "real-seed",
      skillId: "seeded-image-skill",
      prompt: "A distinct generated cold-start work",
      aspectRatio: "3:4",
      artifactPath: generatedPath,
      createdAt: "2026-08-12T12:00:00.000Z",
    }],
    catalogEntries: [{
      id: "seeded-image-skill",
      path: skillDir,
      examples: [{ id: "seed", prompt: "A real cold-start seed", aspectRatio: "3:4", previewPath: examplePath }],
      capabilities: { references: false, maxReferences: 0, aspectRatios: ["3:4"] },
    }],
  };

  async function openServer() {
    const server = await createStudioServer(options);
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    const client = new Client({ name: "seed-test", version: "1.0.0" });
    await client.connect(clientTransport);
    return { server, client };
  }

  const first = await openServer();
  const firstOpen = await first.client.callTool({ name: "open_image_skill_studio", arguments: {} });
  assert.equal(firstOpen.structuredContent.runs.length, 1);
  assert.equal(firstOpen.structuredContent.runs[0].id, "seed-seeded-image-skill-real-seed");
  assert.equal(firstOpen.structuredContent.runs[0].snapshot.prompt, "A distinct generated cold-start work");
  assert.equal(firstOpen.structuredContent.runs[0].artifacts[0].resourceUri, "image-skill-studio://runs/seeded-image-skill/real-seed");
  assert.ok(!firstOpen.structuredContent.runs[0].artifacts[0].resourceUri.includes("/examples/"));
  const generatedResource = await first.client.readResource({ uri: firstOpen.structuredContent.runs[0].artifacts[0].resourceUri });
  assert.deepEqual(Buffer.from(generatedResource.contents[0].blob, "base64"), await readFile(generatedPath));
  await first.client.close();
  await first.server.close();

  const second = await openServer();
  t.after(async () => { await second.client.close(); await second.server.close(); });
  const secondOpen = await second.client.callTool({ name: "open_image_skill_studio", arguments: {} });
  assert.equal(secondOpen.structuredContent.runs.length, 1, "reopening must not duplicate cold-start runs");
});

test("prepared work can be handed to a Codex runner without blocking the MCP App", async (t) => {
  const started = [];
  const root = await mkdtemp(path.join(os.tmpdir(), "image-studio-handoff-"));
  const skillDir = path.join(root, "skill");
  await mkdir(skillDir);
  await writeFile(
    path.join(skillDir, "SKILL.md"),
    `---\nname: test-image-skill\ndescription: Makes a test image.\n---\nUse imagegen.`,
  );
  const server = await createStudioServer({
    pluginRoot: root,
    dataRoot: path.join(root, "data"),
    widgetHtml: "<!doctype html>",
    catalogEntries: [{
      id: "test-image-skill",
      path: skillDir,
      capabilities: { references: true, maxReferences: 2, aspectRatios: ["3:4"] },
    }],
    generationRunner: async ({ run, onEvent }) => {
      started.push(run.id);
      await onEvent({ type: "imagegen_started", label: "ImageGen 正在生成", status: "imagegen_running" });
      return {
        status: "succeeded",
        artifacts: [{ id: "artifact-1", dataUrl: "data:image/png;base64,iVBORw0KGgo=" }],
        summary: "done",
      };
    },
  });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: "handoff-test", version: "1.0.0" });
  await client.connect(clientTransport);
  t.after(async () => { await client.close(); await server.close(); });

  const prepared = await client.callTool({
    name: "prepare_image_generation",
    arguments: { skillId: "test-image-skill", prompt: "paper moon", aspectRatio: "3:4", references: [] },
  });
  const runId = prepared.structuredContent.run.id;
  const dispatched = await client.callTool({ name: "run_prepared_image_generation", arguments: { runId } });
  assert.equal(dispatched.structuredContent.run.status, "agent_running");

  await new Promise((resolve) => setTimeout(resolve, 20));
  const finished = await client.callTool({ name: "get_image_generation_run", arguments: { runId } });
  assert.deepEqual(started, [runId]);
  assert.equal(finished.structuredContent.run.status, "succeeded");
  assert.equal(finished.structuredContent.run.artifacts[0].id, "artifact-1");
});

test("prepare_image_generation snapshots input and returns an agent instruction", async (t) => {
  const { client, server } = await createHarness();
  t.after(async () => {
    await client.close();
    await server.close();
  });

  const result = await client.callTool({
    name: "prepare_image_generation",
    arguments: {
      skillId: "test-image-skill",
      prompt: "A red paper kite",
      aspectRatio: "3:4",
      clientRequestId: "request-1",
      references: [],
    },
  });
  assert.equal(result.structuredContent.run.status, "awaiting_agent");
  assert.match(result.structuredContent.instruction, /\$test-image-skill/);
  assert.match(result.structuredContent.instruction, /\$imagegen/);
  assert.match(result.structuredContent.instruction, /record_image_generation/);
  assert.match(result.structuredContent.instruction, /A red paper kite/);
  assert.match(result.structuredContent.instruction, /生成失败时不要调用这个工具/);
  assert.doesNotMatch(result.structuredContent.instruction, /记录 failed/);
  const skillPath = result.structuredContent.run.snapshot.skill.skillPath;
  assert.match(skillPath, /SKILL\.md$/);
  assert.equal(result.structuredContent.instruction.includes(skillPath), true);
  const listed = await client.listTools();
  const prepare = listed.tools.find((tool) => tool.name === "prepare_image_generation");
  assert.equal(prepare._meta["openai/fileParams"], undefined);
});

test("record_image_generation persists a real saved image as an MCP resource", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "image-studio-artifact-"));
  const skillDir = path.join(root, "skill");
  await mkdir(skillDir);
  await writeFile(path.join(skillDir, "SKILL.md"), `---\nname: test-image-skill\ndescription: Makes a test image.\n---\nUse imagegen.`);
  const png = Buffer.from("89504e470d0a1a0a0000000d49484452", "hex");
  const generatedPath = path.join(root, "generated.png");
  await writeFile(generatedPath, png);
  const server = await createStudioServer({
    dataRoot: path.join(root, "data"),
    artifactRoots: [root],
    widgetHtml: "<!doctype html>",
    catalogEntries: [{
      id: "test-image-skill",
      path: skillDir,
      capabilities: { references: true, maxReferences: 2, aspectRatios: ["3:4"] },
    }],
  });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: "artifact-test", version: "1.0.0" });
  await client.connect(clientTransport);
  t.after(async () => { await client.close(); await server.close(); });

  const prepared = await client.callTool({
    name: "prepare_image_generation",
    arguments: { skillId: "test-image-skill", prompt: "paper moon", aspectRatio: "3:4", references: [] },
  });
  const runId = prepared.structuredContent.run.id;
  const recorded = await client.callTool({
    name: "record_image_generation",
    arguments: { runId, status: "succeeded", savedPath: generatedPath },
  });
  const artifact = recorded.structuredContent.run.artifacts[0];
  assert.match(artifact.resourceUri, /^image-skill-studio:\/\/artifacts\//);
  assert.ok(path.resolve(artifact.savedPath).startsWith(path.join(root, "data", "artifacts")));

  const resource = await client.readResource({ uri: artifact.resourceUri });
  assert.equal(resource.contents[0].mimeType, "image/png");
  assert.deepEqual(Buffer.from(resource.contents[0].blob, "base64"), png);
});

test("record_image_generation ignores failed status instead of storing an error run", async (t) => {
  const { client, server } = await createHarness();
  t.after(async () => {
    await client.close();
    await server.close();
  });

  const prepared = await client.callTool({
    name: "prepare_image_generation",
    arguments: { skillId: "test-image-skill", prompt: "paper moon", aspectRatio: "3:4", references: [] },
  });
  const runId = prepared.structuredContent.run.id;
  const recorded = await client.callTool({
    name: "record_image_generation",
    arguments: { runId, status: "failed", error: "OPENAI_API_KEY is not set" },
  });
  assert.equal(recorded.structuredContent.run.status, "awaiting_agent");
  assert.match(recorded.content[0].text, /不收录/);
});

test("record_image_generation is bound to the MCP App so the widget receives the recorded run", async (t) => {
  const { client, server } = await createHarness();
  t.after(async () => {
    await client.close();
    await server.close();
  });

  const listed = await client.listTools();
  const record = listed.tools.find((tool) => tool.name === "record_image_generation");
  assert.equal(record._meta.ui.resourceUri, STUDIO_RESOURCE_URI);
  assert.equal(record._meta["openai/outputTemplate"], STUDIO_RESOURCE_URI);
});

test("get_image_generation_run expires a stale handoff that never recorded an artifact", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "image-studio-stale-"));
  const skillDir = path.join(root, "skill");
  await mkdir(skillDir);
  await writeFile(path.join(skillDir, "SKILL.md"), `---\nname: test-image-skill\ndescription: Makes a test image.\n---\nUse imagegen.`);
  const server = await createStudioServer({
    dataRoot: path.join(root, "data"),
    widgetHtml: "<!doctype html>",
    handoffTimeoutMs: 25,
    catalogEntries: [{
      id: "test-image-skill",
      path: skillDir,
      capabilities: { references: true, maxReferences: 2, aspectRatios: ["3:4"] },
    }],
  });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: "stale-test", version: "1.0.0" });
  await client.connect(clientTransport);
  t.after(async () => { await client.close(); await server.close(); });

  const prepared = await client.callTool({
    name: "prepare_image_generation",
    arguments: { skillId: "test-image-skill", prompt: "paper moon", aspectRatio: "3:4", references: [] },
  });
  const runId = prepared.structuredContent.run.id;
  await client.callTool({ name: "mark_image_generation_handoff", arguments: { runId } });
  await new Promise((resolve) => setTimeout(resolve, 40));

  const stale = await client.callTool({ name: "get_image_generation_run", arguments: { runId } });
  assert.equal(stale.structuredContent.run.status, "failed");
  assert.match(stale.structuredContent.run.error, /时限|timeout|回写/i);
});

test("users can register a validated Skill into Studio and install it into Codex skills", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "image-studio-library-"));
  const skillDir = path.join(root, "featured");
  await mkdir(skillDir);
  await writeFile(path.join(skillDir, "SKILL.md"), `---\nname: featured-poster\ndescription: Featured poster method.\n---\nUse imagegen.`);
  const incoming = path.join(root, "incoming", "paper-poster");
  await mkdir(incoming, { recursive: true });
  await writeFile(
    path.join(incoming, "SKILL.md"),
    `---\nname: paper-poster\ndescription: Makes editorial paper posters for Codex.\n---\n# paper-poster\n`,
  );
  await writeFile(path.join(incoming, "notes.md"), "Keep this supporting file.\n");
  const hostSkillsDir = path.join(root, "codex-skills");
  const dataRoot = path.join(root, "data");
  const server = await createStudioServer({
    pluginRoot: root,
    dataRoot,
    hostSkillsDir,
    widgetHtml: "<!doctype html>",
    catalogEntries: [
      {
        id: "imagegen",
        origin: "host",
        path: path.join(hostSkillsDir, ".system", "imagegen"),
        capabilities: { references: true, maxReferences: 3, aspectRatios: ["3:4"] },
      },
      {
        id: "featured-poster",
        origin: "bundled",
        path: skillDir,
        capabilities: { references: true, maxReferences: 2, aspectRatios: ["3:4"] },
      },
    ],
  });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: "library-test", version: "1.0.0" });
  await client.connect(clientTransport);
  t.after(async () => { await client.close(); await server.close(); });

  const invalid = await client.callTool({
    name: "register_image_skill",
    arguments: { sourcePath: path.join(root, "missing-skill") },
  });
  assert.equal(invalid.isError, true);

  const registered = await client.callTool({
    name: "register_image_skill",
    arguments: { sourcePath: incoming },
  });
  assert.ok(!registered.isError);
  const ids = registered.structuredContent.skills.map((skill) => skill.id);
  assert.deepEqual(ids.slice(-1), ["paper-poster"]);
  assert.equal(registered.structuredContent.skill.origin, "registered");
  assert.equal(registered.structuredContent.skill.canInstall, true);
  assert.match(registered.structuredContent.skill.skillPath, /paper-poster\/SKILL\.md$/);

  const duplicate = await client.callTool({
    name: "register_image_skill",
    arguments: { sourcePath: incoming },
  });
  assert.equal(duplicate.isError, true);
  assert.match(duplicate.content[0].text, /已经注册/);

  const blockedHost = await client.callTool({
    name: "install_image_skill",
    arguments: { skillId: "imagegen" },
  });
  assert.equal(blockedHost.isError, true);

  const installed = await client.callTool({
    name: "install_image_skill",
    arguments: { skillId: "paper-poster" },
  });
  assert.ok(!installed.isError);
  assert.equal(installed.structuredContent.destination, path.join(hostSkillsDir, "paper-poster"));
  assert.equal(
    await readFile(path.join(hostSkillsDir, "paper-poster", "notes.md"), "utf8"),
    "Keep this supporting file.\n",
  );
});
