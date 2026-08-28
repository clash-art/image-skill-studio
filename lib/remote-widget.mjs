import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const DEFAULT_REMOTE_WIDGET_URL = "https://clash.art/studio/image/widget.html";
const DEFAULT_WIDGET_MAX_AGE_MS = 5 * 60_000;

async function readJson(file) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch {
    return null;
  }
}

async function writeAtomic(file, value) {
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  await writeFile(temporary, value);
  await rename(temporary, file);
}

function normalizeRemoteWidgetUrl(value) {
  const url = new URL(value || DEFAULT_REMOTE_WIDGET_URL);

  if (url.protocol !== "https:") {
    throw new Error("Remote widget URL must use HTTPS.");
  }

  if (url.username || url.password || url.hash) {
    throw new Error("Remote widget URL cannot contain credentials or a hash.");
  }

  return url.toString();
}

export function createRemoteWidgetLoader({
  url = process.env.IMAGE_SKILL_STUDIO_REMOTE_WIDGET_URL,
  fetchImpl = fetch,
  dataRoot = process.env.PLUGIN_DATA || path.join(os.homedir(), ".codex", "image-skill-studio"),
  maxAgeMs = Number(process.env.IMAGE_SKILL_STUDIO_WIDGET_MAX_AGE_MS) || DEFAULT_WIDGET_MAX_AGE_MS,
} = {}) {
  const remoteWidgetUrl = normalizeRemoteWidgetUrl(url);
  const cacheKey = createHash("sha256").update(remoteWidgetUrl).digest("hex").slice(0, 16);
  const cacheRoot = path.join(dataRoot, "cache", "ui");
  const htmlFile = path.join(cacheRoot, `${cacheKey}.html`);
  const metadataFile = path.join(cacheRoot, `${cacheKey}.json`);
  let memoryHtml = null;
  let memoryMetadata = null;
  let initialLoad = null;
  let refresh = null;

  async function readCachedWidget() {
    try {
      const [html, metadata] = await Promise.all([
        readFile(htmlFile, "utf8"),
        readJson(metadataFile),
      ]);
      if (!html.trim()) return null;
      return { html, metadata: metadata || {} };
    } catch {
      return null;
    }
  }

  function isFresh(metadata) {
    const checkedAt = Number(metadata?.checkedAt || 0);
    return checkedAt > 0 && Date.now() - checkedAt < maxAgeMs;
  }

  async function refreshWidget() {
    if (refresh) return refresh;

    refresh = (async () => {
      const headers = { Accept: "text/html" };
      if (memoryMetadata?.etag) headers["If-None-Match"] = memoryMetadata.etag;
      if (memoryMetadata?.lastModified) headers["If-Modified-Since"] = memoryMetadata.lastModified;

      const response = await fetchImpl(remoteWidgetUrl, {
        headers,
        cache: "no-cache",
        signal: AbortSignal.timeout(10_000),
      });

      const checkedAt = Date.now();
      if (response.status === 304 && memoryHtml) {
        memoryMetadata = { ...memoryMetadata, checkedAt };
        await writeAtomic(metadataFile, `${JSON.stringify(memoryMetadata)}\n`);
        return memoryHtml;
      }

      if (!response.ok) {
        throw new Error(
          `Unable to load remote widget (${response.status} ${response.statusText}).`,
        );
      }

      const html = await response.text();
      if (!html.trim()) {
        throw new Error("Remote widget returned an empty document.");
      }

      memoryHtml = html;
      memoryMetadata = {
        url: remoteWidgetUrl,
        checkedAt,
        etag: response.headers?.get?.("etag") || null,
        lastModified: response.headers?.get?.("last-modified") || null,
      };
      await Promise.all([
        writeAtomic(htmlFile, html),
        writeAtomic(metadataFile, `${JSON.stringify(memoryMetadata)}\n`),
      ]);
      return html;
    })().finally(() => {
      refresh = null;
    });

    return refresh;
  }

  return async function loadRemoteWidget() {
    if (memoryHtml) {
      if (!isFresh(memoryMetadata)) void refreshWidget().catch(() => {});
      return memoryHtml;
    }

    if (!initialLoad) {
      initialLoad = (async () => {
        const cached = await readCachedWidget();
        if (cached) {
          memoryHtml = cached.html;
          memoryMetadata = cached.metadata;
          if (!isFresh(memoryMetadata)) void refreshWidget().catch(() => {});
          return memoryHtml;
        }
        return refreshWidget();
      })().finally(() => {
        initialLoad = null;
      });
    }

    return initialLoad;
  };
}

export { DEFAULT_REMOTE_WIDGET_URL, DEFAULT_WIDGET_MAX_AGE_MS };
