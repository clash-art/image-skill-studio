import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  encodeContentPath,
  mergeRegistryDocuments,
  normalizeLicense,
  normalizeRegistryDocument,
  rankRegistrySkills,
  rawContentUrl,
  registryMediaRefs,
  REGISTRY_MANIFEST_PATH,
} from "../lib/skill-registry.mjs";

const pluginRoot = path.resolve(import.meta.dirname, "..");
const COMMIT = "0123456789abcdef0123456789abcdef01234567";

async function loadRealRegistry() {
  const raw = await readFile(path.join(pluginRoot, REGISTRY_MANIFEST_PATH), "utf8");
  return normalizeRegistryDocument(JSON.parse(raw));
}

function baseSkill(overrides = {}) {
  return {
    id: "sample-skill",
    origin: "remote",
    displayName: "Sample",
    description: "A sample skill.",
    source: { repo: "owner/repo", commit: COMMIT, skillPath: "SKILL.md" },
    ...overrides,
  };
}

function doc(skills) {
  return { version: 1, exampleSlotLimit: 10, gallerySlotLimit: 4, skills };
}

test("raw content URLs pin a commit and escape non-ASCII path segments", () => {
  assert.equal(
    rawContentUrl({ repo: "TaiT-tt/tait-crt-interface-skill", commit: COMMIT, path: "生成示例/经典a.png" }),
    `https://raw.githubusercontent.com/TaiT-tt/tait-crt-interface-skill/${COMMIT}/${encodeURIComponent("生成示例")}/${encodeURIComponent("经典a.png")}`,
  );
  assert.equal(encodeContentPath("a/b c/d.png"), "a/b%20c/d.png");
  assert.throws(() => rawContentUrl({ repo: "owner/repo", commit: "abc", path: "SKILL.md" }), /40-character commit/);
  assert.throws(() => rawContentUrl({ repo: "not-a-repo", commit: COMMIT, path: "SKILL.md" }), /Invalid registry repo/);
});

test("a missing or silent license grants nothing", () => {
  assert.deepEqual(normalizeLicense(null), {
    spdx: null,
    name: "未声明许可证",
    redistribute: false,
    commercial: false,
    note: undefined,
  });
  const partial = normalizeLicense({ spdx: "NOASSERTION", name: "Personal" });
  assert.equal(partial.redistribute, false);
  assert.equal(partial.commercial, false);
});

test("normalization rejects documents that could not be served safely", () => {
  assert.throws(() => normalizeRegistryDocument({ version: 2, skills: [] }), /Unsupported registry version/);
  assert.throws(() => normalizeRegistryDocument({ version: 1 }), /skills array/);
  assert.throws(() => normalizeRegistryDocument(doc([baseSkill({ id: "Not_Kebab" })])), /kebab-case/);
  assert.throws(
    () => normalizeRegistryDocument(doc([baseSkill(), baseSkill()])),
    /Duplicate registry skill id/,
  );
  assert.throws(
    () => normalizeRegistryDocument(doc([baseSkill({ source: undefined })])),
    /must declare a source/,
  );
  assert.throws(
    () => normalizeRegistryDocument(doc([baseSkill({ source: { repo: "owner/repo", commit: COMMIT, skillPath: "docs/readme.md" } })])),
    /must end in SKILL\.md/,
  );
  assert.throws(
    () => normalizeRegistryDocument(doc([baseSkill({ origin: "mirror" })])),
    /unknown origin/,
  );
});

test("slot limits are enforced so one entry can not flood the feed", () => {
  const normalized = normalizeRegistryDocument({
    version: 1,
    exampleSlotLimit: 2,
    gallerySlotLimit: 1,
    skills: [
      baseSkill({
        examples: [1, 2, 3, 4].map((n) => ({ id: `e${n}`, image: `e${n}.png`, prompt: `p${n}` })),
        gallery: [1, 2, 3].map((n) => ({ id: `g${n}`, image: `g${n}.png` })),
      }),
    ],
  });
  assert.equal(normalized.skills[0].examples.length, 2);
  assert.equal(normalized.skills[0].gallery.length, 1);
});

