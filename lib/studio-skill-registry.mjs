import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { parseSkillFrontmatter } from "./skill-catalog.mjs";

export const HOST_SKILL_DIR = path.join(process.env.CODEX_HOME || path.join(os.homedir(), ".codex"), "skills");
export const RESERVED_SKILL_IDS = new Set(["imagegen", "image-skill-studio"]);
export const SKILL_NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const INDEX_FILE = "registered-skills.json";
const MAX_SKILL_FILES = 100;
const MAX_SKILL_BYTES = 5 * 1024 * 1024;
const MAX_SKILL_MD_BYTES = 256 * 1024;
const SKIP_NAMES = new Set([".git", "node_modules", ".DS_Store"]);
const ALLOWED_EXTENSIONS = new Set([".md", ".txt", ".png", ".jpg", ".jpeg", ".webp", ".svg", ".json", ".yml", ".yaml"]);
const ALLOWED_BASENAMES = new Set(["license", "copying", "notice", "authors", "readme"]);

function fail(message) {
  return { ok: false, message };
}

function isReservedId(id) {
  return !id || id.startsWith(".") || RESERVED_SKILL_IDS.has(id) || id.includes("/") || id.includes("\\");
}

function isAllowedSkillFile(relativePath) {
  const base = path.basename(relativePath);
  if (base === "SKILL.md") return true;
  const extension = path.extname(base).toLowerCase();
  if (ALLOWED_EXTENSIONS.has(extension)) return true;
  return !extension && ALLOWED_BASENAMES.has(base.toLowerCase());
}

function isInside(filePath, rootPath) {
  const resolvedFile = path.resolve(filePath);
  const resolvedRoot = path.resolve(rootPath);
  return resolvedFile === resolvedRoot || resolvedFile.startsWith(`${resolvedRoot}${path.sep}`);
}

async function pathInfo(target) {
  try {
    return await stat(target);
  } catch {
    return null;
  }
}

async function collectSkillFiles(root) {
  const files = [];
  async function visit(directory) {
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch (error) {
      throw new Error(`无法读取 Skill 目录：${error instanceof Error ? error.message : String(error)}`);
    }
    for (const entry of entries) {
      if (SKIP_NAMES.has(entry.name) || entry.name.startsWith(".")) continue;
      const fullPath = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        await visit(fullPath);
        continue;
      }
      if (!entry.isFile()) continue;
      const relativePath = path.relative(root, fullPath);
      if (!isAllowedSkillFile(relativePath)) continue;
      files.push({ fullPath, relativePath });
    }
  }
  await visit(root);
  return files;
}

async function copySkillDirectory(sourceDir, destinationDir) {
  const files = await collectSkillFiles(sourceDir);
  if (!files.length) throw new Error("Skill 目录里没有可复制的文件。");
  if (files.length > MAX_SKILL_FILES) {
    throw new Error(`Skill 文件过多（最多 ${MAX_SKILL_FILES} 个）。`);
  }
  let totalBytes = 0;
  const payloads = [];
  for (const file of files) {
    const bytes = await readFile(file.fullPath);
    totalBytes += bytes.length;
    if (totalBytes > MAX_SKILL_BYTES) {
      throw new Error("Skill 体积过大（最多 5 MB）。");
    }
    payloads.push({ relativePath: file.relativePath, bytes });
  }
  await rm(destinationDir, { recursive: true, force: true });
  for (const file of payloads) {
    const target = path.join(destinationDir, file.relativePath);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, file.bytes);
  }
  return { fileCount: payloads.length, bytes: totalBytes };
}

async function readIndex(dataRoot) {
  try {
    const raw = JSON.parse(await readFile(path.join(dataRoot, INDEX_FILE), "utf8"));
    return Array.isArray(raw.skills) ? raw.skills : [];
  } catch {
    return [];
  }
}

async function writeIndex(dataRoot, skills) {
  await mkdir(dataRoot, { recursive: true });
  await writeFile(path.join(dataRoot, INDEX_FILE), `${JSON.stringify({ skills }, null, 2)}\n`);
}

function registeredSkillDir(dataRoot, skillId) {
  return path.join(dataRoot, "skills", skillId);
}

export async function validateStudioSkillSource(sourcePath) {
  if (!sourcePath || typeof sourcePath !== "string" || !sourcePath.trim()) {
    return fail("请提供 Skill 目录或 SKILL.md 的绝对路径。");
  }
  const resolved = path.resolve(sourcePath.trim());
  if (!path.isAbsolute(sourcePath.trim())) {
    return fail("请提供 Skill 目录或 SKILL.md 的绝对路径。");
  }
  const info = await pathInfo(resolved);
  if (!info) return fail("找不到这个路径。");

  let directory;
  if (info.isFile()) {
    if (path.basename(resolved) !== "SKILL.md") return fail("请指向 Skill 目录或 SKILL.md。");
    directory = path.dirname(resolved);
  } else if (info.isDirectory()) {
    directory = resolved;
  } else {
    return fail("请指向 Skill 目录或 SKILL.md。");
  }

  const skillPath = path.join(directory, "SKILL.md");
  const skillInfo = await pathInfo(skillPath);
  if (!skillInfo?.isFile()) return fail("这个目录里没有 SKILL.md。");
  if (skillInfo.size < 1) return fail("SKILL.md 是空的。");
  if (skillInfo.size > MAX_SKILL_MD_BYTES) return fail("SKILL.md 过大（最多 256 KB）。");

  let source;
  try {
    source = await readFile(skillPath, "utf8");
  } catch (error) {
    return fail(`无法读取 SKILL.md：${error instanceof Error ? error.message : String(error)}`);
  }

  const frontmatter = parseSkillFrontmatter(source);
  if (!frontmatter.name) return fail("SKILL.md frontmatter 必须包含 name。");
  if (!frontmatter.description) return fail("SKILL.md frontmatter 必须包含 description。");
  if (!SKILL_NAME_PATTERN.test(frontmatter.name) || frontmatter.name.length > 64) {
    return fail("Skill name 必须是 1–64 个字符的 kebab-case 小写。");
  }
  if (isReservedId(frontmatter.name)) {
    return fail(`不能注册保留 Skill：${frontmatter.name}。`);
  }

  try {
    await collectSkillFiles(directory);
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error));
  }

  return {
    ok: true,
    skill: {
      id: frontmatter.name,
      name: frontmatter.name,
      description: frontmatter.description,
      directory,
      skillPath,
    },
  };
}

