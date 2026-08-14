import assert from "node:assert/strict";
import { stat } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { COLD_START_RUN_SEEDS } from "../lib/cold-start-run-seeds.mjs";
import { DEFAULT_CATALOG_ENTRIES, DEFAULT_RUN_SEEDS } from "../server/catalog-config.mjs";

const root = path.resolve(import.meta.dirname, "..");

test("cold-start generated work is distinct from Skill examples", async () => {
  assert.equal(COLD_START_RUN_SEEDS.length, 8);
  const perSkill = new Map();
  const examplePaths = new Set(
    DEFAULT_CATALOG_ENTRIES.flatMap((skill) => skill.examples.map((example) => path.resolve(example.previewPath))),
  );

  for (const seed of COLD_START_RUN_SEEDS) {
    perSkill.set(seed.skillId, (perSkill.get(seed.skillId) || 0) + 1);
    assert.ok(seed.prompt.length > 20, `${seed.id} needs a real generation prompt`);
    assert.equal(seed.aspectRatio, "3:4");
    assert.match(seed.publicUrl, new RegExp(`^/runs/${seed.skillId}/`));
    const artifactPath = path.resolve(root, seed.assetPath);
    assert.ok(!examplePaths.has(artifactPath), `${seed.id} must not reuse a Skill example`);
    const artifact = await stat(artifactPath);
    assert.ok(artifact.isFile() && artifact.size > 20_000, `${seed.id} needs a real generated image`);
  }

  assert.deepEqual([...perSkill.values()].sort(), [2, 2, 2, 2]);
  assert.equal(DEFAULT_RUN_SEEDS.length, COLD_START_RUN_SEEDS.length);
  assert.ok(DEFAULT_RUN_SEEDS.every((seed) => path.isAbsolute(seed.artifactPath)));
});
