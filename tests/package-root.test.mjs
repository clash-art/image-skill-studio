import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { PACKAGE_ROOT } from "../lib/package-root.mjs";

test("PACKAGE_ROOT is the directory that contains the plugin package", async () => {
  assert.equal(PACKAGE_ROOT, path.resolve(import.meta.dirname, ".."));
  await access(path.join(PACKAGE_ROOT, "package.json"));
  await access(path.join(PACKAGE_ROOT, "skills", "image-skill-studio", "SKILL.md"));
});
