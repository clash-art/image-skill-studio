import path from "node:path";

import { SKILL_NAME_PATTERN } from "./studio-skill-registry.mjs";

export const REGISTRY_VERSION = 1;
export const REGISTRY_MANIFEST_PATH = "catalog/registry.json";
export const RAW_CONTENT_BASE = "https://raw.githubusercontent.com";

const ORIGINS = new Set(["host", "bundled", "remote"]);
const REPO_PATTERN = /^[\w.-]+\/[\w.-]+$/;
const COMMIT_PATTERN = /^[0-9a-f]{40}$/;

// Only the path segments are escaped; the separators stay literal so the URL
// keeps its directory shape. Upstream repos use Chinese filenames.
export function encodeContentPath(contentPath) {
  return String(contentPath)
    .split("/")
    .filter((segment) => segment.length > 0)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

export function rawContentUrl({ repo, commit, path: contentPath }) {
  if (!REPO_PATTERN.test(repo || "")) throw new Error(`Invalid registry repo: ${repo}`);
  if (!COMMIT_PATTERN.test(commit || "")) throw new Error(`Registry entry for ${repo} must pin a full 40-character commit`);
  if (!contentPath) throw new Error(`Missing content path for ${repo}`);
  return `${RAW_CONTENT_BASE}/${repo}/${commit}/${encodeContentPath(contentPath)}`;
}

export function normalizeLicense(license) {
  if (!license) {
    return { spdx: null, name: "未声明许可证", redistribute: false, commercial: false, note: undefined };
  }
  return {
    spdx: license.spdx ?? null,
    name: license.name || license.spdx || "未声明许可证",
    // Absent means "not granted": an unlicensed repo keeps all rights reserved.
    redistribute: license.redistribute === true,
    commercial: license.commercial === true,
    note: license.note || undefined,
  };
}

function normalizeSource(source, { id, origin }) {
  if (!source) {
    if (origin === "remote") throw new Error(`Remote registry skill ${id} must declare a source`);
    return undefined;
  }
  if (!REPO_PATTERN.test(source.repo || "")) {
    throw new Error(`Registry skill ${id} has an invalid source repo: ${source.repo}`);
  }
  if (!COMMIT_PATTERN.test(source.commit || "")) {
    throw new Error(`Registry skill ${id} must pin a full 40-character commit`);
  }
  const skillPath = source.skillPath || "SKILL.md";
  if (path.posix.basename(skillPath) !== "SKILL.md") {
    throw new Error(`Registry skill ${id} skillPath must end in SKILL.md`);
  }
  // Pinning the file list keeps on-demand fetching on raw.githubusercontent,
  // which has no API rate limit. The list is as immutable as the commit itself.
  const files = Array.isArray(source.files)
    ? source.files
        .filter((file) => file && typeof file.path === "string")
        .map((file) => ({ path: file.path, size: Number(file.size) || 0 }))
    : [];

  return {
    repo: source.repo,
    commit: source.commit,
    skillPath,
    directory: path.posix.dirname(skillPath) === "." ? "" : path.posix.dirname(skillPath),
    homepage: source.homepage || `https://github.com/${source.repo}`,
    upstreamId: source.upstreamId || undefined,
    excludePaths: Array.isArray(source.excludePaths) ? source.excludePaths.slice() : [],
    files,
  };
}

function normalizeImageSlot(slot, index, kind) {
  const image = typeof slot === "string" ? slot : slot?.image;
  const id = slot?.id || `${kind}-${index + 1}`;
  if (!image) return null;
  const mode = slot?.mode || "text-to-image";
  if (!new Set(["text-to-image", "image-to-image"]).has(mode)) {
    throw new Error(`Registry ${kind} ${id} has an invalid mode: ${mode}`);
  }
  if (mode === "image-to-image" && !slot?.referenceImage) {
    throw new Error(`Registry ${kind} ${id} must declare referenceImage for image-to-image mode`);
  }
  const referenceRole = slot?.referenceRole || (mode === "image-to-image" ? "reference" : undefined);
  if (referenceRole && !new Set(["subject", "style", "composition", "reference"]).has(referenceRole)) {
    throw new Error(`Registry ${kind} ${id} has an invalid referenceRole: ${referenceRole}`);
  }
  return {
    id,
    image,
    prompt: slot?.prompt || undefined,
    aspectRatio: slot?.aspectRatio || "3:4",
    caption: slot?.caption || undefined,
    mode,
    referenceImage: slot?.referenceImage || undefined,
    referenceRole,
    promptFile: slot?.promptFile || undefined,
    mediaOrigin: slot?.mediaOrigin === "studio" ? "studio" : undefined,
  };
}

function normalizeSkill(entry, { exampleSlotLimit, gallerySlotLimit }) {
  const id = entry?.id;
  if (!SKILL_NAME_PATTERN.test(id || "") || id.length > 64) {
    throw new Error(`Registry skill id must be kebab-case: ${id}`);
  }
  const origin = entry.origin || "bundled";
  if (!ORIGINS.has(origin)) throw new Error(`Registry skill ${id} has an unknown origin: ${origin}`);
  if (!entry.displayName) throw new Error(`Registry skill ${id} must declare displayName`);
  if (!entry.description) throw new Error(`Registry skill ${id} must declare description`);

  const examples = (entry.examples || [])
    .map((slot, index) => normalizeImageSlot(slot, index, "example"))
    .filter(Boolean)
    .slice(0, exampleSlotLimit);
  const gallery = (entry.gallery || [])
    .map((slot, index) => normalizeImageSlot(slot, index, "gallery"))
    .filter(Boolean)
    .slice(0, gallerySlotLimit);

  return {
    id,
    origin,
    displayName: entry.displayName,
    description: entry.description,
    category: entry.category || "其他",
    accent: entry.accent || "ink",
    stars: Number.isFinite(entry.stars) ? Number(entry.stars) : null,
    cover: entry.cover || undefined,
    coverOrigin: entry.coverOrigin === "studio" ? "studio" : undefined,
    author: entry.author ? { name: entry.author.name, url: entry.author.url } : undefined,
    license: normalizeLicense(entry.license),
    source: normalizeSource(entry.source, { id, origin }),
    capabilities: {
      references: Boolean(entry.capabilities?.references),
      maxReferences: entry.capabilities?.references ? Number(entry.capabilities?.maxReferences || 3) : 0,
      aspectRatios: entry.capabilities?.aspectRatios?.length ? entry.capabilities.aspectRatios : ["3:4"],
    },
    examples,
    gallery,
  };
}

export function normalizeRegistryDocument(doc) {
  if (!doc || typeof doc !== "object") throw new Error("Registry document must be an object");
  if (Number(doc.version) !== REGISTRY_VERSION) {
    throw new Error(`Unsupported registry version: ${doc.version}`);
  }
  if (!Array.isArray(doc.skills)) throw new Error("Registry document must contain a skills array");

  const exampleSlotLimit = Number(doc.exampleSlotLimit) || 4;
  const gallerySlotLimit = Number(doc.gallerySlotLimit) || 4;
  const skills = doc.skills.map((entry) => normalizeSkill(entry, { exampleSlotLimit, gallerySlotLimit }));

  const seen = new Set();
  for (const skill of skills) {
    if (seen.has(skill.id)) throw new Error(`Duplicate registry skill id: ${skill.id}`);
    seen.add(skill.id);
  }

  return { version: REGISTRY_VERSION, exampleSlotLimit, gallerySlotLimit, skills };
}

// The host tool leads because it is the generic fallback, then popularity, then
// curated entries that have no upstream star count.
export function rankRegistrySkills(skills) {
  return skills
    .map((skill, index) => ({ skill, index }))
    .sort((left, right) => {
      const hostDelta = Number(right.skill.origin === "host") - Number(left.skill.origin === "host");
      if (hostDelta !== 0) return hostDelta;
      const leftStars = left.skill.stars;
      const rightStars = right.skill.stars;
      if (leftStars == null && rightStars != null) return 1;
      if (leftStars != null && rightStars == null) return -1;
      if (leftStars != null && rightStars != null && leftStars !== rightStars) return rightStars - leftStars;
      return left.index - right.index;
    })
    .map(({ skill }) => skill);
}

// A newer remote document replaces seed entries by id but never drops a seed
// entry, so a stale or trimmed feed can not empty the workbench.
export function mergeRegistryDocuments({ seed, remote }) {
  if (!remote) return seed;
  if (!seed) return remote;
  const seedById = new Map(seed.skills.map((skill) => [skill.id, skill]));
  const mergedRemote = remote.skills.map((skill) => {
    const local = seedById.get(skill.id);
    if (local?.origin !== "host") return skill;
    return {
      ...skill,
      cover: local.cover,
      examples: local.examples,
      gallery: local.gallery,
      capabilities: local.capabilities,
    };
  });
  const remoteIds = new Set(mergedRemote.map((skill) => skill.id));
  const seedOnly = seed.skills.filter((skill) => !remoteIds.has(skill.id));
  return {
    version: REGISTRY_VERSION,
    exampleSlotLimit: Math.max(seed.exampleSlotLimit, remote.exampleSlotLimit),
    gallerySlotLimit: Math.max(seed.gallerySlotLimit, remote.gallerySlotLimit),
    skills: [...mergedRemote, ...seedOnly],
  };
}

export function skillMediaRef(skill, contentPath, mediaOrigin) {
  if (!contentPath) return undefined;
  if (skill.origin === "remote" && mediaOrigin !== "studio") {
    return { kind: "remote", url: rawContentUrl({ ...skill.source, path: contentPath }) };
  }
  return { kind: "local", file: contentPath };
}

export function registryMediaRefs(skill) {
  const refs = [];
  const cover = skillMediaRef(skill, skill.cover, skill.coverOrigin);
  if (cover) refs.push({ slot: "cover", id: skill.id, ...cover });
  for (const example of skill.examples) {
    const ref = skillMediaRef(skill, example.image, example.mediaOrigin);
    if (ref) refs.push({ slot: "example", id: example.id, ...ref });
    const reference = skillMediaRef(skill, example.referenceImage, example.mediaOrigin);
    if (reference) refs.push({ slot: "reference", id: example.id, ...reference });
  }
  for (const item of skill.gallery) {
    const ref = skillMediaRef(skill, item.image);
    if (ref) refs.push({ slot: "gallery", id: item.id, ...ref });
  }
  return refs;
}
