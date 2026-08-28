import { App, PostMessageTransport } from "@modelcontextprotocol/ext-apps";
import { createRoot } from "react-dom/client";

import {
  ImageSkillStudio,
  type StudioBridge,
  type StudioSnapshot,
} from "../components/image-skill-studio";
import { mapWithConcurrency } from "../lib/async-pool.mjs";
import { WORKBENCH_DISPLAY_MODES } from "../lib/display-mode.mjs";
import { applyStudioHostAppearance } from "../lib/studio-host-appearance.mjs";
import { applyStoredStudioAppearance } from "../lib/studio-preferences.mjs";
import { STABLE_STUDIO_TOOLS } from "../lib/studio-identity.mjs";
import { isPublishedRun } from "../lib/published-run.mjs";
import { applyStudioToolResult } from "../lib/studio-tool-result.mjs";
import "./widget.css";

declare global {
  interface Window {
    __IMAGE_SKILL_STUDIO__?: {
      edition?: string;
      displayName?: string;
      tools?: Partial<typeof STABLE_STUDIO_TOOLS>;
      resourceUri?: string;
    };
    openai?: {
      toolOutput?: StudioSnapshot;
      displayMode?: "inline" | "fullscreen" | "pip";
      callTool?: (name: string, args: Record<string, unknown>) => Promise<unknown>;
      sendFollowUpMessage?: (params: { prompt: string }) => Promise<{ isError?: boolean }>;
      requestDisplayMode?: (params: { mode: "inline" | "fullscreen" | "pip" }) => Promise<{ mode?: "inline" | "fullscreen" | "pip" }>;
      uploadFile?: (file: File, options?: { library?: boolean }) => Promise<{ fileId: string }>;
      getFileDownloadUrl?: (params: { fileId: string }) => Promise<{ downloadUrl: string }>;
    };
  }
}

const emptyState: StudioSnapshot = { skills: [], runs: [] };
applyStoredStudioAppearance();
const embedded = window.parent !== window;
const studioTools = { ...STABLE_STUDIO_TOOLS, ...window.__IMAGE_SKILL_STUDIO__?.tools };
const app = embedded
  ? new App(
      { name: window.__IMAGE_SKILL_STUDIO__?.displayName || "Image Skill Studio", version: "0.1.0" },
      { availableDisplayModes: WORKBENCH_DISPLAY_MODES },
      { strict: true, autoResize: true },
    )
  : null;
let appReady = false;

const initialToolOutput = window.openai?.toolOutput;
let currentState = initialToolOutput ?? emptyState;
const listeners = new Set<(snapshot: Partial<StudioSnapshot>) => void>();
let resolvingMedia = false;

function structured<T>(value: unknown): T {
  const result = value as { structuredContent?: T } | undefined;
  if (!result?.structuredContent) throw new Error("MCP 工具没有返回 structuredContent。");
  return result.structuredContent;
}

function publish(next: Partial<StudioSnapshot> & { run?: StudioSnapshot["runs"][number] }) {
  currentState = applyStudioToolResult(currentState, next);
  for (const listener of listeners) listener(currentState);
  if (appReady) void resolveMediaResources();
}

async function readImageResource(uri: string) {
  const result = await app!.readServerResource({ uri });
  const content = result.contents[0] as { blob?: string; mimeType?: string } | undefined;
  return content?.blob ? `data:${content.mimeType || "image/png"};base64,${content.blob}` : null;
}

const MEDIA_READ_CONCURRENCY = 6;

