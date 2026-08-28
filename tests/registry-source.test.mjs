import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

import { RegistrySource } from "../server/registry-source.mjs";
import { createStudioServer } from "../server/studio-server.mjs";

const FEED_URL = "https://feed.test/v1/registry.json";
const COMMIT = "1111111111111111111111111111111111111111";
const PNG = Buffer.from("89504e470d0a1a0a0000000d49484452", "hex");

function seedDocument() {
  return {
    version: 1,
    exampleSlotLimit: 10,
    skills: [
      {
        id: "bundled-poster",
        origin: "bundled",
        displayName: "Bundled Poster",
        description: "Ships with the plugin.",
        category: "海报",
        cover: "assets/previews/bundled.png",
        capabilities: { references: true, maxReferences: 1, aspectRatios: ["3:4"] },
        examples: [{ id: "slot-one", prompt: "A quiet poster", aspectRatio: "3:4", image: "assets/previews/bundled.png" }],
      },
    ],
  };
}

function remoteDocument({ stars = 900 } = {}) {
  return {
    version: 1,
    exampleSlotLimit: 10,
    skills: [
      {
        id: "upstream-collage",
        origin: "remote",
        displayName: "Upstream Collage",
        description: "Curated from GitHub.",
        category: "拼贴",
        stars,
        author: { name: "someone", url: "https://github.com/someone" },
        license: { spdx: null, name: "未声明许可证", note: "保留所有权利。" },
        source: { repo: "someone/upstream-collage", commit: COMMIT, skillPath: "SKILL.md" },
        capabilities: { references: true, maxReferences: 1, aspectRatios: ["3:4"] },
        cover: "assets/cover.png",
        gallery: [{ id: "shot-one", image: "assets/shot-one.png" }],
      },
      ...seedDocument().skills,
    ],
  };
}

async function createPluginRoot(document = seedDocument()) {
  const root = await mkdtemp(path.join(os.tmpdir(), "registry-source-"));
  test.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, "catalog"), { recursive: true });
  await writeFile(path.join(root, "catalog", "registry.json"), JSON.stringify(document));
  await mkdir(path.join(root, "assets", "previews"), { recursive: true });
  await writeFile(path.join(root, "assets", "previews", "bundled.png"), PNG);
  await mkdir(path.join(root, "skills", "bundled-poster"), { recursive: true });
  await writeFile(
    path.join(root, "skills", "bundled-poster", "SKILL.md"),
    "---\nname: bundled-poster\ndescription: Ships with the plugin.\n---\nBody",
  );
  return root;
}

function jsonResponse(value) {
  return { ok: true, status: 200, headers: { get: () => null }, text: async () => JSON.stringify(value) };
}

function bytesResponse(bytes) {
  return {
    ok: true,
    status: 200,
    headers: { get: (name) => (name.toLowerCase() === "content-type" ? "image/png" : String(bytes.length)) },
    arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    text: async () => bytes.toString("utf8"),
  };
}

// Serves a feed, a GitHub tree listing, and raw file content.
function upstreamFetch({ feed = remoteDocument(), log = [] } = {}) {
  return async (url) => {
    log.push(url);
    if (url === FEED_URL) return jsonResponse(feed);
    if (url.startsWith("https://api.github.com/")) {
      return jsonResponse({
        truncated: false,
        tree: [
          { path: "SKILL.md", type: "blob", size: 60 },
          { path: "references/notes.md", type: "blob", size: 20 },
        ],
      });
    }
    if (url.endsWith("SKILL.md")) {
      return bytesResponse(Buffer.from("---\nname: upstream-collage\ndescription: Curated from GitHub.\n---\nBody"));
    }
    if (url.endsWith("notes.md")) return bytesResponse(Buffer.from("# notes"));
    return bytesResponse(PNG);
  };
}

test("offline mode serves the bundled seed and never touches the network", async () => {
  const pluginRoot = await createPluginRoot();
  const log = [];
  const source = new RegistrySource({
    pluginRoot,
    dataRoot: path.join(pluginRoot, "data"),
    url: FEED_URL,
    offline: true,
    fetchImpl: upstreamFetch({ log }),
  });

  const loaded = await source.load();
  assert.equal(loaded.state, "seed");
  assert.deepEqual(loaded.entries.map((entry) => entry.id), ["bundled-poster"]);
  assert.equal(log.length, 0);
});

