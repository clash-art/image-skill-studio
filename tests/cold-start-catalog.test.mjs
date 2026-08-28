import assert from "node:assert/strict";
import { stat } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { DEFAULT_CATALOG_ENTRIES } from "../server/catalog-config.mjs";

const pluginRoot = path.resolve(import.meta.dirname, "..");
const localEntries = DEFAULT_CATALOG_ENTRIES.filter((entry) => entry.origin !== "remote");
const remoteEntries = DEFAULT_CATALOG_ENTRIES.filter((entry) => entry.origin === "remote");

test("the offline seed ships two Skills with four real example slots each", async () => {
  assert.equal(localEntries.length, 2);

  for (const skill of localEntries) {
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

test("seed creative Skills are bundled in the plugin; ImageGen is not listed", async () => {
  const imagegen = DEFAULT_CATALOG_ENTRIES.find((skill) => skill.id === "imagegen");
  assert.equal(imagegen, undefined);

  for (const skill of localEntries) {
    assert.equal(skill.origin, "bundled");
    assert.equal(skill.path, path.join(pluginRoot, "skills", skill.id));
    const skillFile = await stat(path.join(skill.path, "SKILL.md"));
    assert.ok(skillFile.isFile(), `${skill.id} must ship SKILL.md inside the plugin`);
  }
});

test("curated upstream Skills keep instructions remote while Studio curation stays isolated", () => {
  assert.ok(remoteEntries.length >= 13);

  for (const skill of remoteEntries) {
    assert.equal(skill.path, null, `${skill.id} must have no local copy until the user fetches it`);
    assert.ok(skill.upstream?.repo, `${skill.id} must record its upstream repo`);
    assert.match(skill.upstream.commit, /^[0-9a-f]{40}$/, `${skill.id} must pin a commit`);
    if (skill.previewPath) {
      assert.ok(
        skill.previewPath.startsWith(path.join(pluginRoot, "assets", "examples", skill.id, path.sep)),
        `${skill.id} local previews must be Studio-generated curation`,
      );
    }
  }
});

test("upstream media is served from commit-pinned URLs", () => {
  for (const skill of remoteEntries) {
    const urls = [
      skill.previewUrl,
      ...skill.examples.map((example) => example.previewUrl),
      ...skill.gallery.map((item) => item.previewUrl),
    ].filter(Boolean);

    for (const url of urls) {
      assert.ok(url.startsWith("https://raw.githubusercontent.com/"), `${skill.id} media must be an https raw URL`);
      assert.ok(
        url.includes(`/${skill.upstream.commit}/`),
        `${skill.id} media must be pinned to the recorded commit`,
      );
    }
  }
});

test("the feed ranks listed Skills by stars", () => {
  const starred = DEFAULT_CATALOG_ENTRIES.map((entry) => entry.stars).filter((stars) => stars != null);
  assert.deepEqual(starred, [...starred].sort((left, right) => right - left));
});
