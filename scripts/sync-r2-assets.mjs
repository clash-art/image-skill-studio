import { access, mkdir, rm } from "node:fs/promises";
import { dirname, extname, resolve } from "node:path";
import { spawn } from "node:child_process";

import sharp from "sharp";
import registry from "../catalog/registry.json" with { type: "json" };

const projectRoot = resolve(import.meta.dirname, "..");
const wranglerBin = resolve(projectRoot, "node_modules/wrangler/bin/wrangler.js");
const bucket = process.env.IMAGE_SKILL_STUDIO_R2_BUCKET || "image-skill-studio-assets";
const concurrency = Math.max(1, Number(process.env.R2_SYNC_CONCURRENCY) || 6);
const previewsOnly = process.env.R2_SYNC_PREVIEWS_ONLY === "1";
const syncPrefix = String(process.env.R2_SYNC_PREFIX || "")
  .replace(/^\/+/, "")
  .replace(/^public\//, "")
  .replace(/^assets\//, "");
const previewRoot = resolve(projectRoot, ".r2-previews");
const previewVariants = [
  { name: "card", width: 640, quality: 82 },
  { name: "reference", width: 160, quality: 78 },
];
const contentTypes = new Map([
  [".gif", "image/gif"],
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".webp", "image/webp"],
]);

function isStudioOwned(skill, mediaOrigin) {
  return skill.origin !== "remote" || mediaOrigin === "studio";
}

function addAsset(target, skill, assetPath, mediaOrigin) {
  if (!assetPath || !isStudioOwned(skill, mediaOrigin)) return;
  target.add(assetPath);
}

function assetKey(assetPath) {
  if (/^https:\/\//i.test(assetPath)) {
    const pathname = new URL(assetPath).pathname;
    const marker = "/studio-assets/";
    const markerIndex = pathname.indexOf(marker);
    if (markerIndex === -1) throw new Error(`Unsupported Studio asset URL: ${assetPath}`);
    return decodeURIComponent(pathname.slice(markerIndex + marker.length));
  }
  return assetPath
    .replace(/^\/+/, "")
    .replace(/^public\//, "")
    .replace(/^assets\//, "");
}

function assetSourcePath(assetPath, key) {
  if (!/^https:\/\//i.test(assetPath)) {
    return assetPath.startsWith("/")
      ? resolve(projectRoot, "public", key)
      : resolve(projectRoot, assetPath);
  }
  return key.startsWith("catalog/")
    ? resolve(projectRoot, "public", key)
    : resolve(projectRoot, "assets", key);
}

const assetPaths = new Set();
for (const skill of registry.skills) {
  addAsset(assetPaths, skill, skill.cover, skill.coverOrigin);
  for (const example of skill.examples || []) {
    addAsset(assetPaths, skill, example.image, example.mediaOrigin);
    addAsset(assetPaths, skill, example.referenceImage, example.mediaOrigin);
  }
  for (const item of skill.gallery || []) addAsset(assetPaths, skill, item.image, item.mediaOrigin);
}

const sourceUploads = [...assetPaths]
  .map((assetPath) => {
    const key = assetKey(assetPath);
    const filePath = assetSourcePath(assetPath, key);
    return {
      assetPath,
      filePath,
      key,
      contentType: contentTypes.get(extname(assetPath).toLowerCase()) || "application/octet-stream",
    };
  })
  .filter(({ key }) => !syncPrefix || key.startsWith(syncPrefix));

await Promise.all(sourceUploads.map(({ filePath }) => access(filePath)));
await rm(previewRoot, { recursive: true, force: true });

const previewUploads = [];
for (const source of sourceUploads) {
  for (const variant of previewVariants) {
    const previewKey = `_preview/${variant.name}/${source.key.replace(/\.[^./]+$/, ".webp")}`;
    const previewPath = resolve(previewRoot, previewKey);
    await mkdir(dirname(previewPath), { recursive: true });
    await sharp(source.filePath)
      .rotate()
      .resize({ width: variant.width, withoutEnlargement: true })
      .webp({ quality: variant.quality, effort: 4 })
      .toFile(previewPath);
    previewUploads.push({
      assetPath: source.assetPath,
      filePath: previewPath,
      key: previewKey,
      contentType: "image/webp",
    });
  }
}

const uploads = previewsOnly ? previewUploads : [...sourceUploads, ...previewUploads];

let cursor = 0;
let completed = 0;

function upload({ filePath, key, contentType }) {
  return new Promise((resolveUpload, rejectUpload) => {
    const child = spawn(process.execPath, [
      wranglerBin,
      "r2",
      "object",
      "put",
      `${bucket}/${key}`,
      "--file",
      filePath,
      "--content-type",
      contentType,
      "--cache-control",
      "public, max-age=31536000, immutable",
      "--remote",
      "--force",
    ], { cwd: projectRoot, stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", rejectUpload);
    child.on("exit", (code) => {
      if (code !== 0) {
        rejectUpload(new Error(`Upload failed for ${key}: ${stderr.trim()}`));
        return;
      }
      completed += 1;
      process.stdout.write(`\rUploaded ${completed}/${uploads.length}`);
      resolveUpload();
    });
  });
}

async function worker() {
  while (cursor < uploads.length) {
    const uploadIndex = cursor;
    cursor += 1;
    await upload(uploads[uploadIndex]);
  }
}

console.log(`Syncing ${uploads.length} catalog assets to R2 bucket ${bucket}...`);
await Promise.all(Array.from({ length: Math.min(concurrency, uploads.length) }, () => worker()));
await rm(previewRoot, { recursive: true, force: true });
console.log("\nR2 asset sync complete.");