test("I2I example provenance survives normalization and studio assets stay local", () => {
  const normalized = normalizeRegistryDocument(doc([
    baseSkill({
      examples: [{
        id: "i2i-01",
        image: "assets/examples/sample-skill/i2i-01.png",
        prompt: "Restage the source as editorial paper art.",
        aspectRatio: "3:4",
        mode: "image-to-image",
        referenceImage: "assets/examples/sample-skill/references/ref-01-source.png",
        referenceRole: "composition",
        promptFile: "assets/examples/sample-skill/prompts/i2i-01.md",
        mediaOrigin: "studio",
      }],
    }),
  ]));
  const example = normalized.skills[0].examples[0];

  assert.equal(example.mode, "image-to-image");
  assert.equal(example.referenceImage, "assets/examples/sample-skill/references/ref-01-source.png");
  assert.equal(example.referenceRole, "composition");
  assert.equal(example.promptFile, "assets/examples/sample-skill/prompts/i2i-01.md");
  assert.equal(example.mediaOrigin, "studio");
  assert.deepEqual(registryMediaRefs(normalized.skills[0]), [
    {
      slot: "example",
      id: "i2i-01",
      kind: "local",
      file: "assets/examples/sample-skill/i2i-01.png",
    },
    {
      slot: "reference",
      id: "i2i-01",
      kind: "local",
      file: "assets/examples/sample-skill/references/ref-01-source.png",
    },
  ]);
});

test("I2I provenance rejects incomplete or invalid contracts", () => {
  assert.throws(
    () => normalizeRegistryDocument(doc([baseSkill({ examples: [{ id: "bad", image: "bad.png", mode: "image-to-image" }] })])),
    /referenceImage/,
  );
  assert.throws(
    () => normalizeRegistryDocument(doc([baseSkill({ examples: [{ id: "bad", image: "bad.png", mode: "video" }] })])),
    /mode/,
  );
});

test("ranking puts the host tool first, then stars, then unranked curation", () => {
  const ranked = rankRegistrySkills([
    { id: "curated-b", origin: "bundled", stars: null },
    { id: "low", origin: "remote", stars: 3 },
    { id: "host-tool", origin: "host", stars: null },
    { id: "high", origin: "remote", stars: 6156 },
    { id: "curated-a", origin: "bundled", stars: null },
    { id: "mid", origin: "remote", stars: 416 },
  ]);
  assert.deepEqual(ranked.map((skill) => skill.id), [
    "host-tool",
    "high",
    "mid",
    "low",
    "curated-b",
    "curated-a",
  ]);
});

test("ties keep their authored order", () => {
  const ranked = rankRegistrySkills([
    { id: "second", origin: "remote", stars: 3599 },
    { id: "first", origin: "remote", stars: 3599 },
  ]);
  assert.deepEqual(ranked.map((skill) => skill.id), ["second", "first"]);
});

test("a remote document replaces seed entries without ever emptying the feed", () => {
  const seed = normalizeRegistryDocument(doc([
    baseSkill({ id: "kept-locally", origin: "bundled", source: undefined }),
    baseSkill({ id: "shared", displayName: "Old name" }),
  ]));
  const remote = normalizeRegistryDocument(doc([
    baseSkill({ id: "shared", displayName: "New name" }),
    baseSkill({ id: "brand-new" }),
  ]));

  const merged = mergeRegistryDocuments({ seed, remote });
  assert.deepEqual(merged.skills.map((skill) => skill.id), ["shared", "brand-new", "kept-locally"]);
  assert.equal(merged.skills.find((skill) => skill.id === "shared").displayName, "New name");

  assert.equal(mergeRegistryDocuments({ seed, remote: null }), seed);
  assert.equal(mergeRegistryDocuments({ seed: null, remote }), remote);
});

test("remote refresh cannot replace a host Skill's bundled curation", () => {
  const seed = normalizeRegistryDocument(doc([
    baseSkill({
      id: "imagegen",
      origin: "host",
      source: undefined,
      cover: "assets/examples/imagegen/txt-01-v2.png",
      examples: Array.from({ length: 10 }, (_, index) => ({
        id: `local-${index}`,
        image: `assets/examples/imagegen/local-${index}.png`,
        prompt: `local ${index}`,
      })),
    }),
  ]));
  const remote = normalizeRegistryDocument(doc([
    baseSkill({
      id: "imagegen",
      origin: "host",
      source: undefined,
      description: "Fresh host description",
      examples: Array.from({ length: 4 }, (_, index) => ({
        id: `remote-${index}`,
        image: `remote-${index}.png`,
      })),
    }),
  ]));

  const merged = mergeRegistryDocuments({ seed, remote });
  assert.equal(merged.skills[0].description, "Fresh host description");
  assert.equal(merged.skills[0].examples.length, 10);
  assert.equal(merged.skills[0].examples[0].id, "local-0");
  assert.equal(merged.skills[0].cover, "assets/examples/imagegen/txt-01-v2.png");
});

