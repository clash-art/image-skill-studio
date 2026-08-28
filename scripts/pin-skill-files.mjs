#!/usr/bin/env node
// Writes `source.files` for every remote Skill in catalog/registry.json.
//
// Pinning the file list keeps on-demand fetching on raw.githubusercontent, which
// has no API rate limit; the anonymous GitHub API allows only 60 requests an
// hour. Uses the authenticated `gh` CLI, so it is a maintainer-only step.
//
//   npm run pin:skill-files
import { execFile } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import { PACKAGE_ROOT } from "../lib/package-root.mjs";
import { selectSkillFiles } from "../lib/skill-fetch.mjs";
import { normalizeRegistryDocument, REGISTRY_MANIFEST_PATH } from "../lib/skill-registry.mjs";

const run = promisify(execFile);

async function upstreamTree(repo, commit) {
  const { stdout } = await run(
    "gh",
    ["api", `repos/${repo}/git/trees/${commit}?recursive=1`, "--jq", "{truncated: .truncated, tree: [.tree[] | {path, type, size}]}"],
    { maxBuffer: 32 * 1024 * 1024 },
  );
  return JSON.parse(stdout);
}

const manifestPath = path.join(PACKAGE_ROOT, REGISTRY_MANIFEST_PATH);
const raw = await readFile(manifestPath, "utf8");
const document = JSON.parse(raw);
// Validate before touching anything so a broken feed fails early.
normalizeRegistryDocument(document);

let updated = 0;
for (const entry of document.skills) {
  if (entry.origin !== "remote" || !entry.source) continue;

  const skillPath = entry.source.skillPath || "SKILL.md";
  const directory = path.posix.dirname(skillPath) === "." ? "" : path.posix.dirname(skillPath);
  const { truncated, tree } = await upstreamTree(entry.source.repo, entry.source.commit);
  if (truncated) {
    console.error(`SKIP ${entry.id}: upstream tree is truncated`);
    continue;
  }

  const selection = selectSkillFiles(tree, { directory, excludePaths: entry.source.excludePaths || [] });
  entry.source.files = selection.files.map((file) => ({ path: file.path, size: file.size }));
  updated += 1;

  const kb = Math.round(selection.totalBytes / 1024);
  const skippedNote = selection.skipped.length ? ` (skipped ${selection.skipped.length})` : "";
  console.log(`${entry.id}: ${selection.files.length} files, ${kb} KB${skippedNote}`);
}

await writeFile(manifestPath, `${JSON.stringify(document, null, 2)}\n`);
normalizeRegistryDocument(JSON.parse(await readFile(manifestPath, "utf8")));
console.log(`\nPinned file lists for ${updated} upstream Skills.`);
