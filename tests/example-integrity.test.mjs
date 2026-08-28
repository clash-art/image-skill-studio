import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { normalizeRegistryDocument, REGISTRY_MANIFEST_PATH } from "../lib/skill-registry.mjs";

const root = path.resolve(import.meta.dirname, "..");
const hybrid = new Set([
  "gc-minimal-zine-poster-v0-1",
  "classic-epic-movie-poster",
]);

async function realFile(relativePath) {
  assert.match(relativePath || "", /^assets\/examples\//, `not a Studio example asset: ${relativePath}`);
  const absolute = path.join(root, relativePath);
  assert.ok((await stat(absolute)).isFile(), `missing file: ${relativePath}`);
  return absolute;
}

test("all 15 listed Skills ship ten unique, provenance-complete examples", async () => {
  const raw = JSON.parse(await readFile(path.join(root, REGISTRY_MANIFEST_PATH), "utf8"));
  const registry = normalizeRegistryDocument(raw);
  assert.equal(registry.skills.length, 15);

  for (const skill of registry.skills) {
    assert.equal(skill.examples.length, 10, `${skill.id}: expected exactly 10 examples`);
    const t2i = skill.examples.filter((example) => example.mode === "text-to-image");
    const i2i = skill.examples.filter((example) => example.mode === "image-to-image");
    if (hybrid.has(skill.id)) {
      assert.equal(t2i.length, 5, `${skill.id}: expected 5 T2I examples`);
      assert.equal(i2i.length, 5, `${skill.id}: expected 5 I2I examples`);
    } else {
      assert.equal(i2i.length, 10, `${skill.id}: expected 10 I2I examples`);
    }

    const hashes = new Set();
    const referenceUses = new Map();
    for (const example of skill.examples) {
      assert.ok(example.prompt?.trim(), `${skill.id}/${example.id}: missing prompt`);
      const image = await realFile(example.image);
      await realFile(example.promptFile);
      const digest = createHash("sha256").update(await readFile(image)).digest("hex");
      assert.ok(!hashes.has(digest), `${skill.id}: duplicate final image at ${example.id}`);
      hashes.add(digest);
      if (example.mode === "image-to-image") {
        await realFile(example.referenceImage);
        assert.match(example.referenceRole || "", /^(subject|style|composition|reference)$/);
        referenceUses.set(example.referenceImage, (referenceUses.get(example.referenceImage) || 0) + 1);
      }
    }
    for (const [reference, uses] of referenceUses) {
      assert.ok(uses <= 2, `${skill.id}: ${reference} is reused ${uses} times`);
    }
  }
});