test("media refs resolve remotely by commit and locally by file", () => {
  const normalized = normalizeRegistryDocument(doc([
    baseSkill({ cover: "examples/cover.png", gallery: [{ id: "g1", image: "examples/g1.png" }] }),
    baseSkill({ id: "local-skill", origin: "bundled", source: undefined, cover: "assets/previews/local.png" }),
  ]));

  const remoteRefs = registryMediaRefs(normalized.skills[0]);
  assert.equal(remoteRefs[0].slot, "cover");
  assert.equal(remoteRefs[0].kind, "remote");
  assert.match(remoteRefs[0].url, new RegExp(`/${COMMIT}/examples/cover\\.png$`));

  const localRefs = registryMediaRefs(normalized.skills[1]);
  assert.deepEqual(localRefs, [
    { slot: "cover", id: "local-skill", kind: "local", file: "assets/previews/local.png" },
  ]);
});

test("the shipped registry is valid and ordered by stars", async () => {
  const registry = await loadRealRegistry();
  assert.ok(registry.skills.length >= 16);

  const starred = registry.skills.filter((skill) => skill.stars != null).map((skill) => skill.stars);
  assert.deepEqual(starred, [...starred].sort((left, right) => right - left));
  assert.equal(registry.skills[0].id, "imagegen");
  assert.equal(registry.skills[0].origin, "host");
  assert.equal(Math.max(...starred), 6156);
});

test("only redistributable skills are vendored into the plugin", async () => {
  const registry = await loadRealRegistry();
  for (const skill of registry.skills) {
    if (skill.origin !== "bundled") continue;
    const skillFile = path.join(pluginRoot, "skills", skill.id, "SKILL.md");
    const info = await stat(skillFile);
    assert.ok(info.isFile(), `${skill.id} claims to be bundled and must ship SKILL.md`);
    if (skill.source) {
      assert.equal(
        skill.license.redistribute,
        true,
        `${skill.id} is vendored from ${skill.source.repo} and needs a license that permits redistribution`,
      );
    }
  }
});

test("every upstream skill is pinned, attributed, and carries a license verdict", async () => {
  const registry = await loadRealRegistry();
  const remote = registry.skills.filter((skill) => skill.origin === "remote");
  assert.ok(remote.length >= 13);

  for (const skill of remote) {
    assert.match(skill.source.commit, /^[0-9a-f]{40}$/, `${skill.id} must pin a commit`);
    assert.ok(skill.author?.name, `${skill.id} must credit an author`);
    assert.ok(skill.author?.url, `${skill.id} must link its author`);
    assert.ok(skill.source.homepage.startsWith("https://github.com/"), `${skill.id} must link upstream`);
    assert.equal(typeof skill.license.redistribute, "boolean");
    assert.ok(skill.license.name, `${skill.id} must state a license name`);
    if (!skill.license.spdx) {
      assert.ok(skill.license.note, `${skill.id} has no license and must explain the restriction`);
    }
  }
});

test("every upstream skill pins its file list so fetching avoids the GitHub API", async () => {
  const registry = await loadRealRegistry();

  for (const skill of registry.skills.filter((entry) => entry.origin === "remote")) {
    const files = skill.source.files;
    assert.ok(files.length > 0, `${skill.id} must pin source.files`);
    assert.ok(files.some((file) => file.path === "SKILL.md"), `${skill.id} must pin its SKILL.md`);

    const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
    assert.ok(
      totalBytes <= 20 * 1024 * 1024,
      `${skill.id} would download ${Math.round(totalBytes / 1024 / 1024)} MB, which is over budget`,
    );
    for (const file of files) {
      assert.doesNotMatch(file.path, /^\/|(^|\/)\.\.(\/|$)/, `${skill.id} pins an unsafe path: ${file.path}`);
      assert.doesNotMatch(file.path, /private-assets/, `${skill.id} pins a private path: ${file.path}`);
    }
  }
});

test("private upstream directories are never fetched", async () => {
  const registry = await loadRealRegistry();
  const heytea = registry.skills.find((skill) => skill.id === "heytea-doodle-poster");
  assert.deepEqual(heytea.source.excludePaths, ["private-assets"]);

  for (const skill of registry.skills) {
    for (const ref of registryMediaRefs(skill)) {
      assert.doesNotMatch(ref.url || ref.file, /private-assets|\/pay\//, `${skill.id} must not surface private media`);
    }
  }
});
