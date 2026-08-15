import assert from "node:assert/strict";
import { stat } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { DEFAULT_CATALOG_ENTRIES } from "../server/catalog-config.mjs";

const pluginRoot = path.resolve(import.meta.dirname, "..");

test("every featured image Skill ships a real four-work cold-start collection", async () => {
  assert.equal(DEFAULT_CATALOG_ENTRIES.length, 4);

  for (const skill of DEFAULT_CATALOG_ENTRIES) {
    assert.ok(skill.examples.length >= 4, `${skill.id} should have at least four examples`);
    assert.equal(new Set(skill.examples.map((example) => example.id)).size, skill.examples.length);
    assert.equal(new Set(skill.examples.map((example) => example.prompt)).size, skill.examples.length);

    for (const example of skill.examples) {
      const file = await stat(example.previewPath);
      assert.ok(file.isFile(), `${skill.id}/${example.id} should resolve to a real image`);
      assert.ok(file.size > 20_000, `${skill.id}/${example.id} should not be a placeholder`);
    }
  }
});

test("featured creative Skills are bundled in the plugin; ImageGen stays a host Skill", async () => {
  const imagegen = DEFAULT_CATALOG_ENTRIES.find((skill) => skill.id === "imagegen");
  assert.equal(imagegen.origin, "host");
  assert.match(imagegen.path.replaceAll("\\", "/"), /skills\/\.system\/imagegen$/);

  for (const skill of DEFAULT_CATALOG_ENTRIES.filter((entry) => entry.id !== "imagegen")) {
    assert.equal(skill.origin, "bundled");
    assert.equal(skill.path, path.join(pluginRoot, "skills", skill.id));
    const skillFile = await stat(path.join(skill.path, "SKILL.md"));
    assert.ok(skillFile.isFile(), `${skill.id} must ship SKILL.md inside the plugin`);
  }
});
