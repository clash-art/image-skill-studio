import { mkdir, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import { encodeContentPath, rawContentUrl } from "./skill-registry.mjs";

export const SKILL_FETCH_LIMITS = {
  maxFiles: 200,
  maxTotalBytes: 20 * 1024 * 1024,
  maxFileBytes: 4 * 1024 * 1024,
  maxSkillMdBytes: 256 * 1024,
};

// Directory names skipped at any depth, so `assets/examples/` is dropped just
// like a top-level `examples/`. Showcase galleries and sponsor images are large
// and never needed to run a Skill; `private-assets` is excluded because
// upstream marked it private.
export const DEFAULT_EXCLUDED_DIRECTORIES = [
  ".git",
  ".github",
  "node_modules",
  "examples",
  "evals",
  "pay",
  "private-assets",
];

const TEXT_EXTENSIONS = new Set([".md", ".txt", ".json", ".yml", ".yaml"]);
const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".svg"]);
const BARE_FILENAMES = new Set(["license", "licence", "copying", "notice", "authors", "readme"]);

export function upstreamTreeUrl({ repo, commit }) {
  return `https://api.github.com/repos/${repo}/git/trees/${commit}?recursive=1`;
}

function isUnsafePath(relativePath) {
  if (!relativePath || path.posix.isAbsolute(relativePath)) return true;
  return relativePath.split("/").some((segment) => segment === ".." || segment === "." || segment === "");
}

function isAllowedFile(relativePath) {
  const base = path.posix.basename(relativePath);
  if (base === "SKILL.md") return true;
  const extension = path.posix.extname(base).toLowerCase();
  if (TEXT_EXTENSIONS.has(extension) || IMAGE_EXTENSIONS.has(extension)) return true;
  return !extension && BARE_FILENAMES.has(base.toLowerCase());
}

function withinExcluded(relativePath, excluded) {
  const segments = relativePath.split("/");
  return excluded.some((name) => segments.includes(name));
}

// A loose image sitting next to SKILL.md is a banner or a sample output, never
// reference material a Skill reads. Several upstream repos keep tens of
// megabytes of them there.
function isShowcaseImageAtRoot(relativePath) {
  if (relativePath.includes("/")) return false;
  return IMAGE_EXTENSIONS.has(path.posix.extname(relativePath).toLowerCase());
}

// Picks the smallest file set that still runs the Skill: SKILL.md plus its
// reference material, scoped to the directory that owns SKILL.md.
export function selectSkillFiles(tree, {
  directory = "",
  excludePaths = [],
  limits = SKILL_FETCH_LIMITS,
} = {}) {
  const prefix = directory ? `${directory.replace(/\/+$/, "")}/` : "";
  const excluded = [...DEFAULT_EXCLUDED_DIRECTORIES, ...excludePaths];
  const blobs = (Array.isArray(tree) ? tree : []).filter((node) => node?.type === "blob" && typeof node.path === "string");

  const candidates = [];
  const skipped = [];
  for (const node of blobs) {
    if (prefix && !node.path.startsWith(prefix)) continue;
    const relativePath = prefix ? node.path.slice(prefix.length) : node.path;
    if (isUnsafePath(relativePath)) continue;
    if (withinExcluded(relativePath, excluded)) continue;
    if (isShowcaseImageAtRoot(relativePath)) continue;
    if (!isAllowedFile(relativePath)) continue;

    const size = Number(node.size || 0);
    if (relativePath === "SKILL.md") {
      if (size > limits.maxSkillMdBytes) {
        throw new Error(`Upstream SKILL.md is larger than ${limits.maxSkillMdBytes} bytes`);
      }
    } else if (size > limits.maxFileBytes) {
      skipped.push({ path: relativePath, size, reason: "file-too-large" });
      continue;
    }
    candidates.push({ path: relativePath, sourcePath: node.path, size });
  }

  const skillMd = candidates.find((file) => file.path === "SKILL.md");
  if (!skillMd) throw new Error("Upstream tree does not contain SKILL.md at the pinned path");

  // SKILL.md first, then the smallest files, so a tight budget still yields a
  // runnable Skill rather than one giant reference image.
  const ordered = [
    skillMd,
    ...candidates.filter((file) => file !== skillMd).sort((left, right) => left.size - right.size),
  ];

  const files = [];
  let totalBytes = 0;
  for (const file of ordered) {
    if (files.length >= limits.maxFiles) {
      skipped.push({ path: file.path, size: file.size, reason: "file-count-budget" });
      continue;
    }
    if (totalBytes + file.size > limits.maxTotalBytes) {
      skipped.push({ path: file.path, size: file.size, reason: "total-size-budget" });
      continue;
    }
    totalBytes += file.size;
    files.push(file);
  }

  return { files, skipped, totalBytes };
}

