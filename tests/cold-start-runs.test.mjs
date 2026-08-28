import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { DEFAULT_CATALOG_ENTRIES, EXAMPLE_SLOT_LIMIT, loadCatalogManifest } from "../server/catalog-config.mjs";

const root = path.resolve(import.meta.dirname, "..");

test("the App does not seed generated work from static run assets", async () => {
  const [catalog, server] = await Promise.all([
    readFile(new URL("../server/catalog-config.mjs", import.meta.url), "utf8"),
    readFile(new URL("../server/studio-server.mjs", import.meta.url), "utf8"),
  ]);
  assert.doesNotMatch(catalog, /COLD_START_RUN_SEEDS|DEFAULT_RUN_SEEDS|assets\/runs\//);
  assert.doesNotMatch(server, /seedIfEmpty|runSeeds|DEFAULT_RUN_SEEDS/);
});

test("official example slots come from catalog/registry.json", async () => {
  const manifest = loadCatalogManifest(root);
  assert.equal(manifest.exampleSlotLimit, 10);
  assert.equal(EXAMPLE_SLOT_LIMIT, 10);
  assert.equal(DEFAULT_CATALOG_ENTRIES.length, manifest.skills.length);

  for (const skill of DEFAULT_CATALOG_ENTRIES) {
    assert.ok(skill.examples.length <= EXAMPLE_SLOT_LIMIT, `${skill.id} cannot exceed the example slot limit`);
  }

  // Promptable example slots are curated locally, so their images must ship.
  for (const skill of DEFAULT_CATALOG_ENTRIES.filter((entry) => entry.origin !== "remote")) {
    assert.ok(skill.examples.length >= 1, `${skill.id} needs at least one official example`);
    for (const example of skill.examples) {
      const file = await stat(example.previewPath);
      assert.ok(file.isFile() && file.size > 20_000, `${skill.id}/${example.id} needs a real example image`);
    }
  }
});
