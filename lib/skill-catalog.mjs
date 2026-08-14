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

export async function loadSkillCatalog(entries) {
  return Promise.all(
    entries.map(async (entry) => {
      const skillPath = resolveSkillPath(entry.path);
      const examples = (entry.examples || []).map((example) => ({
        id: example.id,
        prompt: example.prompt,
        aspectRatio: example.aspectRatio || "3:4",
        previewPath: example.previewPath ? path.resolve(example.previewPath) : undefined,
      }));
      try {
        const source = await readFile(skillPath, "utf8");
        const frontmatter = parseSkillFrontmatter(source);
        if (!frontmatter.name || !frontmatter.description) {
          throw new Error("SKILL.md frontmatter must include name and description");
        }

        return {
          id: entry.id,
          displayName: entry.displayName || frontmatter.name,
          description: frontmatter.description,
          category: entry.category || "其他",
          accent: entry.accent || "ink",
          source: entry.source || "local",
          version: frontmatter.version || entry.version || "local",
          contentHash: createHash("sha256").update(source).digest("hex").slice(0, 12),
          skillPath,
          previewPath: entry.previewPath ? path.resolve(entry.previewPath) : undefined,
          examples,
          capabilities: {
            references: Boolean(entry.capabilities?.references),
            maxReferences: entry.capabilities?.references
              ? Number(entry.capabilities?.maxReferences || 3)
              : 0,
            aspectRatios: entry.capabilities?.aspectRatios || ["3:4"],
          },
          availability: "ready",
        };
      } catch (error) {
        return {
          id: entry.id,
          displayName: entry.displayName || entry.id,
          description: entry.description || "这个 Skill 暂时无法读取。",
          category: entry.category || "其他",
          accent: entry.accent || "ink",
          source: entry.source || "local",
          version: entry.version || "local",
          contentHash: "unavailable",
          skillPath,
          previewPath: entry.previewPath ? path.resolve(entry.previewPath) : undefined,
          examples,
          capabilities: {
            references: Boolean(entry.capabilities?.references),
            maxReferences: entry.capabilities?.references
              ? Number(entry.capabilities?.maxReferences || 3)
              : 0,
            aspectRatios: entry.capabilities?.aspectRatios || ["3:4"],
          },
          availability: "missing",
          error: `无法读取 SKILL.md：${error instanceof Error ? error.message : String(error)}`,
        };
      }
    }),
  );
}