async function resolveMediaResources() {
  if (!app || !appReady || resolvingMedia) return;
  const unresolvedSkills = currentState.skills.filter((skill) => !skill.preview && skill.previewResourceUri);
  const unresolvedExamples = currentState.skills.flatMap((skill) =>
    [
      ...(skill.examples || []).map((slot) => ({ kind: "example" as const, slot })),
      ...(skill.gallery || []).map((slot) => ({ kind: "gallery" as const, slot })),
    ]
      .filter(({ slot }) => !slot.preview && slot.previewResourceUri)
      .map(({ kind, slot }) => ({ skillId: skill.id, kind, exampleId: slot.id, uri: slot.previewResourceUri! })),
  );
  const unresolvedReferences = currentState.skills.flatMap((skill) =>
    (skill.examples || [])
      .filter((slot) => !slot.referencePreview && slot.referenceResourceUri)
      .map((slot) => ({ skillId: skill.id, exampleId: slot.id, uri: slot.referenceResourceUri! })),
  );
  const unresolvedArtifacts = currentState.runs.flatMap((run) =>
    (run.artifacts || [])
      .filter((artifact) => !artifact.dataUrl && !artifact.downloadUrl && artifact.resourceUri)
      .map((artifact) => ({ runId: run.id, artifactId: artifact.id, uri: artifact.resourceUri! })),
  );
  if (!unresolvedSkills.length && !unresolvedExamples.length && !unresolvedReferences.length && !unresolvedArtifacts.length) return;
  resolvingMedia = true;
  try {
    const previews = new Map<string, string>();
    const examples = new Map<string, string>();
    const references = new Map<string, string>();
    const artifacts = new Map<string, string>();
    await mapWithConcurrency(unresolvedSkills, MEDIA_READ_CONCURRENCY, async (skill) => {
      try {
        const image = await readImageResource(skill.previewResourceUri!);
        if (image) previews.set(skill.id, image);
      } catch {
        // A missing demo image should not make the Skill unavailable.
      }
    });
    await mapWithConcurrency(unresolvedExamples, MEDIA_READ_CONCURRENCY, async ({ skillId, kind, exampleId, uri }) => {
      try {
        const image = await readImageResource(uri);
        if (image) examples.set(`${skillId}:${kind}:${exampleId}`, image);
      } catch {
        // Examples are optional curation, not a blocker for generation.
      }
    });
    await mapWithConcurrency(unresolvedReferences, MEDIA_READ_CONCURRENCY, async ({ skillId, exampleId, uri }) => {
      try {
        const image = await readImageResource(uri);
        if (image) references.set(`${skillId}:${exampleId}`, image);
      } catch {
        // A missing source reference disables Remix seeding but not browsing.
      }
    });
    await mapWithConcurrency(unresolvedArtifacts, MEDIA_READ_CONCURRENCY, async ({ runId, artifactId, uri }) => {
      try {
        const image = await readImageResource(uri);
        if (image) artifacts.set(`${runId}:${artifactId || uri}`, image);
      } catch {
        // Keep the result card available even when one artifact cannot be read.
      }
    });
    if (previews.size || examples.size || references.size || artifacts.size) {
      const skills = currentState.skills.map((skill) => ({
        ...skill,
        preview: previews.get(skill.id) ?? skill.preview,
        examples: (skill.examples || []).map((example) => ({
          ...example,
          preview: examples.get(`${skill.id}:example:${example.id}`) ?? example.preview,
          referencePreview: references.get(`${skill.id}:${example.id}`) ?? example.referencePreview,
        })),
        gallery: (skill.gallery || []).map((item) => ({
          ...item,
          preview: examples.get(`${skill.id}:gallery:${item.id}`) ?? item.preview,
        })),
      }));
      const runs = currentState.runs.map((run) => ({
        ...run,
        artifacts: (run.artifacts || []).map((artifact) => {
          const key = `${run.id}:${artifact.id || artifact.resourceUri}`;
          return artifacts.has(key) ? { ...artifact, dataUrl: artifacts.get(key) } : artifact;
        }),
      }));
      currentState = { skills, runs };
      for (const listener of listeners) listener({ skills, runs });
    }
  } finally {
    resolvingMedia = false;
  }
}

function errorDetail(error: unknown) {
  if (error && typeof error === "object" && "message" in error) return String((error as { message: unknown }).message);
  return String(error);
}

function toolResultError(name: string, value: unknown) {
  const result = value as { isError?: boolean; content?: Array<{ text?: string }> } | undefined;
  if (!result?.isError) return null;
  return result.content?.find((entry) => entry.text)?.text || `${name} 失败。`;
}

