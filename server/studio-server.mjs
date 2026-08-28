import { randomUUID } from "node:crypto";
import { copyFile, mkdir, readFile, realpath, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { registerAppResource, registerAppTool, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { buildGenerationPrompt, validateGenerationRequest } from "../lib/agent-command.mjs";
import { WORKBENCH_DISPLAY_MODES } from "../lib/display-mode.mjs";
import { PACKAGE_ROOT } from "../lib/package-root.mjs";
import { createStudioIdentity, injectStudioIdentity, STUDIO_RESOURCE_URI } from "../lib/studio-identity.mjs";
import { isPublishedRun } from "../lib/published-run.mjs";
import {
  injectRemoteStylesheet,
  normalizeRemoteStylesheetUrl,
  remoteStylesheetOrigin,
} from "../lib/remote-stylesheet.mjs";
import { loadSkillCatalog } from "../lib/skill-catalog.mjs";
import {
  HOST_SKILL_DIR,
  installStudioSkill,
  listRegisteredSkillEntries,
  registerStudioSkill,
} from "../lib/studio-skill-registry.mjs";
import { RegistrySource } from "./registry-source.mjs";
import { RunStore } from "./run-store.mjs";

export { STUDIO_RESOURCE_URI };

const referenceInput = z.object({
  download_url: z.string(),
  file_id: z.string(),
  mime_type: z.string().optional(),
  file_name: z.string().optional(),
  role: z.enum(["subject", "style", "composition", "reference"]).optional(),
});

function toolMeta({ render = false, invoking, invoked, visibility, resourceUri }) {
  const ui = { visibility: visibility || ["model", "app"] };
  const meta = {
    "openai/toolInvocation/invoking": invoking,
    "openai/toolInvocation/invoked": invoked,
    // Codex still proxies widget tools through the Apps SDK path, where this
    // defaults to false and the host returns MCP error -32000.
    "openai/widgetAccessible": true,
    ui,
  };
  if (render) {
    ui.resourceUri = resourceUri;
    meta["openai/outputTemplate"] = resourceUri;
  }
  return meta;
}

function previewUri(skillId) {
  return `image-skill-studio://previews/${encodeURIComponent(skillId)}`;
}

function slotUri(kind, skillId, slotId) {
  return `image-skill-studio://${kind}/${encodeURIComponent(skillId)}/${encodeURIComponent(slotId)}`;
}

function hasMedia(slot) {
  return Boolean(slot?.previewPath || slot?.previewUrl);
}

function hasReferenceMedia(slot) {
  return Boolean(slot?.referencePreviewPath || slot?.referencePreviewUrl);
}

function skillSummary(skill) {
  return {
    id: skill.id,
    displayName: skill.displayName,
    description: skill.description,
    category: skill.category,
    accent: skill.accent,
    source: skill.source,
    origin: skill.origin,
    canInstall: skill.canInstall,
    version: skill.version,
    contentHash: skill.contentHash,
    skillPath: skill.skillPath,
    needsFetch: Boolean(skill.needsFetch),
    stars: skill.stars ?? null,
    license: skill.license,
    author: skill.author,
    upstream: skill.upstream
      ? { repo: skill.upstream.repo, commit: skill.upstream.commit, homepage: skill.upstream.homepage }
      : undefined,
    previewResourceUri: hasMedia(skill) ? previewUri(skill.id) : undefined,
    examples: (skill.examples || []).map((example) => ({
      id: example.id,
      prompt: example.prompt,
      aspectRatio: example.aspectRatio,
      mode: example.mode,
      referenceRole: example.referenceRole,
      promptFile: example.promptFile,
      previewResourceUri: hasMedia(example) ? slotUri("examples", skill.id, example.id) : undefined,
      referenceResourceUri: hasReferenceMedia(example) ? slotUri("references", skill.id, example.id) : undefined,
    })),
    gallery: (skill.gallery || []).map((item) => ({
      id: item.id,
      caption: item.caption,
      aspectRatio: item.aspectRatio,
      previewResourceUri: hasMedia(item) ? slotUri("gallery", skill.id, item.id) : undefined,
    })),
    capabilities: skill.capabilities,
    availability: skill.availability,
    error: skill.error,
  };
}

function imageMimeType(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  if (extension === ".webp") return "image/webp";
  if (extension === ".svg") return "image/svg+xml";
  return "image/png";
}

function mediaMimeType(source) {
  if (!source) return "image/png";
  if (source.file) return imageMimeType(source.file);
  if (!source.url) return "image/png";
  try {
    return imageMimeType(new URL(source.url).pathname);
  } catch {
    return "image/png";
  }
}

function isInside(filePath, rootPath) {
  return filePath === rootPath || filePath.startsWith(`${rootPath}${path.sep}`);
}

function detectImage(bytes) {
  if (bytes.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex"))) {
    return { extension: ".png", mimeType: "image/png" };
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { extension: ".jpg", mimeType: "image/jpeg" };
  }
  if (bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP") {
    return { extension: ".webp", mimeType: "image/webp" };
  }
  throw new Error("Generated artifact must be a PNG, JPEG, or WEBP image");
}

async function persistSavedArtifact({ savedPath, runId, dataRoot, artifactRoots }) {
  if (!path.isAbsolute(savedPath)) throw new Error("savedPath must be absolute");
  const source = await realpath(savedPath);
  let permitted = false;
  for (const root of artifactRoots) {
    try {
      if (isInside(source, await realpath(root))) {
        permitted = true;
        break;
      }
    } catch {
      // A configured root that does not exist cannot authorize the file.
    }
  }
  if (!permitted) throw new Error("savedPath is outside the permitted image output roots");
  const info = await stat(source);
  if (!info.isFile() || info.size < 8 || info.size > 30 * 1024 * 1024) {
    throw new Error("Generated artifact must be a regular image file smaller than 30 MB");
  }
  const bytes = await readFile(source);
  const detected = detectImage(bytes);
  const id = `artifact-${randomUUID()}`;
  const artifactDir = path.join(dataRoot, "artifacts");
  await mkdir(artifactDir, { recursive: true });
  const target = path.join(artifactDir, `${runId}-${id}${detected.extension}`);
  await copyFile(source, target);
  return {
    id,
    fileName: `${runId}${detected.extension}`,
    mimeType: detected.mimeType,
    resourceUri: `image-skill-studio://artifacts/${encodeURIComponent(id)}`,
    savedPath: target,
  };
}

export async function createStudioServer({
  pluginRoot = PACKAGE_ROOT,
  dataRoot = process.env.PLUGIN_DATA || path.join(os.homedir(), ".codex", "image-skill-studio"),
  widgetHtml,
  identity = createStudioIdentity("stable"),
  catalogEntries,
  registrySource,
  generationRunner,
  hostSkillsDir = HOST_SKILL_DIR,
  handoffTimeoutMs = Number(process.env.IMAGE_SKILL_STUDIO_HANDOFF_TIMEOUT_MS) || 10 * 60_000,
  artifactRoots = [
    path.join(process.env.CODEX_HOME || path.join(os.homedir(), ".codex"), "generated_images"),
    dataRoot,
  ],
  remoteStylesheetUrl = process.env.IMAGE_SKILL_STUDIO_REMOTE_STYLESHEET_URL,
} = {}) {
  if (widgetHtml == null) throw new Error("createStudioServer requires widgetHtml");
  const tools = identity.tools;
  const stylesheetUrl = normalizeRemoteStylesheetUrl(remoteStylesheetUrl);
  const stylesheetOrigin = remoteStylesheetOrigin(stylesheetUrl);
  // Tests and the dev harness can pin an explicit catalog; otherwise the
  // registry serves its cached feed and refreshes in the background.
  const registry = catalogEntries ? null : registrySource ?? new RegistrySource({ pluginRoot, dataRoot });
  let featuredEntries = catalogEntries ?? [];
  let catalog = [];
  let bundledIds = [];

  async function loadCatalog() {
    const featuredIds = new Set(featuredEntries.map((entry) => entry.id));
    const registered = (await listRegisteredSkillEntries(dataRoot)).filter((entry) => !featuredIds.has(entry.id));
    return loadSkillCatalog([...featuredEntries, ...registered]);
  }

  const store = new RunStore(dataRoot);
  await store.load();
  const server = new McpServer(
    { name: identity.serverName, version: "0.1.0" },
    {
      instructions:
        `Use ${tools.open} to render the two-route image Skill app. The app hands immutable image work to Codex and groups the resulting images by Skill.`,
      capabilities: { tools: {}, resources: {} },
    },
  );
  const registeredArtifactUris = new Set();
  function registerArtifactResource(artifact) {
    if (!artifact?.resourceUri || !artifact?.savedPath || registeredArtifactUris.has(artifact.resourceUri)) return;
    registeredArtifactUris.add(artifact.resourceUri);
    server.registerResource(
      `image-skill-artifact-${artifact.id}`,
      artifact.resourceUri,
      { title: artifact.fileName || "Generated image", mimeType: artifact.mimeType || "image/png" },
      async () => ({
        contents: [{
          uri: artifact.resourceUri,
          mimeType: artifact.mimeType || "image/png",
          blob: (await readFile(artifact.savedPath)).toString("base64"),
        }],
      }),
    );
  }
  for (const run of await store.listPublished()) {
    for (const artifact of run.artifacts || []) registerArtifactResource(artifact);
  }

  // A resource URI is registered once but its backing source is refreshed on
  // every catalog rebuild, so a feed update that re-pins a commit is served
  // from the new URL instead of a stale closure.
  const mediaSources = new Map();
  const registeredMediaNames = new Set();

  function registerMediaResource({ uri, name, title, slot }) {
    mediaSources.set(uri, { file: slot.previewPath, url: slot.previewUrl });
    if (registeredMediaNames.has(name)) return;
    registeredMediaNames.add(name);
    server.registerResource(
      name,
      uri,
      { title, mimeType: mediaMimeType(mediaSources.get(uri)) },
      async () => {
        const source = mediaSources.get(uri);
        const file = source?.file ?? (source?.url ? await registry?.mediaFile(source.url) : null);
        if (!file) throw new Error(`媒体资源暂时不可用：${uri}`);
        return {
          contents: [{
            uri,
            mimeType: mediaMimeType(source),
            blob: (await readFile(file)).toString("base64"),
          }],
        };
      },
    );
  }

  function registerCatalogMedia() {
    for (const skill of catalog) {
      if (hasMedia(skill)) {
        registerMediaResource({
          uri: previewUri(skill.id),
          name: `image-skill-preview-${skill.id}`,
          title: `${skill.displayName} preview`,
          slot: skill,
        });
      }
      for (const example of (skill.examples || []).filter(hasMedia)) {
        registerMediaResource({
          uri: slotUri("examples", skill.id, example.id),
          name: `image-skill-example-${skill.id}-${example.id}`,
          title: `${skill.displayName} example`,
          slot: example,
        });
      }
      for (const example of (skill.examples || []).filter(hasReferenceMedia)) {
        registerMediaResource({
          uri: slotUri("references", skill.id, example.id),
          name: `image-skill-reference-${skill.id}-${example.id}`,
          title: `${skill.displayName} source reference`,
          slot: { previewPath: example.referencePreviewPath, previewUrl: example.referencePreviewUrl },
        });
      }
      for (const item of (skill.gallery || []).filter(hasMedia)) {
        registerMediaResource({
          uri: slotUri("gallery", skill.id, item.id),
          name: `image-skill-gallery-${skill.id}-${item.id}`,
          title: `${skill.displayName} gallery`,
          slot: item,
        });
      }
    }
  }

  async function refreshCatalog() {
    catalog = await loadCatalog();
    bundledIds = featuredEntries.filter((entry) => entry.origin !== "host").map((entry) => entry.id);
    registerCatalogMedia();
    return catalog;
  }

  if (registry) {
    const loaded = await registry.load({
      onUpdate: async ({ entries }) => {
        featuredEntries = entries;
        await refreshCatalog();
      },
    });
    featuredEntries = loaded.entries;
  }
  await refreshCatalog();

  registerAppResource(
    server,
    identity.resourceName,
    identity.resourceUri,
    { mimeType: RESOURCE_MIME_TYPE },
    async () => {
      const html = typeof widgetHtml === "function" ? await widgetHtml() : widgetHtml;
      const styledHtml = injectRemoteStylesheet(html, stylesheetUrl);
      return {
        contents: [
          {
            uri: identity.resourceUri,
            mimeType: RESOURCE_MIME_TYPE,
            text: injectStudioIdentity(styledHtml, identity),
            _meta: {
              ui: {
                prefersBorder: false,
                availableDisplayModes: WORKBENCH_DISPLAY_MODES,
                csp: stylesheetOrigin ? { resourceDomains: [stylesheetOrigin] } : undefined,
              },
              "openai/widgetDescription": "Codex 生图侧栏：Feed 展示生成记录与 Skill 示例，Skill 详情负责 handoff、结果与小红书导出。",
              "openai/widgetPrefersBorder": false,
            },
          },
        ],
      };
    },
  );

  registerAppTool(
    server,
    tools.open,
    {
      title: identity.openTitle,
      description: identity.openDescription,
      inputSchema: {},
      outputSchema: {
        skills: z.array(z.record(z.string(), z.unknown())),
        runs: z.array(z.record(z.string(), z.unknown())),
      },
      annotations: { readOnlyHint: true, openWorldHint: false, destructiveHint: false },
      _meta: toolMeta({
        render: true,
        resourceUri: identity.resourceUri,
        invoking: "正在打开生图工作台…",
        invoked: "生图工作台已打开",
      }),
    },
    async () => {
      await store.expireStale({ timeoutMs: handoffTimeoutMs });
      const runs = await store.listPublished();
      return {
        structuredContent: { skills: catalog.map(skillSummary), runs },
        content: [{ type: "text", text: `已载入 ${catalog.filter((skill) => skill.availability === "ready").length} 个可用生图 Skill。` }],
      };
    },
  );

  registerAppTool(
    server,
    tools.runPrepared,
    {
      title: "Hand off prepared image work to Codex",
      description:
        "Start the immutable prepared run with Codex. This app-only action returns immediately; the finished image is collected under its Skill.",
      inputSchema: { runId: z.string() },
      outputSchema: { run: z.record(z.string(), z.unknown()) },
      annotations: { readOnlyHint: false, openWorldHint: false, destructiveHint: false, idempotentHint: true },
      _meta: toolMeta({ invoking: "正在 hand off 给 Codex…", invoked: "Codex 已接手" }),
    },
    async ({ runId }) => {
      const current = await store.get(runId);
      if (!current) {
        return { isError: true, structuredContent: { run: {} }, content: [{ type: "text", text: `找不到 ${runId}。` }] };
      }
      if (["agent_running", "imagegen_running", "finalizing", "succeeded"].includes(current.status)) {
        return { structuredContent: { run: current }, content: [{ type: "text", text: `${runId} 已经交给 Codex。` }] };
      }
      if (!generationRunner) {
        return {
          isError: true,
          structuredContent: { run: current },
          content: [{ type: "text", text: "当前 Plugin 运行时没有连接 Codex runner；请使用 ui/message hand off。" }],
        };
      }

      const dispatched = await store.appendEvent(runId, {
        type: "handoff",
        label: "已 hand off 给 Codex Agent",
        status: "agent_running",
      });
      queueMicrotask(async () => {
        try {
          const result = await generationRunner({
            run: dispatched,
            skill: dispatched.snapshot.skill,
            prompt: dispatched.snapshot.prompt,
            references: dispatched.snapshot.references,
            aspectRatio: dispatched.snapshot.aspectRatio,
            onEvent: (event) => store.appendEvent(runId, event),
          });
          await store.complete(runId, result);
        } catch (error) {
          await store.complete(runId, {
            status: "failed",
            error: error instanceof Error ? error.message : String(error),
          });
        }
      });
      return {
        structuredContent: { run: dispatched },
        content: [{ type: "text", text: `${runId} 已 hand off 给 Codex；成图会收录在对应 Skill 下。` }],
      };
    },
  );

  registerAppTool(
    server,
    tools.markHandoff,
    {
      title: "Mark image generation handoff",
      description: "Record that ui/message handed a prepared run to the current Codex agent.",
      inputSchema: { runId: z.string() },
      outputSchema: { run: z.record(z.string(), z.unknown()) },
      annotations: { readOnlyHint: false, openWorldHint: false, destructiveHint: false, idempotentHint: true },
      _meta: toolMeta({ invoking: "正在记录 handoff…", invoked: "Handoff 已记录" }),
    },
    async ({ runId }) => {
      const current = await store.get(runId);
      if (!current) {
        return { isError: true, structuredContent: { run: {} }, content: [{ type: "text", text: `找不到 ${runId}。` }] };
      }
      if (current.status !== "awaiting_agent") {
        return { structuredContent: { run: current }, content: [{ type: "text", text: `${runId} 已记录。` }] };
      }
      const run = await store.appendEvent(runId, {
        type: "handoff",
        label: "已 hand off 给当前 Codex Agent",
        status: "agent_running",
      });
      return {
        structuredContent: { run },
        content: [{ type: "text", text: `${runId} 已 hand off 给 Codex。` }],
      };
    },
  );

  registerAppTool(
    server,
    tools.listSkills,
    {
      title: "List image skills",
      description: "List the image-generation Skills curated by Image Skill Studio.",
      inputSchema: {},
      outputSchema: { skills: z.array(z.record(z.string(), z.unknown())) },
      annotations: { readOnlyHint: true, openWorldHint: false, destructiveHint: false },
      _meta: toolMeta({ invoking: "正在读取生图 Skill…", invoked: "生图 Skill 已更新" }),
    },
    async () => ({
      structuredContent: { skills: catalog.map(skillSummary) },
      content: [{ type: "text", text: `找到 ${catalog.length} 个收录的生图 Skill。` }],
    }),
  );

  registerAppTool(
    server,
    tools.registerSkill,
    {
      title: "Register an image skill into Studio",
      description:
        "Validate a local Codex Skill directory or SKILL.md, copy it into Image Skill Studio, and add it to the workbench catalog.",
      inputSchema: {
        sourcePath: z.string(),
        overwrite: z.boolean().optional(),
      },
      outputSchema: {
        skills: z.array(z.record(z.string(), z.unknown())),
        skill: z.record(z.string(), z.unknown()),
      },
      annotations: { readOnlyHint: false, openWorldHint: false, destructiveHint: false },
      _meta: toolMeta({ invoking: "正在校验并注册 Skill…", invoked: "Skill 已注册到 Studio" }),
    },
    async ({ sourcePath, overwrite }) => {
      const result = await registerStudioSkill({
        sourcePath,
        dataRoot,
        overwrite: Boolean(overwrite),
        bundledIds,
      });
      if (!result.ok) {
        return {
          isError: true,
          structuredContent: { skills: catalog.map(skillSummary), skill: {} },
          content: [{ type: "text", text: result.message }],
        };
      }
      await refreshCatalog();
      const skill = catalog.find((entry) => entry.id === result.skill.id);
      return {
        structuredContent: {
          skills: catalog.map(skillSummary),
          skill: skill ? skillSummary(skill) : result.skill,
        },
        content: [{ type: "text", text: `已把 ${result.skill.id} 注册进 Image Skill Studio。` }],
      };
    },
  );

  registerAppTool(
    server,
    tools.installSkill,
    {
      title: "Install a Studio skill into Codex skills",
      description:
        "Copy a Studio-hosted image Skill into the user's built-in Codex skills directory (~/.codex/skills).",
      inputSchema: {
        skillId: z.string(),
        overwrite: z.boolean().optional(),
      },
      outputSchema: {
        skills: z.array(z.record(z.string(), z.unknown())),
        destination: z.string(),
      },
      annotations: { readOnlyHint: false, openWorldHint: false, destructiveHint: false },
      _meta: toolMeta({ invoking: "正在安装到 Codex Skills…", invoked: "已安装到 Codex Skills" }),
    },
    async ({ skillId, overwrite }) => {
      // Installing a curated upstream Skill implies fetching it first.
      const pending = catalog.find((entry) => entry.id === skillId);
      if (pending?.needsFetch && registry) {
        const fetched = await registry.fetchSkill(skillId);
        if (!fetched.ok) {
          return {
            isError: true,
            structuredContent: { skills: catalog.map(skillSummary), destination: "" },
            content: [{ type: "text", text: fetched.message }],
          };
        }
        featuredEntries = registry.catalogEntries();
        await refreshCatalog();
      }

      const result = await installStudioSkill({
        skillId,
        dataRoot,
        hostSkillsDir,
        catalog,
        pluginRoot,
        overwrite: Boolean(overwrite),
      });
      if (!result.ok) {
        return {
          isError: true,
          structuredContent: { skills: catalog.map(skillSummary), destination: "" },
          content: [{ type: "text", text: result.message }],
        };
      }
      return {
        structuredContent: {
          skills: catalog.map(skillSummary),
          destination: result.destination,
        },
        content: [{ type: "text", text: `已把 ${skillId} 安装到 ${result.destination}。` }],
      };
    },
  );

  registerAppTool(
    server,
    tools.fetchSkill,
    {
      title: "Fetch a curated upstream image skill",
      description:
        "Download a curated Skill from its author's repository at the pinned commit into the local cache so it can run. Nothing is redistributed by Studio; the upstream licence and attribution apply.",
      inputSchema: {
        skillId: z.string(),
        force: z.boolean().optional(),
      },
      outputSchema: {
        skills: z.array(z.record(z.string(), z.unknown())),
        skill: z.record(z.string(), z.unknown()),
        attribution: z.record(z.string(), z.unknown()).nullable(),
      },
      annotations: { readOnlyHint: false, openWorldHint: true, destructiveHint: false, idempotentHint: true },
      _meta: toolMeta({ invoking: "正在从上游仓库获取 Skill…", invoked: "Skill 已就绪" }),
    },
    async ({ skillId, force }) => {
      if (!registry) {
        return {
          isError: true,
          structuredContent: { skills: catalog.map(skillSummary), skill: {}, attribution: null },
          content: [{ type: "text", text: "当前运行时使用固定 catalog，无法按需下载。" }],
        };
      }
      const result = await registry.fetchSkill(skillId, { force: Boolean(force) });
      if (!result.ok) {
        return {
          isError: true,
          structuredContent: { skills: catalog.map(skillSummary), skill: {}, attribution: null },
          content: [{ type: "text", text: result.message }],
        };
      }

      featuredEntries = registry.catalogEntries();
      await refreshCatalog();
      const skill = catalog.find((entry) => entry.id === skillId);
      const license = result.skill?.license;
      const notice = license?.redistribute
        ? `许可证 ${license.name}。`
        : `许可证 ${license?.name || "未声明"}：${license?.note || "请遵守作者的使用条款。"}`;
      return {
        structuredContent: {
          skills: catalog.map(skillSummary),
          skill: skill ? skillSummary(skill) : {},
          attribution: result.attribution ?? null,
        },
        content: [{
          type: "text",
          text: `${skillId} 已从 ${result.skill?.source?.repo} 获取（${result.state === "hit" ? "命中缓存" : `${result.files} 个文件`}）。${notice}`,
        }],
      };
    },
  );

  registerAppTool(
    server,
    tools.refreshCatalog,
    {
      title: "Refresh the image skill catalog",
      description: "Re-check the published Skill feed and return the refreshed catalog without reinstalling the plugin.",
      inputSchema: {},
      outputSchema: {
        skills: z.array(z.record(z.string(), z.unknown())),
        state: z.string(),
      },
      annotations: { readOnlyHint: false, openWorldHint: true, destructiveHint: false, idempotentHint: true },
      _meta: toolMeta({ invoking: "正在刷新 Skill 收录…", invoked: "Skill 收录已刷新" }),
    },
    async () => {
      if (!registry) {
        return {
          structuredContent: { skills: catalog.map(skillSummary), state: "pinned" },
          content: [{ type: "text", text: "当前运行时使用固定 catalog。" }],
        };
      }
      const result = await registry.refresh();
      featuredEntries = registry.catalogEntries();
      await refreshCatalog();
      const labels = {
        updated: "已拉到新的收录",
        cold: "已首次拉取收录",
        revalidated: "收录已是最新",
        stale: "网络不可用，继续使用缓存",
        offline: "网络不可用，且没有缓存",
        seed: "离线模式，使用插件自带收录",
      };
      return {
        structuredContent: { skills: catalog.map(skillSummary), state: result.state },
        content: [{ type: "text", text: `${labels[result.state] || result.state}：共 ${catalog.length} 个 Skill。` }],
      };
    },
  );

  registerAppTool(
    server,
    tools.prepare,
    {
      title: "Prepare image generation",
      description:
        "Validate an Image Skill Studio draft, create an immutable run snapshot, and return the exact instruction that must be sent to the Codex agent as a follow-up message.",
      inputSchema: {
        skillId: z.string(),
        prompt: z.string(),
        aspectRatio: z.string().default("3:4"),
        clientRequestId: z.string().optional(),
        locale: z.string().optional(),
        references: z.array(referenceInput).max(3).default([]),
      },
      outputSchema: {
        run: z.record(z.string(), z.unknown()),
        instruction: z.string(),
      },
      annotations: { readOnlyHint: false, openWorldHint: false, destructiveHint: false, idempotentHint: true },
      _meta: toolMeta({ invoking: "正在准备 Codex 指令…", invoked: "Codex 指令已准备" }),
    },
    async ({ skillId, prompt, aspectRatio, clientRequestId, locale, references }) => {
      // Composing against a curated upstream Skill fetches it on first use, so
      // the agent always receives a real SKILL.md path to read.
      if (catalog.find((entry) => entry.id === skillId)?.needsFetch && registry) {
        const fetched = await registry.fetchSkill(skillId);
        if (fetched.ok) {
          featuredEntries = registry.catalogEntries();
          await refreshCatalog();
        }
      }

      const skill = catalog.find((entry) => entry.id === skillId);
      const validation = validateGenerationRequest({ skill, prompt, references, aspectRatio, locale });
      if (!validation.ok) {
        return {
          isError: true,
          content: [{ type: "text", text: validation.message }],
          structuredContent: { run: {}, instruction: "" },
        };
      }

      const snapshot = {
        skill: skillSummary(skill),
        prompt: prompt.trim(),
        aspectRatio,
        references: references.map((reference, index) => ({
          fileId: reference.file_id,
          downloadUrl: reference.download_url,
          fileName: reference.file_name || `reference-${index + 1}`,
          mimeType: reference.mime_type || "image/*",
          role: reference.role || "reference",
          order: index,
          primary: index === 0,
        })),
      };
      const run = await store.create({ clientRequestId: clientRequestId || randomUUID(), snapshot });
      const instruction = buildGenerationPrompt({
        runId: run.id,
        skill,
        prompt: run.snapshot.prompt,
        aspectRatio,
        references: run.snapshot.references,
        artifactDir: dataRoot,
        transport: "mcp-app",
        recordToolName: tools.record,
        locale,
      });
      return {
        structuredContent: { run, instruction },
        content: [{ type: "text", text: instruction }],
      };
    },
  );

  registerAppTool(
    server,
    tools.getRun,
    {
      title: "Get image generation run",
      description: "Read one Image Skill Studio generation result.",
      inputSchema: { runId: z.string() },
      outputSchema: { run: z.record(z.string(), z.unknown()).nullable() },
      annotations: { readOnlyHint: true, openWorldHint: false, destructiveHint: false },
      _meta: toolMeta({ invoking: "正在读取生成状态…", invoked: "生成状态已更新" }),
    },
    async ({ runId }) => {
      await store.expireStale({ timeoutMs: handoffTimeoutMs });
      return {
        structuredContent: { run: await store.get(runId) },
        content: [{ type: "text", text: `已读取 ${runId}。` }],
      };
    },
  );

  registerAppTool(
    server,
    tools.record,
    {
      title: "Record generated image",
      description:
        "Called by the Codex agent only after image_gen produces a real image. Store that artifact against the prepared run. Do not call this tool when generation fails.",
      inputSchema: {
        runId: z.string(),
        status: z.enum(["succeeded", "failed", "cancelled"]),
        image: referenceInput.optional(),
        savedPath: z.string().optional(),
        summary: z.string().optional(),
        error: z.string().optional(),
      },
      outputSchema: { run: z.record(z.string(), z.unknown()) },
      annotations: { readOnlyHint: false, openWorldHint: false, destructiveHint: false, idempotentHint: true },
      _meta: {
        ...toolMeta({
          render: true,
          resourceUri: identity.resourceUri,
          invoking: "正在收录生成图片…",
          invoked: "生成图片已收录",
        }),
        "openai/fileParams": ["image"],
      },
    },
    async ({ runId, status, image, savedPath, summary, error }) => {
      const current = await store.get(runId);
      if (!current) {
        return { isError: true, structuredContent: { run: {} }, content: [{ type: "text", text: `找不到 ${runId}。` }] };
      }
      if (status !== "succeeded") {
        return {
          structuredContent: { skills: catalog.map(skillSummary), runs: await store.listPublished(), run: {} },
          content: [{ type: "text", text: "生成失败不收录。" }],
        };
      }
      const artifacts = savedPath
        ? [await persistSavedArtifact({ savedPath, runId, dataRoot, artifactRoots })]
        : image
        ? [{
            id: image.file_id,
            fileId: image.file_id,
            downloadUrl: image.download_url,
            fileName: image.file_name || `${runId}.png`,
            mimeType: image.mime_type || "image/png",
          }]
        : [];
      const run = await store.complete(runId, { status, artifacts, summary, error });
      if (!isPublishedRun(run)) {
        return {
          structuredContent: { skills: catalog.map(skillSummary), runs: await store.listPublished(), run: {} },
          content: [{ type: "text", text: "生成失败不收录。" }],
        };
      }
      for (const artifact of run.artifacts || []) registerArtifactResource(artifact);
      const runs = await store.listPublished();
      return {
        structuredContent: { run, skills: catalog.map(skillSummary), runs },
        content: [{ type: "text", text: `图片已记录到 ${runId}。` }],
      };
    },
  );

  return server;
}

export async function writeDefaultOutputSchema(runDir, schema) {
  await mkdir(runDir, { recursive: true });
  const outputPath = path.join(runDir, "output-schema.json");
  await writeFile(outputPath, `${JSON.stringify(schema, null, 2)}\n`);
  return outputPath;
}
