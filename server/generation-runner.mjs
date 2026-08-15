import path from "node:path";

import { buildGenerationPrompt } from "../lib/agent-command.mjs";
import { CodexAppClient } from "./codex-app-client.mjs";

function artifactFromImage(image, index, runId) {
  const savedPath = image?.savedPath;
  const dataUrl = !savedPath && image?.result ? `data:image/png;base64,${image.result}` : undefined;
  if (!savedPath && !dataUrl) return null;
  return {
    id: image.id || `artifact-${index + 1}`,
    savedPath,
    dataUrl,
    fileName: savedPath ? path.basename(savedPath) : `${runId}.png`,
    mimeType: "image/png",
  };
}

export function createCodexGenerationRunner({
  clientFactory = () => new CodexAppClient(),
  projectRoot = process.cwd(),
} = {}) {
  return async ({ run, skill, prompt, references = [], aspectRatio, onEvent }) => {
    const client = clientFactory();
    try {
      await onEvent?.({ type: "imagegen_started", label: "ImageGen 正在生成", status: "imagegen_running" });
      const result = await client.startImageGeneration({
        text: buildGenerationPrompt({
          runId: run.id,
          skill,
          prompt,
          references,
          aspectRatio,
          artifactDir: projectRoot,
          transport: "local",
        }),
        cwd: projectRoot,
        skill: skill?.skillPath ? { name: skill.id, path: skill.skillPath } : undefined,
        localImages: references
          .map((reference) => reference.path)
          .filter(Boolean)
          .map((imagePath) => ({ path: imagePath })),
        onEvent: (event) => onEvent?.({ type: event.method, label: event.method }),
      });
      const artifacts = (result.images || [])
        .map((image, index) => artifactFromImage(image, index, run.id))
        .filter(Boolean);
      if (!artifacts.length) {
        return { status: "failed", error: "Codex image generation did not return an artifact" };
      }
      return { status: "succeeded", artifacts, summary: "done" };
    } finally {
      client.close?.();
    }
  };
}