test("a published feed adds Skills without touching the installed plugin", async () => {
  const pluginRoot = await createPluginRoot();
  const source = new RegistrySource({
    pluginRoot,
    dataRoot: path.join(pluginRoot, "data"),
    url: FEED_URL,
    offline: false,
    fetchImpl: upstreamFetch(),
  });

  const loaded = await source.load();
  assert.equal(loaded.state, "cold");
  assert.deepEqual(loaded.entries.map((entry) => entry.id), ["upstream-collage", "bundled-poster"]);

  const upstream = loaded.entries[0];
  assert.equal(upstream.origin, "remote");
  assert.equal(upstream.path, null, "nothing is downloaded until the user asks");
  assert.equal(upstream.stars, 900);
  assert.equal(upstream.license.redistribute, false);
  assert.match(upstream.previewUrl, new RegExp(`/${COMMIT}/assets/cover\\.png$`));
});

test("a malformed published feed leaves the working seed in place", async () => {
  const pluginRoot = await createPluginRoot();
  const source = new RegistrySource({
    pluginRoot,
    dataRoot: path.join(pluginRoot, "data"),
    url: FEED_URL,
    offline: false,
    fetchImpl: async (url) => (url === FEED_URL ? jsonResponse({ version: 1, skills: [{ id: "BROKEN ID" }] }) : jsonResponse({})),
  });

  const loaded = await source.load();
  assert.deepEqual(loaded.entries.map((entry) => entry.id), ["bundled-poster"]);
});

test("fetching an upstream Skill makes it runnable and is cached by commit", async () => {
  const pluginRoot = await createPluginRoot();
  const log = [];
  const source = new RegistrySource({
    pluginRoot,
    dataRoot: path.join(pluginRoot, "data"),
    url: FEED_URL,
    offline: false,
    fetchImpl: upstreamFetch({ log }),
  });
  await source.load();

  const fetched = await source.fetchSkill("upstream-collage");
  assert.equal(fetched.ok, true);
  assert.equal(fetched.state, "downloaded");
  assert.ok(source.fetchedDirectory("upstream-collage"));

  const entry = source.catalogEntries().find((item) => item.id === "upstream-collage");
  assert.equal(entry.path, source.fetchedDirectory("upstream-collage"));

  const treeCallsBefore = log.filter((url) => url.startsWith("https://api.github.com/")).length;
  const again = await source.fetchSkill("upstream-collage");
  assert.equal(again.state, "hit");
  assert.equal(log.filter((url) => url.startsWith("https://api.github.com/")).length, treeCallsBefore);

  const bundled = await source.fetchSkill("bundled-poster");
  assert.equal(bundled.ok, false);
  assert.match(bundled.message, /不需要下载/);
});

test("upstream media is cached on first read and reused afterwards", async () => {
  const pluginRoot = await createPluginRoot();
  const log = [];
  const source = new RegistrySource({
    pluginRoot,
    dataRoot: path.join(pluginRoot, "data"),
    url: FEED_URL,
    offline: false,
    fetchImpl: upstreamFetch({ log }),
  });
  await source.load();
  const url = source.catalogEntries().find((entry) => entry.id === "upstream-collage").previewUrl;

  const first = await source.mediaFile(url);
  assert.ok(first, "the cover resolves to a cached file");
  const downloads = log.filter((entry) => entry === url).length;
  const second = await source.mediaFile(url);
  assert.equal(second, first);
  assert.equal(log.filter((entry) => entry === url).length, downloads);
});

