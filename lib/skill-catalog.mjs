import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

function unquote(value) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

export function parseSkillFrontmatter(source) {
  const match = source.match(/^---\s*\r?\n([\s\S]*?)\r?\n---(?:\s*\r?\n|$)/);
  if (!match) return {};

  const metadata = {};
  for (const line of match[1].split(/\r?\n/)) {
    const field = line.match(/^([A-Za-z][\w-]*):\s*(.*)$/);
    if (!field) continue;
    metadata[field[1]] = unquote(field[2]);
  }
  return metadata;
}

export function resolveSkillPath(configuredPath) {
  const expanded = configuredPath === "~"
    ? os.homedir()
    : configuredPath.startsWith("~/")
      ? path.join(os.homedir(), configuredPath.slice(2))
      : configuredPath;
  return path.extname(expanded).toLowerCase() === ".md"
    ? path.resolve(expanded)
    : path.resolve(expanded, "SKILL.md");
}

function mediaSlot(slot) {
  return {
    id: slot.id,
    prompt: slot.prompt,
    aspectRatio: slot.aspectRatio || "3:4",
    caption: slot.caption,
    mode: slot.mode || "text-to-image",
    referenceRole: slot.referenceRole,
    promptFile: slot.promptFile,
    mediaOrigin: slot.mediaOrigin,
    previewPath: slot.previewPath ? path.resolve(slot.previewPath) : undefined,
    previewUrl: slot.previewUrl || undefined,
    referencePreviewPath: slot.referencePreviewPath ? path.resolve(slot.referencePreviewPath) : undefined,
    referencePreviewUrl: slot.referencePreviewUrl || undefined,
  };
}

function shared(entry) {
  return {
    id: entry.id,
    category: entry.category || "其他",
    accent: entry.accent || "ink",
    source: entry.source || "local",
    origin: entry.origin || "local",
    canInstall: entry.origin !== "host",
    stars: entry.stars ?? null,
    license: entry.license,
    author: entry.author,
    upstream: entry.upstream,
    previewPath: entry.previewPath ? path.resolve(entry.previewPath) : undefined,
    previewUrl: entry.previewUrl || undefined,
    examples: (entry.examples || []).map(mediaSlot),
    gallery: (entry.gallery || []).map(mediaSlot),
    capabilities: {
      references: Boolean(entry.capabilities?.references),
      maxReferences: entry.capabilities?.references
        ? Number(entry.capabilities?.maxReferences || 3)
        : 0,
      aspectRatios: entry.capabilities?.aspectRatios || ["3:4"],
    },
  };
}

export async function loadSkillCatalog(entries) {
  return Promise.all(
    entries.map(async (entry) => {
      const base = shared(entry);
      // A curated upstream Skill has no local copy until the user asks for it.
      // That is a normal browsing state, not a broken entry.
      if (!entry.path) {
        return {
          ...base,
          displayName: entry.displayName || entry.id,
          description: entry.description || "",
          version: entry.version || "upstream",
          contentHash: "unfetched",
          skillPath: null,
          needsFetch: true,
          availability: "available",
        };
      }

      const skillPath = resolveSkillPath(entry.path);
      try {
        const source = await readFile(skillPath, "utf8");
        const frontmatter = parseSkillFrontmatter(source);
        if (!frontmatter.name || !frontmatter.description) {
          throw new Error("SKILL.md frontmatter must include name and description");
        }

        return {
          ...base,
          displayName: entry.displayName || frontmatter.name,
          description: frontmatter.description,
          version: frontmatter.version || entry.version || "local",
          contentHash: createHash("sha256").update(source).digest("hex").slice(0, 12),
          skillPath,
          needsFetch: false,
          availability: "ready",
        };
      } catch (error) {
        return {
          ...base,
          displayName: entry.displayName || entry.id,
          description: entry.description || "这个 Skill 暂时无法读取。",
          version: entry.version || "local",
          contentHash: "unavailable",
          skillPath,
          needsFetch: false,
          availability: "missing",
          error: `无法读取 SKILL.md：${error instanceof Error ? error.message : String(error)}`,
        };
      }
    }),
  );
}
