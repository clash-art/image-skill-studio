import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { loadSkillCatalog, parseSkillFrontmatter } from "../lib/skill-catalog.mjs";

test("parseSkillFrontmatter reads quoted and plain metadata", () => {
  const source = `---\nname: "paper-poster"\ndescription: Editorial poster generator\n---\n# Body`;

  assert.deepEqual(parseSkillFrontmatter(source), {
    name: "paper-poster",
    description: "Editorial poster generator",
  });
});

test("loadSkillCatalog isolates a broken skill and fingerprints valid content", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "image-skill-catalog-"));
  const validDir = path.join(root, "valid");
  await mkdir(validDir);
  await writeFile(
    path.join(validDir, "SKILL.md"),
    `---\nname: poster-maker\ndescription: Makes intentional posters.\n---\nInstructions`,
  );

  const catalog = await loadSkillCatalog([
    {
      id: "poster-maker",
      path: validDir,
      category: "海报",
      accent: "vermillion",
      capabilities: { references: true, aspectRatios: ["3:4", "1:1"] },
    },
    {
      id: "missing-skill",
      path: path.join(root, "missing"),
      category: "实验",
      accent: "ink",
      capabilities: { references: false, aspectRatios: ["3:4"] },
    },
  ]);

  assert.equal(catalog.length, 2);
  assert.equal(catalog[0].availability, "ready");
  assert.equal(catalog[0].displayName, "poster-maker");
  assert.match(catalog[0].contentHash, /^[a-f0-9]{12}$/);
  assert.equal(catalog[1].availability, "missing");
  assert.match(catalog[1].error, /SKILL\.md/);
});
