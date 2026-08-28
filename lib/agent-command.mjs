import path from "node:path";

import { studioCopy } from "./studio-copy.mjs";

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

function isImagegenSkill(skill) {
  return skill?.id === "imagegen" || /(?:^|\/)\.system\/imagegen\/SKILL\.md$/.test(skill?.skillPath || "");
}

function handoffCopy(locale) {
  return studioCopy(locale == null || String(locale).trim() === "" ? "zh" : locale);
}

export function validateGenerationRequest({ skill, prompt, references = [], aspectRatio, locale }) {
  const copy = handoffCopy(locale);
  if (!skill || skill.availability !== "ready") {
    return { ok: false, field: "skill", message: copy.validation.skillUnavailable };
  }
  if (!String(prompt || "").trim()) {
    return { ok: false, field: "prompt", message: copy.validation.emptyPrompt };
  }
  if (references.length && !skill.capabilities.references) {
    return { ok: false, field: "references", message: copy.validation.referencesUnsupported };
  }
  if (references.length > skill.capabilities.maxReferences) {
    return {
      ok: false,
      field: "references",
      message: copy.validation.tooManyReferences(skill.capabilities.maxReferences),
    };
  }
  if (!skill.capabilities.aspectRatios.includes(aspectRatio)) {
    return { ok: false, field: "aspectRatio", message: copy.validation.unsupportedRatio };
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
  recordToolName = "record_image_generation",
  locale,
}) {
  const copy = handoffCopy(locale);
  const referenceText = references.length
    ? references
        .map((reference, index) =>
          copy.handoff.referenceItem(
            index + 1,
            reference.path || reference.fileId || "attached image",
            reference.role || "reference",
          ),
        )
        .join("\n")
    : copy.handoff.noReferences;
  const hashNote = skill.contentHash && !isImagegenSkill(skill)
    ? copy.handoff.contentHash(skill.contentHash)
    : "";
  const method = isImagegenSkill(skill)
    ? copy.handoff.renderGuidance
    : `${copy.handoff.creativeMethod(skill.id, skill.skillPath, hashNote)}\n${copy.handoff.renderGuidance}`;
  const completion = transport === "mcp-app"
    ? copy.handoff.recordSuccess(recordToolName, runId)
    : copy.handoff.saveToDir(artifactDir);

  return [
    copy.handoff.intro,
    "",
    method,
    "",
    copy.handoff.runId(runId),
    copy.handoff.scene(String(prompt).trim()),
    copy.handoff.ratio(aspectRatio),
    copy.handoff.referencesHeading,
    referenceText,
    "",
    completion,
    copy.handoff.keepScope,
  ].join("\n");
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
