import { readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { PACKAGE_ROOT } from "../lib/package-root.mjs";
import {
  normalizeRegistryDocument,
  rankRegistrySkills,
  rawContentUrl,
  REGISTRY_MANIFEST_PATH,
} from "../lib/skill-registry.mjs";

export const CATALOG_MANIFEST_PATH = REGISTRY_MANIFEST_PATH;

function hostImagegenPath() {
  return path.join(process.env.CODEX_HOME || path.join(os.homedir(), ".codex"), "skills/.system/imagegen");
}

function resolveAsset(pluginRoot, assetPath) {
  if (!assetPath) return undefined;
  return path.isAbsolute(assetPath) ? assetPath : path.resolve(pluginRoot, assetPath);
}

function studioAssetUrl(assetPath) {
  if (/^https:\/\//i.test(String(assetPath))) return String(assetPath);
  const baseUrl = (process.env.IMAGE_SKILL_STUDIO_ASSET_BASE_URL || "https://clash.art/studio/image/assets")
    .replace(/\/+$/, "");
  const key = String(assetPath)
    .replace(/^\/+/, "")
    .replace(/^public\//, "")
    .replace(/^assets\//, "");
  return `${baseUrl}/${key}`;
}

export function loadCatalogManifest(pluginRoot = PACKAGE_ROOT) {
  const source = readFileSync(path.join(pluginRoot, CATALOG_MANIFEST_PATH), "utf8");
  return normalizeRegistryDocument(JSON.parse(source));
}

// Studio media lives in Cloudflare R2 and is cached locally on first read.
// Upstream media remains pinned to the source repository commit.
function mediaFields(skill, pluginRoot, contentPath, mediaOrigin) {
  if (!contentPath) return {};
  if (skill.origin === "remote" && mediaOrigin !== "studio") {
    return { previewUrl: rawContentUrl({ ...skill.source, path: contentPath }) };
  }
  return { previewUrl: studioAssetUrl(contentPath) };
}

function skillDirectory(skill, pluginRoot, resolveRemoteSkillDir) {
  if (skill.origin === "host") return hostImagegenPath();
  if (skill.origin === "bundled") return path.join(pluginRoot, "skills", skill.id);
  return resolveRemoteSkillDir?.(skill) ?? null;
}

export function toCatalogEntry(skill, { pluginRoot = PACKAGE_ROOT, resolveRemoteSkillDir } = {}) {
  const examples = skill.examples.map((example) => ({
    id: example.id,
    prompt: example.prompt,
    aspectRatio: example.aspectRatio,
    mode: example.mode,
    referenceRole: example.referenceRole,
    promptFile: example.promptFile,
    mediaOrigin: example.mediaOrigin,
    ...mediaFields(skill, pluginRoot, example.image, example.mediaOrigin),
    ...Object.fromEntries(Object.entries(mediaFields(skill, pluginRoot, example.referenceImage, example.mediaOrigin)).map(([key, value]) => [
      key === "previewPath" ? "referencePreviewPath" : "referencePreviewUrl",
      value,
    ])),
  }));
  const gallery = skill.gallery.map((item) => ({
    id: item.id,
    caption: item.caption,
    aspectRatio: item.aspectRatio,
    ...mediaFields(skill, pluginRoot, item.image),
  }));
  const cover = mediaFields(skill, pluginRoot, skill.cover, skill.coverOrigin);

  return {
    id: skill.id,
    displayName: skill.displayName,
    description: skill.description,
    origin: skill.origin,
    path: skillDirectory(skill, pluginRoot, resolveRemoteSkillDir),
    previewPath: cover.previewPath || examples[0]?.previewPath,
    previewUrl: cover.previewUrl || examples[0]?.previewUrl || gallery[0]?.previewUrl,
    examples,
    gallery,
    category: skill.category,
    accent: skill.accent,
    stars: skill.stars,
    license: skill.license,
    author: skill.author,
    upstream: skill.source,
    capabilities: skill.capabilities,
  };
}

export function createCatalogEntries(pluginRoot = PACKAGE_ROOT, { registry, resolveRemoteSkillDir } = {}) {
  const manifest = registry ?? loadCatalogManifest(pluginRoot);
  return rankRegistrySkills(manifest.skills).map((skill) =>
    toCatalogEntry(skill, { pluginRoot, resolveRemoteSkillDir }),
  );
}

export const DEFAULT_CATALOG_ENTRIES = createCatalogEntries();
export const EXAMPLE_SLOT_LIMIT = loadCatalogManifest().exampleSlotLimit;
