import { App, PostMessageTransport } from "@modelcontextprotocol/ext-apps";
import { createRoot } from "react-dom/client";

import {
  ImageSkillStudio,
  type StudioBridge,
  type StudioFile,
  type StudioSnapshot,
} from "../components/image-skill-studio";
import "./widget.css";

declare global {
  interface Window {
    openai?: {
      toolOutput?: StudioSnapshot;
      callTool?: (name: string, args: Record<string, unknown>) => Promise<unknown>;
      sendFollowUpMessage?: (params: { prompt: string }) => Promise<{ isError?: boolean }>;
      uploadFile?: (file: File, options?: { library?: boolean }) => Promise<{ fileId: string }>;
      getFileDownloadUrl?: (params: { fileId: string }) => Promise<{ downloadUrl: string }>;
    };
  }
}

const emptyState: StudioSnapshot = { skills: [], runs: [] };
const embedded = window.parent !== window;
const app = embedded
  ? new App(
      { name: "Image Skill Studio", version: "0.1.0" },
      { availableDisplayModes: ["inline", "fullscreen"] },
      { strict: true, autoResize: true },
    )
  : null;
let appReady = false;

let currentState = window.openai?.toolOutput ?? emptyState;
const listeners = new Set<(snapshot: Partial<StudioSnapshot>) => void>();
let resolvingMedia = false;

function structured<T>(value: unknown): T {
  const result = value as { structuredContent?: T } | undefined;
  if (!result?.structuredContent) throw new Error("MCP 工具没有返回 structuredContent。");
  return result.structuredContent;
}

function publish(next: Partial<StudioSnapshot>) {
  currentState = {
    skills: next.skills?.length ? next.skills : currentState.skills,
    runs: next.runs ?? currentState.runs,
  };
  for (const listener of listeners) listener(next);
  if (appReady) void resolveMediaResources();
}

async function readImageResource(uri: string) {
  const result = await app!.readServerResource({ uri });
  const content = result.contents[0] as { blob?: string; mimeType?: string } | undefined;
  return content?.blob ? `data:${content.mimeType || "image/png"};base64,${content.blob}` : null;
}