// Re-expands a pinned, Skill-relative file list into the tree shape so it runs
// through exactly the same safety and budget checks as an API listing.
export function pinnedFilesAsTree(files, directory = "") {
  const prefix = directory ? `${directory.replace(/\/+$/, "")}/` : "";
  return files.map((file) => ({ type: "blob", path: `${prefix}${file.path}`, size: Number(file.size) || 0 }));
}

export function upstreamSkillDir(cacheRoot, { id, commit }) {
  return path.join(cacheRoot, "skills", `${id}@${commit.slice(0, 12)}`);
}

async function request(fetchImpl, url, headers, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, { headers, signal: controller.signal, redirect: "follow" });
  } finally {
    clearTimeout(timer);
  }
}

// A pinned commit makes the fetched tree immutable, so an existing directory is
// always a valid hit and an update is simply a different directory.
export async function fetchUpstreamSkill({
  skill,
  cacheRoot,
  fetchImpl = globalThis.fetch?.bind(globalThis),
  limits = SKILL_FETCH_LIMITS,
  timeoutMs = 15_000,
  force = false,
} = {}) {
  if (!skill?.source?.repo || !skill?.source?.commit) {
    return { ok: false, message: `${skill?.id || "Skill"} 没有可下载的上游来源。` };
  }
  if (!fetchImpl) return { ok: false, message: "当前运行时没有可用的 fetch。" };

  const { repo, commit, skillPath, directory, excludePaths, files: pinnedFiles } = skill.source;
  const destination = upstreamSkillDir(cacheRoot, { id: skill.id, commit });
  if (!force) {
    const existing = await stat(path.join(destination, "SKILL.md")).catch(() => null);
    if (existing?.isFile()) return { ok: true, directory: destination, state: "hit", files: 0, bytes: 0 };
  }

  let tree;
  if (pinnedFiles?.length) {
    tree = pinnedFilesAsTree(pinnedFiles, directory);
  } else {
    // Falls back to the GitHub API, which is capped at 60 requests an hour for
    // anonymous callers. Prefer pinning `source.files` in the feed.
    try {
      const response = await request(
        fetchImpl,
        upstreamTreeUrl({ repo, commit }),
        { accept: "application/vnd.github+json", "user-agent": "image-skill-studio" },
        timeoutMs,
      );
      if (!response.ok) {
        const hint = response.status === 403 ? "（GitHub API 限流，建议在 registry 里 pin 住 source.files）" : "";
        return { ok: false, message: `无法读取 ${repo} 的文件列表（HTTP ${response.status}）。${hint}` };
      }
      const body = JSON.parse(await response.text());
      tree = body.tree;
      if (body.truncated) {
        return { ok: false, message: `${repo} 的文件列表过大，无法按需下载。` };
      }
    } catch (error) {
      return { ok: false, message: `无法连接上游仓库：${error instanceof Error ? error.message : String(error)}` };
    }
  }

  let selection;
  try {
    selection = selectSkillFiles(tree, { directory, excludePaths, limits });
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }

  const staging = `${destination}.partial`;
  await rm(staging, { recursive: true, force: true });
  try {
    for (const file of selection.files) {
      const url = rawContentUrl({ repo, commit, path: file.sourcePath });
      const response = await request(fetchImpl, url, { accept: "*/*" }, timeoutMs);
      if (!response.ok) throw new Error(`下载 ${file.path} 失败（HTTP ${response.status}）`);
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length > limits.maxFileBytes && file.path !== "SKILL.md") continue;
      const target = path.join(staging, file.path);
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, bytes);
    }
    await rm(destination, { recursive: true, force: true });
    await mkdir(path.dirname(destination), { recursive: true });
    await rename(staging, destination);
  } catch (error) {
    await rm(staging, { recursive: true, force: true });
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }

  return {
    ok: true,
    directory: destination,
    state: "downloaded",
    files: selection.files.length,
    bytes: selection.totalBytes,
    skipped: selection.skipped,
    attribution: {
      repo,
      commit,
      skillPath,
      url: `https://github.com/${repo}/blob/${commit}/${encodeContentPath(skillPath)}`,
    },
  };
}