async function callTool<T>(name: string, args: Record<string, unknown>) {
  const failures: string[] = [];
  // Codex still implements the Apps SDK alias more completely than tools/call proxying.
  if (window.openai?.callTool) {
    try {
      const result = await window.openai.callTool(name, args);
      const failed = toolResultError(name, result);
      if (failed) throw Object.assign(new Error(failed), { toolLogic: true });
      return structured<T>(result);
    } catch (error) {
      if (error && typeof error === "object" && "toolLogic" in error) throw error;
      failures.push(`callTool: ${errorDetail(error)}`);
    }
  }
  if (app && appReady) {
    try {
      const result = await app.callServerTool({ name, arguments: args });
      const failed = toolResultError(name, result);
      if (failed) throw Object.assign(new Error(failed), { toolLogic: true });
      return structured<T>(result);
    } catch (error) {
      if (error && typeof error === "object" && "toolLogic" in error) throw error;
      failures.push(`tools/call: ${errorDetail(error)}`);
    }
  }
  if (failures.length) throw new Error(`${name} 失败：${failures.join("；")}`);
  throw new Error("当前页面不在支持 MCP Apps 的宿主中。");
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("无法读取参考图。"));
    reader.readAsDataURL(file);
  });
}

async function blobToBase64(blob: Blob) {
  const dataUrl = await fileToDataUrl(new File([blob], "export.png", { type: blob.type }));
  return dataUrl.slice(dataUrl.indexOf(",") + 1);
}

const bridge: StudioBridge = {
  async exportFile(blob, filename) {
    if (app && appReady) {
      const result = await app.downloadFile({
        contents: [{
          type: "resource",
          resource: {
            uri: `file:///${encodeURIComponent(filename)}`,
            mimeType: blob.type || "image/png",
            blob: await blobToBase64(blob),
          },
        }],
      });
      if (result.isError) throw new Error("宿主取消了导出。");
      return;
    }
    const link = document.createElement("a");
    link.download = filename;
    link.href = URL.createObjectURL(blob);
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1_000);
  },

  async refresh() {
    const next = await callTool<{ skills: StudioSnapshot["skills"] }>(studioTools.listSkills, {});
    const snapshot = { skills: next.skills, runs: currentState.runs };
    publish(snapshot);
    return snapshot;
  },

  async registerSkill(input) {
    const next = await callTool<{ skills: StudioSnapshot["skills"]; skill?: StudioSnapshot["skills"][number] }>(
      studioTools.registerSkill,
      { sourcePath: input.sourcePath, overwrite: Boolean(input.overwrite) },
    );
    publish({ skills: next.skills });
    return next;
  },

  async installSkill(input) {
    const next = await callTool<{ skills: StudioSnapshot["skills"]; destination?: string }>(
      studioTools.installSkill,
      { skillId: input.skillId, overwrite: Boolean(input.overwrite) },
    );
    publish({ skills: next.skills });
    return next;
  },

  async uploadFile(file) {
    const dataUrl = await fileToDataUrl(file);
    if (window.openai?.uploadFile && window.openai?.getFileDownloadUrl) {
      const uploaded = await window.openai.uploadFile(file, { library: false });
      const resolved = await window.openai.getFileDownloadUrl({ fileId: uploaded.fileId });
      return {
        file_id: uploaded.fileId,
        download_url: resolved.downloadUrl,
        preview_url: dataUrl,
        data_url: dataUrl,
        file_name: file.name,
        mime_type: file.type || "image/png",
        role: "reference",
      };
    }
    return {
      file_id: `inline-${crypto.randomUUID()}`,
      download_url: dataUrl,
      preview_url: dataUrl,
      data_url: dataUrl,
      file_name: file.name,
      mime_type: file.type || "image/png",
      role: "reference",
    };
  },

  async generate(input) {
    const prepared = await callTool<{ run: StudioSnapshot["runs"][number]; instruction: string }>(
      studioTools.prepare,
      {
        skillId: input.skillId,
        prompt: input.prompt,
        aspectRatio: input.aspectRatio,
        clientRequestId: input.clientRequestId,
        locale: document.documentElement.dataset.locale || document.documentElement.lang,
        ...(input.references.length
          ? {
              references: input.references.map((reference) => ({
                download_url: reference.download_url,
                file_id: reference.file_id,
                file_name: reference.file_name,
                mime_type: reference.mime_type,
                role: reference.role,
              })),
            }
          : {}),
      },
    );
    return { ...prepared, dispatchMode: "host_message" };
  },

  async sendInstruction(instruction, context) {
    const failures: string[] = [];
    let response: { isError?: boolean } | undefined;

    if (app && appReady) {
      try {
        // Codex ui/message currently accepts user text. Reference images are already
        // named in the prepared instruction; extra image blocks trip the MCP proxy.
        response = await app.sendMessage({
          role: "user",
          content: [{ type: "text", text: instruction }],
        });
      } catch (error) {
        failures.push(`ui/message: ${errorDetail(error)}`);
        response = { isError: true };
      }
    }

    if ((!response || response.isError) && window.openai?.sendFollowUpMessage) {
      try {
        response = await window.openai.sendFollowUpMessage({ prompt: instruction });
      } catch (error) {
        failures.push(`sendFollowUpMessage: ${errorDetail(error)}`);
        response = { isError: true };
      }
    }

    if (response && !response.isError && context?.runId) {
      try {
        await callTool(studioTools.markHandoff, {
          runId: context.runId,
        });
      } catch {
        // ui/message was accepted; a later successful record inserts the work.
      }
      return response;
    }

    if (!app && !window.openai?.sendFollowUpMessage && context?.runId) {
      await callTool(studioTools.runPrepared, {
        runId: context.runId,
      });
      return { isError: false };
    }

    throw new Error(failures.length ? `无法 hand off 给 Codex：${failures.join("；")}` : "宿主不支持 ui/message，无法 hand off 给 Codex。");
  },

  async getRun(runId) {
    const result = await callTool<{ run: StudioSnapshot["runs"][number] | null }>(studioTools.getRun, { runId });
    if (result.run && isPublishedRun(result.run)) publish({ run: result.run });
    return result.run;
  },

  requestFullscreen() {
    return adoptWorkbenchSurface();
  },

  subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

