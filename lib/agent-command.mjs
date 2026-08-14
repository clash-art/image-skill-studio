import path from "node:path";

export const GENERATION_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    status: { type: "string", enum: ["succeeded", "failed"] },
    summary: { type: "string" },
    artifactPaths: { type: "array", items: { type: "string" } },
    error: { type: ["string", "null"] },
  },
  required: ["status", "summary", "artifactPaths", "error"],
};

export function validateGenerationRequest({ skill, prompt, references = [], aspectRatio }) {
  if (!skill || skill.availability !== "ready") {
    return { ok: false, field: "skill", message: "这个 Skill 当前不可用，请刷新或换一个。" };
  }
  if (!String(prompt || "").trim()) {
    return { ok: false, field: "prompt", message: "先写下你想生成的画面。" };
  }
  if (references.length && !skill.capabilities.references) {
    return { ok: false, field: "references", message: "这个 Skill 不接受参考图。" };
  }
  if (references.length > skill.capabilities.maxReferences) {
    return {
      ok: false,
      field: "references",
      message: `最多添加 ${skill.capabilities.maxReferences} 张参考图。`,
    };
  }
  if (!skill.capabilities.aspectRatios.includes(aspectRatio)) {
    return { ok: false, field: "aspectRatio", message: "这个 Skill 不支持所选比例。" };
  }
  return { ok: true };
}

export function buildGenerationPrompt({
  runId,
  skill,
  prompt,
  references = [],
  aspectRatio,
  artifactDir,
  transport = "local",
}) {
  const referenceText = references.length
    ? references
        .map((reference, index) => `${index + 1}. ${reference.path || reference.fileId || "attached image"}（角色：${reference.role || "reference"}）`)
        .join("\n")
    : "无参考图。";
  const completion = transport === "mcp-app"
    ? `生成成功后，调用本插件的 record_image_generation 工具，传入 runId "${runId}"、status "succeeded"，并优先把 image_gen 返回的实际绝对路径作为 savedPath 传入；如果宿主只提供文件对象，则把产物作为 image 文件参数传入。如果生成失败，也必须用相同 runId 记录 failed 和错误信息。`
    : `把最终图片保存到目录 ${artifactDir}。只把实际存在的绝对文件路径写入最终 JSON 的 artifactPaths；不可虚构路径。`;

  return `你正在执行 Image Skill Studio 的一次图片生成任务。\n\n` +
    `必须使用 \`$${skill.id}\` Skill。先完整读取精确快照 ${skill.skillPath}（内容哈希 ${skill.contentHash}），严格遵循它的创作方法，然后调用 image_gen 生成 1 张最终图片。\n\n` +
    `Run ID：${runId}\n` +
    `画面要求：${String(prompt).trim()}\n` +
    `输出比例：${aspectRatio}\n` +
    `参考图：\n${referenceText}\n\n` +
    `${completion}\n` +
    `不要修改项目源代码，不要改写用户提示词，不要用其他生图工具代替 image_gen。`;
}

export function buildCodexInvocation({
  projectRoot,
  prompt,
  references = [],
  outputSchemaPath,
  finalMessagePath,
}) {
  const cwd = path.resolve(projectRoot);
  const args = [
    "exec",
    "--json",
    "--skip-git-repo-check",
    "--sandbox",
    "workspace-write",
    "--ask-for-approval",
    "never",
    "--cd",
    cwd,
    "--output-schema",
    outputSchemaPath,
    "--output-last-message",
    finalMessagePath,
  ];
  for (const reference of references) {
    args.push("--image", reference.path);
  }
  args.push("-");
  return { command: "codex", args, cwd, stdin: prompt };
}
