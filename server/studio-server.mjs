import { randomUUID } from "node:crypto";
import { copyFile, mkdir, readFile, realpath, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { registerAppResource, registerAppTool, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { buildGenerationPrompt, validateGenerationRequest } from "../lib/agent-command.mjs";
import { loadSkillCatalog } from "../lib/skill-catalog.mjs";
import { DEFAULT_CATALOG_ENTRIES, DEFAULT_RUN_SEEDS } from "./catalog-config.mjs";
import { RunStore } from "./run-store.mjs";

export const STUDIO_RESOURCE_URI = "ui://image-skill-studio/v1/workbench.html";

const referenceInput = z.object({
  download_url: z.string(),
  file_id: z.string(),
  mime_type: z.string().optional(),
  file_name: z.string().optional(),
  role: z.enum(["subject", "style", "composition", "reference"]).optional(),
});

function toolMeta({ resource = false, invoking, invoked, visibility }) {
  const meta = {
    "openai/toolInvocation/invoking": invoking,
    "openai/toolInvocation/invoked": invoked,
    ui: { visibility: visibility || ["model", "app"] },
  };
  if (resource) {
    meta.ui.resourceUri = STUDIO_RESOURCE_URI;
    meta["openai/outputTemplate"] = STUDIO_RESOURCE_URI;
    meta["openai/widgetAccessible"] = true;
  }
  return meta;
}

function skillSummary(skill) {
  return {
    id: skill.id,
    displayName: skill.displayName,
    description: skill.description,
    category: skill.category,
    accent: skill.accent,
    source: skill.source,
    version: skill.version,
    contentHash: skill.contentHash,
    skillPath: skill.skillPath,
    previewResourceUri: skill.previewPath ? `image-skill-studio://previews/${encodeURIComponent(skill.id)}` : undefined,
    examples: (skill.examples || []).map((example) => ({
      id: example.id,
      prompt: example.prompt,
      aspectRatio: example.aspectRatio,
      previewResourceUri: example.previewPath
        ? `image-skill-studio://examples/${encodeURIComponent(skill.id)}/${encodeURIComponent(example.id)}`
        : undefined,
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
  return "image/png";
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
  dataRoot = process.env.PLUGIN_DATA || path.join(os.homedir(), ".codex", "image-skill-studio"),
  widgetHtml,
  catalogEntries = DEFAULT_CATALOG_ENTRIES,
  runSeeds = catalogEntries === DEFAULT_CATALOG_ENTRIES ? DEFAULT_RUN_SEEDS : [],
  generationRunner,
  artifactRoots = [
    path.join(process.env.CODEX_HOME || path.join(os.homedir(), ".codex"), "generated_images"),
    dataRoot,
  ],
} = {}) {
  const catalog = await loadSkillCatalog(catalogEntries);
  const store = new RunStore(dataRoot);
  await store.load();
  await store.seedIfEmpty(runSeeds.flatMap((seed) => {
    const skill = catalog.find((entry) => entry.id === seed.skillId);
    if (!skill) return [];
    const createdAt = seed.createdAt || new Date().toISOString();
    const id = `seed-${seed.skillId}-${seed.id}`;
    const artifactId = `seed-artifact-${seed.skillId}-${seed.id}`;
    return [{
      id,
      clientRequestId: id,
      status: "succeeded",
      createdAt,
      updatedAt: createdAt,
      snapshot: {
        skill: skillSummary(skill),
        prompt: seed.prompt,
        aspectRatio: seed.aspectRatio,
        references: [],
      },
      events: [{ type: "succeeded", label: "生成完成", at: createdAt }],
      artifacts: [{
        id: artifactId,
        fileName: path.basename(seed.artifactPath),
        mimeType: imageMimeType(seed.artifactPath),
        resourceUri: `image-skill-studio://runs/${encodeURIComponent(seed.skillId)}/${encodeURIComponent(seed.id)}`,
        savedPath: seed.artifactPath,
      }],
      error: null,
      summary: seed.summary || null,
    }];
  }));
  const server = new McpServer(
    { name: "image-skill-studio", version: "0.1.0" },
    {
      instructions:
        "Use open_image_skill_studio to render the two-route image Skill app. The app hands immutable image work to Codex and groups the resulting images by Skill.",
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
  for (const run of await store.list()) {
    for (const artifact of run.artifacts || []) registerArtifactResource(artifact);
  }

  for (const skill of catalog.filter((entry) => entry.previewPath)) {
    const uri = `image-skill-studio://previews/${encodeURIComponent(skill.id)}`;
    const mimeType = imageMimeType(skill.previewPath);
    server.registerResource(
      `image-skill-preview-${skill.id}`,
      uri,
      { title: `${skill.displayName} preview`, mimeType },
      async () => ({
        contents: [{
          uri,
          mimeType,
          blob: (await readFile(skill.previewPath)).toString("base64"),
        }],
      }),
    );
  }

  for (const skill of catalog) {
    for (const example of (skill.examples || []).filter((entry) => entry.previewPath)) {
      const uri = `image-skill-studio://examples/${encodeURIComponent(skill.id)}/${encodeURIComponent(example.id)}`;
      const mimeType = imageMimeType(example.previewPath);
      server.registerResource(
        `image-skill-example-${skill.id}-${example.id}`,
        uri,
        { title: `${skill.displayName} example`, mimeType },
        async () => ({
          contents: [{
            uri,
            mimeType,
            blob: (await readFile(example.previewPath)).toString("base64"),
          }],
        }),
      );
    }
  }

  registerAppResource(
    server,
    "image-skill-studio-workbench",
    STUDIO_RESOURCE_URI,
    { mimeType: RESOURCE_MIME_TYPE },
    async () => ({
      contents: [
        {
          uri: STUDIO_RESOURCE_URI,
          mimeType: RESOURCE_MIME_TYPE,
          text: widgetHtml,
          _meta: {
            ui: { prefersBorder: false },
            "openai/widgetDescription": "Codex 生图侧栏：Feed 展示生成记录与 Skill 示例，Skill 详情负责 handoff、结果与小红书导出。",
            "openai/widgetPrefersBorder": false,
          },
        },
      ],
    }),
  );

  registerAppTool(
    server,
    "open_image_skill_studio",
    {
      title: "Open Image Skill Studio",
      description: "Open the interactive image generation Skill workbench and show recent generation runs.",
      inputSchema: {},
      outputSchema: {
        skills: z.array(z.record(z.string(), z.unknown())),
        runs: z.array(z.record(z.string(), z.unknown())),
      },
      annotations: { readOnlyHint: true, openWorldHint: false, destructiveHint: false },
      _meta: toolMeta({ resource: true, invoking: "正在打开生图工作台…", invoked: "生图工作台已打开" }),
    },
    async () => {
      const runs = await store.list();
      return {
        structuredContent: { skills: catalog.map(skillSummary), runs },
        content: [{ type: "text", text: `已载入 ${catalog.filter((skill) => skill.availability === "ready").length} 个可用生图 Skill。` }],
      };
    },
  );

  registerAppTool(
    server,
    "run_prepared_image_generation",
    {
      title: "Hand off prepared image work to Codex",
      description:
        "Start the immutable prepared run with Codex. This app-only action returns immediately; the finished image is collected under its Skill.",
      inputSchema: { runId: z.string() },
      outputSchema: { run: z.record(z.string(), z.unknown()) },
      annotations: { readOnlyHint: false, openWorldHint: false, destructiveHint: false, idempotentHint: true },
      _meta: toolMeta({ visibility: ["app"], invoking: "正在 hand off 给 Codex…", invoked: "Codex 已接手" }),
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
    "mark_image_generation_handoff",
    {
      title: "Mark image generation handoff",
      description: "Record that ui/message handed a prepared run to the current Codex agent.",
      inputSchema: { runId: z.string() },
      outputSchema: { run: z.record(z.string(), z.unknown()) },
      annotations: { readOnlyHint: false, openWorldHint: false, destructiveHint: false, idempotentHint: true },
      _meta: toolMeta({ visibility: ["app"], invoking: "正在记录 handoff…", invoked: "Handoff 已记录" }),
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
    "list_image_skills",
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
    "prepare_image_generation",
    {
      title: "Prepare image generation",
      description:
        "Validate an Image Skill Studio draft, create an immutable run snapshot, and return the exact instruction that must be sent to the Codex agent as a follow-up message.",
      inputSchema: {
        skillId: z.string(),
        prompt: z.string(),
        aspectRatio: z.string().default("3:4"),
        clientRequestId: z.string().optional(),
        references: z.array(referenceInput).max(3).default([]),
      },
      outputSchema: {
        run: z.record(z.string(), z.unknown()),
        instruction: z.string(),
      },
      annotations: { readOnlyHint: false, openWorldHint: false, destructiveHint: false, idempotentHint: true },
      _meta: {
        ...toolMeta({ visibility: ["app"], invoking: "正在准备 Codex 指令…", invoked: "Codex 指令已准备" }),
        "openai/fileParams": ["references"],
        ui: { visibility: ["app"] },
      },
    },
    async ({ skillId, prompt, aspectRatio, clientRequestId, references }) => {
      const skill = catalog.find((entry) => entry.id === skillId);
      const validation = validateGenerationRequest({ skill, prompt, references, aspectRatio });
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
      });
      return {
        structuredContent: { run, instruction },
        content: [{ type: "text", text: instruction }],
      };
    },
  );

  registerAppTool(
    server,
    "get_image_generation_run",
    {
      title: "Get image generation run",
      description: "Read one Image Skill Studio generation result.",
      inputSchema: { runId: z.string() },
      outputSchema: { run: z.record(z.string(), z.unknown()).nullable() },
      annotations: { readOnlyHint: true, openWorldHint: false, destructiveHint: false },
      _meta: toolMeta({ visibility: ["app"], invoking: "正在读取生成状态…", invoked: "生成状态已更新" }),
    },
    async ({ runId }) => ({
      structuredContent: { run: await store.get(runId) },
      content: [{ type: "text", text: `已读取 ${runId}。` }],
    }),
  );

  registerAppTool(
    server,
    "record_image_generation",
    {
      title: "Record generated image",
      description:
        "Called by the Codex agent after image_gen finishes. Store the real image artifact against the prepared run so the right sidebar can display it.",
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
        ...toolMeta({ invoking: "正在收录生成图片…", invoked: "生成图片已收录" }),
        "openai/fileParams": ["image"],
      },
    },
    async ({ runId, status, image, savedPath, summary, error }) => {
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
      for (const artifact of run.artifacts || []) registerArtifactResource(artifact);
      return {
        structuredContent: { run },
        content: [{ type: "text", text: run.status === "succeeded" ? `图片已记录到 ${runId}。` : `${runId} 未生成图片。` }],
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