export async function listRegisteredSkillEntries(dataRoot) {
  const skillsDir = path.join(dataRoot, "skills");
  const info = await pathInfo(skillsDir);
  if (!info?.isDirectory()) return [];

  const index = await readIndex(dataRoot);
  const byId = new Map(index.map((entry) => [entry.id, entry]));
  const entries = [];
  for (const name of await readdir(skillsDir)) {
    if (isReservedId(name)) continue;
    const directory = path.join(skillsDir, name);
    const skillInfo = await pathInfo(path.join(directory, "SKILL.md"));
    if (!skillInfo?.isFile()) continue;
    const recorded = byId.get(name) || {};
    entries.push({
      id: name,
      path: directory,
      origin: "registered",
      category: recorded.category || "已注册",
      accent: recorded.accent || "ink",
      capabilities: recorded.capabilities || {
        references: true,
        maxReferences: 3,
        aspectRatios: ["3:4", "1:1", "16:9"],
      },
    });
  }
  return entries;
}

export async function registerStudioSkill({
  sourcePath,
  dataRoot,
  overwrite = false,
  bundledIds = [],
} = {}) {
  const validation = await validateStudioSkillSource(sourcePath);
  if (!validation.ok) return validation;

  const { skill } = validation;
  const bundled = new Set(bundledIds);
  if (bundled.has(skill.id) || isReservedId(skill.id)) {
    return fail(`不能覆盖 Studio 内置 Skill：${skill.id}。`);
  }

  const destination = registeredSkillDir(dataRoot, skill.id);
  const existing = await pathInfo(path.join(destination, "SKILL.md"));
  if (existing?.isFile() && !overwrite) {
    return fail(`Skill ${skill.id} 已经注册。如需更新，请打开覆盖。`);
  }

  try {
    await copySkillDirectory(skill.directory, destination);
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error));
  }

  const index = (await readIndex(dataRoot)).filter((entry) => entry.id !== skill.id);
  index.push({
    id: skill.id,
    registeredAt: new Date().toISOString(),
    sourcePath: skill.directory,
  });
  await writeIndex(dataRoot, index);

  return {
    ok: true,
    skill: {
      id: skill.id,
      name: skill.name,
      description: skill.description,
      directory: destination,
      skillPath: path.join(destination, "SKILL.md"),
      origin: "registered",
    },
  };
}

function catalogSkillDirectory(entry) {
  if (!entry) return null;
  if (entry.path) {
    return path.extname(entry.path).toLowerCase() === ".md" ? path.dirname(entry.path) : entry.path;
  }
  if (entry.skillPath) return path.dirname(entry.skillPath);
  return null;
}

export async function installStudioSkill({
  skillId,
  dataRoot,
  hostSkillsDir = HOST_SKILL_DIR,
  catalog = [],
  pluginRoot,
  overwrite = false,
} = {}) {
  if (!SKILL_NAME_PATTERN.test(skillId || "") || isReservedId(skillId)) {
    return fail(`不能安装这个 Skill：${skillId || "未知"}。`);
  }

  const hostRoot = path.resolve(hostSkillsDir);
  if (path.basename(hostRoot) === ".system" || hostRoot.includes(`${path.sep}.system${path.sep}`)) {
    return fail("不能安装到 Codex 的 .system Skill 目录。");
  }

  const catalogEntry = catalog.find((entry) => entry.id === skillId);
  if (catalogEntry?.origin === "host") {
    return fail("宿主自带的 Skill 不能再安装到内置目录。");
  }

  const candidates = [
    registeredSkillDir(dataRoot, skillId),
    catalogSkillDirectory(catalogEntry),
    pluginRoot ? path.join(pluginRoot, "skills", skillId) : null,
  ].filter(Boolean);

  let sourceDir = null;
  for (const candidate of candidates) {
    const skillInfo = await pathInfo(path.join(candidate, "SKILL.md"));
    if (skillInfo?.isFile()) {
      sourceDir = candidate;
      break;
    }
  }
  if (!sourceDir) return fail(`Studio 里找不到 Skill ${skillId}。`);

  const destination = path.join(hostRoot, skillId);
  if (isInside(destination, path.join(hostRoot, ".system"))) {
    return fail("不能安装到 Codex 的 .system Skill 目录。");
  }
  const existing = await pathInfo(destination);
  if (existing && !overwrite) {
    return fail(`~/.codex/skills/${skillId} 已经存在。如需更新，请打开覆盖。`);
  }

  try {
    await copySkillDirectory(sourceDir, destination);
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error));
  }

  return { ok: true, destination, skillId };
}