if (app) {
  app.ontoolresult = (result) => {
    const next = applyStudioToolResult(currentState, result.structuredContent);
    if (next !== currentState) publish(next);
  };
  app.onhostcontextchanged = (context) => {
    applyStudioHostAppearance(context);
  };
}

const root = createRoot(document.getElementById("studio-root")!);
root.render(<ImageSkillStudio initialState={currentState} bridge={bridge} initialLoading={!initialToolOutput} />);

function currentDisplayMode() {
  return window.openai?.displayMode
    || app?.getHostContext()?.displayMode
    || document.documentElement.dataset.displayMode
    || "inline";
}

function applyDisplayMode(mode: string) {
  document.documentElement.dataset.displayMode = mode;
}

async function requestFullscreenFromHost() {
  if (window.openai?.requestDisplayMode) {
    try {
      const result = await window.openai.requestDisplayMode({ mode: "fullscreen" });
      if (result?.mode) {
        applyDisplayMode(result.mode);
        if (result.mode === "fullscreen") return result.mode;
      }
    } catch {
      // Codex may still honor the MCP Apps request below.
    }
  }
  if (app && appReady) {
    try {
      const result = await app.requestDisplayMode({ mode: "fullscreen" });
      applyDisplayMode(result.mode);
      return result.mode;
    } catch {
      applyDisplayMode(currentDisplayMode());
    }
  }
  return currentDisplayMode();
}

let adoptingSurface = false;
let gestureArmed = false;

function armGestureFullscreen() {
  if (gestureArmed || currentDisplayMode() === "fullscreen") return;
  gestureArmed = true;
  const promote = () => {
    window.removeEventListener("pointerdown", promote, true);
    gestureArmed = false;
    void adoptWorkbenchSurface();
  };
  window.addEventListener("pointerdown", promote, true);
}

async function adoptWorkbenchSurface() {
  if (adoptingSurface) return;
  adoptingSurface = true;
  try {
    for (const delay of [0, 80, 240, 720]) {
      if (delay) await new Promise((resolve) => window.setTimeout(resolve, delay));
      const mode = await requestFullscreenFromHost();
      if (mode === "fullscreen") {
        gestureArmed = false;
        return mode;
      }
    }
    armGestureFullscreen();
    return currentDisplayMode();
  } finally {
    adoptingSurface = false;
  }
}

if (app) {
  app.connect(new PostMessageTransport(window.parent, window.parent))
    .then(async () => {
      appReady = true;
      applyStudioHostAppearance(app.getHostContext() || {});
      await adoptWorkbenchSurface();
      void resolveMediaResources();
    })
    .catch((error) => {
      console.error("MCP App handshake failed; using window.openai compatibility bridge", error);
      void adoptWorkbenchSurface();
    });
} else {
  void adoptWorkbenchSurface();
}
