import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, rename, rm, stat, utimes, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_DOCUMENT_MAX_AGE_MS = 6 * 60 * 60 * 1000;
export const DEFAULT_MEDIA_BUDGET_BYTES = 512 * 1024 * 1024;
export const MAX_DOCUMENT_BYTES = 4 * 1024 * 1024;
export const MAX_MEDIA_BYTES = 12 * 1024 * 1024;

const MEDIA_EXTENSIONS = new Map([
  ["image/png", ".png"],
  ["image/jpeg", ".jpg"],
  ["image/webp", ".webp"],
  ["image/svg+xml", ".svg"],
]);
const ALLOWED_MEDIA_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".svg"]);

function urlKey(url) {
  return createHash("sha256").update(url).digest("hex").slice(0, 32);
}

function mediaExtension(url, contentType) {
  const fromUrl = path.extname(new URL(url).pathname).toLowerCase();
  if (ALLOWED_MEDIA_EXTENSIONS.has(fromUrl)) return fromUrl === ".jpeg" ? ".jpg" : fromUrl;
  return MEDIA_EXTENSIONS.get((contentType || "").split(";")[0].trim()) || ".png";
}

async function writeAtomic(target, bytes) {
  await mkdir(path.dirname(target), { recursive: true });
  const staging = `${target}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(staging, bytes);
  try {
    await rename(staging, target);
  } catch (error) {
    await rm(staging, { force: true });
    throw error;
  }
}

export class RegistryCache {
  #root;
  #fetch;
  #now;
  #timeoutMs;

  constructor({ root, fetchImpl, now = () => Date.now(), timeoutMs = 8000 } = {}) {
    if (!root) throw new Error("RegistryCache requires a root directory");
    this.#root = root;
    this.#fetch = fetchImpl || globalThis.fetch?.bind(globalThis);
    this.#now = now;
    this.#timeoutMs = timeoutMs;
  }

  get root() {
    return this.#root;
  }

  documentPath(key) {
    return path.join(this.#root, "documents", `${key}.json`);
  }

  mediaPath(url, contentType) {
    return path.join(this.#root, "media", `${urlKey(url)}${mediaExtension(url, contentType)}`);
  }

  async #request(url, headers) {
    if (!this.#fetch) throw new Error("No fetch implementation available");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.#timeoutMs);
    try {
      return await this.#fetch(url, { headers, signal: controller.signal, redirect: "follow" });
    } finally {
      clearTimeout(timer);
    }
  }

  async readDocument(key) {
    try {
      const raw = await readFile(this.documentPath(key), "utf8");
      const envelope = JSON.parse(raw);
      if (!envelope || typeof envelope !== "object" || envelope.value == null) return null;
      return { value: envelope.value, etag: envelope.etag || null, fetchedAt: envelope.fetchedAt || 0 };
    } catch {
      return null;
    }
  }

  async #writeDocument(key, { value, etag }) {
    const envelope = { value, etag: etag || null, fetchedAt: this.#now() };
    await writeAtomic(this.documentPath(key), `${JSON.stringify(envelope)}\n`);
    return envelope;
  }

  isDocumentFresh(entry, maxAgeMs = DEFAULT_DOCUMENT_MAX_AGE_MS) {
    if (!entry) return false;
    return this.#now() - Number(entry.fetchedAt || 0) < maxAgeMs;
  }

  // Revalidates against the origin. A 304 refreshes the timestamp so a healthy
  // feed does not re-download on every open.
  async refreshDocument({ url, key }) {
    const cached = await this.readDocument(key);
    const headers = { accept: "application/json" };
    if (cached?.etag) headers["if-none-match"] = cached.etag;

    let response;
    try {
      response = await this.#request(url, headers);
    } catch (error) {
      return { value: cached?.value ?? null, state: cached ? "stale" : "offline", error };
    }

    if (response.status === 304 && cached) {
      await this.#writeDocument(key, { value: cached.value, etag: cached.etag });
      return { value: cached.value, state: "revalidated" };
    }
    if (!response.ok) {
      return {
        value: cached?.value ?? null,
        state: cached ? "stale" : "offline",
        error: new Error(`Registry request failed with ${response.status}`),
      };
    }

    const text = await response.text();
    if (text.length > MAX_DOCUMENT_BYTES) {
      return {
        value: cached?.value ?? null,
        state: cached ? "stale" : "offline",
        error: new Error("Registry document is too large"),
      };
    }
    let value;
    try {
      value = JSON.parse(text);
    } catch (error) {
      return { value: cached?.value ?? null, state: cached ? "stale" : "offline", error };
    }
    await this.#writeDocument(key, { value, etag: response.headers?.get?.("etag") });
    return { value, state: cached ? "updated" : "cold" };
  }

  // Serves the cached feed immediately and only touches the network when the
  // copy is older than maxAgeMs, so opening the app never waits on a request.
  async loadDocument({ url, key, maxAgeMs = DEFAULT_DOCUMENT_MAX_AGE_MS, onUpdate }) {
    const cached = await this.readDocument(key);
    if (cached && this.isDocumentFresh(cached, maxAgeMs)) {
      return { value: cached.value, state: "fresh", revalidation: null };
    }
    if (!cached) {
      const result = await this.refreshDocument({ url, key });
      return { value: result.value, state: result.state, error: result.error, revalidation: null };
    }
    const revalidation = this.refreshDocument({ url, key })
      .then((result) => {
        if (result.state === "updated" && onUpdate) onUpdate(result.value);
        return result;
      })
      .catch((error) => ({ value: null, state: "offline", error }));
    return { value: cached.value, state: "stale", revalidation };
  }

  // Media URLs are pinned to a commit, so a hit is always valid and never
  // revalidated.
  async fetchMedia(url) {
    const target = this.mediaPath(url);
    const existing = await stat(target).catch(() => null);
    if (existing?.isFile() && existing.size > 0) {
      await utimes(target, new Date(), existing.mtime).catch(() => {});
      return { file: target, state: "hit", bytes: existing.size };
    }

    let response;
    try {
      response = await this.#request(url, { accept: "image/*" });
    } catch (error) {
      return { file: null, state: "offline", error };
    }
    if (!response.ok) {
      return { file: null, state: "error", error: new Error(`Media request failed with ${response.status}`) };
    }
    const declared = Number(response.headers?.get?.("content-length") || 0);
    if (declared > MAX_MEDIA_BYTES) {
      return { file: null, state: "error", error: new Error("Registry media is too large") };
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length === 0) {
      return { file: null, state: "error", error: new Error("Registry media is empty") };
    }
    if (bytes.length > MAX_MEDIA_BYTES) {
      return { file: null, state: "error", error: new Error("Registry media is too large") };
    }
    const finalTarget = this.mediaPath(url, response.headers?.get?.("content-type"));
    await writeAtomic(finalTarget, bytes);
    return { file: finalTarget, state: "downloaded", bytes: bytes.length };
  }

  // Keeps the media directory bounded by dropping the least recently used files.
  async pruneMedia(maxBytes = DEFAULT_MEDIA_BUDGET_BYTES) {
    const mediaDir = path.join(this.#root, "media");
    let names;
    try {
      names = await readdir(mediaDir);
    } catch {
      return { removed: 0, bytes: 0 };
    }
    const files = [];
    let total = 0;
    for (const name of names) {
      const file = path.join(mediaDir, name);
      const info = await stat(file).catch(() => null);
      if (!info?.isFile()) continue;
      total += info.size;
      files.push({ file, size: info.size, atime: info.atimeMs });
    }
    if (total <= maxBytes) return { removed: 0, bytes: total };

    files.sort((left, right) => left.atime - right.atime);
    let removed = 0;
    for (const entry of files) {
      if (total <= maxBytes) break;
      await rm(entry.file, { force: true });
      total -= entry.size;
      removed += 1;
    }
    return { removed, bytes: total };
  }
}
