import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  HOST_SKILL_DIR,
  installStudioSkill,
  registerStudioSkill,
  validateStudioSkillSource,
} from "../lib/studio-skill-registry.mjs";

async function writeSkill(dir, { name = "paper-poster", description = "Makes editorial paper posters for Codex." } = {}) {
  await mkdir(dir, { recursive: true });
  await writeFile(
    path.join(dir, "SKILL.md"),
    `---\nname: ${name}\ndescription: ${description}\n---\n# ${name}\n\nUse this method to compose one image.\n`,
  );
  return dir;
}

test("validateStudioSkillSource requires a readable SKILL.md with kebab-case name and description", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "studio-skill-validate-"));
  await mkdir(path.join(root, "empty"));
  assert.equal((await validateStudioSkillSource(path.join(root, "missing"))).ok, false);
  assert.match((await validateStudioSkillSource(path.join(root, "empty"))).message, /SKILL\.md/);

  const unnamed = path.join(root, "unnamed");
  await mkdir(unnamed);
  await writeFile(path.join(unnamed, "SKILL.md"), `---\ndescription: No name here.\n---\nBody\n`);
  assert.match((await validateStudioSkillSource(unnamed)).message, /name/);

  const badName = path.join(root, "bad-name");
  await writeSkill(badName, { name: "Paper Poster" });
  assert.match((await validateStudioSkillSource(badName)).message, /kebab-case|小写/);

  const reserved = path.join(root, "reserved");
  await writeSkill(reserved, { name: "imagegen" });
  assert.match((await validateStudioSkillSource(reserved)).message, /imagegen/);

  const valid = await writeSkill(path.join(root, "paper-poster"));
  const result = await validateStudioSkillSource(valid);
  assert.equal(result.ok, true);
  assert.equal(result.skill.id, "paper-poster");
  assert.equal(result.skill.directory, path.resolve(valid));
});

test("registerStudioSkill copies a validated skill into Studio and rejects collisions without overwrite", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "studio-skill-register-"));
  const source = await writeSkill(path.join(root, "source", "paper-poster"));
  await writeFile(path.join(source, "notes.md"), "Keep this supporting file.\n");
  const dataRoot = path.join(root, "studio");

  const registered = await registerStudioSkill({ sourcePath: source, dataRoot });
  assert.equal(registered.ok, true);
  assert.equal(registered.skill.id, "paper-poster");
  assert.equal(
    await readFile(path.join(dataRoot, "skills", "paper-poster", "notes.md"), "utf8"),
    "Keep this supporting file.\n",
  );

  const duplicate = await registerStudioSkill({ sourcePath: source, dataRoot });
  assert.equal(duplicate.ok, false);
  assert.match(duplicate.message, /已经注册/);

  await writeFile(path.join(source, "SKILL.md"), `---\nname: paper-poster\ndescription: Updated editorial paper posters.\n---\n# Updated\n`);
  const overwritten = await registerStudioSkill({ sourcePath: source, dataRoot, overwrite: true });
  assert.equal(overwritten.ok, true);
  assert.match(await readFile(path.join(dataRoot, "skills", "paper-poster", "SKILL.md"), "utf8"), /Updated editorial/);
});

test("installStudioSkill publishes a Studio skill into the host Codex skills directory", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "studio-skill-install-"));
  const dataRoot = path.join(root, "studio");
  const hostSkillsDir = path.join(root, "codex-skills");
  const source = await writeSkill(path.join(root, "source", "paper-poster"));
  await registerStudioSkill({ sourcePath: source, dataRoot });

  const blocked = await installStudioSkill({
    skillId: "imagegen",
    dataRoot,
    hostSkillsDir,
    catalog: [{ id: "imagegen", origin: "host", skillPath: path.join(hostSkillsDir, ".system", "imagegen", "SKILL.md") }],
  });
  assert.equal(blocked.ok, false);

  const installed = await installStudioSkill({
    skillId: "paper-poster",
    dataRoot,
    hostSkillsDir,
  });
  assert.equal(installed.ok, true);
  assert.equal(installed.destination, path.join(hostSkillsDir, "paper-poster"));
  assert.match(await readFile(path.join(hostSkillsDir, "paper-poster", "SKILL.md"), "utf8"), /paper-poster/);

  const duplicate = await installStudioSkill({ skillId: "paper-poster", dataRoot, hostSkillsDir });
  assert.equal(duplicate.ok, false);
  assert.match(duplicate.message, /已经存在/);
});

test("HOST_SKILL_DIR is the user Codex skills directory, not .system", () => {
  assert.match(HOST_SKILL_DIR, /skills$/);
  assert.doesNotMatch(HOST_SKILL_DIR, /\.system/);
});