async function resolveMediaResources() {
  if (!app || !appReady || resolvingMedia) return;
  const unresolvedSkills = currentState.skills.filter((skill) => !skill.preview && skill.previewResourceUri);
  const unresolvedExamples = currentState.skills.flatMap((skill) =>
    (skill.examples || [])
      .filter((example) => !example.preview && example.previewResourceUri)
      .map((example) => ({ skillId: skill.id, exampleId: example.id, uri: example.previewResourceUri! })),
  );
  const unresolvedArtifacts = currentState.runs.flatMap((run) =>
    (run.artifacts || [])
      .filter((artifact) => !artifact.dataUrl && !artifact.downloadUrl && artifact.resourceUri)
      .map((artifact) => ({ runId: run.id, artifactId: artifact.id, uri: artifact.resourceUri! })),
  );
  if (!unresolvedSkills.length && !unresolvedExamples.length && !unresolvedArtifacts.length) return;
  resolvingMedia = true;
  try {
    const previews = new Map<string, string>();
    const examples = new Map<string, string>();
    const artifacts = new Map<string, string>();
    await Promise.all(unresolvedSkills.map(async (skill) => {
      try {
        const image = await readImageResource(skill.previewResourceUri!);
        if (image) previews.set(skill.id, image);
      } catch {
        // A missing demo image should not make the Skill unavailable.
      }
    }));
    await Promise.all(unresolvedExamples.map(async ({ skillId, exampleId, uri }) => {
      try {
        const image = await readImageResource(uri);
        if (image) examples.set(`${skillId}:${exampleId}`, image);
      } catch {
        // Examples are optional curation, not a blocker for generation.
      }
    }));
    await Promise.all(unresolvedArtifacts.map(async ({ runId, artifactId, uri }) => {
      try {
        const image = await readImageResource(uri);
        if (image) artifacts.set(`${runId}:${artifactId || uri}`, image);
      } catch {
        // Keep the result card available even when one artifact cannot be read.
      }
    }));
    if (previews.size || examples.size || artifacts.size) {
      const skills = currentState.skills.map((skill) => ({
        ...skill,
        preview: previews.get(skill.id) ?? skill.preview,
        examples: (skill.examples || []).map((example) => ({
          ...example,
          preview: examples.get(`${skill.id}:${example.id}`) ?? example.preview,
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

async function callTool<T>(name: string, args: Record<string, unknown>) {
  if (app && appReady) return structured<T>(await app.callServerTool({ name, arguments: args }));
  if (window.openai?.callTool) return structured<T>(await window.openai.callTool(name, args));
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

function imageBlock(reference: StudioFile) {
  const value = reference.data_url || (reference.download_url.startsWith("data:") ? reference.download_url : "");
  const match = value.match(/^data:([^;,]+);base64,(.+)$/);
  return match ? { type: "image" as const, mimeType: match[1], data: match[2] } : null;
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
    const next = await callTool<{ skills: StudioSnapshot["skills"] }>("list_image_skills", {});
    const snapshot = { skills: next.skills, runs: currentState.runs };
    publish(snapshot);
    return snapshot;
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
      "prepare_image_generation",
      {
        skillId: input.skillId,
        prompt: input.prompt,
        aspectRatio: input.aspectRatio,
        clientRequestId: input.clientRequestId,
        references: input.references.map((reference) => ({
          download_url: reference.download_url,
          file_id: reference.file_id,
          file_name: reference.file_name,
          mime_type: reference.mime_type,
          role: reference.role,
        })),
      },
    );
    publish({ runs: [prepared.run, ...currentState.runs.filter((run) => run.id !== prepared.run.id)] });
    return { ...prepared, dispatchMode: "host_message" };
  },

  async sendInstruction(instruction, context) {
    let response: { isError?: boolean } | undefined;
    if (app && appReady) {
      const images = (context?.references ?? [])
        .map(imageBlock)
        .filter((block): block is NonNullable<ReturnType<typeof imageBlock>> => block !== null);
      response = await app.sendMessage({
        role: "user",
        content: [{ type: "text", text: instruction }, ...images],
      });
    } else if (window.openai?.sendFollowUpMessage) {
      response = await window.openai.sendFollowUpMessage({ prompt: instruction });
    } else {
      throw new Error("宿主不支持 ui/message，无法 hand off 给 Codex。");
    }

    if (!response?.isError && context?.runId) {
      try {
        const marked = await callTool<{ run: StudioSnapshot["runs"][number] }>("mark_image_generation_handoff", {
          runId: context.runId,
        });
        publish({ runs: [marked.run, ...currentState.runs.filter((run) => run.id !== marked.run.id)] });
      } catch {
        // ui/message was accepted; the final agent callback remains authoritative.
      }
    }
    return response;
  },

  async getRun(runId) {
    const result = await callTool<{ run: StudioSnapshot["runs"][number] | null }>("get_image_generation_run", { runId });
    if (result.run) publish({ runs: [result.run, ...currentState.runs.filter((run) => run.id !== result.run?.id)] });
    return result.run;
  },

  requestFullscreen() {
    if (!appReady) return;
    return app?.requestDisplayMode({ mode: "fullscreen" }).then((result) => {
      document.documentElement.dataset.displayMode = result.mode;
    });
  },

  subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

if (app) {
  app.ontoolresult = (result) => {
    const next = result.structuredContent as Partial<StudioSnapshot> | undefined;
    if (next?.skills || next?.runs) publish(next);
  };
  app.onhostcontextchanged = (context) => {
    if (context.displayMode) document.documentElement.dataset.displayMode = context.displayMode;
  };
}

const root = createRoot(document.getElementById("studio-root")!);
root.render(<ImageSkillStudio initialState={currentState} bridge={bridge} />);

if (app) {
  app.connect(new PostMessageTransport(window.parent, window.parent))
    .then(() => { appReady = true; void resolveMediaResources(); })
    .catch((error) => {
      console.error("MCP App handshake failed; using window.openai compatibility bridge", error);
    });
}