test("loading keeps the media cache inside its budget", async () => {
  const pluginRoot = await createPluginRoot();
  const dataRoot = path.join(pluginRoot, "data");
  const big = Buffer.alloc(4096, 1);
  const source = new RegistrySource({
    pluginRoot,
    dataRoot,
    url: FEED_URL,
    offline: false,
    mediaBudgetBytes: 4096,
    fetchImpl: async (url) => (url === FEED_URL ? jsonResponse(remoteDocument()) : bytesResponse(big)),
  });
  await source.load();

  for (const index of [0, 1, 2]) {
    await source.mediaFile(`https://raw.githubusercontent.com/o/r/${COMMIT}/a${index}.png`);
  }
  const before = await source.pruneMedia(1024 * 1024);
  assert.equal(before.removed, 0);
  assert.ok(before.bytes > 4096, "three files exceed the budget");

  const pruned = await source.pruneMedia();
  assert.ok(pruned.removed > 0, "the configured budget is applied by default");
  assert.ok(pruned.bytes <= 4096);
});

async function createServerHarness() {
  const pluginRoot = await createPluginRoot();
  const registrySource = new RegistrySource({
    pluginRoot,
    dataRoot: path.join(pluginRoot, "data"),
    url: FEED_URL,
    offline: false,
    fetchImpl: upstreamFetch(),
  });
  const server = await createStudioServer({
    pluginRoot,
    dataRoot: path.join(pluginRoot, "data"),
    widgetHtml: "<!doctype html><html><head></head><body></body></html>",
    registrySource,
  });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: "registry-test", version: "1.0.0" }, { capabilities: {} });
  await client.connect(clientTransport);
  test.after(async () => {
    await client.close();
    await server.close();
  });
  return { client, registrySource };
}

test("the workbench serves curated upstream Skills with licence and gallery metadata", async () => {
  const { client } = await createServerHarness();

  const tools = (await client.listTools()).tools.map((tool) => tool.name);
  assert.ok(tools.includes("fetch_image_skill"));
  assert.ok(tools.includes("refresh_image_skill_catalog"));

  const opened = await client.callTool({ name: "open_image_skill_studio", arguments: {} });
  const upstream = opened.structuredContent.skills.find((skill) => skill.id === "upstream-collage");

  assert.equal(upstream.availability, "available");
  assert.equal(upstream.needsFetch, true);
  assert.equal(upstream.stars, 900);
  assert.equal(upstream.license.redistribute, false);
  assert.equal(upstream.author.name, "someone");
  assert.equal(upstream.upstream.repo, "someone/upstream-collage");
  assert.equal(upstream.gallery.length, 1);
  assert.ok(upstream.previewResourceUri, "the cover is exposed as an MCP resource");
});

test("reading an upstream gallery resource downloads it through the cache", async () => {
  const { client } = await createServerHarness();
  const opened = await client.callTool({ name: "open_image_skill_studio", arguments: {} });
  const upstream = opened.structuredContent.skills.find((skill) => skill.id === "upstream-collage");

  const read = await client.readResource({ uri: upstream.gallery[0].previewResourceUri });
  assert.equal(read.contents[0].mimeType, "image/png");
  assert.equal(Buffer.from(read.contents[0].blob, "base64").toString("hex"), PNG.toString("hex"));
});

test("fetch_image_skill reports attribution and flips the Skill to ready", async () => {
  const { client } = await createServerHarness();

  const result = await client.callTool({ name: "fetch_image_skill", arguments: { skillId: "upstream-collage" } });
  assert.equal(result.isError, undefined);
  assert.equal(result.structuredContent.skill.availability, "ready");
  assert.equal(result.structuredContent.skill.needsFetch, false);
  assert.equal(result.structuredContent.attribution.repo, "someone/upstream-collage");
  assert.match(result.content[0].text, /未声明许可证/, "an unlicensed Skill warns before use");
});

test("composing against an unfetched upstream Skill fetches it first", async () => {
  const { client } = await createServerHarness();

  const prepared = await client.callTool({
    name: "prepare_image_generation",
    arguments: { skillId: "upstream-collage", prompt: "A torn paper collage", aspectRatio: "3:4" },
  });

  assert.equal(prepared.isError, undefined);
  assert.equal(prepared.structuredContent.run.snapshot.skill.id, "upstream-collage");
  assert.match(prepared.structuredContent.instruction, /SKILL\.md/);
});
