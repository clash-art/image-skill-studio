#!/usr/bin/env node
// Checks that every pinned upstream URL in catalog/registry.json still resolves.
// Run before publishing a feed change: npm run verify:registry
import { readFile } from "node:fs/promises";
import path from "node:path";

import { PACKAGE_ROOT } from "../lib/package-root.mjs";
import {
  normalizeRegistryDocument,
  rawContentUrl,
  registryMediaRefs,
  REGISTRY_MANIFEST_PATH,
} from "../lib/skill-registry.mjs";

const CONCURRENCY = 6;

async function head(url) {
  try {
    const response = await fetch(url, { method: "HEAD", redirect: "follow" });
    return { url, ok: response.ok, status: response.status };
  } catch (error) {
    return { url, ok: false, status: 0, error: error instanceof Error ? error.message : String(error) };
  }
}

async function mapLimited(items, limit, worker) {
  const results = [];
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (cursor < items.length) {
        const index = cursor++;
        results[index] = await worker(items[index]);
      }
    }),
  );
  return results;
}

const raw = await readFile(path.join(PACKAGE_ROOT, REGISTRY_MANIFEST_PATH), "utf8");
const registry = normalizeRegistryDocument(JSON.parse(raw));

const targets = [];
for (const skill of registry.skills) {
  if (skill.origin !== "remote") continue;
  targets.push({ skill: skill.id, label: "SKILL.md", url: rawContentUrl({ ...skill.source, path: skill.source.skillPath }) });
  for (const ref of registryMediaRefs(skill)) {
    if (ref.kind === "remote") targets.push({ skill: skill.id, label: `${ref.slot}:${ref.id}`, url: ref.url });
  }
}

console.log(`Checking ${targets.length} pinned URLs across ${new Set(targets.map((t) => t.skill)).size} upstream skills…\n`);
const checked = await mapLimited(targets, CONCURRENCY, async (target) => ({ ...target, ...(await head(target.url)) }));
const failures = checked.filter((result) => !result.ok);

for (const failure of failures) {
  console.error(`FAIL ${failure.skill} ${failure.label} → ${failure.status} ${failure.error || ""}`);
  console.error(`     ${failure.url}`);
}

console.log(`\n${checked.length - failures.length}/${checked.length} URLs resolved.`);
if (failures.length) process.exitCode = 1;
