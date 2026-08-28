import { stat } from "node:fs/promises";
import path from "node:path";

import { PACKAGE_ROOT } from "../lib/package-root.mjs";
import { DEFAULT_DOCUMENT_MAX_AGE_MS, DEFAULT_MEDIA_BUDGET_BYTES, RegistryCache } from "../lib/registry-cache.mjs";
import { fetchUpstreamSkill, upstreamSkillDir } from "../lib/skill-fetch.mjs";
import { mergeRegistryDocuments, normalizeRegistryDocument } from "../lib/skill-registry.mjs";
import { createCatalogEntries, loadCatalogManifest } from "./catalog-config.mjs";

export const DEFAULT_FEED_URL =
  "https://raw.githubusercontent.com/hrhrng/awesome-image-skill/main/catalog/registry.json";
export const FEED_DOCUMENT_KEY = "registry-v1";

export function resolveFeedUrl() {
  return process.env.IMAGE_SKILL_STUDIO_FEED_URL || DEFAULT_FEED_URL;
}

export function isOfflineMode() {
  return process.env.IMAGE_SKILL_STUDIO_OFFLINE === "1";
}

// Owns the three-layer catalog: the seed that ships in the plugin, the cached
// feed that refreshes without a reinstall, and the upstream Skills fetched on
// demand. Every layer degrades to the one below it.
export class RegistrySource {
  #cache;
  #pluginRoot;
  #url;
  #offline;
  #maxAgeMs;
  #seed;
  #registry;
  #fetchImpl;
  #mediaBudgetBytes;
  #fetchedDirs = new Map();

  constructor({
    pluginRoot = PACKAGE_ROOT,
    dataRoot,
    url = resolveFeedUrl(),
    cache,
    fetchImpl,
    offline = isOfflineMode(),
    maxAgeMs = DEFAULT_DOCUMENT_MAX_AGE_MS,
    mediaBudgetBytes = DEFAULT_MEDIA_BUDGET_BYTES,
  } = {}) {
    this.#pluginRoot = pluginRoot;
    this.#url = url;
    this.#offline = offline;
    this.#maxAgeMs = maxAgeMs;
    this.#fetchImpl = fetchImpl;
    this.#mediaBudgetBytes = mediaBudgetBytes;
    this.#cache = cache ?? new RegistryCache({ root: path.join(dataRoot, "cache"), fetchImpl });
    this.#seed = loadCatalogManifest(pluginRoot);
    this.#registry = this.#seed;
  }

  get cacheRoot() {
    return this.#cache.root;
  }

  get registry() {
    return this.#registry;
  }

  get seed() {
    return this.#seed;
  }

  async load({ onUpdate } = {}) {
    // Bounding the media cache is housekeeping, so it must not delay startup or
    // fail the load.
    void this.pruneMedia().catch(() => {});

    if (this.#offline) {
      await this.#indexFetchedSkills();
      return { registry: this.#registry, entries: this.catalogEntries(), state: "seed" };
    }

    const result = await this.#cache.loadDocument({
      url: this.#url,
      key: FEED_DOCUMENT_KEY,
      maxAgeMs: this.#maxAgeMs,
      onUpdate: async (value) => {
        const applied = await this.#apply(value);
        if (applied && onUpdate) onUpdate({ registry: this.#registry, entries: this.catalogEntries() });
      },
    });
    await this.#apply(result.value);
    await this.#indexFetchedSkills();
    return {
      registry: this.#registry,
      entries: this.catalogEntries(),
      state: result.value ? result.state : "seed",
      revalidation: result.revalidation ?? null,
    };
  }

  // A malformed published feed must never take down a working install.
  async #apply(value) {
    if (!value) return false;
    try {
      const remote = normalizeRegistryDocument(value);
      this.#registry = mergeRegistryDocuments({ seed: this.#seed, remote });
      await this.#indexFetchedSkills();
      return true;
    } catch {
      this.#registry = this.#seed;
      return false;
    }
  }

  async #indexFetchedSkills() {
    this.#fetchedDirs = new Map();
    for (const skill of this.#registry.skills) {
      if (skill.origin !== "remote" || !skill.source) continue;
      const directory = upstreamSkillDir(this.cacheRoot, { id: skill.id, commit: skill.source.commit });
      const info = await stat(path.join(directory, "SKILL.md")).catch(() => null);
      if (info?.isFile()) this.#fetchedDirs.set(skill.id, directory);
    }
  }

  catalogEntries() {
    return createCatalogEntries(this.#pluginRoot, {
      registry: this.#registry,
      resolveRemoteSkillDir: (skill) => this.#fetchedDirs.get(skill.id) ?? null,
    });
  }

  async mediaFile(url) {
    const result = await this.#cache.fetchMedia(url);
    return result.file;
  }

  async pruneMedia(maxBytes = this.#mediaBudgetBytes) {
    return this.#cache.pruneMedia(maxBytes);
  }

  async refresh() {
    if (this.#offline) return { state: "seed", registry: this.#registry };
    const result = await this.#cache.refreshDocument({ url: this.#url, key: FEED_DOCUMENT_KEY });
    await this.#apply(result.value);
    await this.#indexFetchedSkills();
    return { state: result.state, registry: this.#registry, error: result.error };
  }

  // Downloads a curated upstream Skill into the cache. Nothing is vendored into
  // the plugin, so the author's licence and attribution stay with the source.
  async fetchSkill(skillId, { force = false, fetchImpl } = {}) {
    const skill = this.#registry.skills.find((entry) => entry.id === skillId);
    if (!skill) return { ok: false, message: `Registry 里找不到 ${skillId}。` };
    if (skill.origin !== "remote") {
      return { ok: false, message: `${skillId} 已经随插件提供，不需要下载。` };
    }

    const resolvedFetch = fetchImpl ?? this.#fetchImpl;
    const result = await fetchUpstreamSkill({
      skill,
      cacheRoot: this.cacheRoot,
      force,
      ...(resolvedFetch ? { fetchImpl: resolvedFetch } : {}),
    });
    if (result.ok) this.#fetchedDirs.set(skillId, result.directory);
    return { ...result, skill };
  }

  fetchedDirectory(skillId) {
    return this.#fetchedDirs.get(skillId) ?? null;
  }
}
